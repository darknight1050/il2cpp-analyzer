
const fs = require("fs");

const versionsPath = "./versions";
const availableBuildIDs = {};

const readBuildIDs = async (path) => {
    fs.readdirSync(path, { withFileTypes: true }).forEach(file => {
        if(file.isDirectory())
            readBuildIDs(path + "/" + file.name);
        if(file.isFile()) {
            try {
                const json = JSON.parse(fs.readFileSync(path + "/" + file.name));
                if(json.buildID !== undefined) {
                    const name = (path + "/" + file.name).substring(versionsPath.length + 1);
                    const buildID = json.buildID.toLocaleLowerCase();
                    console.log("Loaded " + name + ": " + buildID);
                    availableBuildIDs[buildID] = name;
                }
            } catch (e) {
            }
        }
    });
}

readBuildIDs(versionsPath);

const getBuildIDs = () => {
    return Object.values(availableBuildIDs).map(name => name.substring(0, name.length - ".json".length));
}

const analyzeJson = (json, addresses) => {
    let analyzed = {};
    let functions = json.functions;
    for (let i = 0; i < functions.length; i++) {
        let func = functions[i];
        let ranges = func.ranges;
        for (let j = 0; j < ranges.length; j++) {
            let range = ranges[j];
            let result = addresses.filter(addr => parseInt(range[0], 16) <= addr && parseInt(range[1], 16) >= addr);
            if(result.length > 0) {
                result.forEach(addr => {
                    addresses.splice(addresses.indexOf(addr), 1);
                    analyzed[addr] = func;
                });
                if(addresses.length <= 0)
                    return analyzed;
            }
        }
    }
    return analyzed;
}

const analyzeBuildIDs = (buildIDs) => {
    let analyzed = {};
    for (const [buildID, addresses] of Object.entries(buildIDs)) {
        try {
            const json = JSON.parse(fs.readFileSync(versionsPath + "/" + availableBuildIDs[buildID.toLocaleLowerCase()]));
            if(json.buildID.toLocaleLowerCase() === buildID.toLocaleLowerCase()) {
                analyzed[buildID] = analyzeJson(json, addresses);
            }
        } catch (e) {
        }
    }
    return analyzed;
}

module.exports = { getBuildIDs, analyzeBuildIDs };