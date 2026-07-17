// Impact VFX: sparks, hit-flashes, ground shockwave rings, slam dust, and dodge
// afterimages. Everything is pooled (no per-frame allocation) and mostly additive
// so the bloom pass makes hits pop. Driven by the impact spine's weight.
import * as THREE from 'three';
import { clamp01 } from './util.js';

export function createFx(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // ---- sparks: pool of tiny emissive shards ----
  const SPARKS = 160;
  const sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd98a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const sparks = [];
  for (let i = 0; i < SPARKS; i++) {
    const m = new THREE.Mesh(sparkGeo, sparkMat);
    m.visible = false; group.add(m);
    sparks.push({ m, life: 0, max: 1, v: new THREE.Vector3() });
  }
  let sp = 0;

  // ---- flashes: pool of bright spheres ----
  const flashGeo = new THREE.SphereGeometry(0.5, 12, 8);
  const flashes = [];
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    m.visible = false; group.add(m);
    flashes.push({ m, life: 0, max: 1 });
  }
  let fl = 0;

  // ---- shockwave rings on the floor ----
  const ringGeo = new THREE.RingGeometry(0.6, 1.0, 40);
  const rings = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff7a3a, blending: THREE.AdditiveBlending, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.visible = false; group.add(m);
    rings.push({ m, life: 0, max: 1, r0: 1, r1: 4 });
  }
  let rg = 0;

  // ---- dust puffs ----
  const dustGeo = new THREE.SphereGeometry(0.3, 8, 6);
  const dusts = [];
  for (let i = 0; i < 30; i++) {
    const m = new THREE.Mesh(dustGeo, new THREE.MeshStandardMaterial({ color: 0x6b5a44, transparent: true, roughness: 1, opacity: 0 }));
    m.visible = false; group.add(m);
    dusts.push({ m, life: 0, max: 1, v: new THREE.Vector3() });
  }
  let du = 0;

  // ---- dodge ghosts (faded chef silhouettes) ----
  const ghostGeo = new THREE.CapsuleGeometry(0.34, 0.9, 4, 8);
  const ghosts = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(ghostGeo, new THREE.MeshBasicMaterial({ color: 0x8e5bd0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.visible = false; group.add(m);
    ghosts.push({ m, life: 0, max: 1 });
  }
  let gh = 0;

  function sparkBurst(p, w, dx = 0, dz = 0) {
    const n = Math.round(6 + w * 8);
    for (let i = 0; i < n; i++) {
      const s = sparks[sp = (sp + 1) % SPARKS];
      s.m.visible = true; s.m.position.set(p.x, p.y, p.z);
      s.m.scale.setScalar(0.6 + Math.random() * 0.9);
      const spd = 2 + Math.random() * 4 + w;
      const ang = Math.random() * Math.PI * 2, up = Math.random() * 3 + 1;
      s.v.set(Math.cos(ang) * spd + dx * 3, up, Math.sin(ang) * spd + dz * 3);
      s.life = s.max = 0.3 + Math.random() * 0.3;
    }
  }
  function flash(p, size, color = 0xffffff) {
    const f = flashes[fl = (fl + 1) % flashes.length];
    f.m.visible = true; f.m.material.color.setHex(color);
    f.m.position.set(p.x, p.y, p.z); f.m.scale.setScalar(size);
    f.life = f.max = 0.16;
  }
  function shockwave(p, r1 = 4, color = 0xff7a3a) {
    const r = rings[rg = (rg + 1) % rings.length];
    r.m.visible = true; r.m.material.color.setHex(color);
    r.m.position.set(p.x, 0.05, p.z); r.r1 = r1;
    r.life = r.max = 0.5;
  }
  function dust(p, n = 14) {
    for (let i = 0; i < n; i++) {
      const d = dusts[du = (du + 1) % dusts.length];
      d.m.visible = true; d.m.position.set(p.x, 0.2, p.z);
      d.m.scale.setScalar(0.5 + Math.random());
      const ang = Math.random() * Math.PI * 2, spd = 1 + Math.random() * 3;
      d.v.set(Math.cos(ang) * spd, 0.5 + Math.random() * 1.5, Math.sin(ang) * spd);
      d.life = d.max = 0.6 + Math.random() * 0.4;
    }
  }
  function ghost(p, facing) {
    const g = ghosts[gh = (gh + 1) % ghosts.length];
    g.m.visible = true; g.m.position.set(p.x, 0.9, p.z); g.m.rotation.y = facing;
    g.life = g.max = 0.35;
  }

  function update(dt) {
    for (const s of sparks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) { s.m.visible = false; continue; }
      s.v.y -= 14 * dt; // gravity
      s.m.position.addScaledVector(s.v, dt);
      const k = clamp01(s.life / s.max);
      s.m.material.opacity = k; // shared mat: last write wins, fine for a glow field
      s.m.scale.setScalar(0.2 + k * 0.9);
    }
    for (const f of flashes) {
      if (f.life <= 0) continue;
      f.life -= dt;
      const k = clamp01(f.life / f.max);
      if (f.life <= 0) { f.m.visible = false; continue; }
      f.m.material.opacity = k; f.m.scale.setScalar((1 - k) * 2 + 0.4);
    }
    for (const r of rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const k = clamp01(r.life / r.max);
      if (r.life <= 0) { r.m.visible = false; continue; }
      const s = r.r0 + (1 - k) * (r.r1 - r.r0);
      r.m.scale.setScalar(s); r.m.material.opacity = k * 0.8;
    }
    for (const d of dusts) {
      if (d.life <= 0) continue;
      d.life -= dt;
      const k = clamp01(d.life / d.max);
      if (d.life <= 0) { d.m.visible = false; continue; }
      d.v.y -= 3 * dt; d.m.position.addScaledVector(d.v, dt);
      d.m.material.opacity = k * 0.5; d.m.scale.setScalar((1 - k) * 1.6 + 0.4);
    }
    for (const g of ghosts) {
      if (g.life <= 0) continue;
      g.life -= dt;
      const k = clamp01(g.life / g.max);
      if (g.life <= 0) { g.m.visible = false; continue; }
      g.m.material.opacity = k * 0.4;
    }
  }

  return { sparkBurst, flash, shockwave, dust, ghost, update };
}
