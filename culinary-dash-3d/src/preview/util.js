// Small shape/material helpers for the elevated-procedural preview.
// The whole look is built from primitives + good materials + lighting, no models.
import * as THREE from 'three';

export function mat(color, o = {}) {
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: o.rough ?? 0.72,
    metalness: o.metal ?? 0.0,
    flatShading: !!o.flat,
    emissive: new THREE.Color(o.emissive ?? 0x000000),
    emissiveIntensity: o.emi ?? 1,
  });
  if (o.transparent || o.opacity != null) { m.transparent = true; m.opacity = o.opacity ?? 1; }
  return m;
}

export function box(w, h, d, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function put(mesh, x, y, z) {
  mesh.position.set(x, y, z);
  return mesh;
}

export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t) => t * t * t;
// snappy overshoot for a punch that "pops"
export const easeOutBack = (t) => {
  const c1 = 2.2, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a, b, t) => a + (b - a) * t;
// frame-rate-independent smoothing factor
export const smooth = (dt, rate) => 1 - Math.exp(-rate * dt);
