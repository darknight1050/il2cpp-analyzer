const fs = require("fs");

const crashesPath = "./crashes/";

if(!fs.existsSync(crashesPath)) {
    fs.mkdirSync(crashesPath);
}

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

const getAvailableID = (crash) => {
    let id = randomID(6);
    while(fs.existsSync(crashesPath + id)) {
        id = randomID(6);
    }
    return id;
}

const getCrashes = () => {
    let crashes = [];
    const files = fs.readdirSync(crashesPath, { withFileTypes: true });
    files.forEach(file => {
        if(file.isFile())
            crashes.push(file.name);
    });
    crashes.sort((a, b) => {
        return fs.statSync(crashesPath + b).mtime - fs.statSync(crashesPath + a).mtime;
    });
    return crashes;
}

const getCrash = (crashId) => {
    if(!fs.existsSync(crashesPath + crashId))
        return;
    return fs.readFileSync(crashesPath + crashId);
}

const storeCrash = (crash) => {
    const crashId = getAvailableID();
    fs.writeFile(crashesPath + crashId, crash, (err) => {
        if (err) throw err;
        console.log("Stored crash: " + crashId);
    });
    return crashId;
}

module.exports = { getCrashes, getCrash, storeCrash };