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
async function recreateIndex() {
    await mongoose.connect(process.env.MONGODB_URI);
    try {
        await recreateEsIndex();

        const cursor = crash.find({}).batchSize(BATCH_SIZE).cursor();
        let batch = [];
        let indexed = 0;
        const failed = [];

        const flush = async () => {
            if (batch.length === 0) return;
            const result = await bulkIndexCrashes(batch);
            indexed += result.indexed;
            failed.push(...result.failed);
            batch = [];
            console.log(`Indexed ${indexed} documents.`);
        };

        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
            batch.push(doc);
            if (batch.length >= BATCH_SIZE) await flush();
        }
        await flush();

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
