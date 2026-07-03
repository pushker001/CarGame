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

  // F1 Main Chassis / Nosecone
  const chassisGeo = new THREE.BoxGeometry(0.8, 0.4, 4.5);
  const chassisMat = new THREE.MeshLambertMaterial({ color });
  const chassis = new THREE.Mesh(chassisGeo, chassisMat);
  chassis.position.y = 0.2;
  group.add(chassis);

  // Cockpit area
  const cockpitGeo = new THREE.BoxGeometry(0.9, 0.5, 1.5);
  const cockpit = new THREE.Mesh(cockpitGeo, chassisMat);
  cockpit.position.set(0, 0.25, -0.2);
  chassis.add(cockpit);

  // Driver Helmet (simple black sphere)
  const helmetGeo = new THREE.SphereGeometry(0.2, 8, 8);
  const helmetMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const helmet = new THREE.Mesh(helmetGeo, helmetMat);
  helmet.position.set(0, 0.5, 0.1);
  cockpit.add(helmet);

  // Front Wing
  const fWingGeo = new THREE.BoxGeometry(2.2, 0.05, 0.6);
  const fWing = new THREE.Mesh(fWingGeo, chassisMat);
  fWing.position.set(0, -0.1, 2.2);
  chassis.add(fWing);
  
  // Front Wing Sideplates
  const fPlateGeo = new THREE.BoxGeometry(0.05, 0.3, 0.6);
  const fPlateL = new THREE.Mesh(fPlateGeo, chassisMat);
  fPlateL.position.set(1.1, 0.1, 0);
  fWing.add(fPlateL);
  const fPlateR = new THREE.Mesh(fPlateGeo, chassisMat);
  fPlateR.position.set(-1.1, 0.1, 0);
  fWing.add(fPlateR);

  // Rear Wing
  const rWingGeo = new THREE.BoxGeometry(2.0, 0.05, 0.6);
  const rWing = new THREE.Mesh(rWingGeo, chassisMat);
  rWing.position.set(0, 0.6, -2.0);
  chassis.add(rWing);
  
  // Rear Wing Pillars
  const pillarGeo = new THREE.BoxGeometry(0.1, 0.6, 0.2);
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const pillar = new THREE.Mesh(pillarGeo, pillarMat);
  pillar.position.set(0, -0.3, 0);
  rWing.add(pillar);
  
  // Rear Wing Sideplates
  const rPlateGeo = new THREE.BoxGeometry(0.05, 0.6, 0.8);
  const rPlateL = new THREE.Mesh(rPlateGeo, chassisMat);
  rPlateL.position.set(1.0, -0.1, 0);
  rWing.add(rPlateL);
  const rPlateR = new THREE.Mesh(rPlateGeo, chassisMat);
  rPlateR.position.set(-1.0, -0.1, 0);
  rWing.add(rPlateR);

  // Wheels (Exposed, Open-Wheel style)
  const wheels = [];
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x181818 }); // dark rubber
  const rimMat   = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
  // Front wheels (slightly narrower), Rear wheels (wider)
  const wSpecs = [
    { x: -0.9, y: 0.1, z:  1.6, w: 0.3, r: 0.4 }, // FL
    { x:  0.9, y: 0.1, z:  1.6, w: 0.3, r: 0.4 }, // FR
    { x: -0.9, y: 0.1, z: -1.7, w: 0.4, r: 0.45 }, // RL
    { x:  0.9, y: 0.1, z: -1.7, w: 0.4, r: 0.45 }, // RR
  ];
  
  for (const spec of wSpecs) {
    const wGeo = new THREE.CylinderGeometry(spec.r, spec.r, spec.w, 16);
    const wheel = new THREE.Mesh(wGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(spec.x, spec.y, spec.z);

    const rimGeo = new THREE.CylinderGeometry(spec.r * 0.5, spec.r * 0.5, spec.w + 0.02, 8);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    // Fix rim rotation relative to wheel (cylinder inside cylinder)
    rim.rotation.set(0, 0, 0);
    wheel.add(rim);

    // Axle (visual strut connecting wheel to chassis)
    const axleGeo = new THREE.CylinderGeometry(0.05, 0.05, Math.abs(spec.x) - 0.4, 4);
    const axle = new THREE.Mesh(axleGeo, pillarMat);
    axle.rotation.z = Math.PI / 2;
    // Axle is child of chassis, pointing to wheel
    axle.position.set(Math.sign(spec.x) * ((Math.abs(spec.x) - 0.4) / 2 + 0.4), spec.y, spec.z);
    chassis.add(axle);

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
