import * as THREE from 'three';
import { CHECKPOINTS, TOTAL_LAPS, TRACK_WIDTH } from '../../shared/trackData.js';

const MAX_SPEED     = 55;   // m/s  (~200 km/h display)
const ACCELERATION  = 28;
const BRAKE_FORCE   = 45;
const FRICTION      = 18;   // natural deceleration
const STEER_SPEED   = 2.2;  // rad/sec at full speed
const DRIFT_FACTOR  = 0.88; // lateral velocity bleed (lower = more drift)

export class Car {
  constructor(scene, color = 0x00f5d4) {
    this.speed        = 0;
    this.steerAngle   = 0;
    this.heading      = 0;  // radians, Y axis
    this.lapCount     = 0;
    this.checkpoint   = 0;
    this.lapTimes     = [];
    this.lapStart     = performance.now();
    this.finished     = false;
    this.wrongWay     = false;
    this.lastCheckpointDir = 1;
    this.trackCurve   = null; // set externally after construction
    this.hasStartedRace = false;

    this.velocity = new THREE.Vector3(); // lateral physics

    this.mesh = buildCarMesh(color);
    scene.add(this.mesh);

    this.keys = {};
    this._onKey = this._onKey.bind(this);
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKey);

    // Starting grid position
    this.mesh.position.set(0, 0.4, 8);
    this.heading = Math.PI; // face along track start direction
    this.mesh.rotation.y = this.heading;
  }

  setGridPosition(index) {
    // Stagger starting positions
    const col = index % 2;
    const row = Math.floor(index / 2);
    this.mesh.position.set(col * 5 - 2.5, 0.4, 8 + row * 8);
    this.heading = Math.PI;
    this.mesh.rotation.y = this.heading;
    this.speed = 0;
    this.velocity.set(0,0,0);
  }

  _onKey(e) {
    this.keys[e.code] = e.type === 'keydown';
  }

  update(dt, canMove) {
    if (this.finished || !canMove) return;

    const { keys } = this;
    const fwd = keys['ArrowUp']   || keys['KeyW'];
    const bwd = keys['ArrowDown'] || keys['KeyS'];
    const lft = keys['ArrowLeft'] || keys['KeyA'];
    const rgt = keys['ArrowRight']|| keys['KeyD'];

    // ── Acceleration / braking ──
    if (fwd) {
      this.speed = Math.min(this.speed + ACCELERATION * dt, MAX_SPEED);
    } else if (bwd) {
      if (this.speed > 0.5) {
        this.speed = Math.max(this.speed - BRAKE_FORCE * dt, 0);
      } else {
        this.speed = Math.max(this.speed - ACCELERATION * 0.4 * dt, -MAX_SPEED * 0.3);
      }
    } else {
      // Friction
      const sign = Math.sign(this.speed);
      this.speed -= sign * FRICTION * dt;
      if (Math.abs(this.speed) < 0.5) this.speed = 0;
    }

    // ── Steering (speed-dependent, but minimum turn rate at low speed) ──
    const speedRatio = Math.max(Math.abs(this.speed) / MAX_SPEED, 0.15); // always some steering
    const steerAmount = STEER_SPEED * speedRatio * (this.speed >= 0 ? 1 : -1);

    if (lft) this.heading += steerAmount * dt;
    if (rgt) this.heading -= steerAmount * dt;

    // Tilt car body on steer
    this.steerAngle = lft ? 0.12 : rgt ? -0.12 : 0;


    // ── Movement ──
    const dir = new THREE.Vector3(
      Math.sin(this.heading),
      0,
      Math.cos(this.heading)
    );

    // Blend velocity (gives slight drift feel)
    const targetVel = dir.clone().multiplyScalar(this.speed);
    this.velocity.lerp(targetVel, DRIFT_FACTOR);
    this.velocity.y = 0;

    this.mesh.position.addScaledVector(this.velocity, dt);
    this.mesh.position.y = 0.4; // keep on ground

    // ── Track boundary constraint (stop car going through buildings) ──
    if (this.trackCurve) this._constrainToTrack();

    // ── Rotation ──
    this.mesh.rotation.y = this.heading;
    // Roll + pitch for feel
    this.mesh.children[0].rotation.z = this.steerAngle * 0.5;
    this.mesh.children[0].rotation.x = THREE.MathUtils.clamp(this.speed / MAX_SPEED * 0.03, -0.05, 0.05);

    // Wheel spin
    this._spinWheels(dt);

    // ── Checkpoint ──
    this._checkCheckpoints();
  }

  // ── Keep car within track boundaries ───────────────────────
  _constrainToTrack() {
    const pos    = this.mesh.position;
    const curve  = this.trackCurve;
    const halfW  = TRACK_WIDTH / 2 + 1; // slight tolerance

    // Find closest point on the spline (sample 300 points)
    let closestT = 0, closestDist = Infinity;
    const samples = 300;
    for (let i = 0; i < samples; i++) {
      const t  = i / samples;
      const pt = curve.getPointAt(t);
      const d  = (pos.x - pt.x) ** 2 + (pos.z - pt.z) ** 2;
      if (d < closestDist) { closestDist = d; closestT = t; }
    }

    const closestPt  = curve.getPointAt(closestT);
    const lateralDist = Math.sqrt(closestDist);

    if (lateralDist > halfW) {
      // Vector from spline center to car (horizontal)
      const pushDir = new THREE.Vector3(pos.x - closestPt.x, 0, pos.z - closestPt.z).normalize();
      // Project car back to boundary
      pos.x = closestPt.x + pushDir.x * halfW;
      pos.z = closestPt.z + pushDir.z * halfW;
      // Bounce: kill velocity component pointing outward
      const outDot = this.velocity.dot(pushDir);
      if (outDot > 0) {
        this.velocity.addScaledVector(pushDir, -outDot * 1.5);
        this.speed *= 0.45; // lose speed on impact
      }
    }
  }

  _spinWheels(dt) {
    const spinSpeed = this.speed * 0.08;
    // wheels are children[1..4] of the chassis group
    const wheels = this.mesh.userData.wheels || [];
    for (const w of wheels) {
      w.rotation.x += spinSpeed * dt;
    }
  }

  _checkCheckpoints() {
    const pos = this.mesh.position;
    const cp = CHECKPOINTS[this.checkpoint];
    const cpPos = new THREE.Vector3(...cp.pos);
    const dist = pos.distanceTo(cpPos);

    if (dist < cp.radius) {
      // Completed a lap? (Hitting checkpoint 0)
      if (this.checkpoint === 0) {
        const now = performance.now();
        const lapTime = (now - this.lapStart) / 1000;
        
        // The car spawns inside checkpoint 0, so the first hit happens at time=0.
        // We only count it as a lap if they've been driving for a bit and already crossed the line once.
        if (lapTime > 2.0 && this.hasStartedRace) {
          this.lapTimes.push(lapTime);
          this.lapCount++;
          this.lapStart = now;
        } else {
          // Reset lap start to exact moment they cleared the start line
          this.lapStart = now;
          this.hasStartedRace = true;
        }
      }
      
      this.checkpoint = (this.checkpoint + 1) % CHECKPOINTS.length;
    }
  }

  getState() {
    return {
      x: this.mesh.position.x,
      y: this.mesh.position.y,
      z: this.mesh.position.z,
      heading: this.heading,
      speed: this.speed,
      lap: this.lapCount,
      checkpoint: this.checkpoint,
    };
  }

  applyState(state) {
    this.mesh.position.set(state.x, state.y, state.z);
    this.mesh.rotation.y = state.heading;
    this.speed = state.speed;
    this.lapCount = state.lap;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('keyup', this._onKey);
  }
}

export function buildCarMesh(color = 0x00f5d4) {
  const group = new THREE.Group();

  // Chassis
  const chassisGeo = new THREE.BoxGeometry(2.0, 0.6, 4.0);
  const chassisMat = new THREE.MeshLambertMaterial({ color });
  const chassis = new THREE.Mesh(chassisGeo, chassisMat);
  chassis.position.y = 0;
  group.add(chassis);

  // Cab
  const cabGeo = new THREE.BoxGeometry(1.6, 0.6, 2.0);
  const cabMat = new THREE.MeshLambertMaterial({ color });
  const cab = new THREE.Mesh(cabGeo, cabMat);
  cab.position.set(0, 0.6, -0.2);
  chassis.add(cab);

  // Windshield tint
  const wGeo = new THREE.BoxGeometry(1.5, 0.5, 0.1);
  const wMat = new THREE.MeshLambertMaterial({ color: 0x88ccff, transparent: true, opacity: 0.6 });
  const wind = new THREE.Mesh(wGeo, wMat);
  wind.position.set(0, 0.05, 0.95);
  cab.add(wind);

  // Spoiler
  const spoilerGeo = new THREE.BoxGeometry(1.8, 0.1, 0.4);
  const spoilerMat = new THREE.MeshLambertMaterial({ color: darken(color, 0.5) });
  const spoiler = new THREE.Mesh(spoilerGeo, spoilerMat);
  spoiler.position.set(0, 0.45, -1.1);
  chassis.add(spoiler);

  // Wheels
  const wheels = [];
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const rimMat   = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
  const wPositions = [
    [-1.2, -0.1,  1.3],
    [ 1.2, -0.1,  1.3],
    [-1.2, -0.1, -1.3],
    [ 1.2, -0.1, -1.3],
  ];
  for (const [wx, wy, wz] of wPositions) {
    const wGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 12);
    const wheel = new THREE.Mesh(wGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, wy, wz);

    const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.34, 8);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    wheel.add(rim);

    chassis.add(wheel);
    wheels.push(wheel);
  }

  group.userData.wheels = wheels;
  return group;
}

function darken(hexColor, factor) {
  const r = ((hexColor >> 16) & 0xff) * factor | 0;
  const g = ((hexColor >>  8) & 0xff) * factor | 0;
  const b = ((hexColor >>  0) & 0xff) * factor | 0;
  return (r << 16) | (g << 8) | b;
}
