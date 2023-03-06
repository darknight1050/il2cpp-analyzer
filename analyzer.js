const fssync = require("fs"),
    fs = require("fs/promises"),
    fsPath = require("path"),
    gc = require("expose-gc/function"),
    { readELF, searchDWARFLines } = require("./elfparser");

const BuildIDTypes = {
    JSON: 1,
    SO: 2
}

const versionsPath = "./versions";
const availableBuildIDs = {};
const beatSaberVersions = {};

const readVersion = async (path) => {
    let buffer = await fs.readFile(path);
    const name = path.substring(versionsPath.length + 1);
    try {
        const extension = fsPath.extname(name).substring(1);
        switch (extension) {
            case "json":
            {
                const json = JSON.parse(buffer);
                if (json.buildID !== undefined) {
                    const buildID = json.buildID.toLocaleLowerCase();
                    console.log("Loaded " + name + ": " + buildID);
                    availableBuildIDs[buildID] = {name: name, type: BuildIDTypes.JSON};
                    if (path.includes("com.beatgames.beatsaber")) {
                        beatSaberVersions[fsPath.basename(path, fsPath.extname(path))] = buildID;
                    }
                }
                break;
            }
            case "so":
            {
                const elf = readELF(buffer);
                console.log("Loaded " + name + ": " + elf.buildID);
                availableBuildIDs[elf.buildID] = {name: name, section: elf.section, type: BuildIDTypes.SO};
                break;
            }
            default:
            {
                console.log("File has unknown extension: " + name);
                break;
            }
        }

    } catch (e) {
        console.log("Error loading " + name + ": " + e);
    }
    gc();
}

const readVersionsDir = async (path) => {
    let files = await fs.readdir(path, { withFileTypes: true });

    for (let file of files) {
        if (file.isDirectory())
            await readVersionsDir(path + "/" + file.name);
        if (file.isFile()) {
            await readVersion(path + "/" + file.name);
        }
    }
}

const loadVersions = async () => {
    await readVersionsDir(versionsPath);
}

const getBuildIDs = () => {
    return Object.values(availableBuildIDs).map(buildID => buildID.name.substring(0, buildID.name.length - fsPath.extname(buildID.name).length));
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
            if (result.length > 0) {
                result.forEach(addr => {
                    addresses.splice(addresses.indexOf(addr), 1);
                    analyzed[addr] = func;
                });
                if (addresses.length <= 0)
                    return analyzed;
            }
        }
    }
    return analyzed;
}

const analyzeSo = (buffer, section, addresses) => {
    return searchDWARFLines(buffer, section, addresses);
}

const analyzeBuildIDs = (buildIDs) => {
    let analyzed = {};
    for (const [buildID, addresses] of Object.entries(buildIDs)) {
        try {
            const buildIDData = availableBuildIDs[buildID.toLocaleLowerCase()];
            if(buildIDData) {
                const buffer = fssync.readFileSync(versionsPath + "/" + buildIDData.name);
                switch(buildIDData.type) {
                    case BuildIDTypes.JSON:
                    {
                        const json = JSON.parse(buffer);
                        analyzed[buildID] = analyzeJson(json, addresses);
                        break;
                    }
                    case BuildIDTypes.SO:
                    {
                        analyzed[buildID] = analyzeSo(buffer, buildIDData.section,  addresses);
                        break;
                    }
                }
                analyzed[buildID].type = buildIDData.type;
            }
        } catch (e) {
            console.log(e);
        }
    }
    gc();
    return analyzed;
}

const analyzeStacktrace = (stacktrace) => {
    const regexPc = /#[0-9]{2,3} pc (?<address>.{16})  \/.+?(?<insertSo>\().*?(?<insertJson>BuildId: )(?<buildID>.{40})\)/gd;
    let buildIDs = [];
    let match;
    while (match = regexPc.exec(stacktrace)) {
        const buildID = match.groups.buildID;
        const address = "0x" + match.groups.address;
        if (!buildIDs[buildID])
            buildIDs[buildID] = [];
        buildIDs[buildID].push(address);
    }
    const analyzed = analyzeBuildIDs(buildIDs);
    while (match = regexPc.exec(stacktrace)) {
        const buildID = match.groups.buildID;
        const address = "0x" + match.groups.address;
        if (analyzed[buildID] && analyzed[buildID][address]) {
            const result = analyzed[buildID][address];
            switch(analyzed[buildID].type) {
                case BuildIDTypes.JSON:
                {
                    const startAddr = result.ranges.sort((a, b) => a[0] - b[0])[0][0];
                    const textInsert = "(" + result.sig + "+" + (address - startAddr) + ") ";
                    const insertPos = match.indices.groups.insertJson[0]-1;
                    stacktrace = stacktrace.insert(insertPos, textInsert);
                    break;
                }
                case BuildIDTypes.SO:
                {
                    const insertPos = match.indices.groups.insertSo[0];
                    const lineStart = stacktrace.lastIndexOf("\n", insertPos) + 1;
                    const lineEnd = stacktrace.indexOf("\n", insertPos) + 1;
                    const textInsert = " ".repeat(insertPos - lineStart) + result.file + ":" + result.line + ":" + result.column + "\n";
                    stacktrace = stacktrace.insert(lineEnd, textInsert);
                    break;
                }
            }
        }
    }
    return stacktrace;
}

const getBeatSaberVersions = () => {
    return beatSaberVersions;
}
// TODO: Replace with something generic
const getBeatsaberVersionFromStacktrace = (stacktrace) => {
    // Grab build ids
    const regexPc = /#[0-9]{2,3} pc (?<address>.{16})  \/.+? (?<insert>\(BuildId: )(?<buildID>.{40})\)/gd;
    let buildIDs = [];
    let match;
    while (match = regexPc.exec(stacktrace)) {
        const buildID = match.groups.buildID;
        if (!buildIDs.includes(buildID)){
            buildIDs.push(buildID);
        }
        
    }
    for (const [version, buildID] of Object.entries(beatSaberVersions)) {
        if (buildIDs.includes(buildID)) {
            return version;
        }
    }
}

module.exports = { getBuildIDs, analyzeBuildIDs, analyzeStacktrace, loadVersions, getBeatsaberVersionFromStacktrace, getBeatSaberVersions };