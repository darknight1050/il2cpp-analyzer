const { Client } = require("@elastic/elasticsearch");

// mongoosastic used to derive this index name from the collection name.
const INDEX = "crashes";

// The mapping the crash schema used to declare through mongoosastic's es_*
// options. Only these fields are mirrored into ElasticSearch - the bulky ones
// (original, stacktrace) live in MongoDB only, which is the source of truth.
//
// userId / mods keep a text + .keyword pair so that both the query_string
// search over "mods.*" and the `term` filter on the lowercased userId keep
// matching exactly as they did before. gameVersion is only ever hit by a
// `term` filter built from user input, so it gets a lowercase normalizer
// instead of being analyzed.
const SETTINGS = {
    analysis: {
        normalizer: {
            lowercase_normalizer: { type: "custom", filter: ["lowercase"] },
        },
    },
};

const textWithKeyword = {
    type: "text",
    fields: { keyword: { type: "keyword", ignore_above: 256 } },
};

const MAPPINGS = {
    properties: {
        userId: textWithKeyword,
        uploadDate: { type: "date" },
        log: { type: "text" },
        gameVersion: { type: "keyword", normalizer: "lowercase_normalizer" },
        mods: {
            properties: {
                name: textWithKeyword,
                version: textWithKeyword,
            },
        },
        backtrace: { type: "text" },
        header: { type: "text" },
    },
};

let client;

const getClient = () => {
    if (!client) {
        const node = process.env.ELASTICSEARCH_URI;
        if (!node) throw new Error("ELASTICSEARCH_URI is not set!");
        client = new Client({ node });
    }
    return client;
};

/** The subset of a crash that gets mirrored into ElasticSearch. */
const toDocument = (crash) => ({
    userId: crash.userId,
    uploadDate: crash.uploadDate,
    log: crash.log,
    gameVersion: crash.gameVersion,
    mods: crash.mods?.map((mod) => ({ name: mod.name, version: mod.version })),
    backtrace: crash.backtrace,
    header: crash.header,
});

/** Creates the index with our mapping if it isn't there yet. */
const ensureIndex = async () => {
    const es = getClient();
    if (await es.indices.exists({ index: INDEX })) return false;
    await es.indices.create({
        index: INDEX,
        settings: SETTINGS,
        mappings: MAPPINGS,
    });
    console.log(`Created ElasticSearch index "${INDEX}".`);
    return true;
};

/** Drops the index and recreates it empty. Used by the reindex script. */
const recreateIndex = async () => {
    const es = getClient();
    if (await es.indices.exists({ index: INDEX })) {
        await es.indices.delete({ index: INDEX });
        console.log(`Deleted ElasticSearch index "${INDEX}".`);
    }
    await ensureIndex();
};

const indexCrash = (crash) =>
    getClient().index({
        index: INDEX,
        id: String(crash._id),
        document: toDocument(crash),
    });

// A single crash can carry a multi-MB backtrace (the upload endpoint accepts
// 32mb bodies), so a fixed document count is not enough to keep a bulk request
// under ElasticSearch's http.max_content_length - exceeding it fails the whole
// request with a 413. Batches are therefore capped by serialized size too.
const MAX_BULK_BYTES = 30 * 1024 * 1024;
const MAX_BULK_DOCS = 500;

/**
 * Bulk indexes crashes, splitting them into requests that stay under the size
 * limit. Documents ElasticSearch rejects are collected and reported rather
 * than aborting the run - one unindexable crash must not stop a whole reindex.
 * Transport level failures still throw, so a dead cluster fails loudly.
 *
 * @returns {Promise<{indexed: number, failed: {id: string, error: string}[]}>}
 */
const bulkIndexCrashes = async (crashes) => {
    const result = { indexed: 0, failed: [] };
    let operations = [];
    let bytes = 0;
    let docs = 0;

    const flush = async () => {
        if (operations.length === 0) return;
        const response = await getClient().bulk({ operations });
        operations = [];
        bytes = 0;
        docs = 0;
        for (const item of response.items) {
            if (item.index?.error) {
                result.failed.push({
                    id: item.index._id,
                    error:
                        item.index.error.reason ||
                        item.index.error.type ||
                        "unknown",
                });
            } else {
                result.indexed++;
            }
        }
    };

    for (const crash of crashes) {
        const action = { index: { _index: INDEX, _id: String(crash._id) } };
        const document = toDocument(crash);
        const size = Buffer.byteLength(JSON.stringify(document)) + 100;

        // Keep at least one document per request, even an oversized one, so it
        // gets reported as a failure instead of silently blocking the batch.
        if (docs > 0 && (bytes + size > MAX_BULK_BYTES || docs >= MAX_BULK_DOCS)) {
            await flush();
        }
        operations.push(action, document);
        bytes += size;
        docs++;
    }
    await flush();
    return result;
};

/** Bulk deletes crashes by id. Missing documents are not an error. */
const bulkDeleteCrashes = async (ids) => {
    if (ids.length === 0) return;
    const operations = ids.map((id) => ({
        delete: { _index: INDEX, _id: String(id) },
    }));
    await getClient().bulk({ refresh: true, operations });
};

/** Runs a search against the crash index. Returns the raw ES response. */
const search = (params) => getClient().search({ index: INDEX, ...params });

const refresh = () => getClient().indices.refresh({ index: INDEX });

const close = () => (client ? client.close() : Promise.resolve());

module.exports = {
    INDEX,
    ensureIndex,
    recreateIndex,
    indexCrash,
    bulkIndexCrashes,
    bulkDeleteCrashes,
    search,
    refresh,
    close,
};
