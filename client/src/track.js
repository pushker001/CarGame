import * as THREE from 'three';
import { TRACK_POINTS, TRACK_WIDTH } from '../../shared/trackData.js';

const ROAD_COLOR    = 0x222222; // darker asphalt
const CURB_A_COLOR  = 0xff0000; // red
const CURB_B_COLOR  = 0xffffff; // white
const MARK_COLOR    = 0xffffff;
const GROUND_COLOR  = 0x3a7d44; // grass green

export function buildTrack(scene) {
  const pts = TRACK_POINTS.map(p => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);

  const roadGroup = new THREE.Group();

  // ── Road surface ──────────────────────────────────────────
  const roadSegments = 300; // higher res for sweeping corners
  const halfW = TRACK_WIDTH / 2;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= roadSegments; i++) {
    const t  = i / roadSegments;
    const pt = curve.getPointAt(t);
    const tg = curve.getTangentAt(t).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(tg, up).normalize();

    const left  = pt.clone().addScaledVector(right, -halfW);
    const right2 = pt.clone().addScaledVector(right, halfW);

    positions.push(left.x, left.y, left.z, right2.x, right2.y, right2.z);
    uvs.push(0, t * roadSegments * 0.2, 1, t * roadSegments * 0.2);

    if (i < roadSegments) {
      const b = i * 2;
      indices.push(b, b+1, b+2, b+1, b+3, b+2);
    }
  }

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  roadGeo.setIndex(indices);
  roadGeo.computeVertexNormals();

  const roadMat = new THREE.MeshLambertMaterial({ color: ROAD_COLOR, side: THREE.DoubleSide });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  roadGroup.add(roadMesh);

  // ── Curbs (red/white striped edges) ───────────────────────
  buildCurbs(curve, roadSegments, halfW, roadGroup);

  // ── Barriers (tire walls / armco) ─────────────────────────
  buildBarriers(curve, roadSegments, halfW, roadGroup);

  // ── Ground plane (Grass) ──────────────────────────────────
  const groundGeo = new THREE.PlaneGeometry(2000, 2000);
  const groundMat = new THREE.MeshLambertMaterial({ color: GROUND_COLOR });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  roadGroup.add(ground);

  // ── Visual Pit Lane ───────────────────────────────────────
  buildPitLane(curve, halfW, roadGroup);

  // ── Grandstands ───────────────────────────────────────────
  buildGrandstands(curve, halfW, roadGroup);

  // ── Gravel Traps ──────────────────────────────────────────
  buildGravelTraps(curve, roadSegments, halfW, roadGroup);

  // ── Start/Finish line ─────────────────────────────────────
  buildStartLine(curve, halfW, roadGroup);

  scene.add(roadGroup);
  return { curve };
}

function buildCurbs(curve, segs, halfW, group) {
  const matA = new THREE.MeshLambertMaterial({ color: CURB_A_COLOR });
  const matB = new THREE.MeshLambertMaterial({ color: CURB_B_COLOR });

  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < segs; i++) {
      const t = i / segs;
      const pt = curve.getPointAt(t);
      
      // Only place curbs on tighter corners (curvature check could be added, but placing everywhere is fine for v1 arcade feel)
      // We'll space them out nicely
      
      const tg = curve.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tg, new THREE.Vector3(0,1,0)).normalize();
      const edge = pt.clone().addScaledVector(right, side * (halfW + 0.5));

      const mat = i % 4 < 2 ? matA : matB;
      const geo = new THREE.BoxGeometry(3, 0.1, 1.2);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(edge);
      mesh.position.y = 0.05;
      mesh.lookAt(edge.clone().add(tg));
      group.add(mesh);
    }
  }
}

function buildBarriers(curve, segs, halfW, group) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xcccccc }); // Armco steel barrier color
  const step = 6;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < segs; i += step) {
      const t = i / segs;
      const pt = curve.getPointAt(t);
      const tg = curve.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tg, new THREE.Vector3(0,1,0)).normalize();
      // Push barriers further back to allow for runoff
      const edge = pt.clone().addScaledVector(right, side * (halfW + 15));

      const geo = new THREE.BoxGeometry(10, 1.2, 0.5);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(edge);
      mesh.position.y = 0.6;
      mesh.lookAt(edge.clone().add(tg));
      group.add(mesh);
    }
  }
}

function buildPitLane(curve, halfW, group) {
  // Pit lane parallel to the start/finish straight (t=0 to t=0.1)
  const pitMat = new THREE.MeshLambertMaterial({ color: ROAD_COLOR });
  const segments = 20;
  
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * 0.1; // Only first 10% of track
    if (t > 0.08 && t < 0.09) continue; // exit blend
    
    const pt = curve.getPointAt(t);
    const tg = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tg, new THREE.Vector3(0,1,0)).normalize();
    
    // Position pit lane to the right
    const pitPos = pt.clone().addScaledVector(right, halfW + 10);
    
    const geo = new THREE.PlaneGeometry(15, 6);
    const mesh = new THREE.Mesh(geo, pitMat);
    mesh.position.copy(pitPos);
    mesh.position.y = 0.01;
    mesh.rotation.x = -Math.PI / 2;
    // Align with track tangent
    const lookTarget = pitPos.clone().add(tg);
    lookTarget.y = 0.01;
    mesh.lookAt(lookTarget);
    group.add(mesh);
  }
}

function buildGrandstands(curve, halfW, group) {
  const standMat = new THREE.MeshLambertMaterial({ color: 0x999999 });
  const seatMat = new THREE.MeshLambertMaterial({ color: 0x224488 });
  
  // Place grandstands along the main straight (t = 0.02 to 0.08)
  for (let i = 0.02; i <= 0.08; i += 0.02) {
    const pt = curve.getPointAt(i);
    const tg = curve.getTangentAt(i).normalize();
    const right = new THREE.Vector3().crossVectors(tg, new THREE.Vector3(0,1,0)).normalize();
    
    // Left side of track
    const standPos = pt.clone().addScaledVector(right, -halfW - 25);
    
    const baseGeo = new THREE.BoxGeometry(40, 5, 10);
    const base = new THREE.Mesh(baseGeo, standMat);
    base.position.copy(standPos);
    base.position.y = 2.5;
    
    // Look at track center (pt) instead of down the track
    base.lookAt(pt);
    
    // Add tiered seating
    for (let s = 1; s <= 4; s++) {
      const tier = new THREE.Mesh(new THREE.BoxGeometry(38, 1, 2), seatMat);
      tier.position.set(0, 2.5 + s, -5 + s*2);
      base.add(tier);
    }
    
    group.add(base);
  }
}

function buildGravelTraps(curve, segs, halfW, group) {
  const gravelMat = new THREE.MeshLambertMaterial({ color: 0xd2b48c }); // tan/sand color
  
  // Just place a few large flat planes at corner apexes for visuals
  // E.g., t = 0.2, 0.4, 0.6, 0.8
  const trapPoints = [0.15, 0.35, 0.55, 0.75, 0.85];
  
  trapPoints.forEach(t => {
    const pt = curve.getPointAt(t);
    const tg = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tg, new THREE.Vector3(0,1,0)).normalize();
    
    // Outside of the corner (we just guess 'right' side here, for simplicity we place on both sides or just one)
    const trapPos = pt.clone().addScaledVector(right, halfW + 10);
    
    const geo = new THREE.PlaneGeometry(40, 30);
    const mesh = new THREE.Mesh(geo, gravelMat);
    mesh.position.copy(trapPos);
    mesh.position.y = 0.02;
    mesh.rotation.x = -Math.PI / 2;
    
    // Rotate horizontally to align with the track tangent
    mesh.rotation.z = Math.atan2(-tg.x, tg.z);
    
    group.add(mesh);
  });
}

function buildStartLine(curve, halfW, group) {
  const pt   = curve.getPointAt(0);
  const tg   = curve.getTangentAt(0).normalize();
  const right = new THREE.Vector3().crossVectors(tg, new THREE.Vector3(0,1,0)).normalize();

  // Checkered start/finish line
  const tileSize = TRACK_WIDTH / 8;
  const matA = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const matB = new THREE.MeshBasicMaterial({ color: 0x111111 });

  for (let col = 0; col < 8; col++) {
    for (let row = 0; row < 2; row++) {
      const geo = new THREE.BoxGeometry(tileSize, 0.05, tileSize);
      const mat = (col + row) % 2 === 0 ? matA : matB;
      const tile = new THREE.Mesh(geo, mat);
      const offset = (col - 3.5) * tileSize;
      tile.position.copy(pt);
      tile.position.addScaledVector(right, offset);
      tile.position.addScaledVector(tg, (row - 0.5) * tileSize);
      tile.position.y = 0.03;
      group.add(tile);
    }
  }
}

function seeder(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
}
