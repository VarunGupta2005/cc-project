import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// 1. Transactional & Query Client
export const redisClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
  },
});

// 2. Dedicated Subscription Client (Redis mandates dedicated connection for subscribers)
export const redisSubClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
  },
});

redisClient.on('error', (err) => console.error('[Redis Client Error]', err));
redisSubClient.on('error', (err) => console.error('[Redis SubClient Error]', err));

export async function initRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log('[Redis] Command client connected.');
  }
  if (!redisSubClient.isOpen) {
    await redisSubClient.connect();
    console.log('[Redis] Subscriber client connected.');
  }
}
