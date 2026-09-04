require("dotenv").config({
    path: require("path").join(__dirname, "../.env"),
    quiet: true,
});

const crash = require("../dbmodels/crash");
const mongoose = require("mongoose");
const { bulkDeleteCrashes, close } = require("../storage/elasticsearch");

const cutoff = new Date(Date.now() - 150 * 24 * 60 * 60 * 1000);

async function deleteCrashes() {
    await mongoose.connect(process.env.MONGODB_URI);
    try {
        const oldIds = await crash
            .find({ uploadDate: { $lt: cutoff } }, { _id: 1 })
            .limit(100000)
            .lean();

        if (oldIds.length === 0) return;
        const idsToDelete = oldIds.map((d) => d._id);
        console.log(`Found ${oldIds.length} crashes to delete.`);
        const first = await crash.findById(idsToDelete[0]);
        console.log(first.uploadDate);
        const last = await crash.findById(idsToDelete[idsToDelete.length - 1]);
        console.log(last.uploadDate);
        // 2. Delete those documents
        await crash.deleteMany({ _id: { $in: idsToDelete } });
        console.log(`Deleted ${oldIds.length} crashes.`);

        await bulkDeleteCrashes(idsToDelete);
        console.log(`Removed ${idsToDelete.length} crashes from ElasticSearch.`);
    } finally {
        await mongoose.disconnect();
        await close();
    }
}
deleteCrashes().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
