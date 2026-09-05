require("dotenv").config({
  path: require("path").join(__dirname, "../.env"),
  quiet: true,
});

const crash = require("../dbmodels/crash");
const mongoose = require("mongoose");
const {
  getBeatsaberVersionFromStacktrace,
  loadVersions,
  splitStacktrace,
} = require("../analyzer");

// Script to reanalyze all the data in the database
async function analyze() {
  // Load the versions of older crashes
  await loadVersions();
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    // Find all crashes with empty gameversion.
    // Paginated on _id rather than a cursor: analysing and saving each
    // document is slow, and a cursor left idle longer than MongoDB's
    // cursorTimeoutMillis (10 minutes) is reaped, failing the run with
    // "cursor id ... not found".
    const BATCH_SIZE = 200;
    const filter = {
      $or: [
        { gameVersion: { $exists: false } },
        { header: { $exists: false } },
      ],
    };

    let lastId = null;
    let count = 0;
    let saved = 0;

    for (;;) {
      const page = await crash
        .find(
          lastId == null
            ? filter
            : { $and: [filter, { _id: { $gt: lastId } }] },
        )
        .sort({ _id: 1 })
        .limit(BATCH_SIZE)
        .exec();
      if (page.length === 0) break;
      lastId = page[page.length - 1]._id;

      for (const doc of page) {
        if (doc.original || doc.stacktrace) {
          //
          let changed = false;

          // Parse the game version
          let version = getBeatsaberVersionFromStacktrace(
            doc.original || doc.stacktrace,
          );

          if (version) {
            console.log(version);
            doc.gameVersion = version;
            changed = true;
          }

          // Split the stacktrace
          if (doc.stacktrace) {
            try {
              const splitStack = splitStacktrace(doc.stacktrace);

              doc.header = splitStack.header;
              doc.backtrace = splitStack.backtrace;
              // Don't save the stack and registers for now
              // doc.stack = splitStack.stack;
              // doc.registers = splitStack.registers;
              changed = true;
            } catch (e) {
              console.error(
                "Failed to split stacktrace for crash " + doc._id + "!",
              );
              console.error(e);
            }
          }

          if (changed) {
            await doc.save();
            saved++;
          }
        }
        console.log(`Analyzed ${++count} crashes, saved ${saved}.`);
      }
    }
  } finally {
    await mongoose.disconnect();
  }
}
analyze().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
