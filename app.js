const path = require("path");
const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const cors = require("cors");

const AppError = require("./utils/appError");
const globalErrorHandler = require("./controllers/error/errorController");

const userRouter = require("./routes/user/userRoutes");
const merchantRouter = require("./modules/merchant/merchant.routes");
const analyticsRouter = require("./modules/analytics/analytics.routes");

// Start express app
const app = express();

const logger = (req, res, next) => {
  const originalWrite = res.write;
  const originalEnd = res.end;

  const chunks = [];

  res.write = (chunk, ...args) => {
    chunks.push(chunk);
    originalWrite.apply(res, [chunk, ...args]);
  };

  res.end = (chunk, ...args) => {
    if (chunk) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks).toString("utf8");
    if (res.statusCode >= 400) {
      console.error(`${req.method} ${req.url} ${res.statusCode} ${body}`);
    }
    originalEnd.apply(res, [chunk, ...args]);
  };

  next();
};

app.enable("trust proxy");
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

// 1) GLOBAL MIDDLEWARES
app.use(cors());
app.options("*", cors());
app.use(helmet());

// Improved Logger: Only log if not compressed or use Morgan for cleaner output
if (process.env.NODE_ENV?.trim() === "development") {
  app.use(logger);
  app.use(morgan("dev"));
}

app.use(express.static(path.join(__dirname, "public")));

// Body parsers
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));
app.use(cookieParser());

// Sanitization
app.use(mongoSanitize());
app.use(xss());
app.use(
  hpp({
    whitelist: ["ratingsQuantity", "ratingsAverage", "price"],
  }),
);

// Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.cookies);
  next();
});

// 3) ROUTES
app.use("/api/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/merchants", merchantRouter);
app.use("/api/analytics", analyticsRouter);

app.use(compression());

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
