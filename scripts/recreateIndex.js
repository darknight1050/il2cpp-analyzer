require("dotenv").config({
  path: require("path").join(__dirname, "../.env"),
  quiet: true,
});

const crash = require("../dbmodels/crash");
const mongoose = require("mongoose");
const {
  recreateIndex: recreateEsIndex,
  bulkIndexCrashes,
  refresh,
  close,
} = require("../storage/elasticsearch");

const BATCH_SIZE = 500;

// Script to rebuild the ElasticSearch index from MongoDB, which is the source
// of truth. Drops the index first so it comes back with the current mapping -
// this is also the migration path when the mapping changes.
//
//   node scripts/recreateIndex.js              rebuild from scratch
//   node scripts/recreateIndex.js --resume ID  continue after ID, keeping the
//                                              existing index (ID is the last
//                                              one the previous run printed)
async function recreateIndex() {
  const resumeArg = process.argv.indexOf("--resume");
  const resumeFrom = resumeArg === -1 ? null : process.argv[resumeArg + 1];

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    if (resumeFrom) {
      console.log(`Resuming after ${resumeFrom}; keeping the existing index.`);
    } else {
      await recreateEsIndex();
    }

    // Paginate on _id rather than holding a cursor open. Indexing a batch
    // can take minutes, and MongoDB reaps cursors that sit idle for longer
    // than cursorTimeoutMillis (10 minutes by default), which used to kill
    // long rebuilds with "cursor id ... not found". Each page is its own
    // short query, so nothing is left open across the ElasticSearch work.
    let lastId = resumeFrom;
    let indexed = 0;
    const failed = [];

    for (;;) {
      const filter = lastId == null ? {} : { _id: { $gt: lastId } };
      const batch = await crash
        .find(filter)
        .sort({ _id: 1 })
        .limit(BATCH_SIZE)
        .exec();
      if (batch.length === 0) break;

      lastId = batch[batch.length - 1]._id;
      const result = await bulkIndexCrashes(batch);
      indexed += result.indexed;
      failed.push(...result.failed);
      // Printing the id makes an interrupted run resumable.
      console.log(`Indexed ${indexed} documents (through ${lastId}).`);
    }

    await refresh();
    console.log(`Done. Indexed ${indexed} documents.`);
    if (failed.length > 0) {
      // Report rather than fail silently: these crashes stay in MongoDB
      // but will not turn up in search until the cause is fixed.
      console.error(`${failed.length} document(s) could not be indexed:`);
      for (const f of failed.slice(0, 20)) {
        console.error(`  ${f.id}: ${f.error}`);
      }
      if (failed.length > 20) {
        console.error(`  ... and ${failed.length - 20} more`);
      }
      process.exitCode = 1;
    }
  } finally {
    await mongoose.disconnect();
    await close();
  }
}
recreateIndex().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
