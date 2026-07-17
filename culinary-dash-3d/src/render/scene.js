// Sync layer: sim state -> Three.js transforms, once per render frame.
// The render reads the sim but never mutates it. `alpha` is the interpolation
// factor from the fixed-step loop (0..1 into the next pending tick); we lerp the
// chef between its previous and current sim position so motion stays smooth.
//
// Performance: this runs every frame, so it does ZERO allocation in the hot
// path — colours are scratch instances written in place, the live-set is reused,
// and material colours are only rewritten when the underlying value changed
// (dirty-checked via quantised keys stashed on userData).

import * as THREE from 'three';
import { to3 } from '../sim/data.js';
import { buildCustomer, buildEnemy, DISH_COLOR } from './meshes.js';

const prev = { x: 160, y: 90, facing: -Math.PI / 2 };
const customerMeshes = new Map(); // customer id -> Group
const enemyMeshes = new Map();    // enemy id -> Group
let sceneRef = null;

export function attachScene(scene) { sceneRef = scene; }

// --- scratch (module-scoped, never allocated per frame) ---
const _a = new THREE.Color();
const _b = new THREE.Color();
const _white = new THREE.Color(0xffffff);
const _liveE = new Set();
const _liveC = new Set();
const q = (v) => Math.round(v * 24); // quantise a 0..1 fraction for dirty-checks
// write lerp(a,b,t) into a material colour without allocating
function lerpInto(mat, a, b, t) { mat.color.copy(_a.set(a).lerp(_b.set(b), t)); }

export function syncScene(refs, state, alpha) {
  const chef = state.chef;

  // interpolate position; keep facing snappy (short-angle lerp)
  const ix = prev.x + (chef.x - prev.x) * alpha;
  const iy = prev.y + (chef.y - prev.y) * alpha;
  const p = to3(ix, iy);
  refs.chef.position.set(p.x, 0, p.z);

  let df = chef.facing - prev.facing;
  while (df > Math.PI) df -= Math.PI * 2;
  while (df < -Math.PI) df += Math.PI * 2;
  refs.chef.rotation.y = prev.facing + df * Math.min(1, alpha * 1.5);

  // carried plate marker: show + colour by dish (only rewrite on change)
  const carry = refs.chef.userData.carry;
  carry.visible = !!chef.carrying;
  if (chef.carrying) {
    const c = chef.carrying.cooked ? (DISH_COLOR[chef.carrying.dish] ?? 0xffd24a) : 0x3a4f7a;
    if (carry.userData._c !== c) { carry.material.color.set(c); carry.userData._c = c; }
  }

  // chef hurt flash (red) during the brawl — dirty-checked
  const chefBody = refs.chef.children[0].children[0];
  if (chefBody?.material) {
    const hurt = chef.hurtT > 0;
    if (refs.chef.userData._hurt !== hurt) {
      chefBody.material.color.set(hurt ? 0xff5555 : 0x3a2f5c);
      refs.chef.userData._hurt = hurt;
    }
  }

  // station "you can use this" lift + timing-station cook glow
  for (const id in refs.stationMeshes) {
    const m = refs.stationMeshes[id];
    m.position.y = state.nearStation === id ? 0.9 : 0.8;
    const st = state.stations?.[id];
    if (!st) continue;
    const body = m.children[0];
    if (st.cooking) {
      const station = refs.stationData[id];
      const raw = st.t < station.cook;
      const frac = raw ? st.t / station.cook : Math.min(1, (st.t - station.cook) / station.green);
      const key = (raw ? 0 : 100) + q(frac);
      if (m.userData._cook !== key) {          // only recompute the glow colour on change
        // raw -> green (perfect) -> red (burnt), written into emissive in place
        body.material.emissive.copy(raw ? _a.set(0x8fd3ff).lerp(_b.set(0x5fbf5f), frac) : _a.set(0x5fbf5f).lerp(_b.set(0xe0553a), frac));
        m.userData._cook = key;
      }
      body.material.emissiveIntensity = 0.5 + 0.3 * Math.sin(state.t * 8); // cheap pulse
    } else if (m.userData._cook !== -1) {
      body.material.emissiveIntensity = 0;
      m.userData._cook = -1;
    }
  }

  syncCustomers(state);
  syncEnemies(state);
}

function syncEnemies(state) {
  if (!sceneRef) return;
  _liveE.clear();
  for (const e of state.enemies || []) {
    _liveE.add(e.id);
    let g = enemyMeshes.get(e.id);
    if (!g) { g = buildEnemy(e.kind, e.r); enemyMeshes.set(e.id, g); sceneRef.add(g); }
    const p = to3(e.x, e.y);
    g.position.set(p.x, 0, p.z);
    g.rotation.y = Math.atan2(state.chef.x - e.x, -(state.chef.y - e.y));

    const flash = e.hurtT > 0;
    if (g.userData._flash !== flash) {         // dirty-checked flash
      g.userData.body.material.color.copy(flash ? _white : g.userData.baseColor);
      g.userData._flash = flash;
    }
    const frac = Math.max(0, e.hp) / e.maxHp;
    g.userData.bar.scale.x = Math.max(0.001, frac);
    const bkey = q(frac);
    if (g.userData._bar !== bkey) { lerpInto(g.userData.bar.material, 0xff5566, 0x66ff88, frac); g.userData._bar = bkey; }
  }
  for (const [id, g] of enemyMeshes) {
    if (!_liveE.has(id)) { sceneRef.remove(g); enemyMeshes.delete(id); }
  }
}

function syncCustomers(state) {
  if (!sceneRef) return;
  _liveC.clear();
  for (const c of state.customers) {
    _liveC.add(c.id);
    let g = customerMeshes.get(c.id);
    if (!g) { g = buildCustomer(c.dish); customerMeshes.set(c.id, g); sceneRef.add(g); }
    const pos = to3(c.x, c.y);
    g.position.set(pos.x, c.state === 'waiting' ? 0 : -0.4, pos.z);

    const h = Math.max(0, c.hearts) / 3;
    g.userData.ring.scale.setScalar(0.4 + 0.6 * h);
    const rkey = q(h);
    if (g.userData._ring !== rkey) { lerpInto(g.userData.ring.material, 0xe0553a, 0x5fbf5f, h); g.userData._ring = rkey; }
    g.userData.orb.visible = c.state === 'waiting';
  }
  for (const [id, g] of customerMeshes) {
    if (!_liveC.has(id)) { sceneRef.remove(g); customerMeshes.delete(id); }
  }
}

// Called AFTER a sim tick to record the frame we just left, for interpolation.
export function commitPrev(state) {
  prev.x = state.chef.x;
  prev.y = state.chef.y;
  prev.facing = state.chef.facing;
}
