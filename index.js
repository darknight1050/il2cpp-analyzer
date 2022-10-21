const http = require("http"),
    express = require("express"),
    app = express(),
    cors = require("cors");

const server = http.createServer(app);

app.set("view engine", "ejs");

app.use(cors());

require("./routes/router")(app);

app.use(async (err, req, res, next) => {
    if (err) {
        console.log(err);
        res.status(500).end();
    } else {
        next();
    }
});

server.listen(process.env.PORT || 5000, () =>
    console.log("Server has started.")
);
