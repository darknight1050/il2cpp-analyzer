const express = require("express"), 
    { getCrashes, getCrash } = require("../storage");

module.exports = (app) => {
    app.get("/", async (req, res) => {
        res.render("index");
    });

    app.get("/crashes", async (req, res) => {
        res.render("crashes", { crashes: getCrashes() });
    });

    app.get("/crashes/:crashId", async (req, res) => {
        if(req.params.crashId === "latest") {
            res.redirect("./" + getCrashes()[0]);
            return;
        }

        res.render("crash", { crash: getCrash(req.params.crashId) });
    });
}