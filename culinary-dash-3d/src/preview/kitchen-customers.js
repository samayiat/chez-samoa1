// Dynamic diners — one mesh per sim customer, created/removed as they arrive and
// leave. Each shows a dish order bubble and a patience bar that drains gold->red,
// reading the sim's per-customer state so the visuals never drift from the logic.
import * as THREE from 'three';
import { mat, box, put, clamp01, lerp } from './util.js';
import { HEARTS_MAX } from '../sim/data.js';

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

    const torso = put(box(0.5, 0.6, 0.4, mat(top, { flat: true, rough: 0.7 })), 0, 0.75, 0); torso.castShadow = true; m.add(torso);
    const head = new THREE.Group(); head.position.set(0, 1.26, 0); m.add(head);
    head.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), mat(hair, { flat: true, rough: 0.9 })), 0, 0, -0.02));
    head.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), mat(skin, { rough: 0.7 })), 0, 0, 0.05));

    // seated legs — thigh forward, shin down at the knee
    const trouser = mat(0x2e2e38, { flat: true, rough: 0.85 });
    const sleeveMat = mat(top, { flat: true, rough: 0.7 });
    const skinMat = mat(skin, { rough: 0.7 });
    for (const sx of [-0.14, 0.14]) {
      const hip = new THREE.Group(); hip.position.set(sx, 0.5, 0.1); hip.rotation.x = -1.35; m.add(hip);
      hip.add(put(box(0.2, 0.34, 0.22, trouser), 0, -0.17, 0));                                // thigh (forward)
      const knee = new THREE.Group(); knee.position.y = -0.34; knee.rotation.x = 1.5; hip.add(knee);
      knee.add(put(box(0.18, 0.34, 0.2, trouser), 0, -0.17, 0));                               // shin (down)
      knee.add(put(box(0.22, 0.1, 0.28, mat(0x1a1a20, { flat: true })), 0, -0.36, 0.05));      // foot
    }
    // resting arms — forearms come forward onto the table at the elbow
    for (const sx of [-0.3, 0.3]) {
      const sh = new THREE.Group(); sh.position.set(sx, 1.0, 0.03); sh.rotation.x = -0.55; m.add(sh);
      sh.add(put(box(0.13, 0.3, 0.13, sleeveMat), 0, -0.15, 0));                               // upper arm
      const elbow = new THREE.Group(); elbow.position.y = -0.3; elbow.rotation.x = 1.15; sh.add(elbow);
      elbow.add(put(box(0.12, 0.28, 0.12, skinMat), 0, -0.14, 0));                             // forearm
      elbow.add(put(box(0.14, 0.1, 0.15, skinMat), 0, -0.3, 0));                               // hand
    }

    // order bubble with a dish-colored icon
    const bubble = new THREE.Group(); bubble.position.set(0, 2.0, 0.1); m.add(bubble);
    const bub = put(new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), mat(0xf4eee2, { rough: 0.7 })), 0, 0, 0);
    bub.scale.set(1.2, 0.95, 0.7); bubble.add(bub);
    bubble.add(put(box(0.08, 0.14, 0.02, mat(0xf4eee2, { rough: 0.7 })), 0, -0.19, 0)); // tail
    const icon = put(new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), mat(DISH_COLOR[c.dish] ?? 0xcccccc, { rough: 0.6 })), 0, 0, 0.13); bubble.add(icon);

    // patience bar under the bubble
    const barBg = put(box(0.5, 0.07, 0.03, mat(0x201811, { rough: 0.9 })), 0, 0.32, 0.12); bubble.add(barBg);
    const bar = put(box(0.48, 0.05, 0.05, mat(0x8be27a)), 0, 0.32, 0.14); bubble.add(bar);

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
      e.bubble.visible = waiting;
      e.bubble.position.y = 2.0 + Math.sin(t * 2 + e.seed) * 0.03;
      // leaving: slump + a red flash; served: a happy little bounce
      if (c.state === 'served') { e.servedT += dt; e.mesh.position.y = Math.abs(Math.sin(e.servedT * 12)) * 0.12; e.torso.material.emissive.setRGB(0, 0.15, 0); }
      else if (c.state === 'leaving') { e.torso.material.emissive.setRGB(0.25, 0, 0); e.head.rotation.z = lerp(e.head.rotation.z, 0.3, 1 - Math.exp(-6 * dt)); }
      else { e.torso.material.emissive.setScalar(0); }
    }
  }

  return { sync };
}
