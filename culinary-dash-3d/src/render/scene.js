// Sync layer: sim state -> Three.js transforms, once per render frame.
// The render reads the sim but never mutates it. `alpha` is the interpolation
// factor from the fixed-step loop (0..1 into the next pending tick); we lerp the
// chef between its previous and current sim position so motion stays smooth.

import * as THREE from 'three';
import { to3 } from '../sim/data.js';
import { buildCustomer, DISH_COLOR } from './meshes.js';

const prev = { x: 160, y: 90, facing: -Math.PI / 2 };
const customerMeshes = new Map(); // customer id -> Group
let sceneRef = null;

export function attachScene(scene) { sceneRef = scene; }

const lerpColor = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

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

  // carried plate marker: show + colour by dish
  const carry = refs.chef.userData.carry;
  carry.visible = !!chef.carrying;
  if (chef.carrying) {
    const c = chef.carrying.cooked ? (DISH_COLOR[chef.carrying.dish] ?? 0xffd24a) : 0x3a4f7a;
    carry.material.color.set(c);
  }

  // station "you can use this" lift + timing-station cook colour
  for (const id in refs.stationMeshes) {
    const m = refs.stationMeshes[id];
    m.position.y = state.nearStation === id ? 0.9 : 0.8;
    const st = state.stations?.[id];
    if (st) {
      const body = m.children[0];
      if (st.cooking) {
        const station = refs.stationData[id];
        const frac = Math.min(1, st.t / (station.cook + station.green));
        // raw -> green (perfect) -> red (burnt)
        const col = st.t < station.cook
          ? lerpColor(0x8fd3ff, 0x5fbf5f, st.t / station.cook)
          : lerpColor(0x5fbf5f, 0xe0553a, Math.min(1, (st.t - station.cook) / station.green));
        body.material.emissive = col;
        body.material.emissiveIntensity = 0.5 + 0.3 * Math.sin(state.t * 8);
      } else {
        body.material.emissiveIntensity = 0;
      }
    }
  }

  syncCustomers(state);
}

function syncCustomers(state) {
  if (!sceneRef) return;
  const live = new Set();
  for (const c of state.customers) {
    live.add(c.id);
    let g = customerMeshes.get(c.id);
    if (!g) {
      g = buildCustomer(c.dish);
      customerMeshes.set(c.id, g);
      sceneRef.add(g);
    }
    const pos = to3(c.x, c.y);
    g.position.set(pos.x, c.state === 'waiting' ? 0 : -0.4, pos.z);
    g.visible = true;
    // patience ring: green -> red, and shrink as it drains
    const h = Math.max(0, c.hearts) / 3;
    g.userData.ring.material.color.copy(lerpColor(0xe0553a, 0x5fbf5f, h));
    g.userData.ring.scale.setScalar(0.4 + 0.6 * h);
    g.userData.orb.visible = c.state === 'waiting';
  }
  // remove departed customers
  for (const [id, g] of customerMeshes) {
    if (!live.has(id)) { sceneRef.remove(g); customerMeshes.delete(id); }
  }
}

// Called AFTER a sim tick to record the frame we just left, for interpolation.
export function commitPrev(state) {
  prev.x = state.chef.x;
  prev.y = state.chef.y;
  prev.facing = state.chef.facing;
}
