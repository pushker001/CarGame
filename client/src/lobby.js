// Lobby screen controller
import * as Net from './network.js';

const lobbyEl       = document.getElementById('lobby-screen');
const nameInput     = document.getElementById('player-name');
const joinBtn       = document.getElementById('join-btn');
const onlineCountEl = document.getElementById('online-count');
const waitingEl     = document.getElementById('waiting-count');
const joinFeedEl    = document.getElementById('join-feed');

const ADJECTIVES = ['Fast','Turbo','Neon','Storm','Apex','Ghost','Blaze','Nova','Hyper','Flash'];
const NOUNS      = ['Racer','Driver','Pilot','Runner','Hawk','Wolf','Fox','Viper','Tiger','Bolt'];

function randomName() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a}${n}${Math.floor(Math.random() * 99)}`;
}

export function initLobby(onJoin, onSolo) {
  if (nameInput) nameInput.value = randomName();

  Net.on('stats', ({ online, waiting }) => {
    if (onlineCountEl) onlineCountEl.textContent = online;
    if (waitingEl) waitingEl.textContent = waiting;
  });

  Net.on('player_joined', ({ name, country, flag }) => {
    addJoinFeedEntry(flag, name, country);
    showToast(`${flag || '🌍'} ${name} joined from ${country || 'Unknown'}`);
  });

  joinBtn?.addEventListener('click', () => {
    const name = nameInput?.value.trim() || randomName();
    onJoin(name);
  });

  // Solo practice button
  const soloBtn = document.getElementById('solo-btn');
  soloBtn?.addEventListener('click', () => {
    const name = nameInput?.value.trim() || randomName();
    onSolo?.(name);
  });

  nameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinBtn?.click();
  });
}


export function hideLobby() {
  lobbyEl?.classList.add('hidden');
}

export function showLobby() {
  lobbyEl?.classList.remove('hidden');
}

function addJoinFeedEntry(flag, name, country) {
  if (!joinFeedEl) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.position = 'relative';
  el.style.animation = 'toastIn 0.3s ease forwards';
  el.textContent = `${flag || '🌍'} ${name} from ${country || 'Unknown'}`;
  joinFeedEl.prepend(el);
  // Keep only last 4
  while (joinFeedEl.children.length > 4) {
    joinFeedEl.lastChild?.remove();
  }
}

export function showToast(msg, duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}
