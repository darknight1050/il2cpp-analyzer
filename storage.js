const { analyzeStacktrace } = require("./analyzer"),
    Crash = require("./dbmodels/crash");

//https://stackoverflow.com/a/1349426
const randomID = (length) => {
    let result = "";
    let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

const getAvailableID = async (crash) => {
    let id;
    do {
        id = randomID(4);
    } while(await Crash.findById(id).exec());
    return id;
}

const getCrashes = async (filter) => {
    const limit = filter.limit;
    const userId = filter.userId;
    let statement = Crash.find().sort({ uploadDate: -1 }).select("crashId userId uploadDate");
    if(limit) {
        try {
            statement = statement.limit(limit);
        } catch (error) {
        }
    }
    if(userId)
        statement = statement.find({ userId: userId });
    return await statement.exec();
}

const getCrash = async (crashId, includeOriginal = false) => {
    let statement = Crash.findById(crashId);
    if(!includeOriginal)
        statement = statement.select("-original");
    return statement.exec();
}

const storeCrash = async (crash) => {
    const crashId = await getAvailableID();
    const write = async (crashId, crash) => {
        new Crash( { crashId: crashId, userId: crash.userId, original: crash.stacktrace, stacktrace: analyzeStacktrace(crash.stacktrace), uploadDate: Date.now() }).save();
    };
    write(crashId, crash);
    return crashId;
}

module.exports = { getCrashes, getCrash, storeCrash };