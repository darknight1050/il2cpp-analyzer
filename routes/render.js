const { getCrashes } = require("../storage/storageMongoDB"); 

module.exports = (app) => {
    app.get("/", async (req, res) => {
        res.render("index");
    });

    app.get("/crashes", async (req, res) => {
        res.render("crashes", {
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