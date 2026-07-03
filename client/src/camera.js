import * as THREE from 'three';

const OFFSET_BEHIND = 10;
const OFFSET_ABOVE  = 4.5;
const LOOK_AHEAD    = 6;
const LERP_POS      = 0.1;
const LERP_LOOK     = 0.08;

export class ChaseCamera {
  constructor(camera) {
    this.camera    = camera;
    this.targetPos = new THREE.Vector3();
    this.targetLook = new THREE.Vector3();
    this._tmpPos   = new THREE.Vector3();
    this._tmpLook  = new THREE.Vector3();

    // 360-degree free-look variables
    this.orbitYaw = 0;   // horizontal rotation offset
    this.orbitPitch = 0; // vertical rotation offset
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      
      this.orbitYaw += dx * 0.01;
      this.orbitPitch += dy * 0.01;
      // Clamp pitch so they don't look upside down
      this.orbitPitch = Math.max(-0.5, Math.min(1.5, this.orbitPitch));
    });
    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
    
    // Touch support for mobile
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        this.isDragging = true;
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
      }
    });
    window.addEventListener('touchmove', (e) => {
      if (!this.isDragging || e.touches.length === 0) return;
      const dx = e.touches[0].clientX - this.lastMouseX;
      const dy = e.touches[0].clientY - this.lastMouseY;
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;
      
      this.orbitYaw += dx * 0.01;
      this.orbitPitch += dy * 0.01;
      this.orbitPitch = Math.max(-0.5, Math.min(1.5, this.orbitPitch));
    });
    window.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }

  update(carMesh, dt) {
    const carPos = carMesh.position;
    const heading = carMesh.rotation.y;

    // If not dragging, smoothly return the camera to the default forward-facing angle
    if (!this.isDragging) {
      this.orbitYaw *= 0.95;
      this.orbitPitch *= 0.95;
    }

    // Apply the free-look orbit rotation
    const baseHeading = heading + this.orbitYaw;
    
    // Desired camera position: behind and above the car
    const behindDir = new THREE.Vector3(
      Math.sin(baseHeading),
      0,
      Math.cos(baseHeading)
    );

    // Calculate height offset based on pitch
    const currentAbove = OFFSET_ABOVE + this.orbitPitch * 5;

    this._tmpPos.copy(carPos)
      .addScaledVector(behindDir, -OFFSET_BEHIND)
      .setY(carPos.y + currentAbove);

    // Lerp camera position
    this.camera.position.lerp(this._tmpPos, LERP_POS);

    // Look-at target: we look directly at the car, but adjust height for pitch
    this._tmpLook.copy(carPos).setY(carPos.y + 1.5 - this.orbitPitch * 2);

    // Lerp look target
    this.targetLook.lerp(this._tmpLook, LERP_LOOK);
    this.camera.lookAt(this.targetLook);
  }

  snapTo(carMesh) {
    const carPos = carMesh.position;
    const heading = carMesh.rotation.y;
    const behindDir = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    this.camera.position.copy(carPos).addScaledVector(behindDir, OFFSET_BEHIND).setY(carPos.y + OFFSET_ABOVE);
    this.targetLook.copy(carPos).addScaledVector(behindDir, -LOOK_AHEAD).setY(carPos.y + 1.0);
    this.camera.lookAt(this.targetLook);
  }
}
