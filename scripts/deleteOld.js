require("dotenv").config({path: "../.env"});

const crash = require("../dbmodels/crash");
const mongoose = require("mongoose");
const mongoosastic = require("mongoosastic");

const cutoff = new Date(Date.now() - 150 * 24 * 60 * 60 * 1000);
const { Client } = require('@elastic/elasticsearch');

const esClient = new Client({
  node: 'http://localhost:9200'
});

async function deleteCrashes() {
    mongoose.connect(process.env.MONGODB_URI, async () => {
        const oldIds = await crash.find(
            { uploadDate: { $lt: cutoff } },
            { _id: 1 }
        )
        .limit(100000)
        .lean();
       
        if (oldIds.length === 0) return;
        const idsToDelete = oldIds.map(d => d._id);
        console.log(`Found ${oldIds.length} crashes to delete.`);
        const first = await crash.findById(idsToDelete[0]);
        console.log(first.uploadDate);
        const last = await crash.findById(idsToDelete[idsToDelete.length - 1]);
        console.log(last.uploadDate);
        // 2. Delete those documents
        await crash.deleteMany({ _id: { $in: idsToDelete } });
        console.log(`Deleted ${oldIds.length} crashes.`);
        const body = idsToDelete.flatMap(id => [
            { delete: { _index: 'crashId', _id: id } }
        ]);

        await esClient.bulk({ refresh: true, body });
        mongoose.disconnect();
    });
}
deleteCrashes();
