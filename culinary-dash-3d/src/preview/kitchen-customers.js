// Dynamic diners — one mesh per sim customer, created/removed as they arrive and
// leave. Each shows a dish order bubble and a patience bar that drains gold->red,
// reading the sim's per-customer state so the visuals never drift from the logic.
import * as THREE from 'three';
import { mat, box, put, clamp01, lerp } from './util.js';
import { HEARTS_MAX } from '../sim/data.js';
import { dishSpriteMaterial } from './dish-sprites.js';

const SKINS = [0x7a4328, 0x8a5a3a, 0xb07a4e, 0x633119, 0x9c6b45];
const TOPS = [0xc85a6a, 0x4f7fa8, 0x6a9a5a, 0xc8913a, 0x8a6bb0, 0x3f7f78];
const HAIRS = [0x1a1210, 0x3a281a, 0x120a06, 0x503018];
export const DISH_COLOR = {
  salad: 0x6a9a4a, karaage: 0xd9a441, lobster: 0xc23a2a,
  'whiskey-sour': 0xc8913a, 'gin-sour': 0xbfd6e0,
};
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

export function createCustomers(scene, tables) {
  const group = new THREE.Group(); scene.add(group);
  const map = new Map();

  function build(c) {
    const seed = hash(c.id);
    const skin = SKINS[seed % SKINS.length], top = TOPS[(seed * 3) % TOPS.length], hair = HAIRS[seed % HAIRS.length];
    const tpos = tables[c.table] || { x: 0, z: 0 };
    const m = new THREE.Group();
    m.position.set(tpos.x, 0, tpos.z - 0.85);   // back chair, facing the camera
    group.add(m);

    // Diners share the chef's form vocabulary — tapered cylinder limbs, rounded
    // joints, a neck — so the whole room reads as one cast, not two art passes.
    const topMat = mat(top, { flat: true, rough: 0.7 });
    const skinMat = mat(skin, { rough: 0.7 });
    const hairMat = mat(hair, { flat: true, rough: 0.9 });
    const trouser = mat(0x2e2e38, { flat: true, rough: 0.85 });
    const shoeMat = mat(0x1a1a20, { flat: true });
    const cyl = (rt, rb, h, mt, seg = 10) => { const x = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mt); x.castShadow = true; return x; };
    const ball = (r, mt, sx2 = 1, sy = 1, sz = 1) => { const x = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mt); x.scale.set(sx2, sy, sz); x.castShadow = true; return x; };

    // soft tapered torso + shoulder caps + neck
    const torso = cyl(0.24, 0.21, 0.55, topMat, 10); torso.scale.z = 0.72; torso.position.y = 0.72; m.add(torso);
    m.add(put(ball(0.11, topMat, 1, 0.85, 0.9), -0.21, 0.95, 0));
    m.add(put(ball(0.11, topMat, 1, 0.85, 0.9), 0.21, 0.95, 0));
    m.add(put(cyl(0.075, 0.085, 0.14, skinMat, 8), 0, 1.05, 0.02));   // neck

    // head — face + eyes + a seeded hairstyle (crop / afro / top puff / side puffs)
    const head = new THREE.Group(); head.position.set(0, 1.26, 0); m.add(head);
    head.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), skinMat), 0, 0, 0.05)); // face
    head.add(put(box(0.045, 0.05, 0.03, mat(0x120a06)), -0.08, 0.03, 0.24));                    // eyes
    head.add(put(box(0.045, 0.05, 0.03, mat(0x120a06)), 0.08, 0.03, 0.24));
    const style = (seed >> 2) % 4;
    head.add(put(ball(0.24, hairMat, 1.02, style === 1 ? 1.05 : 0.92, 0.98), 0, 0.05, -0.04));  // hair cap
    if (style === 1) { head.add(put(ball(0.14, hairMat), -0.18, 0.12, -0.06)); head.add(put(ball(0.14, hairMat), 0.18, 0.12, -0.06)); }   // afro width
    if (style === 2) head.add(put(ball(0.12, hairMat, 1, 0.9, 1), 0, 0.3, -0.05));              // top puff
    if (style === 3) { head.add(put(ball(0.1, hairMat, 1, 1.4, 1), -0.22, -0.08, -0.03)); head.add(put(ball(0.1, hairMat, 1, 1.4, 1), 0.22, -0.08, -0.03)); }   // side puffs

    // seated legs — tapered thigh forward, shin down at a rounded knee
    for (const sx of [-0.13, 0.13]) {
      const hip = new THREE.Group(); hip.position.set(sx, 0.48, 0.1); hip.rotation.x = -1.35; m.add(hip);
      hip.add(put(ball(0.095, trouser), 0, 0, 0));
      hip.add(put(cyl(0.095, 0.08, 0.3, trouser), 0, -0.16, 0));
      const knee = new THREE.Group(); knee.position.y = -0.31; knee.rotation.x = 1.5; hip.add(knee);
      knee.add(put(ball(0.075, trouser), 0, 0, 0));
      knee.add(put(cyl(0.075, 0.06, 0.28, trouser), 0, -0.15, 0));
      knee.add(put(ball(0.08, shoeMat, 1, 0.72, 1.25), 0, -0.31, 0.05));   // shoe
    }
    // resting arms — tapered, elbow bent so the forearm reaches the table
    for (const sx of [-0.27, 0.27]) {
      const sh = new THREE.Group(); sh.position.set(sx, 0.95, 0.03); sh.rotation.x = -0.55; m.add(sh);
      sh.add(put(cyl(0.07, 0.058, 0.26, topMat), 0, -0.14, 0));
      const elbow = new THREE.Group(); elbow.position.y = -0.28; elbow.rotation.x = 1.15; sh.add(elbow);
      elbow.add(put(ball(0.06, skinMat), 0, 0, 0));
      elbow.add(put(cyl(0.055, 0.048, 0.24, skinMat), 0, -0.13, 0));
      elbow.add(put(ball(0.065, skinMat), 0, -0.27, 0));                   // hand
    }

    // order icon — the 2D game's pixel sprite for the dish, a static billboard
    const bubble = new THREE.Group(); bubble.position.set(0, 2.2, 0.1); m.add(bubble);
    const icon = new THREE.Sprite(dishSpriteMaterial(c.dish)); icon.scale.set(0.95, 0.95, 1); bubble.add(icon);

    // patience bar under the icon
    const barBg = put(box(0.54, 0.07, 0.03, mat(0x201811, { rough: 0.9 })), 0, -0.6, 0); bubble.add(barBg);
    const bar = put(box(0.52, 0.05, 0.05, mat(0x8be27a)), 0, -0.6, 0.02); bubble.add(bar);

    return { mesh: m, torso, head, bubble, bar, seed, servedT: 0 };
  }

  function sync(state, dt, t) {
    // add newcomers
    for (const c of state.customers) if (!map.has(c.id)) map.set(c.id, build(c));
    // remove departed
    for (const [id, e] of map) if (!state.customers.find((c) => c.id === id)) { group.remove(e.mesh); map.delete(id); }
    // update
    for (const c of state.customers) {
      const e = map.get(c.id); if (!e) continue;
      const waiting = c.state === 'waiting';
      const h = clamp01(c.hearts / HEARTS_MAX);
      e.bar.scale.x = Math.max(0.03, h);
      e.bar.position.x = -0.24 * (1 - h);
      e.bar.material.color.setHSL(0.33 * h, 0.85, 0.5);   // green -> red
      e.bubble.visible = waiting;   // static icon — no bob
      // leaving: slump + a red flash; served: a happy little bounce
      if (c.state === 'served') { e.servedT += dt; e.mesh.position.y = Math.abs(Math.sin(e.servedT * 12)) * 0.12; e.torso.material.emissive.setRGB(0, 0.15, 0); }
      else if (c.state === 'leaving') { e.torso.material.emissive.setRGB(0.25, 0, 0); e.head.rotation.z = lerp(e.head.rotation.z, 0.3, 1 - Math.exp(-6 * dt)); }
      else { e.torso.material.emissive.setScalar(0); }
    }
  }

  return { sync };
}
