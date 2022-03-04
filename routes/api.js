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
        if (_.isEmpty(req.body.version)) {
            res.status(400).json({
                success: false,
                error: "No version!"
            });
            return;
        }
        let hasStacktrace = !_.isEmpty(req.body.stacktrace);
        let hasUrl = !_.isEmpty(req.body.url);
        if (!hasStacktrace && !hasUrl) {
            res.status(400).json({
                success: false,
                error: "No stacktrace or url!"
            });
            return;
        }
        let fileName = versionsPath + req.body.version.replace("..", "").replace("/", "").replace("\\", "") + ".json";
        if (!fs.existsSync(fileName)) {
            res.status(400).json({
            success: false,
            error: "Version not found!"
            });
            return;
        }
        
        let json = JSON.parse(fs.readFileSync(fileName));
        const regexAddressPc = /(?<=pc ).+?(?=  \/data\/app\/com.beatgames.beatsaber-.+?\/lib\/arm64\/libil2cpp.so)/g;
        const regexAddressAt = /(?<=at libil2cpp\.).+?(?=\(Native Method\))/g;
        let analyzedStackTrace = "";
        if(hasStacktrace)
            analyzedStackTrace = req.body.stacktrace;
        if(hasUrl) {
            let res = await axios.get(req.body.url);
            analyzedStackTrace = res.data;
            const regexAndroidRuntime = /E AndroidRuntime:/;
            const regexCrash = /E CRASH   :/; 
            let lines = analyzedStackTrace.split('\n').filter(line => regexAndroidRuntime.test(line) || regexCrash.test(line));
            analyzedStackTrace = "";
            lines.forEach(line => analyzedStackTrace += line + "\n");
        }

        let result;
        while(result = regexAddressPc.exec(analyzedStackTrace)) {
            let addr = parseInt(String(result), 16);
            let analyzed = analyze(json, addr);
            if(analyzed) {
                const search = "libil2cpp.so";
                let index = analyzedStackTrace.indexOf(search, result.index);
                analyzedStackTrace = analyzedStackTrace.insert(index + search.length, " (" + analyzed.sig + ")");
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
            version: req.body.version,
            stacktrace: analyzedStackTrace
        });
    });
};