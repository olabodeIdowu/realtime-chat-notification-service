import Redis from "ioredis";
import { config } from "./index";

export const pubClient = new Redis(config.redisUrl);
export const subClient = pubClient.duplicate();

export const redis = pubClient; // general purpose
