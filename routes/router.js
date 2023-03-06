module.exports = (app) => {
    require("./api")(app);
    require("./render")(app);
};
