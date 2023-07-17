const mongoose = require("mongoose");
const mongoosastic = require('mongoosastic')

const crashSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true, alias: "crashId", es_indexed: true },
        userId: { type: String, required: true, index: true, es_indexed: true, es_type: 'keyword'  },
        original: { type: String, required: true },
        uploadDate: { type: Date, required: true, es_indexed: true, es_type: 'date'  },
        stacktrace: { type: String, },
        
        log: { type: String, es_indexed: true },
        gameVersion: { type: String, es_indexed: true, es_type: 'keyword' },
        mods: {
            type: [{
                _id: false,
                name: { type: String, required: true },
                version: { type: String, required: true  },
            }],
            es_indexed: true,
            es_type: 'nested',
            es_include_in_parent: true,
            // es_select: 'name, version'
        },

        // Parsed fields 
        backtrace: { type: String, es_indexed: true  },
        stack: { type: String, es_indexed: false  },
        header: { type: String, es_indexed: true  },
        registers: { type: String, es_indexed: false  },
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


// ElasticSearch indexing 
crashSchema.plugin(mongoosastic, {
    bulk: {
        size: 10, // preferred number of docs to bulk index
        delay: 100 // milliseconds to wait for enough docs to meet size constraint
    },
    clientOptions: {
        nodes: [
            process.env.ELASTICSEARCH_URI
        ]
    }
});

module.exports = mongoose.model("Crash", crashSchema);
