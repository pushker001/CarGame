// Shared between client (Three.js) and server (Node.js)
// City circuit control points — a closed loop
export const TRACK_POINTS = [
  [0, 0, 0],
  [80, 0, -20],
  [160, 0, -80],
  [200, 0, -180],
  [180, 0, -280],
  [120, 0, -340],
  [40, 0, -360],
  [-60, 0, -340],
  [-140, 0, -280],
  [-180, 0, -200],
  [-160, 0, -100],
  [-100, 0, -30],
  [-40, 0, 10],
  [0, 0, 0],
];

// Checkpoints: each is a 3D position along the track
// Used server-side to validate lap progress
export const CHECKPOINTS = [
  { id: 0, pos: [0, 0, 0],        radius: 65 },  // Start/Finish
  { id: 1, pos: [120, 0, -50],    radius: 65 },
  { id: 2, pos: [200, 0, -180],   radius: 65 },
  { id: 3, pos: [100, 0, -350],   radius: 65 },
  { id: 4, pos: [-80, 0, -340],   radius: 65 },
  { id: 5, pos: [-170, 0, -200],  radius: 65 },
  { id: 6, pos: [-150, 0, -60],   radius: 65 },
];

export const TOTAL_LAPS = 3;
export const TRACK_WIDTH = 30;
export const PLAYERS_PER_ROOM = 12;
export const COUNTDOWN_SECONDS = 5;
export const RACE_TIMEOUT_MS = 5 * 60 * 1000; // 5 min max race
