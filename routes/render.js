const { getBeatSaberVersions } = require("../analyzer");
const { getCrashes } = require("../storage/storageMongoDB"); 

/**
 * Temporary array for game versions
 * @type {Array<{name:string, value: string}>}
 */
let bsVersions = [];

function ShortenGameVersion(version) {
    const regex = /(\_\d*)/g;
    // Remove the _ and the number
    return version.replace(regex, "");
}

module.exports = (app) => {
    app.get("/", async (req, res) => {
        res.render("index");
    });

    app.get("/uploadDebug", async (req, res) => {
        res.render("uploadDebug");
    });

    app.get("/crashes", async (req, res) => {
        // Get game version for select
        if (bsVersions.length === 0) {
            const versions = getBeatSaberVersions();
            if (versions.length !== 0) {
                for (const [version, buildID] of Object.entries(versions)) {
                    bsVersions.unshift({ name: ShortenGameVersion(version), value: version });
                }
            }
        }
        
        res.render("crashes", {
            bsVersions,
            queryParams: req.query,
        });
    });

    app.get("/crashes/:crashId", async (req, res) => {
        if(req.params.crashId === "latest") {
            res.redirect("./" + (await getCrashes({ limit: 1 }))[0].crashId);
            return;
        }
        res.render("crash", { crashId: req.params.crashId });
    });
}