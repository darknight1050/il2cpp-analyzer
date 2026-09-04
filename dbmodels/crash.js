const mongoose = require("mongoose");
const { indexCrash } = require("../storage/elasticsearch");

const crashSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            required: true,
            alias: "crashId",
        },
        userId: { type: String, required: true, index: true },
        libIl2CppBuildID: { type: String, required: false },
        original: { type: String, required: true },
        uploadDate: { type: Date, required: true },
        stacktrace: { type: String },
        log: { type: String },
        gameVersion: { type: String },
        mods: {
            type: [
                {
                    _id: false,
                    name: { type: String, required: true },
                    version: { type: String, required: true },
                },
            ],
            default: undefined,
        },
        // Parsed fields
        backtrace: { type: String },
        header: { type: String },
        // We don't use these fields for searching and parsing them is fast enough so we won't save them for now
        // stack: { type: String },
        // registers: { type: String },
    },
    { strict: false }
);

crashSchema.set("toJSON", {
    transform: function (doc, ret, options) {
        ret.crashId = ret._id;
        delete ret._id;
        delete ret.__v;
    },
});

// ElasticSearch indexing. This used to be the mongoosastic plugin's post-save
// hook; it now goes through our own client so we aren't tied to that package's
// pinned ElasticSearch 7 / mongoose 6 dependencies.
// Indexing failures must not fail the crash upload itself, so they are logged
// rather than propagated - MongoDB stays the source of truth and the index can
// always be rebuilt with `npm run recreateIndex`.
crashSchema.post("save", function (doc) {
    indexCrash(doc).catch((e) =>
        console.error(
            "Failed to index crash " + doc._id + " in ElasticSearch: " + e.message
        )
    );
});

module.exports = mongoose.model("Crash", crashSchema);
