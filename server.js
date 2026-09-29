const dotenv = require("dotenv");

process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION! ðŸ’¥ Shutting down...");
  console.log(err, err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: "./.env" });
const app = require("./app");
const { setupSocketHandlers } = require("./sockets");

const port = process.env.PORT || 3000;

const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
  },
});

app.use((req, res, next) => {
  req.io = io; // Attach io to request
  next();
});

setupSocketHandlers(io);

// io.use((socket, next) => {
//   const token = socket.handshake.auth.token;
//   if (!token) return next(new Error("Authentication error"));
//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     socket.userId = decoded.userId;
//     socket.role = decoded.role;
//     next();
//   } catch (error) {
//     next(new Error("Authentication error"));
//   }
// });

const server = http.listen(port, () =>
  console.log(`App running on port ${port}...`),
);

process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION! 💥 Shutting down...");
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  console.log("👋 SIGTERM RECEIVED. Shutting down gracefully");
  server.close(() => {
    console.log("💥 Process terminated!");
  });
});
