import { createServer } from "http";
import { Server } from "socket.io";
import app from "./app";
import { setupSocket } from "./sockets";
import { config } from "./config";
import { producer } from "./config/kafka";

process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION! ðŸ’¥ Shutting down...");
  console.log(err, err.name, err.message);
  process.exit(1);
});

async function bootstrap() {
  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  setupSocket(io);

  // Connect Kafka producer (optional – continues even if Kafka is down)
  try {
    await producer.connect();
    console.log("Kafka producer connected");
  } catch (err) {
    console.warn("Kafka not available – continuing without it");
  }

  const server = httpServer.listen(config.port, () => {
    console.log(
      `🚀 Real-time Chat service running on http://localhost:${config.port}`,
    );
  });

  process.on("unhandledRejection", (err: any) => {
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
}

bootstrap();
