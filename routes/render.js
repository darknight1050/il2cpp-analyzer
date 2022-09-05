const express = require("express"), 
    { getCrashes, getCrash } = require("../storage");

module.exports = (app) => {
    app.get("/", async (req, res) => {
        res.render("index");
    });

    app.get("/crashes", async (req, res) => {
        res.render("crashes", { crashes: await getCrashes() });
    });

    app.get("/crashes/:crashId", async (req, res) => {
        if(req.params.crashId === "latest") {
            res.redirect("./" + (await getCrashes())[0].crashId);
            return;
        }
        const crash = await getCrash(req.params.crashId);
        res.render("crash", { crash: crash });
    });
}