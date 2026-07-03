import * as THREE from 'three';
import { buildTrack }           from './track.js';
import { Car }                  from './car.js';
import { RemoteCar }            from './remoteCar.js';
import { ChaseCamera }          from './camera.js';
import { updateHUD, updateLeaderboard, startHUDTimer, stopHUDTimer } from './hud.js';
import { initLobby, hideLobby, showLobby, showToast } from './lobby.js';
import { showFinishScreen, hideFinishScreen } from './finish.js';
import { loadBranding }         from './branding.js';
import { createBalloon }        from './balloon.js';
import * as Net                 from './network.js';
import { TOTAL_LAPS }           from '../../shared/trackData.js';

// ── Config ────────────────────────────────────────────────
const SERVER_URL = import.meta.env.VITE_SERVER_URL 
  || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);
const UPDATE_HZ     = 10;        // send car state 10x/sec
const CAR_COLORS    = [0x00f5d4, 0xff6b35, 0xa855f7, 0xf7b731, 0xff4d6d,
                       0x3b82f6, 0x22c55e, 0xec4899, 0x14b8a6, 0xf97316];

// ── State ─────────────────────────────────────────────────
let scene, renderer, camera, clock;
let trackCurve;
let balloon = null;   // { group, update } — hot air balloon
let playerCar = null;
let chaseCamera = null;
let remoteCars = {};          // socketId → RemoteCar
let myId = null;
let myName = '';
let myColor = CAR_COLORS[0];
let canDrive = false;
let raceStarted = false;
let updateInterval = null;
let standings = [];
let myPosition = 1;
let colorIndex = 0;

// ── Scene Setup ───────────────────────────────────────────
function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a1e); // dark night sky
  scene.fog = new THREE.Fog(0x0a0a1e, 120, 600); 

  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('game-canvas'),
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;

  camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 600);
  camera.position.set(0, 10, 30);

  clock = new THREE.Clock();

  // Lighting — dark neon night
  const sun = new THREE.DirectionalLight(0xffe8b5, 1.4);
  sun.position.set(80, 120, 60);
  sun.castShadow = true;
  scene.add(sun);
  const ambient = new THREE.AmbientLight(0x1a1a3a, 0.9); // dark ambient
  scene.add(ambient);
  const fill = new THREE.HemisphereLight(0x1a3a5c, 0x0a0a1e, 0.5); // night bounce
  scene.add(fill);

  // Skybox stars
  buildStars();

  // Resize handler
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // Ensure canvas captures keyboard events — click it to focus
  const canvas = document.getElementById('game-canvas');
  canvas.setAttribute('tabindex', '0');
  canvas.addEventListener('click', () => canvas.focus());
}

function buildStars() {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  for (let i = 0; i < 2000; i++) {
    verts.push(
      (Math.random() - 0.5) * 800,
      Math.random() * 200 + 20,
      (Math.random() - 0.5) * 800
    );
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.4 });
  scene.add(new THREE.Points(geo, mat));
}

// ── Game Loop ─────────────────────────────────────────────
function startGameLoop() {
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05); // cap at 50ms

    // Update player car
    if (playerCar) {
      playerCar.update(dt, canDrive);
    }

    // Update remote cars
    for (const rc of Object.values(remoteCars)) {
      rc.update(dt);
    }

    // Update balloon
    if (balloon) balloon.update(dt);

    // Chase camera
    if (playerCar && chaseCamera) {
      chaseCamera.update(playerCar.mesh, dt);
    }

    // HUD
    if (playerCar && raceStarted) {
      updateHUD({
        speed: playerCar.speed,
        lap:   playerCar.lapCount,
        position: myPosition,
      });

      // Check lap completion
      if (playerCar.lapCount >= TOTAL_LAPS && !playerCar.finished) {
        playerCar.finished = true;
        Net.send('race_finish', { totalTime: Date.now() });
      }
    }

    renderer.render(scene, camera);
  });
}

// ── Network: State broadcast ───────────────────────────────
function startStateUpdater() {
  if (updateInterval) clearInterval(updateInterval);
  updateInterval = setInterval(() => {
    if (playerCar && raceStarted) {
      Net.send('car_update', playerCar.getState());
    }
  }, 1000 / UPDATE_HZ);
}

// ── Join Flow (Multiplayer) ───────────────────────────────
function handleJoin(name) {
  myName = name || 'Racer';

  // Show canvas, hide lobby
  hideLobby();
  document.getElementById('game-canvas').classList.remove('hidden');
  document.getElementById('hud').classList.remove('hidden');

  // Assign color
  myColor = CAR_COLORS[colorIndex++ % CAR_COLORS.length];

  // Build player car
  playerCar = new Car(scene, myColor);
  playerCar.trackCurve = trackCurve;
  chaseCamera = new ChaseCamera(camera);
  chaseCamera.snapTo(playerCar.mesh);

  canDrive = false;
  raceStarted = false;

  // Tell server we joined
  Net.send('player_join', { name: myName, color: myColor });

  startStateUpdater();

  // Show waiting overlay so player knows what's happening
  const waitingOverlay = document.getElementById('waiting-overlay');
  if (waitingOverlay) waitingOverlay.classList.remove('hidden');

  // "Start Practice Now" button inside waiting overlay
  document.getElementById('start-solo-btn')?.addEventListener('click', () => {
    waitingOverlay.classList.add('hidden');
    startSoloPractice();
  }, { once: true });
}

// ── Solo Practice (no server needed) ─────────────────────
function startSoloPractice() {
  const waitingOverlay = document.getElementById('waiting-overlay');
  if (waitingOverlay) waitingOverlay.classList.add('hidden');
  showCountdown(3, () => {
    canDrive = true;
    raceStarted = true;
    startHUDTimer();
  });
}

// ── Solo Join (from lobby Solo button) ───────────────────
function handleSoloJoin(name) {
  myName = name || 'Racer';
  hideLobby();
  document.getElementById('game-canvas').classList.remove('hidden');
  document.getElementById('hud').classList.remove('hidden');

  myColor = CAR_COLORS[colorIndex++ % CAR_COLORS.length];
  playerCar = new Car(scene, myColor);
  playerCar.trackCurve = trackCurve;
  chaseCamera = new ChaseCamera(camera);
  chaseCamera.snapTo(playerCar.mesh);
  canDrive = false;
  raceStarted = false;

  // Also tell server (so join feed still fires)
  Net.send('player_join', { name: myName, color: myColor });
  startStateUpdater();

  // Skip straight to countdown
  startSoloPractice();
}


// ── Countdown ─────────────────────────────────────────────
function showCountdown(seconds, onDone) {
  const overlay = document.getElementById('countdown-overlay');
  const numEl   = document.getElementById('countdown-num');
  if (!overlay || !numEl) { onDone(); return; }

  overlay.classList.remove('hidden');
  let t = seconds;

  function tick() {
    if (t > 0) {
      numEl.textContent = t;
      numEl.style.animation = 'none';
      numEl.offsetHeight; // reflow
      numEl.style.animation = 'countPulse 1s ease-in-out';
      t--;
      setTimeout(tick, 1000);
    } else {
      numEl.textContent = 'GO!';
      numEl.style.color = '#f7b731';
      numEl.style.animation = 'none';
      numEl.offsetHeight;
      numEl.style.animation = 'countPulse 0.8s ease-in-out';
      setTimeout(() => {
        overlay.classList.add('hidden');
        numEl.style.color = '';
        onDone();
      }, 800);
    }
  }
  tick();
}

// ── Race Again ─────────────────────────────────────────────
function raceAgain() {
  hideFinishScreen();
  stopHUDTimer();

  // Dispose old car
  if (playerCar) {
    scene.remove(playerCar.mesh);
    playerCar.dispose();
  }

  // Clean remote cars
  for (const rc of Object.values(remoteCars)) rc.dispose(scene);
  remoteCars = {};

  // Rebuild player car
  myColor = CAR_COLORS[colorIndex++ % CAR_COLORS.length];
  playerCar = new Car(scene, myColor);
  playerCar.trackCurve = trackCurve;
  chaseCamera = new ChaseCamera(camera);
  chaseCamera.snapTo(playerCar.mesh);
  canDrive = false;
  raceStarted = false;

  Net.send('player_join', { name: myName, color: myColor });
}

// ── Entry Point ───────────────────────────────────────────
async function main() {
  initScene();

  // Build track
  const { curve } = buildTrack(scene);
  trackCurve = curve;

  // Load sponsor branding
  await loadBranding(scene, trackCurve);

  // Create hot air balloon (marketing canvas in the sky)
  balloon = createBalloon(scene);

  // Connect to server
  Net.connect(SERVER_URL);

  Net.on('_connected', () => {
    myId = Net.getSocketId();
    console.log('[main] my socket id:', myId);
  });

  // ── Server events ──
  Net.on('room_state', ({ players }) => {
    // Sync who is already in room
    for (const p of players) {
      if (p.id === myId) continue;
      if (!remoteCars[p.id]) {
        const color = p.color || 0xff6b35;
        remoteCars[p.id] = new RemoteCar(scene, p.id, p.name, color);
      }
      if (p.gridIndex !== undefined && playerCar) {
        playerCar.setGridPosition(p.gridIndex);
      }
    }
  });

  Net.on('player_joined', ({ id, name, color, gridIndex }) => {
    if (id === myId) {
      // Our join was acknowledged — set grid position
      if (playerCar && gridIndex !== undefined) {
        playerCar.setGridPosition(gridIndex);
      }
      return;
    }
    if (!remoteCars[id]) {
      remoteCars[id] = new RemoteCar(scene, id, name, color || 0xff6b35);
    }
    showToast(`🏎️ ${name} joined the race!`);
  });

  Net.on('player_left', ({ id, name }) => {
    if (remoteCars[id]) {
      remoteCars[id].dispose(scene);
      delete remoteCars[id];
    }
    if (name) showToast(`🚪 ${name} left the race`);
  });

  Net.on('car_update', ({ id, state }) => {
    if (id === myId) return;
    if (!remoteCars[id]) {
      remoteCars[id] = new RemoteCar(scene, id, state.name || 'Racer', state.color || 0xff6b35);
    }
    remoteCars[id].receiveState(state);
  });

  Net.on('race_countdown', ({ seconds }) => {
    // Hide waiting overlay if showing
    document.getElementById('waiting-overlay')?.classList.add('hidden');
    canDrive = false;
    showCountdown(seconds, () => {
      canDrive = true;
      raceStarted = true;
      startHUDTimer();
    });
  });

  Net.on('race_standings', ({ standings: s }) => {
    standings = s;
    const myEntry = s.find(p => p.id === myId);
    if (myEntry) myPosition = myEntry.position;
    updateLeaderboard(s, myId);
  });

  Net.on('race_finish', ({ standings: s }) => {
    canDrive = false;
    raceStarted = false;
    stopHUDTimer();
    showFinishScreen(s, myId, raceAgain);
  });

  function setupMobileControls() {
    const binds = {
      'btn-up': 'ArrowUp',
      'btn-down': 'ArrowDown',
      'btn-left': 'ArrowLeft',
      'btn-right': 'ArrowRight'
    };
    
    for (const [id, key] of Object.entries(binds)) {
      const btn = document.getElementById(id);
      if (!btn) continue;
      
      const press = (e) => {
        if (e.cancelable) e.preventDefault();
        btn.classList.add('active');
        if (playerCar) playerCar.keys[key] = true;
      };
      const release = (e) => {
        if (e.cancelable) e.preventDefault();
        btn.classList.remove('active');
        if (playerCar) playerCar.keys[key] = false;
      };
      
      btn.addEventListener('touchstart', press, {passive: false});
      btn.addEventListener('mousedown', press);
      btn.addEventListener('touchend', release, {passive: false});
      btn.addEventListener('touchcancel', release, {passive: false});
      btn.addEventListener('mouseup', release);
      btn.addEventListener('mouseleave', release);
    }
  }

  // ── Start game loop ──
  setupMobileControls();
  startGameLoop();

  // ── Init lobby ──
  initLobby(handleJoin, handleSoloJoin);
}

main().catch(console.error);
