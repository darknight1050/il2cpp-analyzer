const { loadVersions } = require('./analyzer');

require('dotenv').config()

const http = require("http"),
    express = require("express"),
    app = express(),
    cors = require("cors"),
    fileUpload = require("express-fileupload");

const server = http.createServer(app);

app.set("view engine", "ejs");
app.use("/static", express.static("public"))

app.use(cors());

app.use(fileUpload({
    createParentPath: true,
    limits: { fileSize: 128 * 1024 * 1024 },
  }));

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

async function start (){
    // Wait for all versions to be loaded before starting the server
    await loadVersions();
    
    server.listen(port, () =>
    console.log(`Server has started on port: ${port}`)
);
}
start();

