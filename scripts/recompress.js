require("dotenv").config({
  path: require("path").join(__dirname, "../.env"),
  quiet: true,
});

const mongoose = require("mongoose");
const { withRetry } = require("./retry");

// Rewrites the crashes collection with zstd block compression instead of the
// WiredTiger snappy default. Measured on real crash data at 17.8x versus
// snappy's 4.9x, so expect roughly 3.6x less disk.
//
// WiredTiger fixes the block compressor when a collection is created, so the
// only way to change it is to rewrite the data into a new collection.
//
//   node scripts/recompress.js             copy into crashes_zstd, verify, stop
//   node scripts/recompress.js --swap      ... then swap it in (keeps a backup)
//   node scripts/recompress.js --resume ID continue an interrupted copy
//
// STOP THE APP FIRST. Documents written while the copy runs are not picked up.
// Needs free disk for the copy alongside the original until the old collection
// is dropped.

const SOURCE = "crashes";
const TARGET = "crashes_zstd";
const BACKUP = "crashes_snappy_backup";
const BATCH_SIZE = 200;

async function recompress() {
  const swap = process.argv.includes("--swap");
  const resumeArg = process.argv.indexOf("--resume");
  const resumeFrom = resumeArg === -1 ? null : process.argv[resumeArg + 1];

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  try {
    const names = (await db.listCollections().toArray()).map((c) => c.name);
    if (!names.includes(SOURCE)) throw new Error(`no "${SOURCE}" collection`);
    if (names.includes(BACKUP)) {
      throw new Error(
        `"${BACKUP}" already exists - a previous run swapped already; ` +
          `drop it once you are happy, or rename it back first`,
      );
    }

    if (!resumeFrom) {
      await db
        .collection(TARGET)
        .drop()
        .catch(() => {});
      await db.createCollection(TARGET, {
        storageEngine: {
          wiredTiger: { configString: "block_compressor=zstd" },
        },
      });
      console.log(`Created ${TARGET} with block_compressor=zstd.`);
    } else {
      console.log(`Resuming copy after ${resumeFrom}.`);
    }

    const source = db.collection(SOURCE);
    const target = db.collection(TARGET);
    const total = await source.estimatedDocumentCount();
    let lastId = resumeFrom;
    let copied = 0;

    for (;;) {
      const filter = lastId == null ? {} : { _id: { $gt: lastId } };
      const batch = await withRetry("reading batch", () =>
        source.find(filter).sort({ _id: 1 }).limit(BATCH_SIZE).toArray(),
      );
      if (batch.length === 0) break;
      lastId = batch[batch.length - 1]._id;
      // ordered:false so one bad document cannot stall the whole copy
      await withRetry("writing batch", () =>
        target.insertMany(batch, { ordered: false }),
      );
      copied += batch.length;
      console.log(`Copied ${copied}/~${total} documents (through ${lastId}).`);
    }

    // Recreate the non-_id indexes the schema declares.
    for (const idx of await source.indexes()) {
      if (idx.name === "_id_") continue;
      await target.createIndex(idx.key, {
        name: idx.name,
        unique: !!idx.unique,
      });
      console.log(`Recreated index ${idx.name}.`);
    }

    const srcCount = await source.countDocuments();
    const dstCount = await target.countDocuments();
    const srcStats = await db.command({ collStats: SOURCE });
    const dstStats = await db.command({ collStats: TARGET });
    console.log(
      `\n${SOURCE}: ${srcCount} docs, ${(srcStats.storageSize / 1e9).toFixed(2)} GB on disk` +
        `\n${TARGET}: ${dstCount} docs, ${(dstStats.storageSize / 1e9).toFixed(2)} GB on disk` +
        `\nsaving: ${((1 - dstStats.storageSize / srcStats.storageSize) * 100).toFixed(1)}%\n`,
    );

    if (srcCount !== dstCount) {
      throw new Error(
        `document counts differ (${srcCount} vs ${dstCount}) - not swapping`,
      );
    }

    if (!swap) {
      console.log(
        `Counts match. Re-run with --swap to put ${TARGET} live ` +
          `(the old collection is kept as ${BACKUP}).`,
      );
      return;
    }

    await source.rename(BACKUP);
    await target.rename(SOURCE);
    console.log(
      `Swapped. ${SOURCE} is now zstd; the previous data is in ${BACKUP}.\n` +
        `Drop it with db.${BACKUP}.drop() once you are satisfied.`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

recompress().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
