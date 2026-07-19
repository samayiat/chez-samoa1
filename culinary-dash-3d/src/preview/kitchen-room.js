// The 2.5D kitchen — a warm diner rendered in the SAME 3D world as the boss fight,
// but bright, cozy and shot from a fixed diorama camera so the whole floor reads at
// once (the legibility a cooking game lives on). This is the cozy counter-note to
// the fight's dark alley; the cut into a boss night is the same room going dark.
import * as THREE from 'three';
import { mat, box, put, lerp } from './util.js';
import { RIM_LIGHT } from '../engine/quality.js';

const FLOOR = 0x8a5a34;      // warm oak planks
const WALL = 0xcaa47a;       // warm cream wall
const WOOD = 0x6e4526;       // counter / table wood
const CREAM = 0xe7d8b8;      // countertop / plates
const TEAL = 0x2f6e66;       // diner accent
const BRASS = 0xb8912f;
const SKINS = [0x7a4328, 0x8a5a3a, 0xb07a4e, 0x633119, 0x9c6b45];
const TOPS = [0xc85a6a, 0x4f7fa8, 0x6a9a5a, 0xc8913a, 0x8a6bb0];
const HAIRS = [0x1a1210, 0x3a281a, 0x120a06, 0x503018];

export function buildKitchen(scene) {
  const g = new THREE.Group();
  scene.add(g);
  const steamers = [];

  // ---- floor: warm planks ----
  const floor = new THREE.Mesh(new THREE.BoxGeometry(17, 0.4, 12), mat(FLOOR, { rough: 0.85 }));
  floor.position.set(0, -0.2, -0.5); floor.receiveShadow = true; g.add(floor);
  // plank seams
  for (let i = -7; i <= 7; i++) g.add(put(box(0.04, 0.01, 12, mat(0x5f3f22, { rough: 1 })), i * 1.1, 0.011, -0.5));

  // ---- walls ----
  const wallMat = mat(WALL, { rough: 0.95 });
  g.add(put(box(17, 6, 0.4, wallMat), 0, 2.6, -6.4));          // back
  g.add(put(box(0.4, 6, 12, wallMat), -8.4, 2.6, -0.5));       // left
  g.add(put(box(0.4, 6, 12, wallMat), 8.4, 2.6, -0.5));        // right
  // wainscot + a rail of warmth along the back
  g.add(put(box(17, 1.1, 0.5, mat(TEAL, { rough: 0.7 })), 0, 0.35, -6.35));
  g.add(put(box(17, 0.12, 0.55, mat(BRASS, { metal: 0.6, rough: 0.4 })), 0, 0.95, -6.33));

  // ---- a warm window on the back wall (daylight glow) ----
  const win = new THREE.Group(); win.position.set(-4.6, 3.1, -6.2); g.add(win);
  win.add(put(box(3.2, 2.4, 0.1, mat(0xffe6b0, { emissive: 0xffdf9c, emi: 1.2 })), 0, 0, 0));
  win.add(put(box(3.5, 0.18, 0.24, mat(WOOD, { rough: 0.8 })), 0, 1.2, 0.08));
  win.add(put(box(3.5, 0.18, 0.24, mat(WOOD, { rough: 0.8 })), 0, -1.2, 0.08));
  win.add(put(box(0.16, 2.4, 0.24, mat(WOOD, { rough: 0.8 })), 0, 0, 0.08));

  // ---- the pass counter (kitchen behind, dining in front) ----
  const pass = new THREE.Group(); pass.position.set(0, 0, -3.4); g.add(pass);
  const passBase = put(box(12, 1.5, 0.9, mat(WOOD, { rough: 0.8 })), 0, 0.75, 0); passBase.castShadow = true; passBase.receiveShadow = true; pass.add(passBase);
  pass.add(put(box(12.3, 0.18, 1.15, mat(CREAM, { rough: 0.5 })), 0, 1.55, 0));   // cream top
  // a stack of clean plates on the pass
  for (let i = 0; i < 4; i++) pass.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 16), mat(CREAM, { rough: 0.4 })), 3.4, 1.66 + i * 0.06, 0.1));
  // a served dish under the heat lamp
  pass.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 16), mat(0xf0e6cf, { rough: 0.4 })), -3.2, 1.66, 0.1));
  pass.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mat(0xc23a2a, { rough: 0.6 })), -3.2, 1.78, 0.1)); // a lobster-red dish

  // ---- kitchen stations behind the pass ----
  station(g, -5.2, -5.2, 'stove', steamers);
  station(g, -2.4, -5.2, 'prep');
  station(g, 2.4, -5.2, 'fryer');
  station(g, 5.2, -5.2, 'bar');

  // ---- dining tables + seated customers ----
  const tableSpots = [[-5, 1.2, 2], [-1.4, 3.2, 3], [2.6, 1.0, 1], [5.4, 2.8, 0], [-4.4, 4.4, 4], [3.2, 4.6, 2]];
  tableSpots.forEach(([x, z, cust], i) => diningTable(g, x, z, cust, i));

  // ---- hanging warm lamps (bloom) ----
  const lampXs = [-3.5, 0, 3.5];
  const lamps = [];
  lampXs.forEach((x) => {
    const lg = new THREE.Group(); lg.position.set(x, 4.4, -0.5); g.add(lg);
    lg.add(put(box(0.05, 1.4, 0.05, mat(0x2a2a2a)), 0, 0.7, 0));
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.5, 16, 1, true), mat(BRASS, { metal: 0.5, rough: 0.5, emissive: 0x3a2a10, emi: 0.4 }));
    shade.position.y = 0; shade.rotation.x = Math.PI; lg.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), mat(0xfff0c8, { emissive: 0xffcf8a, emi: 2.6 }));
    bulb.position.y = -0.1; lg.add(bulb);
    const pl = new THREE.PointLight(0xffd9a0, 16, 9, 2); pl.position.y = -0.1; lg.add(pl);
    lamps.push(lg);
  });

  // ---- lighting: bright + warm, soft shadows ----
  scene.add(new THREE.HemisphereLight(0xfff0d8, 0x4a3a2a, 0.75));
  const key = new THREE.DirectionalLight(0xfff0d0, 1.7);
  key.position.set(5, 11, 6); key.castShadow = true;
  key.shadow.mapSize.set(RIM_LIGHT ? 2048 : 1024, RIM_LIGHT ? 2048 : 1024);
  key.shadow.camera.near = 1; key.shadow.camera.far = 40;
  const S = 12; key.shadow.camera.left = -S; key.shadow.camera.right = S; key.shadow.camera.top = S; key.shadow.camera.bottom = -S;
  key.shadow.bias = -0.0008; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  if (RIM_LIGHT) { const fill = new THREE.DirectionalLight(0xffe0b0, 0.4); fill.position.set(-6, 5, 8); scene.add(fill); }

  return {
    update(dt, t) {
      for (const s of steamers) s.update(dt, t);
      for (let i = 0; i < lamps.length; i++) lamps[i].rotation.z = Math.sin(t * 0.7 + i) * 0.02;
    },
  };
}

// ---- a kitchen station: a body + a hint of what it is ----
function station(g, x, z, kind, steamers) {
  const s = new THREE.Group(); s.position.set(x, 0, z); g.add(s);
  const body = put(box(2.2, 1.4, 1.2, mat(0x5a5f66, { metal: 0.3, rough: 0.6 })), 0, 0.7, 0); body.castShadow = true; body.receiveShadow = true; s.add(body);
  s.add(put(box(2.3, 0.1, 1.3, mat(0x8a9098, { metal: 0.5, rough: 0.4 })), 0, 1.45, 0));
  if (kind === 'stove') {
    const pot = put(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.44, 0.5, 18), mat(0x30343a, { metal: 0.6, rough: 0.4 })), 0, 1.75, 0); pot.castShadow = true; s.add(pot);
    s.add(put(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 18), mat(0x20242a, { metal: 0.6 })), 0, 2.0, 0));
    if (steamers) steamers.push(makeSteam(s, 0, 2.1, 0));
    // burner glow
    const glow = new THREE.PointLight(0xff7a30, 3, 2.5, 2); glow.position.set(0, 1.55, 0); s.add(glow);
  } else if (kind === 'fryer') {
    s.add(put(box(1.6, 0.3, 0.9, mat(0xcaa23a, { metal: 0.4, rough: 0.4, emissive: 0x3a2a08, emi: 0.4 })), 0, 1.6, 0)); // oil
    if (steamers) steamers.push(makeSteam(s, 0, 1.8, 0, 0xffe6b0));
  } else if (kind === 'prep') {
    s.add(put(box(2.0, 0.08, 1.0, mat(CREAM, { rough: 0.5 })), 0, 1.5, 0));
    s.add(put(box(0.5, 0.1, 0.35, mat(0x6a9a4a, { rough: 0.7 })), -0.4, 1.58, 0.1)); // veg
    s.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mat(0xc23a2a, { rough: 0.7 })), 0.4, 1.6, 0));
  } else if (kind === 'bar') {
    for (let i = 0; i < 4; i++) s.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.5, 10), mat([0x2f6e66, 0xb8912f, 0x8a2f3f, 0x3a5f8a][i], { metal: 0.3, rough: 0.4, emissive: 0x0a0a0a, emi: 0.3 })), -0.6 + i * 0.4, 1.75, 0));
  }
}

// ---- a round table with two chairs + optional seated customers ----
function diningTable(g, x, z, custCount, seed) {
  const t = new THREE.Group(); t.position.set(x, 0, z); g.add(t);
  const post = put(box(0.16, 0.85, 0.16, mat(0x3a2a1a)), 0, 0.42, 0); t.add(post);
  const top = put(new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.1, 20), mat(WOOD, { rough: 0.6 })), 0, 0.88, 0); top.castShadow = true; top.receiveShadow = true; t.add(top);
  // a candle
  t.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8), mat(CREAM)), 0, 0.99, 0));
  t.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(0xffb040, { emissive: 0xffa030, emi: 1.4 })), 0, 1.1, 0));
  // chairs + customers facing the table
  const seats = [[0, 1.0], [0, -1.0]];
  for (let i = 0; i < seats.length; i++) {
    const [sx, sz] = seats[i];
    const chair = put(box(0.5, 0.5, 0.5, mat(0x4a3a2a, { rough: 0.8 })), sx, 0.25, sz); t.add(chair);
    if (i < custCount) seatedCustomer(t, sx, sz, seed * 2 + i, sz > 0 ? Math.PI : 0);
  }
}

function seatedCustomer(t, x, z, seed, faceY) {
  const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = faceY; t.add(c);
  const skin = SKINS[seed % SKINS.length], top = TOPS[(seed * 3) % TOPS.length], hair = HAIRS[seed % HAIRS.length];
  const torso = put(box(0.5, 0.62, 0.4, mat(top, { flat: true, rough: 0.7 })), 0, 0.75, 0); torso.castShadow = true; c.add(torso);
  const head = new THREE.Group(); head.position.set(0, 1.28, 0); c.add(head);
  head.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), mat(hair, { flat: true, rough: 0.9 })), 0, 0, -0.02));
  head.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), mat(skin, { rough: 0.7 })), 0, 0, 0.05));
  // an order bubble above waiting customers — a soft matte speech bubble + a food
  // icon (NOT emissive, so bloom doesn't turn it into a lightbulb)
  if (seed % 2 === 0) {
    const b = new THREE.Group(); b.position.set(0, 1.9, 0.12); c.add(b);
    const bub = put(new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), mat(0xf4eee2, { rough: 0.7 })), 0, 0, 0);
    bub.scale.set(1.15, 0.9, 0.7); b.add(bub);
    b.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat([0xc23a2a, 0x6a9a4a, 0xc8913a][seed % 3], { rough: 0.6 })), 0, 0, 0.12));
    b.add(put(box(0.08, 0.14, 0.02, mat(0xf4eee2, { rough: 0.7 })), 0, -0.18, 0)); // bubble tail
  }
}

// ---- a rising steam column (recycled points) ----
function makeSteam(parent, x, y, z, color = 0xffffff) {
  const N = 14;
  const pos = new Float32Array(N * 3);
  const seeds = [];
  for (let i = 0; i < N; i++) { pos[i * 3] = x; pos[i * 3 + 1] = y + i * 0.06; pos[i * 3 + 2] = z; seeds.push(Math.random()); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.22, transparent: true, opacity: 0.28, depthWrite: false }));
  parent.add(pts);
  return { update(dt, t) {
    const a = geo.attributes.position.array;
    for (let i = 0; i < N; i++) {
      a[i * 3 + 1] += dt * 0.4;
      a[i * 3] = x + Math.sin(t * 1.5 + seeds[i] * 6) * 0.12 * ((a[i * 3 + 1] - y) );
      if (a[i * 3 + 1] > y + 1.4) a[i * 3 + 1] = y;
    }
    geo.attributes.position.needsUpdate = true;
  } };
}
