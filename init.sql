CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY,
  room VARCHAR(100) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  username VARCHAR(100) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_room_created (room, created_at)
);