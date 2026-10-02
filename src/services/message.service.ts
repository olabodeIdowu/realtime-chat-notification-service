import mysql from "mysql2/promise";
import { config } from "../config";

const pool = mysql.createPool({
  host: config.mysql.host,
  port: config.mysql.port,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,
  waitForConnections: true,
  connectionLimit: 10,
});

export class MessageService {
  async saveMessage(message: {
    id: string;
    room: string;
    userId: string;
    username: string;
    text: string;
    timestamp: string;
  }) {
    await pool.execute(
      `INSERT INTO messages (id, room, user_id, username, text, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        message.room,
        message.userId,
        message.username,
        message.text,
        message.timestamp,
      ],
    );
  }

  async getRecentMessages(room: string, limit = 50) {
    const [rows] = await pool.execute(
      `SELECT id, room, user_id as userId, username, text, created_at as timestamp
       FROM messages
       WHERE room = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [room, limit],
    );
    return (rows as any[]).reverse();
  }
}
