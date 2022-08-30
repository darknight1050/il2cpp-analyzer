const _ = require("lodash"),
    { getBuildIDs, analyzeBuildIDs } = require("../analyzer"),
    axios = require("axios");

String.prototype.insert = function(idx, str) {
    return this.slice(0, idx) + str + this.slice(idx);
};

String.prototype.splice = function(idx, replace, str) {
    return this.slice(0, idx) + str + this.slice(idx + replace);
};

module.exports = (app) => {

    app.get("/api/versions", async (req, res) => {
        res.status(200).json({ versions: getBuildIDs() });
    });

    app.post("/api/analyze", async (req, res) => {
        if (_.isEmpty(req.body)) {
            res.status(400).json({
                error: "No body!"
            });
            return;
        }
        
        let buildIDs = req.body.buildids || [];
        const hasBuildIDs = !_.isEmpty(buildIDs);

        let stacktrace = req.body.stacktrace || "";
        const hasStacktrace = !_.isEmpty(stacktrace);

        const url = req.body.url;
        const hasUrl = !_.isEmpty(url);

        if (hasBuildIDs) {
            res.status(200).json({
                result: analyzeBuildIDs(buildIDs)
            });
            return;
        }

        if (hasStacktrace || hasUrl) {
            if(hasUrl) {
                try {
                    const res = await axios.get(url);
                    stacktrace = res.data;
                    if(!stacktrace.startsWith("*** *** *** *** *** *** *** *** *** *** *** *** *** *** *** ***")) {
                        const regexAndroidRuntime = /E AndroidRuntime:/;
                        const regexCrash = /E CRASH   :/; 
                        const regexAt = /at /; 
                        let lines = stacktrace.split('\n').filter(line => !regexAt.test(line) && (regexAndroidRuntime.test(line) || regexCrash.test(line)));
                        stacktrace = "";
                        lines.forEach(line => stacktrace += line + "\n");
                    }
                } catch(err) {
                    res.status(400).json({
                        error: "Couldn't load url!"
                    });
                    return;
                }
            }
            const regexPc = /#[0-9]{2} pc (?<address>.{16})  \/.+? (?<insert>\(BuildId: )(?<buildID>.{40})\)/gd;
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
            res.status(200).json({
                stacktrace: stacktrace
            });
            return;
        }

        res.status(400).json({
            error: "No buildids, stacktrace or url!"
        });
    });
}