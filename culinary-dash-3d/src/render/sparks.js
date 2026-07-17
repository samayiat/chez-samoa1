// Spark particles — the visible end of the impact spine. The sim emits weighted
// hit events; main.js turns them into bus.sparks; this drains them into a small
// recycled Points cloud animated on the REAL clock (render-only, so Math.random
// is fine here — it never touches the deterministic sim).

import * as THREE from 'three';

const MAX = 256;
const GRAV = 22;

export function createSparks(scene) {
  const pos = new Float32Array(MAX * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffe08a, size: 0.35, transparent: true, opacity: 0.95, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  const p = { x: new Float32Array(MAX), y: new Float32Array(MAX), z: new Float32Array(MAX) };
  const v = { x: new Float32Array(MAX), y: new Float32Array(MAX), z: new Float32Array(MAX) };
  const life = new Float32Array(MAX);
  let cursor = 0;
  let liveCount = 0;

  function spawn(s) {
    const i = cursor; cursor = (cursor + 1) % MAX;
    if (life[i] <= 0) liveCount++;         // reviving a dead slot
    const spread = 3 + s.w * 4;
    p.x[i] = s.x; p.y[i] = s.y; p.z[i] = s.z;
    v.x[i] = s.dx * spread + (Math.random() - 0.5) * spread;
    v.y[i] = 3 + Math.random() * 3 * (1 + s.w);
    v.z[i] = s.dz * spread + (Math.random() - 0.5) * spread;
    life[i] = 0.35 + s.w * 0.1;
  }

  function update(bus, rdt) {
    if (bus.sparks.length) { for (const s of bus.sparks) spawn(s); bus.sparks.length = 0; }
    if (liveCount <= 0) return;            // idle: nothing to animate, no GPU upload
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) continue;
      life[i] -= rdt;
      if (life[i] <= 0) { pos[i * 3 + 1] = -999; liveCount--; continue; } // just died -> park
      v.y[i] -= GRAV * rdt;
      p.x[i] += v.x[i] * rdt; p.y[i] += v.y[i] * rdt; p.z[i] += v.z[i] * rdt;
      pos[i * 3] = p.x[i]; pos[i * 3 + 1] = Math.max(0.05, p.y[i]); pos[i * 3 + 2] = p.z[i];
    }
    geo.attributes.position.needsUpdate = true;
  }

  return { update };
}
