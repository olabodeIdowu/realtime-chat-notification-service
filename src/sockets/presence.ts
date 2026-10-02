import { redis } from "../config/redis";

const PRESENCE_PREFIX = "presence:";
const PRESENCE_TTL = 60; // seconds

export async function setUserOnline(
  userId: string,
  socketId: string,
  username: string,
) {
  const key = `${PRESENCE_PREFIX}${userId}`;
  await redis.hset(key, {
    socketId,
    username,
    status: "online",
    lastSeen: Date.now().toString(),
  });
  await redis.expire(key, PRESENCE_TTL);
}

export async function setUserOffline(userId: string) {
  const key = `${PRESENCE_PREFIX}${userId}`;
  await redis.hset(key, {
    status: "offline",
    lastSeen: Date.now().toString(),
  });
  await redis.expire(key, 60 * 60 * 24); // keep last seen for 24h
}

export async function refreshPresence(userId: string) {
  const key = `${PRESENCE_PREFIX}${userId}`;
  await redis.expire(key, PRESENCE_TTL);
}

export async function getPresence(userId: string) {
  return redis.hgetall(`${PRESENCE_PREFIX}${userId}`);
}
