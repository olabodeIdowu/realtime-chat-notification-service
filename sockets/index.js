// import { Server, Socket } from "socket.io";

export function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("join", (room) => {
      socket.join(room);
      socket.to(room).emit("user-joined", socket.id);
    });

    socket.on("message", ({ room, message }) => {
      io.to(room).emit("message", {
        id: socket.id,
        message,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
}
