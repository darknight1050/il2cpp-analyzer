const _ = require("lodash"),
  analyze = require("../analyzer"),
  fs = require("fs");

String.prototype.insert = function(idx, str) {
  return this.slice(0, idx) + str + this.slice(idx);
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

  app.post("/api/analyze", (req, res) => {
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
    if (_.isEmpty(req.body.stacktrace)) {
      res.status(400).json({
        success: false,
        error: "No stacktrace!"
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
    let regex = /(?<=pc ).+?(?=  \/data\/app\/com.beatgames.beatsaber-.+?\/lib\/arm64\/libil2cpp.so)/g;
    let analyzedStackTrace = req.body.stacktrace;
    let result;
    while(result = regex.exec(analyzedStackTrace)) {
      let addr = parseInt(String(result), 16);
      let analyzed = analyze(json, addr);
      if(analyzed)
        analyzedStackTrace = analyzedStackTrace.insert(result.index + String(result).length, " (" + analyzed.sig + ")")
    }
    
    res.status(200).json({
      success: true,
      version: req.body.version,
      stacktrace: analyzedStackTrace
    });
  });
};