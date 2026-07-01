import * as THREE from 'three';
import sponsorsConfig from '../../config/sponsors.json';

export async function loadBranding(scene, curve) {
  loadBillboards(scene, curve);
  loadStartArch(scene, curve);
}

function loadBillboards(scene, curve) {
  for (const bb of sponsorsConfig.billboards) {
    const group = new THREE.Group();

    // 1. The Massive Screen
    const screenW = 40;
    const screenH = 20;
    const panelGeo = new THREE.PlaneGeometry(screenW, screenH);
    const texture  = generateBillboardTexture(bb.label || bb.brand, bb.brand);
    // Use BasicMaterial so it glows brightly in the dark
    const panelMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    const panel    = new THREE.Mesh(panelGeo, panelMat);
    // Lift the screen high up on the building
    panel.position.y = 30;
    // Push it slightly forward so it doesn't z-fight with the building
    panel.position.z = 0.5;
    group.add(panel);

    // 2. The Dark Skyscraper behind the screen
    const bldgW = 44;
    const bldgH = 80;
    const bldgD = 44;
    const bldgGeo = new THREE.BoxGeometry(bldgW, bldgH, bldgD);
    const bldgMat = new THREE.MeshLambertMaterial({ color: 0x0f1522 }); // sleek dark steel
    const bldg = new THREE.Mesh(bldgGeo, bldgMat);
    bldg.position.y = bldgH / 2;
    // Push the building back so its front face touches Z=0
    bldg.position.z = -bldgD / 2; 
    group.add(bldg);

    // Position and rotation of the entire building complex
    group.position.set(...bb.position);
    group.rotation.y = bb.rotation || 0;
    scene.add(group);
  }
}

function loadStartArch(scene, curve) {
  const archCfg = sponsorsConfig.start_arch;
  const pt = curve.getPointAt(0);
  const tg = curve.getTangentAt(0).normalize();

  const archGroup = new THREE.Group();
  const archMat   = new THREE.MeshLambertMaterial({ color: 0xf7b731 });

  // Left pillar
  const pillarGeo = new THREE.BoxGeometry(1.2, 14, 1.2);
  const lPillar = new THREE.Mesh(pillarGeo, archMat);
  lPillar.position.set(-11, 7, 0);
  archGroup.add(lPillar);

  // Right pillar
  const rPillar = new THREE.Mesh(pillarGeo, archMat);
  rPillar.position.set(11, 7, 0);
  archGroup.add(rPillar);

  // Top beam
  const beamGeo = new THREE.BoxGeometry(22.4, 2, 1.2);
  const beam    = new THREE.Mesh(beamGeo, archMat);
  beam.position.set(0, 14, 0);
  archGroup.add(beam);

  // Sign on beam
  const signGeo = new THREE.PlaneGeometry(18, 1.6);
  const signTex = generateArchTexture(archCfg?.label || 'BRAND GRAND PRIX');
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide });
  const sign    = new THREE.Mesh(signGeo, signMat);
  sign.position.set(0, 14, 0.7);
  archGroup.add(sign);

  // Neon strip lights along top beam
  const neonMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4 });
  const neonGeo = new THREE.BoxGeometry(22, 0.2, 0.2);
  const neon    = new THREE.Mesh(neonGeo, neonMat);
  neon.position.set(0, 13.2, 0.7);
  archGroup.add(neon);

  // Position at start line
  archGroup.position.copy(pt);
  archGroup.position.y = 0;
  // Face perpendicular to track
  const right = new THREE.Vector3().crossVectors(tg, new THREE.Vector3(0,1,0));
  archGroup.lookAt(pt.clone().add(right));

  scene.add(archGroup);
}

function generateBillboardTexture(label, brand) {
  const canvas = document.createElement('canvas');
  canvas.width  = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Dark gradient background
  const grad = ctx.createLinearGradient(0, 0, 512, 256);
  grad.addColorStop(0,   '#0d0d1a');
  grad.addColorStop(1,   '#12122a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Neon border
  ctx.strokeStyle = '#00f5d4';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 240);

  // Brand name
  ctx.fillStyle = '#f7b731';
  ctx.font = 'bold 42px Orbitron, monospace';
  ctx.textAlign = 'center';
  const lines = label.split('\n');
  lines.forEach((line, i) => {
    ctx.fillText(line, 256, 110 + i * 60);
  });

  // Accent line
  ctx.strokeStyle = '#00f5d4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 80); ctx.lineTo(472, 80);
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

function generateArchTexture(label) {
  const canvas = document.createElement('canvas');
  canvas.width  = 1024; canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, 1024, 128);

  ctx.fillStyle = '#f7b731';
  ctx.font = 'bold 56px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, 512, 82);

  return new THREE.CanvasTexture(canvas);
}
