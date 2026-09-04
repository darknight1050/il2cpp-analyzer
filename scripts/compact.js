require("dotenv").config({
    path: require("path").join(__dirname, "../.env"),
    quiet: true,
});

const crash = require("../dbmodels/crash");
const mongoose = require("mongoose");

async function compact() {
    await mongoose.connect(process.env.MONGODB_URI);
    try {
        const result = await mongoose.connection.db.command({
            compact: "crashes",
        });
        console.log("Compact result:", result);
    } finally {
        await mongoose.disconnect();
    }
}
compact().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
