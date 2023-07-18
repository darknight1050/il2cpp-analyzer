const { analyzeStacktrace, getBeatsaberVersionFromStacktrace, splitStacktrace } = require("../analyzer"),
    mongoose = require("mongoose"),
    Crash = require("../dbmodels/crash");

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("Mongoose connected."))
    .catch(e => console.log(e));;


const defaultLimit = 200;

//https://stackoverflow.com/a/1349426
const randomID = (length) => {
    let result = "";
    let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

const getAvailableID = async (crash) => {
    let id;
    do {
        id = randomID(4);
    } while (await Crash.findById(id).exec());
    return id;
}

const getCrashes = async (filter) => {
    let limit = filter.limit || defaultLimit;
    let userId = filter.userId;
    let searchQuery = filter.search;
    let dateLimit = filter.date | 0; // 0 - All, 1 - Last 24h, 7 - Last week, 30 - Last month, 365 - Last year
    let version = filter.version || "all";

    // Check all values for null
    let isNull = {
        limit: limit == defaultLimit,
        userId: userId === undefined || userId === "",
        searchQuery: searchQuery === undefined || searchQuery === "",
        dateLimit: dateLimit == 0,
        version: version === "all",
    }

    // Fix types for mongoose
    if (typeof limit !== "number") {
        limit = parseInt(limit);
    }
    if (typeof dateLimit !== "number") {
        dateLimit = parseInt(dateLimit);
    }

    // Fix invalid values for date
    if (dateLimit > 365 || dateLimit < 0) {
        dateLimit = 0;
    }

    // Build search params
    let SearchParams = {
        "size": limit,
        "sort": [
            { "uploadDate": { "order": "desc", "mode": "max" } }
        ],
        query: {
            "bool": {
                "must": [],
                "filter": [],
            },
        }
    }

    if (!isNull.searchQuery) {
        SearchParams.query.bool.must.push({
            "query_string": {
                "fields": [
                    "backtrace",
                    "header",
                    "mods.*",
                    "log",
                ],
                "query": searchQuery,
            },
        })
    }

    // Filter by user id
    if (!isNull.userId) {
        SearchParams.query.bool.filter.push({
            "term": { "userId": userId.toLowerCase() },
        })
    };

    // Filter by game version
    if (!isNull.version) {
        SearchParams.query.bool.filter.push({
            "term": { "gameVersion": version.toLowerCase() },
        })
    };

    // Filter by date limit
    if (!isNull.dateLimit) {
        SearchParams.query.bool.filter.push({
            "range": { "uploadDate": { "gte": "now-" + dateLimit + "d" } }
        })
    }

    // ES Search
    let searchResult = await Crash.esSearch(SearchParams, { hydrate: false });
    let hits = searchResult.body.hits.hits;

    // Remove not needed fields from result and map fields from ElasticSearch to MongoDB
    hits = hits.map(hit => ({
        userId: hit._source.userId,
        crashId: hit._id,
        uploadDate: hit._source.uploadDate,
        gameVersion: hit._source.gameVersion,
    }))

    return hits;
}

const getCrash = async (crashId, includeOriginal = false) => {
    let statement = Crash.findById(crashId);
    if (!includeOriginal)
        statement = statement.select("-original");
    return statement.exec();
}

const storeCrash = async (crash) => {
    const crashId = await getAvailableID();
    // Try to get game version from stacktrace
    let gameVersion = getBeatsaberVersionFromStacktrace(crash.stacktrace);

    const analyzedStacktrace = analyzeStacktrace(crash.stacktrace);

    /**
     * @type {AnalyzedStacktrace}
     */
    let splitStack = {
        backtrace: undefined,
        header: undefined,
        stack: undefined,
        registers: undefined,
    }

    try {
        splitStack = splitStacktrace(analyzedStacktrace);
    } catch (e) {
        console.error("Failed to split stacktrace for crash " + crashId + "!");
        console.error(e);
    }

    new Crash({
        crashId: crashId,
        userId: crash.userId,
        original: crash.stacktrace,
        stacktrace: analyzedStacktrace,
        log: crash.log,
        mods: crash.mods,
        gameVersion: gameVersion,
        uploadDate: Date.now(),
        header: splitStack.header,
        backtrace: splitStack.backtrace,
        // Don't save the stack and registers for now
        // stack: splitStack.stack,
        // registers: splitStack.registers,
    }).save();
    return crashId;
}

module.exports = { getCrashes, getCrash, storeCrash };