const express = require("express"),
    Config = require("../config");

module.exports = (app) => {
    require("./api")(app);
    require("./render")(app);
};
