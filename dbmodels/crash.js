const mongoose = require("mongoose");

const crashSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true, alias: "crashId" },
        userId: { type: String, required: true, index: true },
        original: { type: String, required: true },
        uploadDate: { type: Date, required: true },
        stacktrace: { type: String },
        log: { type: String },
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

module.exports = mongoose.model("Crash", crashSchema);
