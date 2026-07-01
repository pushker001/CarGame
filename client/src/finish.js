import sponsorsConfig from '../../config/sponsors.json';
import { formatTime } from './hud.js';
import { showLobby }  from './lobby.js';

const finishEl    = document.getElementById('finish-screen');
const podiumEl    = document.getElementById('finish-podium');
const standingsEl = document.getElementById('finish-standings');
const ctaEl       = document.getElementById('finish-cta');
const againBtn    = document.getElementById('race-again-btn');

const MEDALS = ['🥇', '🥈', '🥉'];

export function showFinishScreen(standings, myId, onRaceAgain) {
  if (!finishEl) return;
  finishEl.classList.remove('hidden');

  // Podium (top 3)
  if (podiumEl) {
    const top3 = standings.slice(0, 3);
    const order = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
    podiumEl.innerHTML = '';

    // Render 2nd, 1st, 3rd layout (classic podium)
    const renderPositions = top3.length >= 3
      ? [1, 0, 2]
      : top3.map((_, i) => i);

    for (const pi of renderPositions) {
      const p = top3[pi];
      if (!p) continue;
      const cls = ['podium-card', `p${pi + 1}`].join(' ');
      const card = document.createElement('div');
      card.className = cls;
      card.innerHTML = `
        <div class="podium-medal">${MEDALS[pi] || '🏁'}</div>
        <div class="podium-name">${escHtml(p.name)}</div>
        <div class="podium-time">${p.lapTime ? formatTime(p.lapTime) : '—'}</div>
        ${p.flag ? `<div style="font-size:1.2rem;margin-top:4px">${p.flag}</div>` : ''}
      `;
      podiumEl.appendChild(card);
    }
  }

  // Full standings list
  if (standingsEl) {
    standingsEl.innerHTML = '';
    standings.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = `standings-row ${p.id === myId ? 'me' : ''}`;
      const posCls = i < 3 ? `standings-pos p${i+1}` : 'standings-pos';
      row.innerHTML = `
        <span class="${posCls}">${i + 1}</span>
        <span class="standings-flag">${p.flag || '🌍'}</span>
        <span class="standings-name">${escHtml(p.name)}</span>
        <span class="standings-time">${p.lapTime ? formatTime(p.lapTime) : '—'}</span>
      `;
      standingsEl.appendChild(row);
    });
  }

  // Sponsor CTA
  if (ctaEl && sponsorsConfig.finish_cta) {
    const cta = sponsorsConfig.finish_cta;
    ctaEl.innerHTML = `🏁 ${escHtml(cta.text)}`;
    if (cta.url) {
      ctaEl.style.cursor = 'pointer';
      ctaEl.onclick = () => window.open(cta.url, '_blank');
    }
  }

  againBtn?.addEventListener('click', () => {
    finishEl.classList.add('hidden');
    onRaceAgain?.();
  }, { once: true });
}

export function hideFinishScreen() {
  finishEl?.classList.add('hidden');
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
