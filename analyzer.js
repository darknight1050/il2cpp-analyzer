const fssync = require("fs"),
    fs = require("fs/promises"),
    fsPath = require("path"),
    gc = require("expose-gc/function"),
    { readELF } = require("./elf/elfparser"),
    { searchDWARFLines } = require("./elf/dwarfparser");

const BuildIDTypes = {
    JSON: 1,
    SO: 2,
};

const versionsPath = "./versions";
const availableBuildIDs = {};
const beatSaberVersions = {};

const regexPc =
    /#[0-9]+? +?pc +?(?<address>.{16}) +?\/.+?(?<insertSo>\().*?(?<insertJson>BuildId: )(?<buildID>.{40})\)/dg;

const readVersion = async (path) => {
    const buffer = await fs.readFile(path);
    if (buffer.length == 0) {
        return;
    }
    const name = path.substring(versionsPath.length + 1);
    try {
        const extension = fsPath.extname(name).substring(1);
        switch (extension) {
            case "json": {
                const json = JSON.parse(buffer);
                if (json.buildID !== undefined) {
                    const buildID = json.buildID.toLocaleLowerCase();
                    console.log("Loaded " + name + ": " + buildID);
                    availableBuildIDs[buildID] = {
                        name: name,
                        type: BuildIDTypes.JSON,
                    };
                    if (path.includes("com.beatgames.beatsaber")) {
                        beatSaberVersions[
                            fsPath.basename(path, fsPath.extname(path))
                        ] = buildID;
                    }
                }
                break;
            }
            case "so": {
                const elf = readELF(buffer);
                if (elf.sections) {
                    console.log("Loaded " + name + ": " + elf.buildID);
                    availableBuildIDs[elf.buildID] = {
                        name: name,
                        sections: elf.sections,
                        type: BuildIDTypes.SO,
                    };
                } else {
                    console.log("Couldn't find .debug section in " + name);
                }
                break;
            }
            default: {
                console.log("File has unknown extension: " + name);
                break;
            }
        }
    } catch (e) {
        console.log("Error loading " + name + ": " + e);
    }
    buffer.fill(0);
    gc();
};

const readVersionsDir = async (path) => {
    let files = await fs.readdir(path, { withFileTypes: true });
    const threads = [];
    for (let file of files) {
        if (file.isDirectory())
            threads.push(readVersionsDir(path + "/" + file.name));
        if (file.isFile()) threads.push(readVersion(path + "/" + file.name));
    }
    await Promise.all(threads);
};

const loadVersions = async () => {
    await readVersionsDir(versionsPath);
};

const getBuildIDs = () => {
    return Object.values(availableBuildIDs).map((buildID) =>
        buildID.name.substring(
            0,
            buildID.name.length - fsPath.extname(buildID.name).length
        )
    );
};

const analyzeJson = (json, addresses) => {
    let analyzed = {};
    let functions = json.functions;
    for (let i = 0; i < functions.length; i++) {
        let func = functions[i];
        let ranges = func.ranges;
        for (let j = 0; j < ranges.length; j++) {
            let range = ranges[j];
            let result = addresses.filter(
                (addr) =>
                    parseInt(range[0], 16) <= addr &&
                    parseInt(range[1], 16) >= addr
            );
            if (result.length > 0) {
                result.forEach((addr) => {
                    addresses.splice(addresses.indexOf(addr), 1);
                    analyzed[addr] = func;
                });
                if (addresses.length <= 0) return analyzed;
            }
        }
    }
    return analyzed;
};

const analyzeSo = (buffer, sections, addresses) => {
    return searchDWARFLines(buffer, sections, addresses);
};

const analyzeBuildIDs = (buildIDs) => {
    let analyzed = {};
    for (const [buildID, addresses] of Object.entries(buildIDs)) {
        try {
            const buildIDData = availableBuildIDs[buildID.toLocaleLowerCase()];
            if (buildIDData) {
                const buffer = fssync.readFileSync(
                    versionsPath + "/" + buildIDData.name
                );
                switch (buildIDData.type) {
                    case BuildIDTypes.JSON: {
                        const json = JSON.parse(buffer);
                        analyzed[buildID] = analyzeJson(json, addresses);
                        break;
                    }
                    case BuildIDTypes.SO: {
                        analyzed[buildID] = analyzeSo(
                            buffer,
                            buildIDData.sections,
                            addresses
                        );
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
};

const analyzeStacktrace = (stacktrace) => {
    let buildIDs = [];
    let match;
    while ((match = regexPc.exec(stacktrace))) {
        const buildID = match.groups.buildID;
        const address = "0x" + match.groups.address;
        if (!buildIDs[buildID]) buildIDs[buildID] = [];
        buildIDs[buildID].push(address);
    }
    const analyzed = analyzeBuildIDs(buildIDs);
    while ((match = regexPc.exec(stacktrace))) {
        const buildID = match.groups.buildID;
        const address = "0x" + match.groups.address;
        if (analyzed[buildID] && analyzed[buildID][address]) {
            const result = analyzed[buildID][address];
            switch (analyzed[buildID].type) {
                case BuildIDTypes.JSON: {
                    const startAddr = result.ranges.sort(
                        (a, b) => a[0] - b[0]
                    )[0][0];
                    const textInsert =
                        "(" + result.sig + "+" + (address - startAddr) + ") ";
                    const insertPos = match.indices.groups.insertJson[0] - 1;
                    stacktrace = stacktrace.insert(insertPos, textInsert);
                    break;
                }
                case BuildIDTypes.SO: {
                    const insertPos = match.indices.groups.insertSo[0];
                    const lineStart =
                        stacktrace.lastIndexOf("\n", insertPos) + 1;
                    let lineEnd = stacktrace.indexOf("\n", insertPos) + 1;
                    const spaces = " ".repeat(insertPos - lineStart);
                    for (const entry of result) {
                        const textInsert =
                            spaces +
                            entry.file +
                            ":" +
                            entry.line +
                            ":" +
                            entry.column +
                            "\n";
                        stacktrace = stacktrace.insert(lineEnd, textInsert);
                        lineEnd += textInsert.length;
                    }
                    break;
                }
            }
        }
    }
    return stacktrace;
};

const getBeatSaberVersions = () => {
    return beatSaberVersions;
};
// TODO: Replace with something generic
const getBeatsaberVersionFromStacktrace = (stacktrace) => {
    // Grab build ids
    let buildIDs = [];
    let match;
    while ((match = regexPc.exec(stacktrace))) {
        const buildID = match.groups.buildID;
        if (!buildIDs.includes(buildID)) {
            buildIDs.push(buildID);
        }
    }
    for (const [version, buildID] of Object.entries(beatSaberVersions)) {
        if (buildIDs.includes(buildID)) {
            return version;
        }
    }
};

/**
 * Split stacktrace into its components
 * @param {string} stacktrace
 * @returns {AnalyzedStacktrace}
 */
const splitStacktrace = (stacktrace) => {
    let result = {
        header: undefined,
        backtrace: undefined,
        stack: undefined,
        registers: undefined,
    };

    // replace all \r\n with \n if present
    stacktrace = stacktrace.replace(/\r\n/g, "\n");

    // Get positions of points of interest
    const headerStart = stacktrace.indexOf("\nVersion '");
    const headerEnd = stacktrace.indexOf("\n    x0", headerStart);
    const backtracePos = stacktrace.indexOf("\n\nbacktrace:\n");
    const stackPos = stacktrace.indexOf("\nstack:\n");
    // Appears in the stacktrace if we fail to unwind the backtrace (usually when we have BUS_ADRALN)
    const failedToUnwindPos = stacktrace.indexOf("\nFailed to unwind\n");

    // Parse header
    if (headerStart != -1) {
        if (headerEnd != -1) {
            // skip newline
            result.header = stacktrace.substring(headerStart + 1, headerEnd);
        }
    }

    // Parse registers
    if (headerEnd != -1) {
        if (backtracePos != -1) {
            // skip newline and 4 spaces
            result.registers = stacktrace.substring(
                headerEnd + 5,
                backtracePos
            );

            // Remove indentation
            result.registers = result.registers.replace(/    /g, "");
        }
        // The stacktrace does not contain a backtrace, so the registers end with failed to unwind
        else {
            // If we are here then it means that the stacktrace does not contain a backtrace
            if (failedToUnwindPos != -1) {
                result.registers = stacktrace.substring(
                    headerEnd + 5,
                    failedToUnwindPos
                );
            } else if (stackPos == -1) {
                // If we did not find anything after the header then we just get everything after the header
                result.registers = stacktrace.substring(headerEnd + 5);
            }
        }
    }

    // Split stacktrace into its components
    if (backtracePos != -1) {
        // If stack position is not found then backtrace is the last part of the stacktrace
        if (stackPos != -1) {
            // 13 = length of "\n\nbacktrace:\n"
            result.backtrace = stacktrace.substring(
                backtracePos + 13,
                stackPos
            );
        } else {
            result.backtrace = stacktrace.substring(backtracePos + 13);
        }

        // Remove indentation
        result.backtrace = result.backtrace.replace(/      /g, "");
    }

    if (stackPos != -1) {
        result.stack = stacktrace.substring(stackPos + 8);
    } else if (failedToUnwindPos != -1) {
        // If the stack is not here then it means that the stacktrace
        // does not contain a backtrace and we just get everything after failed to unwind

        // 18 = length of "\nFailed to unwind\n"
        result.stack = stacktrace.substring(failedToUnwindPos + 18);
    }

    if (!result.header) {
        throw new Error(
            "Header not found, something is wrong with the stacktrace"
        );
    }
    if (!result.registers) {
        throw new Error(
            "Registers not found, something is wrong with the stacktrace"
        );
    }

    // Validate that the stacktrace is valid
    if (result.registers.length > 800) {
        throw new Error(
            "Something is wrong with the stacktrace, length of registers is too long"
        );
    }
    // Validate that the header is valid
    if (result.header) {
        const pos = stacktrace.indexOf("\nVersion '");
        if (pos == -1) {
            throw new Error(
                "Something is wrong with the stacktrace, header is invalid"
            );
        }
    }

    return result;
};

module.exports = {
    getBuildIDs,
    analyzeBuildIDs,
    analyzeStacktrace,
    loadVersions,
    getBeatsaberVersionFromStacktrace,
    getBeatSaberVersions,
    readVersion,
    splitStacktrace,
};
