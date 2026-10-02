import { Server, Socket } from "socket.io";
import { setUserOnline, setUserOffline, refreshPresence } from "./presence";
import { MessageService } from "../services/message.service";
import { producer } from "../config/kafka";

const messageService = new MessageService();

export function registerHandlers(io: Server, socket: Socket) {
  let currentUserId: string | null = null;

  // Join a room + set presence
  socket.on(
    "join",
    async (payload: { room: string; userId: string; username: string }) => {
      const { room, userId, username } = payload;
      currentUserId = userId;

      socket.join(room);
      await setUserOnline(userId, socket.id, username);

      // Notify others in the room
      socket.to(room).emit("presence", {
        userId,
        username,
        status: "online",
      });

      // Send recent messages (optional)
      const history = await messageService.getRecentMessages(room, 50);
      socket.emit("history", history);

      console.log(`${username} joined room ${room}`);
    },
  );

  // Heartbeat to keep presence alive
  socket.on("heartbeat", async (userId: string) => {
    await refreshPresence(userId);
  });

  // Send message
  socket.on(
    "message",
    async (payload: {
      room: string;
      userId: string;
      username: string;
      text: string;
    }) => {
      const message = {
        id: crypto.randomUUID(),
        room: payload.room,
        userId: payload.userId,
        username: payload.username,
        text: payload.text,
        timestamp: new Date().toISOString(),
      };

      // Persist
      await messageService.saveMessage(message);

      // Broadcast to room
      io.to(payload.room).emit("message", message);

      // Emit to Kafka for notifications / analytics
      try {
        await producer.send({
          topic: "chat.messages",
          messages: [{ value: JSON.stringify(message) }],
        });
      } catch (err) {
        console.error("Kafka produce error:", err);
      }
    },
  );

  // Disconnect
  socket.on("disconnect", async () => {
    if (currentUserId) {
      await setUserOffline(currentUserId);
      // Optionally broadcast offline status to rooms the user was in
      console.log(`User ${currentUserId} disconnected`);
    }
  });
}
