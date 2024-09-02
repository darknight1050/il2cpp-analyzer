const mongoose = require("mongoose");
const mongoosastic = require("mongoosastic");

const crashSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            required: true,
            alias: "crashId",
            es_indexed: true,
        },
        userId: { type: String, required: true, index: true, es_indexed: true },
        libIl2CppBuildID: { type: String, required: false },
        original: { type: String, required: true },
        uploadDate: {
            type: Date,
            required: true,
            es_indexed: true,
            es_type: "date",
        },
        stacktrace: { type: String },
        log: { type: String, es_indexed: true, es_type: "text" },
        gameVersion: { type: String, es_indexed: true, es_type: "keyword" },
        mods: {
            type: [
                {
                    _id: false,
                    name: { type: String, required: true, es_type: "keyword" },
                    version: {
                        type: String,
                        required: true,
                        es_type: "keyword",
                    },
                },
            ],
            es_indexed: true,
            es_type: "nested",
            default: undefined,
        },
        // Parsed fields
        backtrace: { type: String, es_indexed: true, es_type: "text" },
        header: { type: String, es_indexed: true, es_type: "text" },
        // We don't use these fields for searching and parsing them is fast enough so we won't save them for now
        // stack: { type: String, es_indexed: false  },
        // registers: { type: String, es_indexed: false  },
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

// ElasticSearch indexing
crashSchema.plugin(mongoosastic, {
    bulk: {
        size: 10, // preferred number of docs to bulk index
        delay: 100, // milliseconds to wait for enough docs to meet size constraint
    },
    clientOptions: {
        nodes: [process.env.ELASTICSEARCH_URI],
    },
});

module.exports = mongoose.model("Crash", crashSchema);
