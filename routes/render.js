const { getCrashes } = require("../storage"); 

module.exports = (app) => {
    app.get("/", async (req, res) => {
        res.render("index");
    });

    app.get("/crashes", async (req, res) => {
        res.render("crashes");
    });

    app.get("/crashes/:crashId", async (req, res) => {
        if(req.params.crashId === "latest") {
            res.redirect("./" + (await getCrashes())[0].crashId);
            return;
        }
        res.render("crash", { crashId: req.params.crashId });
    });
}