import { io } from 'socket.io-client';
import { API_BASE } from './api';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      console.log(`[Socket.io] Connected to RescueGrid cluster. ID: ${socket.id}`);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.io Connection Error]', err.message);
    });
  }
  return socket;
}
