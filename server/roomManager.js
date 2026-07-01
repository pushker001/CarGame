import { validateCheckpoint, computeStandings, TOTAL_LAPS } from './raceLogic.js';

const PLAYERS_PER_ROOM  = 12;
const COUNTDOWN_SECS    = 5;
const RACE_TIMEOUT_MS   = 5 * 60 * 1000;
const STANDINGS_HZ      = 5;  // broadcast standings 5x/sec
const FINISH_WAIT_MS    = 20 * 1000; // wait 20s after first finish for others

let rooms = {};
let roomCounter = 0;

export function createRoom(io) {
  const id = `room_${++roomCounter}`;
  rooms[id] = {
    id,
    io,
    players: {},     // socketId → player
    status: 'WAITING',
    startTime: null,
    finishTimer: null,
    standingsInterval: null,
    countdownTimer: null,
  };
  return rooms[id];
}

export function getAvailableRoom(io) {
  // Find a WAITING room with space
  for (const room of Object.values(rooms)) {
    if (room.status === 'WAITING' && Object.keys(room.players).length < PLAYERS_PER_ROOM) {
      return room;
    }
  }
  return createRoom(io);
}

export function addPlayerToRoom(room, socket, playerData) {
  const gridIndex = Object.keys(room.players).length;
  room.players[socket.id] = {
    id:              socket.id,
    socket,
    name:            playerData.name,
    color:           playerData.color,
    flag:            playerData.flag,
    country:         playerData.country,
    lap:             0,
    checkpoint:      0,
    lapTimes:        [],
    lapCompletedAt:  null,
    finished:        false,
    gridIndex,
    lastState:       null,
  };

  socket.join(room.id);

  // Broadcast to others in room
  socket.to(room.id).emit('player_joined', {
    id:        socket.id,
    name:      playerData.name,
    color:     playerData.color,
    flag:      playerData.flag,
    country:   playerData.country,
    gridIndex,
  });

  // Send this player current room state (who's already here)
  const roomPlayers = Object.values(room.players).map(p => ({
    id: p.id, name: p.name, color: p.color, flag: p.flag, gridIndex: p.gridIndex,
  }));
  socket.emit('room_state', { roomId: room.id, players: roomPlayers });
  // Also tell them their own join with gridIndex
  socket.emit('player_joined', {
    id: socket.id,
    name: playerData.name,
    color: playerData.color,
    gridIndex,
    self: true,
  });

  console.log(`[room ${room.id}] ${playerData.name} joined (${Object.keys(room.players).length} players)`);

  // Auto-start: 2+ players and not started yet
  if (room.status === 'WAITING' && Object.keys(room.players).length >= 2) {
    startCountdown(room);
  }

  return room.players[socket.id];
}

export function removePlayerFromRoom(socket, rooms) {
  for (const room of Object.values(rooms)) {
    if (room.players[socket.id]) {
      const player = room.players[socket.id];
      delete room.players[socket.id];
      socket.to(room.id).emit('player_left', { id: socket.id, name: player.name });
      console.log(`[room ${room.id}] ${player.name} left (${Object.keys(room.players).length} left)`);

      // Clean up empty rooms
      if (Object.keys(room.players).length === 0) {
        cleanupRoom(room);
        delete rooms[room.id];
      }
      return;
    }
  }
}

export function handleCarUpdate(room, socketId, state) {
  const player = room.players[socketId];
  if (!player || room.status !== 'RACING') return;
  player.lastState = state;
  validateCheckpoint(player, state);

  // Relay to others
  room.socket?.to(room.id).emit('car_update', { id: socketId, state });
}

function startCountdown(room) {
  if (room.status !== 'WAITING') return;
  room.status = 'COUNTDOWN';
  room.io.to(room.id).emit('race_countdown', { seconds: COUNTDOWN_SECS });
  console.log(`[room ${room.id}] countdown started`);

  room.countdownTimer = setTimeout(() => {
    startRace(room);
  }, (COUNTDOWN_SECS + 1) * 1000);
}

function startRace(room) {
  room.status = 'RACING';
  room.startTime = Date.now();
  room.io.to(room.id).emit('race_start', { startTime: room.startTime });
  console.log(`[room ${room.id}] race started!`);

  // Broadcast standings every 200ms
  room.standingsInterval = setInterval(() => {
    if (Object.keys(room.players).length === 0) return;
    const s = computeStandings(room.players);
    room.io.to(room.id).emit('race_standings', { standings: s });

    // Check if all finished
    const allDone = Object.values(room.players).every(p => p.lap >= TOTAL_LAPS);
    if (allDone) {
      endRace(room);
    }
  }, 1000 / STANDINGS_HZ);

  // Timeout safety
  room.raceTimeout = setTimeout(() => endRace(room), RACE_TIMEOUT_MS);
}

export function handlePlayerFinish(room, socketId) {
  const player = room.players[socketId];
  if (!player || room.status !== 'RACING') return;
  player.finished = true;
  player.lap = TOTAL_LAPS;
  player.finishTime = Date.now() - room.startTime;
  console.log(`[room ${room.id}] ${player.name} finished in ${player.finishTime}ms`);

  // Start finish window timer on first finisher
  if (!room.finishTimer) {
    room.finishTimer = setTimeout(() => endRace(room), FINISH_WAIT_MS);
  }
}

function endRace(room) {
  if (room.status === 'FINISHED') return;
  room.status = 'FINISHED';
  clearInterval(room.standingsInterval);
  clearTimeout(room.raceTimeout);
  clearTimeout(room.finishTimer);

  const finalStandings = computeStandings(room.players);
  room.io.to(room.id).emit('race_finish', { standings: finalStandings });
  console.log(`[room ${room.id}] race finished!`);

  // Reset room for next race after 30s
  setTimeout(() => resetRoom(room), 30000);
}

function resetRoom(room) {
  room.status = 'WAITING';
  for (const p of Object.values(room.players)) {
    p.lap = 0;
    p.checkpoint = 0;
    p.lapTimes = [];
    p.finished = false;
    p.lapCompletedAt = null;
    p.lastState = null;
  }
  console.log(`[room ${room.id}] reset for next race`);
}

function cleanupRoom(room) {
  clearInterval(room.standingsInterval);
  clearTimeout(room.raceTimeout);
  clearTimeout(room.finishTimer);
  clearTimeout(room.countdownTimer);
}

export function getAllRooms() { return rooms; }
