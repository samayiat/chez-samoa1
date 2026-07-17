// Sync layer: sim state -> Three.js transforms, once per render frame.
// The render reads the sim but never mutates it. `alpha` is the interpolation
// factor from the fixed-step loop (0..1 into the next pending tick); we lerp the
// chef between its previous and current sim position so motion stays smooth.

import { to3, len2 } from '../sim/data.js';

const prev = { x: 160, y: 90, facing: -Math.PI / 2 };

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

  refs.chef.userData.carry.visible = !!chef.carrying;

  // highlight the station within interact range
  for (const id in refs.stationMeshes) {
    const m = refs.stationMeshes[id];
    const on = state.nearStation === id;
    m.position.y = on ? 0.9 : 0.8; // tiny lift as a "you can use this" tell
  }
}

// Called AFTER a sim tick to record the frame we just left, for interpolation.
export function commitPrev(state) {
  prev.x = state.chef.x;
  prev.y = state.chef.y;
  prev.facing = state.chef.facing;
}

export const _floorSpan = { w: () => len2(320), d: () => len2(180) };
