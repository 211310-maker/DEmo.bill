const express = require("express");
const dotenv = require("dotenv");
const app = express();
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
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
// ✅ CORS CONFIG (LOCAL + RENDER FRONTEND)
// =============================================

const allowedOrigins = [
  "http://localhost:3000",                  // React dev
  "https://demo-bill-frontend.onrender.com" // Render frontend
];

// Manual CORS headers so we fully control the response
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
  }

  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, x-auth-token"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// Also keep cors() for safety
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // Postman/curl
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

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
