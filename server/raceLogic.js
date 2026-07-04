// Race logic: checkpoint validation and lap counting server-side

const CHECKPOINTS = [
  { id: 0, pos: [0, 0, 0],        radius: 65 },  // Start/Finish
  { id: 1, pos: [0, 0, -150],     radius: 65 },
  { id: 2, pos: [80, 0, -330],    radius: 65 },
  { id: 3, pos: [260, 0, -250],   radius: 65 },
  { id: 4, pos: [260, 0, -50],    radius: 65 },
  { id: 5, pos: [150, 0, 80],     radius: 65 },
  { id: 6, pos: [0, 0, 40],       radius: 65 },
];

export const TOTAL_LAPS = 3;

export function validateCheckpoint(player, state) {
  const cp = CHECKPOINTS[player.checkpoint];
  if (!cp) return false;

  const dx = state.x - cp.pos[0];
  const dz = state.z - cp.pos[2];
  const dist = Math.sqrt(dx*dx + dz*dz);

  if (dist <= cp.radius) {
    const isLastCheckpoint = player.checkpoint === CHECKPOINTS.length - 1;

    // Advance checkpoint
    player.checkpoint = (player.checkpoint + 1) % CHECKPOINTS.length;

    // Lap completed when passing the last checkpoint
    if (isLastCheckpoint) {
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
