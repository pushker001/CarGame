// Shared between client (Three.js) and server (Node.js)
// City circuit control points — a closed loop
export const TRACK_POINTS = [
  [0, 0, 0],
  [0, 0, -250],      // Long main straight
  [80, 0, -330],     // Sweeping right turn
  [180, 0, -330],    // Short straight
  [260, 0, -250],    // Sweeping right turn
  [260, 0, -100],    // Straight back
  [300, 0, -50],     // Chicane right
  [260, 0, 0],       // Chicane left
  [150, 0, 80],      // Hairpin / sweep
  [50, 0, 80],       // Return straight
  [0, 0, 0]          // Back to start
];

// Checkpoints: each is a 3D position along the track
// Used server-side to validate lap progress
export const CHECKPOINTS = [
  { id: 0, pos: [0, 0, 0],        radius: 65 },  // Start/Finish
  { id: 1, pos: [0, 0, -150],     radius: 65 },
  { id: 2, pos: [80, 0, -330],    radius: 65 },
  { id: 3, pos: [260, 0, -250],   radius: 65 },
  { id: 4, pos: [260, 0, -50],    radius: 65 },
  { id: 5, pos: [150, 0, 80],     radius: 65 },
  { id: 6, pos: [50, 0, 30],      radius: 65 },
];

export const TOTAL_LAPS = 3;
export const TRACK_WIDTH = 30;
export const PLAYERS_PER_ROOM = 12;
export const COUNTDOWN_SECONDS = 5;
export const RACE_TIMEOUT_MS = 5 * 60 * 1000; // 5 min max race
