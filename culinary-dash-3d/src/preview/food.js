// Dish + ingredient models. Small stylized-procedural props so the food reads as
// FOOD at diorama distance — colour + rough silhouette do the work. Used for what
// the chef carries and what customers order (the bubble icon).
import * as THREE from 'three';
import { mat, box, put } from './util.js';

const ico = (r, color, o = {}) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(color, { flat: true, rough: o.rough ?? 0.6, ...o })); m.castShadow = true; return m; };
const sph = (r, color, o = {}) => new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat(color, { rough: o.rough ?? 0.6, ...o }));
const cyl = (rt, rb, h, color, o = {}) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 14), mat(color, { rough: o.rough ?? 0.5, ...o }));

// a shallow plate the plated dishes sit on
function plate() {
  const g = new THREE.Group();
  const p = cyl(0.19, 0.17, 0.035, 0xf1e9d6, { rough: 0.35 }); p.castShadow = true; g.add(p);
  g.add(put(cyl(0.19, 0.185, 0.02, 0xe3d6bd, { rough: 0.35 }), 0, 0.02, 0)); // rim
  return g;
}

// a red (cooked) / blue (raw) lobster — domed carapace up front, a segmented
// abdomen curling up to a spread fan tail at the back, two big front claws and
// swept antennae. Reads from the diorama's high angle by silhouette, not colour.
function lobster(color) {
  const g = new THREE.Group();
  const m = { flat: true, rough: 0.4 };
  const mat0 = () => mat(color, m);
  const dark = 0x000000;

  // domed head / carapace at the front (-z is toward the diner)
  const head = put(ico(0.075, color, m), 0, 0.055, -0.13); head.scale.set(1.1, 0.85, 1.25); g.add(head);
  // two little black eyes on stalks
  for (const s of [-1, 1]) g.add(put(sph(0.014, dark, { rough: 0.3 }), s * 0.035, 0.1, -0.19));

  // abdomen — 4 tapering segments stepping back and curling up, then the fan tail
  const seg = [[0.09, 0.05, -0.03], [0.08, 0.055, 0.04], [0.07, 0.065, 0.1], [0.055, 0.08, 0.15]];
  for (const [w, y, z] of seg) { const s = put(box(w, 0.055, 0.07, mat0()), 0, y, z); s.castShadow = true; g.add(s); }
  // fan tail — five flukes spread flat at the tip
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.34;
    const fl = put(new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.075, 4), mat0()), Math.sin(a) * 0.05, 0.088, 0.2 + Math.cos(a) * 0.02);
    fl.rotation.set(-1.15, a, 0); fl.scale.set(1, 1, 0.4); g.add(fl);
  }

  // two front claws — a thin arm reaching forward-out to a big pincer (two nippers)
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.08, 0.045, -0.17); arm.rotation.y = s * 0.6; g.add(arm);
    const upper = put(cyl(0.018, 0.024, 0.12, color, { seg: 6, flat: true, rough: 0.4 }), 0, 0, -0.07); upper.rotation.x = Math.PI / 2; arm.add(upper);
    const claw = new THREE.Group(); claw.position.set(0, 0, -0.14); arm.add(claw);
    const pincer = put(ico(0.06, color, m), 0, 0, 0); pincer.scale.set(0.85, 0.75, 1.4); pincer.castShadow = true; claw.add(pincer);
    claw.add(put(box(0.025, 0.028, 0.08, mat0()), -0.02, 0.016, -0.07));   // upper nipper
    claw.add(put(box(0.025, 0.028, 0.08, mat0()), 0.02, -0.016, -0.07));   // lower nipper
  }
  // swept antennae
  for (const s of [-1, 1]) { const a = put(cyl(0.004, 0.006, 0.16, color, { seg: 4, flat: true }), s * 0.04, 0.09, -0.24); a.rotation.set(1.15, 0, s * 0.25); g.add(a); }

  g.rotation.y = Math.PI;   // face the head + claws toward the diner / camera
  return g;
}

// the plated dishes (with base) — id from sim/data DISHES
export function dishModel(id) {
  const g = new THREE.Group();
  if (id === 'whiskey-sour' || id === 'gin-sour') {
    // an open tumbler: the coloured liquid IS the visible body (no enclosing glass
    // to hide it), read as glass by a bright rim lip + a clear foot ring.
    const liq = id === 'whiskey-sour' ? 0xd88a24 : 0xe4dfb0;
    const glassMat = { rough: 0.08, metal: 0.1, transparent: true, opacity: 0.45 };
    g.add(put(cyl(0.075, 0.075, 0.02, 0xdfeef2, glassMat), 0, 0.02, 0));        // glass foot
    g.add(put(cyl(0.045, 0.045, 0.06, 0xdfeef2, glassMat), 0, 0.05, 0));        // stem
    g.add(put(cyl(0.115, 0.09, 0.2, liq, { rough: 0.2, emissive: id === 'whiskey-sour' ? 0x351f04 : 0x323018, emi: 0.35 }), 0, 0.19, 0)); // liquid body
    const rim = put(new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.012, 6, 18), mat(0xeef6f8, glassMat)), 0, 0.29, 0); rim.rotation.x = Math.PI / 2; g.add(rim); // glass rim lip
    g.add(put(cyl(0.108, 0.108, 0.025, 0xf6f1e8, { rough: 0.9 }), 0, 0.29, 0)); // foam cap
    g.add(put(sph(0.032, 0xc0202e), 0.05, 0.315, 0.03));                        // cherry
    g.add(put(box(0.012, 0.14, 0.012, mat(0x8a1a24)), 0.05, 0.37, 0.03));       // cherry stick
    return g;
  }
  g.add(plate());
  if (id === 'salad') {
    const greens = [0x5f9a3e, 0x74ab4c, 0x4f8a38];
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const leaf = put(ico(0.06, greens[i % 3], { rough: 0.7 }), Math.cos(a) * 0.07, 0.07 + (i % 2) * 0.02, Math.sin(a) * 0.07); leaf.scale.y = 0.6; g.add(leaf); }
    g.add(put(sph(0.045, 0xc8402c), -0.04, 0.09, 0.03));                        // tomato
    g.add(put(sph(0.04, 0xc8402c), 0.06, 0.08, -0.03));
    g.add(put(ico(0.035, 0xe0a63a, { rough: 0.7 }), 0.02, 0.1, 0.06));          // carrot bit
  } else if (id === 'karaage') {
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.5; g.add(put(ico(0.075, [0xcf9038, 0xc07f2c][i % 2], { rough: 0.6 }), Math.cos(a) * 0.06, 0.08, Math.sin(a) * 0.06)); }
    const lem = put(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8, 1, false, 0, Math.PI), mat(0xe9d24a, { rough: 0.5 })), 0.1, 0.06, 0.08); lem.rotation.x = -0.4; g.add(lem); // lemon wedge
  } else if (id === 'lobster') {
    const l = lobster(0xcf3a24); l.position.y = 0.05; g.add(l);
  } else {
    g.add(put(sph(0.1, 0xd9c9a8), 0, 0.09, 0)); // fallback blob
  }
  return g;
}

// a raw ingredient the chef carries between stations
export function rawModel(dish) {
  if (dish === 'lobster') { const g = lobster(0x3a4f7a); g.position.y = 0.05; return g; }  // raw = blue (the raw/cooked tell)
  const g = new THREE.Group(); g.add(put(sph(0.11, 0x8aa0c0), 0, 0.08, 0)); return g;
}

// chopped veg carried from the cutting board to the salad bar
export function choppedModel() {
  const g = new THREE.Group();
  g.add(put(cyl(0.14, 0.13, 0.03, 0xc9a06a, { rough: 0.7 }), 0, 0, 0));         // a board sliver
  const cols = [0x5f9a3e, 0x74ab4c, 0xc8402c, 0xe0a63a];
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(put(box(0.05, 0.05, 0.05, mat(cols[i % 4], { flat: true, rough: 0.7 })), Math.cos(a) * 0.05, 0.04, Math.sin(a) * 0.05)); }
  return g;
}

// what the chef is holding, from the sim's `carrying`
export function carriedModel(carrying) {
  if (!carrying) return new THREE.Group();
  if (carrying.kind === 'raw') return rawModel(carrying.dish);
  if (carrying.kind === 'prep') return choppedModel();
  return dishModel(carrying.dish);
}
