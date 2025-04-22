const { loadVersions, readVersion } = require("./analyzer"),
    { downloadPackages } = require("./qpackagesDownloader"),
    { updateCache } = require("./bsquest-so-info");
require("dotenv").config();

const http = require("http"),
    express = require("express"),
    app = express(),
    cors = require("cors"),
    fileUpload = require("express-fileupload");

const server = http.createServer(app);

app.set("view engine", "ejs");
app.use("/static", express.static("public"));

app.use(cors());

app.use(
    fileUpload({
        createParentPath: true,
        limits: { fileSize: 128 * 1024 * 1024 },
    })
);

require("./routes/router")(app);

app.use(async (err, req, res, next) => {
    if (err) {
        console.log(err);
        res.status(500).end();
    } else {
        next();
    }
});
let port = process.env.PORT || 5000;

const updatePackages = async () => {
    await updateCache();
    for (const path of await downloadPackages()) {
        readVersion(path);
    }
};

const start = async () => {
    // Wait for all versions to be loaded before starting the server
    await loadVersions();

    server.listen(port, () =>
        console.log(`Server has started on port: ${port}`)
    );

    updatePackages();
    setInterval(updatePackages, 60 * 60 * 1000);
};
start();
