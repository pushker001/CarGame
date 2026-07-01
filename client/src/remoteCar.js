import * as THREE from 'three';
import { buildCarMesh } from './car.js';

const INTERP_SPEED = 12; // lerp factor

export class RemoteCar {
  constructor(scene, id, name, color = 0xff6b35) {
    this.id       = id;
    this.name     = name;
    this.lap      = 0;
    this.checkpoint = 0;

    this.mesh = buildCarMesh(color);
    this.mesh.position.set(0, -100, 0); // hide until first update
    scene.add(this.mesh);

    // Name label above car
    this.label = createLabel(name);
    this.mesh.add(this.label);

    // Target state for interpolation
    this.targetPos = new THREE.Vector3();
    this.targetHeading = 0;
    this.hasData = false;
  }

  receiveState(state) {
    this.targetPos.set(state.x, state.y, state.z);
    this.targetHeading = state.heading;
    this.lap        = state.lap;
    this.checkpoint = state.checkpoint;
    this.hasData = true;
  }

  update(dt) {
    if (!this.hasData) return;
    // Smooth position interpolation
    this.mesh.position.lerp(this.targetPos, INTERP_SPEED * dt);
    // Smooth heading interpolation (handle wrap-around)
    let dh = this.targetHeading - this.mesh.rotation.y;
    while (dh >  Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.mesh.rotation.y += dh * INTERP_SPEED * dt;

    // Spin wheels (based on velocity magnitude)
    const speed = this.mesh.position.distanceTo(this.targetPos);
    const wheels = this.mesh.userData.wheels || [];
    for (const w of wheels) w.rotation.x += speed * 0.3;
  }

  dispose(scene) {
    scene.remove(this.mesh);
  }
}

function createLabel(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(13,13,26,0.75)';
  roundRect(ctx, 4, 4, 248, 56, 10);
  ctx.fill();

  ctx.fillStyle = '#00f5d4';
  ctx.font = 'bold 22px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(name.substring(0, 14), 128, 36);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(0, 3, 0);
  sprite.scale.set(3, 0.75, 1);
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}
