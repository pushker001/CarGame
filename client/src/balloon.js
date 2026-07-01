import * as THREE from 'three';
import sponsorsConfig from '../../config/sponsors.json';

/**
 * Creates a large Zeppelin/Blimp floating in the sky.
 * (Renamed internally to a blimp based on user reference image)
 */
export function createBalloon(scene) {
  const group = new THREE.Group();

  // 1. The Main Envelope (The big balloon part)
  // We use a SphereGeometry and stretch it along the Z axis to make a cigar/ellipsoid shape.
  const envelopeGeo = new THREE.SphereGeometry(6, 32, 16);
  const envelopeMat = new THREE.MeshLambertMaterial({ color: 0xe0e0e0 }); // Light grey/white
  const envelope = new THREE.Mesh(envelopeGeo, envelopeMat);
  envelope.scale.set(1, 1, 3); // Stretch Z by 3x
  group.add(envelope);

  // 2. The Billboard (Black rectangular block on the side)
  const brandText = sponsorsConfig?.start_arch?.label || 'BRAND GRAND PRIX';
  const sponsorName = sponsorsConfig?.finish_cta?.brand || 'Apex Motors';
  
  const billboardTex = makeBlimpBillboardTexture(brandText, sponsorName);
  
  // We make a box that sticks out of the left and right sides
  const billboardGeo = new THREE.BoxGeometry(12.5, 3.5, 14); 
  // We apply the texture only to the left and right faces, black to others
  const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const texMat = new THREE.MeshBasicMaterial({ map: billboardTex });
  
  // BoxGeometry face order: right (0), left (1), top (2), bottom (3), front (4), back (5)
  // Our envelope is stretched along Z, so the sides are X (right/left).
  const billboardMats = [
    texMat,   // right (+x)
    texMat,   // left (-x)
    blackMat, // top
    blackMat, // bottom
    blackMat, // front
    blackMat  // back
  ];
  
  const billboard = new THREE.Mesh(billboardGeo, billboardMats);
  // Position it slightly below the vertical center to match the reference image
  billboard.position.set(0, -1.5, 0);
  group.add(billboard);

  // 3. The Gondola / Cabin (Underneath)
  const gondolaGeo = new THREE.BoxGeometry(2, 1.5, 6);
  const gondolaMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const gondola = new THREE.Mesh(gondolaGeo, gondolaMat);
  gondola.position.set(0, -6.5, 2); // Hanging below
  group.add(gondola);

  // 4. Tail Fins
  const finGeo = new THREE.BoxGeometry(0.5, 4, 3);
  const finMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  
  // Top fin
  const topFin = new THREE.Mesh(finGeo, finMat);
  topFin.position.set(0, 5, -15);
  group.add(topFin);
  
  // Bottom fin
  const bottomFin = new THREE.Mesh(finGeo, finMat);
  bottomFin.position.set(0, -5, -15);
  group.add(bottomFin);
  
  // Left fin
  const leftFin = new THREE.Mesh(finGeo, finMat);
  leftFin.rotation.z = Math.PI / 2;
  leftFin.position.set(5, 0, -15);
  group.add(leftFin);

  // Right fin
  const rightFin = new THREE.Mesh(finGeo, finMat);
  rightFin.rotation.z = Math.PI / 2;
  rightFin.position.set(-5, 0, -15);
  group.add(rightFin);


  // ── Position & Scale ──────────────────────────────────────────
  // Make it MASSIVE so it dominates the sky like in the picture
  group.scale.set(8, 8, 8); 
  
  // Base Y is 120, so it clears all skyscrapers easily
  group.position.set(0, 120, -80); 
  // Rotate it so the side billboard faces the starting line initially
  group.rotation.y = Math.PI / 2; 

  scene.add(group);

  // ── Animation state ─────────────────────────────────────────
  let t = 0;
  const BOB_SPEED  = 0.3;
  const BOB_AMP    = 2;
  const ROT_SPEED  = 0.05; // Very slow majestic rotation

  function update(dt) {
    t += dt;
    // Gentle bobbing
    group.position.y = 120 + Math.sin(t * BOB_SPEED) * BOB_AMP;
    
    // Slow drift side-to-side across the track instead of a huge circle
    group.position.x = Math.cos(t * ROT_SPEED * 2) * 40;
    
    // Slowly pivot back and forth so the side is always mostly facing the start
    group.rotation.y = (Math.PI / 2) + Math.sin(t * ROT_SPEED) * 0.3;
  }

  return { group, update };
}

function makeBlimpBillboardTexture(title, sub) {
  const canvas = document.createElement('canvas');
  canvas.width  = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Solid black background (like the reference image)
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Main Title (White, bold, centered)
  ctx.fillStyle   = '#ffffff';
  ctx.font        = 'bold 72px Arial Black, sans-serif';
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  
  // Let's use the sponsor string or fallback to something similar to the reference
  const displayText = title.toUpperCase();
  ctx.fillText(displayText, canvas.width / 2, canvas.height / 2 - 20);

  // Sub Title (Smaller, cyan/neon)
  ctx.fillStyle = '#00f5d4';
  ctx.font      = 'bold 36px Arial, sans-serif';
  ctx.fillText(sub.toUpperCase(), canvas.width / 2, canvas.height / 2 + 50);

  return new THREE.CanvasTexture(canvas);
}
