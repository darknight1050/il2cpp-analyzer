const Development = {
    isProduction: false
};

const Production = {
    isProduction: true
};

const isProduction = process.env.NODE_ENV.localeCompare("production");
const Config = isProduction ? Production : Development;

module.exports = Config;
