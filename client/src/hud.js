import { TOTAL_LAPS } from '../../shared/trackData.js';

const lapNumEl   = document.getElementById('lap-num');
const lapTotalEl = document.getElementById('lap-total');
const posNumEl   = document.getElementById('pos-num');
const timerEl    = document.getElementById('race-timer');
const speedEl    = document.getElementById('speed-display');
const wrongWayEl = document.getElementById('wrong-way');
const lbPanel    = document.getElementById('leaderboard-panel');

if (lapTotalEl) lapTotalEl.textContent = TOTAL_LAPS;

let _raceStart = null;
let _timerRAF  = null;

export function startHUDTimer() {
  _raceStart = performance.now();
  function tick() {
    if (!_raceStart) return;
    const elapsed = (performance.now() - _raceStart) / 1000;
    timerEl.textContent = formatTime(elapsed);
    _timerRAF = requestAnimationFrame(tick);
  }
  _timerRAF = requestAnimationFrame(tick);
}

export function getRaceTime() {
  return _raceStart ? performance.now() - _raceStart : 0;
}

export function stopHUDTimer() {
  cancelAnimationFrame(_timerRAF);
}

export function updateHUD({ speed, lap, position }) {
  if (speedEl) speedEl.textContent = Math.round(Math.abs(speed) * 3.6);
  if (lapNumEl) lapNumEl.textContent = Math.min(lap + 1, TOTAL_LAPS);
  if (posNumEl) posNumEl.textContent = position;
}

export function updateLeaderboard(standings, myId) {
  if (!lbPanel) return;
  lbPanel.innerHTML = `<div class="lb-header">STANDINGS</div>`;
  standings.slice(0, 8).forEach((p, i) => {
    const cls = [
      'lb-row',
      p.id === myId ? 'me' : '',
      i === 0 ? 'leader' : ''
    ].join(' ');
    const posCls = i === 0 ? 'lb-pos p1' : i === 1 ? 'lb-pos p2' : i === 2 ? 'lb-pos p3' : 'lb-pos';
    lbPanel.innerHTML += `
      <div class="${cls}">
        <span class="${posCls}">P${i + 1}</span>
        <span class="lb-name">${escHtml(p.name)}</span>
        <span class="lb-lap">L${p.lap}</span>
      </div>`;
  });
}

export function showWrongWay(show) {
  if (wrongWayEl) wrongWayEl.classList.toggle('hidden', !show);
}

export function formatTime(secs) {
  const m   = Math.floor(secs / 60);
  const s   = Math.floor(secs % 60);
  const ms  = Math.floor((secs % 1) * 1000);
  return `${m}:${String(s).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
}

function escHtml(str) {
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
