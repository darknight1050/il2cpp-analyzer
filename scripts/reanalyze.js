require('dotenv').config()

const crash = require('../dbmodels/crash')
const mongoose = require("mongoose");
const { getBeatsaberVersionFromStacktrace, loadVersions, splitStacktrace } = require('../analyzer');

// Script to reanalyze all the data in the database
async function analyze() {
    // Load the versions of older crashes
    await loadVersions();
    mongoose.connect(process.env.MONGODB_URI, async () => {
        // Find all crashes with empty gameversion
        const cursor = crash.find({ "$or": [
            { "gameVersion": { "$exists": false } },
            { "header": { "$exists": false } },
        ]
        }).cursor();
        
        let count = 0;
        let saved = 0;
        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        
            if (doc.original || doc.stacktrace ) { 
                // 
                let changed = false;

                // Parse the game version
                let version = getBeatsaberVersionFromStacktrace(doc.original || doc.stacktrace);
                
                if (version) {
                    console.log(version);
                    doc.gameVersion = version;
                    changed = true;
                }

                // Split the stacktrace
                if (doc.stacktrace) {
                    const splitStack = splitStacktrace(doc.stacktrace);
                    if (splitStack && splitStack.header && splitStack.backtrace && splitStack.registers) {
                        doc.stack = splitStack.stack;
                        doc.header = splitStack.header;
                        doc.backtrace = splitStack.backtrace;
                        doc.registers = splitStack.registers;
                        changed = true;
                    } else {
                        console.error("Failed to split stacktrace for crash " + doc._id + "!");
                    }
                }

                if (changed) {
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