const mongoose = require("mongoose");

const crashSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true, alias: "crashId" },
        userId: { type: String, required: true, index: true },
        original: { type: String, required: true },
        uploadDate: { type: Date, required: true },
        stacktrace: { type: String },
        log: { type: String },
        mods: [{
            name: { type: String, required: true },
            version: { type: String, required: true },
        }],
    },
    { strict: false }
);

crashSchema.set("toJSON", {
    transform: function (doc, ret, options) {
        ret.crashId = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

crashSchema.index({
    stacktrace: "text",
});

module.exports = mongoose.model("Crash", crashSchema);
