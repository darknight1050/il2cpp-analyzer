const Development = {

};

const Production = {

};

const isProduction = process.env.NODE_ENV !== "development";
const Config = isProduction ? Production : Development;
Config.isProduction = isProduction;

module.exports = Config;
