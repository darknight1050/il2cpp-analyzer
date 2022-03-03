const http = require("http"),
  express = require("express"),
  app = express(),
  cors = require("cors");

const server = http.createServer(app);

app.use(cors());

app.use(express.json());

require("./routes/router")(app);

app.use(function (err, req, res, next) {
  if (err) {
    res.status(500).end();
  } else {
    next();
  }
});

server.listen(process.env.PORT || 5000, () =>
  console.log(`Server has started.`)
);
