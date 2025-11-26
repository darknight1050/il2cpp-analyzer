require("dotenv").config({path: "../.env"});

const crash = require("../dbmodels/crash");
const mongoose = require("mongoose");

async function compact() {
    mongoose.connect(process.env.MONGODB_URI, async () => {
        const result = await mongoose.connection.db.command({ compact: 'crashes' });
        console.log('Compact result:', result);
    });
}
compact();
