
const fs = require("fs"),
    fsPath = require("path"),
    gc = require("expose-gc/function"),
    { readELF } = require("./elfparser");

const versionsPath = "./versions";
const availableBuildIDs = {};

const readVersion = async (path) => {
    fs.readFile(path, (err, buffer) => {
        const name = path.substring(versionsPath.length + 1);
        try {
            const extension = fsPath.extname(name).substring(1);
            switch(extension) {
                case "json":
                    const json = JSON.parse(buffer);
                    if(json.buildID !== undefined) {
                        const buildID = json.buildID.toLocaleLowerCase();
                        console.log("Loaded " + name + ": " + buildID);
                        availableBuildIDs[buildID] = name;
                    }
                break;
                case "so":
                    const elf = readELF(buffer);
                break;
                default:
                    console.log("File has unknown extension: " + name);
                break;
            }
            
        } catch (e) {
            console.log("Error loading " + name + ": " + e);
        }
        gc();
    });
}

const readVersionsDir = async (path) => {
    fs.readdir(path, { withFileTypes: true }, (err, files) => {
        files.forEach(file => {
            if(file.isDirectory())
                readVersionsDir(path + "/" + file.name);
            if(file.isFile()) {
                readVersion(path + "/" + file.name);
            }
        });
    });
}

readVersionsDir(versionsPath);

const getBuildIDs = () => {
    return Object.values(availableBuildIDs).map(name => name.substring(0, name.length - fsPath.extname(name).length));
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

const analyzeStacktrace = (stacktrace) => {
    const regexPc = /#[0-9]{2,3} pc (?<address>.{16})  \/.+? (?<insert>\(BuildId: )(?<buildID>.{40})\)/gd;
    let buildIDs = [];
    let match;
    while(match = regexPc.exec(stacktrace)) {
        const buildID = match.groups.buildID;
        const address = "0x" + match.groups.address;
        if(!buildIDs[buildID])
            buildIDs[buildID] = [];
        buildIDs[buildID].push(address);
    }
    const analyzed = analyzeBuildIDs(buildIDs);
    while(match = regexPc.exec(stacktrace)) {
        const buildID = match.groups.buildID;
        const address = "0x" + match.groups.address;
        if(analyzed[buildID] && analyzed[buildID][address]) {
            const result = analyzed[buildID][address];
            const startAddr = result.ranges.sort((a, b) => a[0] - b[0])[0][0];
            const textInsert = "(" + result.sig + "+" + (address-startAddr) + ") ";
            const insertPos = match.indices.groups.insert[0];
            stacktrace = stacktrace.insert(insertPos, textInsert);
        }
    }
    return stacktrace;
} 

module.exports = { getBuildIDs, analyzeBuildIDs, analyzeStacktrace };