const { analyzeStacktrace } = require("../analyzer"),
    admin = require("firebase-admin");

const serviceAccount = require("../firebase.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();
firestore.settings({ ignoreUndefinedProperties: true });
const crashesCollection = firestore.collection("crashes");

const defaultLimit = 200;

let cachedCrashes = [];

const observer = crashesCollection
    .orderBy("uploadDate", "desc")
    .limit(defaultLimit)
    .onSnapshot(
        (querySnapshot) => {
            cachedCrashes = querySnapshot.docs.map((doc) => {
                let data = cachedCrashes.find(
                    (crash) => crash.crashId === doc.id
                );
                if (data !== undefined) return data;
                let origData = doc.data();
                data = {
                    crashId: doc.id,
                    userId: origData.userId,
                    uploadDate: origData.uploadDate,
                };
                return data;
            });
        },
        (err) => {
            console.log(`Encountered error: ${err}`);
        }
    );

//https://stackoverflow.com/a/1349426
const randomID = (length) => {
    let result = "";
    let characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(
            Math.floor(Math.random() * charactersLength)
        );
    }
    return result;
};

const getAvailableID = async (crash) => {
    let id;
    do {
        id = randomID(4);
    } while ((await crashesCollection.doc(id).get()).exists);
    return id;
};

const getCrashes = async (filter) => {
    const limit = filter.limit;
    const userId = filter.userId;
    if (limit == defaultLimit && userId === undefined) {
        return cachedCrashes;
    }
    let statement = crashesCollection;
    statement = statement
        .orderBy("uploadDate", "desc")
        .select("crashId", "userId", "uploadDate");
    if (limit) {
        try {
            statement = statement.limit(limit);
        } catch (error) {}
    }
    if (userId) statement = statement.where("userId", "==", userId);
    return (await statement.get()).docs.map((doc) => {
        let data = doc.data();
        data.crashId = doc.id;
        return data;
    });
};

const getCrash = async (crashId, includeOriginal = false) => {
    let data = (await crashesCollection.doc(crashId).get()).data();
    if (!includeOriginal && data) data.original = undefined;
    return data;
};

const storeCrash = async (crash) => {
    const crashId = await getAvailableID();
    const write = async (crashId, crash) => {
        crashesCollection.doc(crashId).set({
            userId: crash.userId,
            original: crash.stacktrace,
            stacktrace: analyzeStacktrace(crash.stacktrace),
            log: crash.log,
            uploadDate: Date.now(),
        });
    };
    write(crashId, crash);
    return crashId;
};

module.exports = { getCrashes, getCrash, storeCrash };
