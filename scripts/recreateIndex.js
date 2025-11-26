require("dotenv").config({path: "../.env"});

const crash = require("../dbmodels/crash");
const mongoose = require("mongoose");

// Script to reanalyze all the data in the database
async function recreateIndex() {
    // Load the versions of older crashes
    // await loadVersions();
    mongoose.connect(process.env.MONGODB_URI, async () => {
        await sync();
        mongoose.disconnect();
    });
}
recreateIndex();
function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // busy wait
  }
}
function sync() {
    return new Promise((resolve, reject) => {
        const stream = crash.synchronize();
        let count = 0;

        stream.on("data", function (err, doc) {
            count++;
            console.log("indexed " + count + " document");
            sleepSync(2);
        });

        stream.on("close", async function () {
            resolve();
        });

        stream.on("error", function (err) {
            console.log(err);
            resolve();
        });
    });
}
