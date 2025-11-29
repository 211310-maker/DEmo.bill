const express = require("express");
const dotenv = require("dotenv");
const app = express();
const morgan = require("morgan");
const helmet = require("helmet");
const xssClean = require("xss-clean");
const hpp = require("hpp");
const path = require("path");
const pdf = require("express-pdf");
const cookieParser = require("cookie-parser");
const logger = require("./logger");
require("colors");

// Load ENV
dotenv.config({
  path: `${path.join(
    __dirname,
    "config",
    process.env.NODE_ENV || "local"
  )}.env`,
});

const cors = require("cors");

app.use(cors({
origin: [
"https://demo-bill-frontend.onrender.com",
"http://localhost:3000"
],
credentials: true,
methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
allowedHeaders: ["Content-Type", "x-auth-token", "authorization"]
}));

app.options("*", cors());

// Routes Imports
const authRoute = require("./routes/auth");
const billRoute = require("./routes/bill");
const { appView, statusView } = require("./routes/appView");
const errorHandler = require("./middleware/error");

// =============================================
// STATIC FILES
// =============================================
app.use(
  "/static",
  express.static(path.join(__dirname, "public", "build", "static"))
);
app.use(express.static(path.join(__dirname, "public/"), { index: false }));
app.use(pdf);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// =============================================
// SECURITY MIDDLEWARES
// =============================================
app.use(helmet());
app.use(xssClean());
app.use(hpp());

// LOGGER
app.use(morgan("dev"));

// PARSERS
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// =============================================
// ROUTES
// =============================================
app.use("/auth", authRoute);
app.use("/bill", billRoute);
app.use("/app", appView);
app.get("/check", statusView);

// ERROR HANDLER
app.use(errorHandler);

// =============================================
// GLOBAL ERROR HANDLERS
// =============================================
process.on("uncaughtException", (err, promise) => {
  logger.error(err.message);
  process.exit(1);
});

process.on("unhandledRejection", (err, promise) => {
  logger.error(err.message);
  process.exit(1);
});

module.exports = app;
