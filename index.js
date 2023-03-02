require('dotenv').config()

const http = require("http"),
    express = require("express"),
    app = express(),
    cors = require("cors");

const server = http.createServer(app);

app.set("view engine", "ejs");
app.use('/static', express.static('public'))

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
let port = process.env.PORT || 5000;
server.listen(port, () =>
    console.log(`Server has started on port: ${port}`)
);
