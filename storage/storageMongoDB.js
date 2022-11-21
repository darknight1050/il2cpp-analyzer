const { analyzeStacktrace } = require("../analyzer"),
    mongoose = require("mongoose"),
    Crash = require("../dbmodels/crash");

mongoose.connect(process.env.MONGODB_URI)
.then(()=>console.log("Mongoose connected."))
.catch(e=>console.log(e));;

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
    new Crash({ 
        crashId: crashId, 
        userId: crash.userId,
        original: crash.stacktrace, 
        stacktrace: analyzeStacktrace(crash.stacktrace), 
        log: crash.log, 
        mods: crash.mods, 
        uploadDate: Date.now() 
    }).save();
    return crashId;
}

module.exports = { getCrashes, getCrash, storeCrash };