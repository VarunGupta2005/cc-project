import { Server } from 'socket.io';
import { redisSubClient } from '../config/redis.js';

let ioInstance = null;

export function initSocketManager(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  ioInstance.on('connection', (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Allow shelters or couriers to join private notification rooms
    socket.on('join:room', (roomName) => {
      socket.join(roomName);
      console.log(`[WebSocket] Socket ${socket.id} joined room: ${roomName}`);
    });

    socket.on('disconnect', () => {
      // console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });
  });

  // -------------------------------------------------------------
  // Bridge Redis Pub/Sub alerts into WebSockets
  // Ensures events broadcast across all 3 load-balanced container replicas!
  // -------------------------------------------------------------
  try {
    redisSubClient.subscribe('channel:alerts', (message) => {
      try {
        const parsed = JSON.parse(message);
        // console.log('[Redis Pub/Sub Alert Bridge]', parsed.event);

        if (parsed.event === 'FOOD_POSTED') {
          ioInstance.emit('food:new_alert', parsed);
        } else if (parsed.event === 'FOOD_CLAIMED') {
          ioInstance.emit('food:claimed', parsed);
        } else if (parsed.event === 'FOOD_EXPIRED') {
          ioInstance.emit('food:expired', parsed);
        } else if (parsed.event === 'DELIVERY_UPDATE') {
          ioInstance.emit('delivery:update', parsed);
        }
      } catch (e) {
        console.error('[Error processing Pub/Sub message]', e);
      }
    });
    console.log('[SocketManager] Subscribed to Redis channel:alerts bridge.');
  } catch (err) {
    console.error('[SocketManager] Failed to subscribe to channel:alerts', err);
  }

  return ioInstance;
}

export function getIO() {
  return ioInstance;
}
