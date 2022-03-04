const _ = require("lodash"),
    analyze = require("../analyzer"),
    fs = require("fs"),
    axios = require('axios');

String.prototype.insert = function(idx, str) {
    return this.slice(0, idx) + str + this.slice(idx);
};

String.prototype.splice = function(idx, replace, str) {
    return this.slice(0, idx) + str + this.slice(idx + replace);
};

const versionsPath = "./versions/";

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

    app.post("/api/analyze", async (req, res) => {
        if (_.isEmpty(req.body)) {
            res.status(400).json({
                success: false,
                error: "No body!"
            });
        return;
        }
        let version = req.body.version;
        let stacktrace = req.body.stacktrace;
        let url = req.body.url;
        if (_.isEmpty(version)) {
            res.status(400).json({
                success: false,
                error: "No version!"
            });
            return;
        }
        let hasStacktrace = !_.isEmpty(stacktrace);
        let hasUrl = !_.isEmpty(url);
        if (!hasStacktrace && !hasUrl) {
            res.status(400).json({
                success: false,
                error: "No stacktrace or url!"
            });
            return;
        }
        let fileName = versionsPath + version.replace("..", "").replace("/", "").replace("\\", "") + ".json";
        if (!fs.existsSync(fileName)) {
            res.status(400).json({
                success: false,
                error: "Version not found!"
            });
            return;
        }
        
        let json = JSON.parse(fs.readFileSync(fileName));
        const regexAddressPc = /(?<=pc ).+?(?=  \/data\/app\/com.beatgames.beatsaber-.+?\/lib\/arm64\/libil2cpp.so \(BuildId:)/g;
        const regexAddressAt = /(?<=at libil2cpp\.).+?(?=\(Native Method\))/g;
        let analyzedStackTrace = "";
        if(hasStacktrace)
            analyzedStackTrace = stacktrace;
        if(hasUrl) {
            try {
                let res = await axios.get(url);
                analyzedStackTrace = res.data;
                const regexAndroidRuntime = /E AndroidRuntime:/;
                const regexCrash = /E CRASH   :/; 
                let lines = analyzedStackTrace.split('\n').filter(line => regexAndroidRuntime.test(line) || regexCrash.test(line));
                analyzedStackTrace = "";
                lines.forEach(line => analyzedStackTrace += line + "\n");
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
            let addr = parseInt(String(result), 16);
            let analyzed = analyze(json, addr);
            if(analyzed) {
                let startAddr = analyzed.ranges.sort((a, b) => a[0] - b[0])[0][0];
                const search = "libil2cpp.so";
                let index = analyzedStackTrace.indexOf(search, result.index);
                analyzedStackTrace = analyzedStackTrace.insert(index + search.length, " (" + analyzed.sig + "+" + (addr-startAddr) + ")");
            }
        }
        while(result = regexAddressAt.exec(analyzedStackTrace)) {
            let addrStr = String(result);
            let addr = parseInt(addrStr, 16);
            let analyzed = analyze(json, addr);
            if(analyzed) {
                analyzedStackTrace = analyzedStackTrace.splice(result.index, addrStr.length + "(Native Method)".length, analyzed.sig + "(" + addrStr + ")");
            }
        }
        
        res.status(200).json({
            success: true,
            version: version,
            stacktrace: analyzedStackTrace
        });
    });
};