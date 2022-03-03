const express = require("express"),
  Config = require("../config");

module.exports = (app) => {
  require("./api")(app);

  if (Config.isProduction) {
    app.use("/static", express.static("./build/static"));
    app.use("/favicon.ico", express.static("./build/favicon.ico"));
    app.use("*", express.static("./build"));
  }
};
