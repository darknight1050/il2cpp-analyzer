const { Console } = require("console");
const { find } = require("lodash");
const _ = require("lodash"),
    { analyzeSingle, analyzeMultiple } = require("../analyzer"),
    fs = require("fs"),
    axios = require('axios');

String.prototype.insert = function(idx, str) {
    return this.slice(0, idx) + str + this.slice(idx);
};

String.prototype.splice = function(idx, replace, str) {
    return this.slice(0, idx) + str + this.slice(idx + replace);
};

const versionsPath = "./versions/";
const buildIDs = JSON.parse(fs.readFileSync(versionsPath + "BuildID.json"));

versionFromBuildID = (buildID) => {
    for (let version in buildIDs) {
        if(buildIDs[version].includes(buildID))
            return version;
    }
    return;
}

module.exports = (app) => {
    app.get("/api/versions", (req, res) => {
        let versions = [];
        fs.readdirSync(versionsPath).forEach(file => {
            versions.push(file.replace(".json", ""));
        });
        res.status(200).json({
            versions: versions
        });
    });

    app.get("/api/buildids", (req, res) => {
        res.status(200).json(buildIDs);
    });

    app.post("/api/analyze/address", async (req, res) => {
        if (_.isEmpty(req.body)) {
            res.status(400).json({
                success: false,
                error: "No body!"
            });
            return;
        }

        let version = req.body.version.replace(/\.\./g, "").replace(/\//g, "").replace(/\\/g, "");
        if (_.isEmpty(version)) {
            res.status(400).json({
                success: false,
                error: "No version!"
            });
            return;
        }
        
        let addresses = req.body.addresses;
        let hasAddresses = !_.isEmpty(addresses);
        if (!hasAddresses) {
            res.status(400).json({
                success: false,
                error: "No addresses!"
            });
            return;
        }
        
        if(ver = versionFromBuildID(version))
            version = ver;

        let fileName = versionsPath + version + ".json";
        if (!fs.existsSync(fileName)) {
            console.log(versionFromBuildID(version));
            res.status(400).json({
                success: false,
                error: "Version not found!"
            });
            return;
        }

        let json = JSON.parse(fs.readFileSync(fileName));

        res.status(200).json({
            success: true,
            version: version,
            result: analyzeMultiple(json, addresses)
        });
    });

    app.post("/api/analyze", async (req, res) => {
        if (_.isEmpty(req.body)) {
            res.status(400).json({
                success: false,
                error: "No body!"
            });
            return;
        }

        let version = req.body.version.replace(/\.\./g, "").replace(/\//g, "").replace(/\\/g, "");
        if (_.isEmpty(version)) {
            res.status(400).json({
                success: false,
                error: "No version!"
            });
            return;
        }
        
        let stacktrace = req.body.stacktrace;
        let url = req.body.url;
        let hasStacktrace = !_.isEmpty(stacktrace);
        let hasUrl = !_.isEmpty(url);
        if (!hasStacktrace && !hasUrl) {
            res.status(400).json({
                success: false,
                error: "No stacktrace or url!"
            });
            return;
        }
        
        let json;
        if(version != "BuildID") {
            let fileName = versionsPath + version + ".json";
            if (!fs.existsSync(fileName)) {
                res.status(400).json({
                    success: false,
                    error: "Version not found!"
                });
                return;
            }
            json = JSON.parse(fs.readFileSync(fileName));
        }

        const regexAddressPc = /(?<=pc ).+?(?=  \/data\/app\/com.beatgames.beatsaber-.+?\/lib\/arm64\/libil2cpp.so)/g;
        const regexAddressAt = /(?<=at libil2cpp\.).+?(?=\(Native Method\))/g;
        let analyzedStackTrace = "";
        if(hasStacktrace)
            analyzedStackTrace = stacktrace;
        if(hasUrl) {
            try {
                let res = await axios.get(url);
                analyzedStackTrace = res.data;
                if(!analyzedStackTrace.startsWith("*** *** *** *** *** *** *** *** *** *** *** *** *** *** *** ***")) {
                    const regexAndroidRuntime = /E AndroidRuntime:/;
                    const regexCrash = /E CRASH   :/; 
                    let lines = analyzedStackTrace.split('\n').filter(line => regexAndroidRuntime.test(line) || regexCrash.test(line));
                    analyzedStackTrace = "";
                    lines.forEach(line => analyzedStackTrace += line + "\n");
                }
            } catch(err) {
                res.status(400).json({
                    success: false,
                    error: "Couldn't load url!"
                });
                return;
            }
        }

        let result;
        while(result = regexAddressPc.exec(analyzedStackTrace)) {
            let addr = parseInt(result.toString(), 16);
            if(!json) {
                const search = "(BuildId: ";
                let indexStart = analyzedStackTrace.indexOf(search, result.index);
                let indexEnd = analyzedStackTrace.indexOf(")", indexStart);
                if(!(version = versionFromBuildID(analyzedStackTrace.substring(indexStart + search.length, indexEnd)))) {
                    res.status(400).json({
                        success: false,
                        error: "Version not found!"
                    });
                    return;
                }
                let fileName = versionsPath + version + ".json";
                if (!fs.existsSync(fileName)) {
                    res.status(400).json({
                        success: false,
                        error: "Version not found!"
                    });
                    return;
                }
                json = JSON.parse(fs.readFileSync(fileName));
            }
            let analyzed = analyzeSingle(json, addr);
            if(analyzed) {
                let startAddr = analyzed.ranges.sort((a, b) => a[0] - b[0])[0][0];
                const search = "libil2cpp.so";
                let index = analyzedStackTrace.indexOf(search, result.index);
                analyzedStackTrace = analyzedStackTrace.insert(index + search.length, " (" + analyzed.sig + "+" + (addr-startAddr) + ")");
            }
        }

        while(result = regexAddressAt.exec(analyzedStackTrace)) {
            let addrStr = result.toString();
            let addr = parseInt(addrStr, 16);
            let analyzed = analyzeSingle(json, addr);
            if(analyzed) {
                let startAddr = analyzed.ranges.sort((a, b) => a[0] - b[0])[0][0];
                let indexEnd = analyzed.sig.indexOf("(");
                if(indexEnd < 0)
                    indexEnd = analyzed.sig.length;
                let indexStart = analyzed.sig.lastIndexOf("::", indexEnd);
                if(indexStart < 0)
                    indexStart = analyzed.sig.lastIndexOf(" ", indexEnd)-1;
                if(indexStart < 0)
                    indexStart = -2;
                analyzedStackTrace = analyzedStackTrace.splice(result.index, addrStr.length + "(Native Method)".length, analyzed.sig + "(" + analyzed.sig.slice(indexStart+2, indexEnd) + ":" + (addr-startAddr) + ")");
            }
        }
        
        res.status(200).json({
            success: true,
            version: version,
            stacktrace: analyzedStackTrace
        });
    });
};