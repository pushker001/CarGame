import express    from 'express';
import { createServer } from 'http';
import path       from 'path';
import { fileURLToPath } from 'url';
import { Server as SocketIO } from 'socket.io';
import { geolocate } from './geo.js';
import {
  getAvailableRoom,
  addPlayerToRoom,
  removePlayerFromRoom,
  handleCarUpdate,
  handlePlayerFinish,
  getAllRooms,
} from './roomManager.js';

const PORT = process.env.PORT || 3001;
const app  = express();
const http = createServer(app);
const io   = new SocketIO(http, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(express.json());

// ── Serve Frontend ────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Stats endpoint
app.get('/stats', (_, res) => {
  const rooms  = getAllRooms();
  const online = io.engine.clientsCount;
  const waiting = Object.values(rooms)
    .filter(r => r.status === 'WAITING')
    .reduce((sum, r) => sum + Object.keys(r.players).length, 0);
  res.json({ online, waiting, rooms: Object.keys(rooms).length });
});

// ── Socket.io ─────────────────────────────────────────────
io.on('connection', async (socket) => {
  const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || socket.handshake.address;

  console.log(`[server] connect ${socket.id} ip=${ip}`);

  // Geolocate
  const geo = await geolocate(ip);

  // Broadcast global stats
  broadcastStats();

  // ── player_join ──
  socket.on('player_join', async (data) => {
    const name  = (data?.name || 'Racer').substring(0, 20);
    const color = data?.color || 0x00f5d4;

    const room = getAvailableRoom(io);
    socket._room = room;
    socket._player = addPlayerToRoom(room, socket, {
      name, color,
      flag:    geo.flag,
      country: geo.country,
    });

    // Broadcast join to everyone (for global join feed)
    io.emit('player_joined', {
      id:      socket.id,
      name,
      country: geo.country,
      flag:    geo.flag,
    });

    broadcastStats();
  });

  // ── car_update ──
  socket.on('car_update', (state) => {
    if (!socket._room) return;
    // Relay state to others in room
    socket.to(socket._room.id).emit('car_update', { id: socket.id, state });
    // Validate checkpoints server-side
    handleCarUpdate(socket._room, socket.id, state);
  });

  // ── race_finish (player signals they finished) ──
  socket.on('race_finish', (data) => {
    if (!socket._room) return;
    handlePlayerFinish(socket._room, socket.id);
  });

  // ── disconnect ──
  socket.on('disconnect', () => {
    console.log(`[server] disconnect ${socket.id}`);
    removePlayerFromRoom(socket, getAllRooms());
    broadcastStats();
  });
});

function broadcastStats() {
  const rooms  = getAllRooms();
  const online  = io.engine.clientsCount;
  const waiting = Object.values(rooms)
    .filter(r => r.status === 'WAITING')
    .reduce((sum, r) => sum + Object.keys(r.players).length, 0);
  io.emit('stats', { online, waiting });
}

// Fallback to frontend index for any unknown routes (SPA support)
app.get('/(.*)', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

http.listen(PORT, () => {
  console.log(`\n🏁 Brand Grand Prix Server running on http://localhost:${PORT}\n`);
});
