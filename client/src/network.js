import { io } from 'socket.io-client';

let socket = null;
const handlers = {};

export function connect(serverUrl) {
  socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('[net] connected', socket.id);
    emit('_connected');
  });

  socket.on('disconnect', () => {
    console.log('[net] disconnected');
    emit('_disconnected');
  });

  // Forward all server events to local listeners
  const serverEvents = [
    'room_state',
    'player_joined',
    'player_left',
    'car_update',
    'race_countdown',
    'race_start',
    'race_standings',
    'race_finish',
    'checkpoint_ack',
    'stats',
  ];
  for (const evt of serverEvents) {
    socket.on(evt, data => emit(evt, data));
  }
}

export function send(event, data) {
  if (socket) socket.emit(event, data);
}

export function on(event, fn) {
  if (!handlers[event]) handlers[event] = [];
  handlers[event].push(fn);
}

export function off(event, fn) {
  if (!handlers[event]) return;
  handlers[event] = handlers[event].filter(h => h !== fn);
}

export function getSocketId() {
  return socket?.id;
}

function emit(event, data) {
  const fns = handlers[event];
  if (fns) fns.forEach(fn => fn(data));
}
