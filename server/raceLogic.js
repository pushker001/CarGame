// Race logic: checkpoint validation and lap counting server-side

const CHECKPOINTS = [
  { id: 0, pos: [0, 0, 0],        radius: 30 },
  { id: 1, pos: [120, 0, -50],    radius: 25 },
  { id: 2, pos: [200, 0, -180],   radius: 25 },
  { id: 3, pos: [100, 0, -350],   radius: 25 },
  { id: 4, pos: [-80, 0, -340],   radius: 25 },
  { id: 5, pos: [-170, 0, -200],  radius: 25 },
  { id: 6, pos: [-150, 0, -60],   radius: 25 },
];

export const TOTAL_LAPS = 3;

export function validateCheckpoint(player, state) {
  const cp = CHECKPOINTS[player.checkpoint];
  if (!cp) return false;

  const dx = state.x - cp.pos[0];
  const dz = state.z - cp.pos[2];
  const dist = Math.sqrt(dx*dx + dz*dz);

  if (dist <= cp.radius) {
    player.checkpoint = (player.checkpoint + 1) % CHECKPOINTS.length;

    // Completed a full lap?
    if (player.checkpoint === 0) {
      player.lap++;
      player.lapCompletedAt = Date.now();
    }
    return true;
  }
  return false;
}

export function computeStandings(players) {
  // Sort: more laps > more checkpoints > less time
  const arr = Object.values(players);
  arr.sort((a, b) => {
    if (b.lap !== a.lap) return b.lap - a.lap;
    if (b.checkpoint !== a.checkpoint) return b.checkpoint - a.checkpoint;
    return (a.lapCompletedAt || Infinity) - (b.lapCompletedAt || Infinity);
  });
  return arr.map((p, i) => ({
    id:        p.id,
    name:      p.name,
    flag:      p.flag,
    lap:       p.lap,
    checkpoint: p.checkpoint,
    position:  i + 1,
    lapTime:   p.lapTimes?.[p.lapTimes.length - 1],
    finished:  p.lap >= TOTAL_LAPS,
  }));
}
