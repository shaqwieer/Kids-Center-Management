/** Socket.IO client wiring. Binds server events to store-provided handlers. */
import { io } from 'socket.io-client';

let socket = null;

export function connectSocket(token, handlers = {}) {
  if (socket) socket.disconnect();
  const url = import.meta.env.VITE_SOCKET_URL || undefined; // '' -> same origin
  socket = io(url, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
  });

  socket.on('connect', () => handlers.onConnect?.());
  socket.on('connected', (p) => handlers.onConnected?.(p));
  socket.on('disconnect', () => handlers.onDisconnect?.());
  socket.on('connect_error', (e) => handlers.onError?.(e));
  socket.on('session:created', (p) => handlers.onCreated?.(p));
  socket.on('session:updated', (p) => handlers.onUpdated?.(p));
  socket.on('session:ended', (p) => handlers.onEnded?.(p));
  socket.on('notification:sent', (p) => handlers.onNotification?.(p));
  socket.on('tick', (p) => handlers.onTick?.(p));

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket() { return socket; }
