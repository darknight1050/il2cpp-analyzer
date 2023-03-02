const _ = require("lodash"),
    { getBuildIDs, analyzeBuildIDs, analyzeStacktrace } = require("../analyzer"),
    { storeCrash, getCrashes, getCrash } = require("../storage/storageMongoDB"),
    axios = require("axios"),
    express = require("express");

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

    app.post("/api/analyze", express.json({limit: "10mb"}), async (req, res) => {
        if (_.isEmpty(req.body)) {
            res.status(400).json({
                error: "No body!"
            });
            return;
        }
        
        const buildIDs = req.body.buildids;
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
                        let lines = stacktrace.split("\n").filter(line => !regexAt.test(line) && (regexAndroidRuntime.test(line) || regexCrash.test(line)));
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
            res.status(200).json({
                stacktrace: analyzeStacktrace(stacktrace)
            });
            return;
        }

        res.status(400).json({
            error: "No buildids, stacktrace or url!"
        });
    });

    app.get("/api/crashes", async (req, res) => {
        try {
            let result = await getCrashes(req.query)
            res.status(200).json(result);
        } catch (err) {
            res.status(400).json({message: err.message});
        }
        
    });

    app.get("/api/crashes/:crashId", async (req, res) => {
        if(req.params.crashId === "latest") {
            res.redirect("./" + (await getCrashes({ limit: 1 }))[0].crashId);
            return;
        }
        const crash = await getCrash(req.params.crashId, req.query.original?.toLowerCase() === "true" ? true : false);
        if(crash) {
            res.status(200).setHeader("Content-Type", "application/json").send(crash);
        } else {
            res.status(404).end();
        }
    });

    app.post("/api/upload", express.json({limit: "10mb"}), async (req, res) => {
        let code = 400;
        let data;
        if (_.isEmpty(req.body)) {
            data = "No body!";
        } else if (_.isEmpty(req.body.userId)) {
            data = "No userId!";
        } else if (_.isEmpty(req.body.stacktrace)) {
            data = "No stacktrace!";
        } else {
            code = 200;
            data = await storeCrash(req.body);
        }
        res.status(code).setHeader("Content-Type", "text/plain").send(data);
    });

}