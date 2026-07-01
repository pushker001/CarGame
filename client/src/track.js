import * as THREE from 'three';
import { TRACK_POINTS, TRACK_WIDTH } from '../../shared/trackData.js';

const ROAD_COLOR    = 0x3a3a4a;
const CURB_A_COLOR  = 0xdd2222;
const CURB_B_COLOR  = 0xffffff;
const MARK_COLOR    = 0xffffff;
const BUILDING_PALLETE = [0x111118, 0x161622, 0x0f1522, 0x1a1a24, 0x1f1f2e]; // sleek dark glass/steel
const GROUND_COLOR  = 0x0f0f1a; // dark ground

export function buildTrack(scene) {
  const pts = TRACK_POINTS.map(p => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);

  const roadGroup = new THREE.Group();

  // ── Road surface ──────────────────────────────────────────
  const roadSegments = 200;
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

  // ── Dashed center line ────────────────────────────────────
  buildDashes(curve, roadSegments, roadGroup);

  // ── Curbs (striped edges) ─────────────────────────────────
  buildCurbs(curve, roadSegments, halfW, roadGroup);

  // ── Barriers ─────────────────────────────────────────────
  buildBarriers(curve, roadSegments, halfW, roadGroup);

  // ── Ground plane ──────────────────────────────────────────
  const groundGeo = new THREE.PlaneGeometry(800, 800);
  const groundMat = new THREE.MeshLambertMaterial({ color: GROUND_COLOR });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  roadGroup.add(ground);

  // ── City buildings ────────────────────────────────────────
  buildCity(curve, roadSegments, halfW, roadGroup);

  // ── Lamp posts ────────────────────────────────────────────
  buildLamps(curve, roadSegments, halfW, roadGroup);

  // ── Start/Finish line ─────────────────────────────────────
  buildStartLine(curve, halfW, roadGroup);

  scene.add(roadGroup);
  return { curve };
}

function buildDashes(curve, segs, group) {
  const mat = new THREE.MeshLambertMaterial({ color: MARK_COLOR });
  for (let i = 0; i < segs; i += 8) {
    const t0 = i / segs;
    const t1 = (i + 3) / segs;
    const pts = [];
    for (let s = 0; s <= 4; s++) {
      pts.push(curve.getPointAt(THREE.MathUtils.lerp(t0, t1, s / 4)));
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 4, 0.25, 4, false);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.02;
    group.add(mesh);
  }
}

function buildCurbs(curve, segs, halfW, group) {
  const matA = new THREE.MeshLambertMaterial({ color: CURB_A_COLOR });
  const matB = new THREE.MeshLambertMaterial({ color: CURB_B_COLOR });

  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < segs; i++) {
      const t = i / segs;
      const pt = curve.getPointAt(t);
      const tg = curve.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tg, new THREE.Vector3(0,1,0)).normalize();
      const edge = pt.clone().addScaledVector(right, side * (halfW + 0.5));

      const mat = i % 4 < 2 ? matA : matB;
      const geo = new THREE.BoxGeometry(3, 0.4, 1.2);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(edge);
      mesh.position.y = 0.2;
      mesh.lookAt(edge.clone().add(tg));
      group.add(mesh);
    }
  }
}

function buildBarriers(curve, segs, halfW, group) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x888899 });
  const step = 6;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < segs; i += step) {
      const t = i / segs;
      const pt = curve.getPointAt(t);
      const tg = curve.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tg, new THREE.Vector3(0,1,0)).normalize();
      const edge = pt.clone().addScaledVector(right, side * (halfW + 2.5));

      const geo = new THREE.BoxGeometry(5, 1.0, 0.5);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(edge);
      mesh.position.y = 0.5;
      mesh.lookAt(edge.clone().add(tg));
      group.add(mesh);
    }
  }
}

function buildCity(curve, segs, halfW, group) {
  const rng = seeder(42);
  const placedPositions = [];

  for (let i = 0; i < segs; i += 5) {
    for (let side = -1; side <= 1; side += 2) {
      const t = i / segs;
      const pt = curve.getPointAt(t);
      const tg = curve.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tg, new THREE.Vector3(0,1,0)).normalize();

      const dist = halfW + 8 + rng() * 12;
      const bPos = pt.clone().addScaledVector(right, side * dist);
      bPos.x += (rng() - 0.5) * 8;
      bPos.z += (rng() - 0.5) * 8;

      // Check overlap
      let ok = true;
      for (const p of placedPositions) {
        if (bPos.distanceTo(p) < 8) { ok = false; break; }
      }
      if (!ok) continue;
      placedPositions.push(bPos.clone());

      const w = 6  + rng() * 12;
      const d = 6  + rng() * 12;
      const h = 10 + rng() * 60;
      const col = BUILDING_PALLETE[Math.floor(rng() * BUILDING_PALLETE.length)];

      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshLambertMaterial({ color: col });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(bPos.x, h / 2, bPos.z);
      group.add(mesh);

      // Window glow strips
      addWindowGlows(mesh, w, h, d, group);
    }
  }
}

function addWindowGlows(building, w, h, d, group) {
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 0.6 });
  const rows = Math.floor(h / 4);
  for (let r = 1; r < rows; r++) {
    const geo = new THREE.PlaneGeometry(w * 0.7, 0.6);
    const p = new THREE.Mesh(geo, glowMat);
    p.position.set(
      building.position.x,
      r * (h / rows),
      building.position.z + d / 2 + 0.1
    );
    group.add(p);
  }
}

function buildLamps(curve, segs, halfW, group) {
  const poleMat  = new THREE.MeshLambertMaterial({ color: 0x555566 });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffdd });

  for (let i = 0; i < segs; i += 12) {
    for (let side = -1; side <= 1; side += 2) {
      const t = i / segs;
      const pt = curve.getPointAt(t);
      const tg = curve.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tg, new THREE.Vector3(0,1,0)).normalize();
      const lPos = pt.clone().addScaledVector(right, side * (halfW + 1.5));

      const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 7, 5);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.copy(lPos);
      pole.position.y = 3.5;
      group.add(pole);

      const headGeo = new THREE.SphereGeometry(0.4, 6, 6);
      const head = new THREE.Mesh(headGeo, lightMat);
      head.position.copy(lPos);
      head.position.y = 7.2;
      group.add(head);
    }
  }
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
