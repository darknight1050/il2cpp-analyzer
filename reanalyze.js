require('dotenv').config()

const crash = require('./dbmodels/crash')
const mongoose = require("mongoose");
const { getBeatsaberVersionFromStacktrace, loadVersions } = require('./analyzer');

// Script to reanalyze all the data in the database
async function analyze() {
    // Load the versions of older crashes
    await loadVersions();
    await mongoose.connect(process.env.MONGODB_URI, async () => {
        // Find all crashes with empty gameversion
        const cursor = crash.find({ gameVersion: undefined }).cursor();
        let count = 0;
        let saved = 0;
        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        
            if (doc.original || doc.stacktrace ) { 
                let version = getBeatsaberVersionFromStacktrace(doc.original || doc.stacktrace);
                if (version) {
                    console.log(version);
                    doc.gameVersion = version;
                    await doc.save();
                    saved++;
                }
            }
            console.log(`Analyzed ${++count} crashes, saved ${saved}.`);
        }
        mongoose.disconnect();
    });



}
analyze();