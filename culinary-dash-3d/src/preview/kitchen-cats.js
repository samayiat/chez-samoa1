// THE CATS — ported in spirit from the 2D game: a black TUXEDO (white chest)
// and an ORANGE (white belly). Territorial — they never settle at the same
// spot — and purely ambient: not solid, no effect on any system. They are the
// room being alive, not a mechanic.
import * as THREE from 'three';
import { mat, box, put, lerp } from './util.js';

const PALETTES = {
  tux:    { body: 0x332d28, dark: 0x181310, belly: 0xf2eee6, eye: 0xd8e46a },
  orange: { body: 0xd98a3a, dark: 0xa25f22, belly: 0xf2eee6, eye: 0x8fd86a },
};
// floor spots clear of tables, stations, plants and the chef's main lanes
const SPOTS = [
  { x: -4.3, z: 4.9 }, { x: 2.6, z: 5.2 }, { x: 7.6, z: -1.7 },
  { x: -7.9, z: -1.0 }, { x: 5.3, z: 4.8 }, { x: -6.4, z: 1.3 },
];
const SPEED = 1.35, GAP = 2.2;

function buildCat(pal) {
  const p = PALETTES[pal];
  const g = new THREE.Group();
  const bodyMat = mat(p.body, { flat: true, rough: 0.85 });
  const bellyMat = mat(p.belly, { rough: 0.8 });
  // body — a low loaf-capsule, chest/belly patch in front
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.24, 3, 8), bodyMat);
  body.rotation.x = Math.PI / 2; body.position.set(0, 0.16, 0); body.castShadow = true; g.add(body);
  g.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bellyMat), 0, 0.13, 0.14));   // chest patch
  // head + ears + eyes + muzzle
  const head = new THREE.Group(); head.position.set(0, 0.29, 0.2); g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), bodyMat); skull.castShadow = true; head.add(skull);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 4), bodyMat);
    ear.position.set(sx * 0.065, 0.1, -0.01); ear.rotation.z = -sx * 0.25; head.add(ear);
  }
  head.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), pal === 'tux' ? bellyMat : bodyMat), 0, -0.02, 0.09));  // muzzle (tux gets the white chin)
  head.add(put(box(0.022, 0.03, 0.01, mat(p.eye, { emissive: p.eye, emi: 0.35 })), -0.045, 0.02, 0.095));
  head.add(put(box(0.022, 0.03, 0.01, mat(p.eye, { emissive: p.eye, emi: 0.35 })), 0.045, 0.02, 0.095));
  // legs — four stubs
  for (const [lx, lz] of [[-0.07, 0.1], [0.07, 0.1], [-0.07, -0.1], [0.07, -0.1]]) {
    g.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.12, 6), bodyMat), lx, 0.06, lz));
  }
  // tail — two segments curling up, swaying from the base
  const tail = new THREE.Group(); tail.position.set(0, 0.2, -0.18); g.add(tail);
  const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.16, 6), bodyMat);
  t1.position.y = 0.08; t1.rotation.x = 0.5; tail.add(t1);
  const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.024, 0.14, 6), pal === 'tux' ? bodyMat : mat(p.dark, { flat: true, rough: 0.85 }));
  t2.position.set(0, 0.19, 0.06); t2.rotation.x = -0.3; tail.add(t2);
  return { group: g, head, tail };
}

export function createCats(scene) {
  const cats = [];
  const mk = (pal, spotIdx) => {
    const c = buildCat(pal);
    const s = SPOTS[spotIdx];
    c.group.position.set(s.x, 0, s.z);
    scene.add(c.group);
    cats.push({ ...c, x: s.x, z: s.z, tx: s.x, tz: s.z, state: 'sit', t: 3 + Math.random() * 5, phase: Math.random() * 7 });
  };
  mk('tux', 0); mk('orange', 2);   // start at different spots, like the 2D pair

  function pickSpot(self) {
    const others = cats.filter((c) => c !== self);
    const open = SPOTS.filter((s) =>
      Math.hypot(s.x - self.x, s.z - self.z) > 1 &&
      others.every((o) => Math.hypot(s.x - o.tx, s.z - o.tz) > GAP));
    return open.length ? open[Math.floor(Math.random() * open.length)] : null;
  }

  function update(dt, t) {
    for (const c of cats) {
      c.t -= dt;
      if (c.state === 'sit') {
        // seated: loaf low, tail swishing slowly, an occasional head turn
        c.group.scale.y = lerp(c.group.scale.y, 0.86, 1 - Math.exp(-4 * dt));
        c.tail.rotation.z = Math.sin(t * 1.1 + c.phase) * 0.35;
        c.head.rotation.y = Math.sin(t * 0.35 + c.phase * 2) * 0.5;
        if (c.t <= 0) {
          const s = pickSpot(c);
          if (s) { c.tx = s.x; c.tz = s.z; c.state = 'walk'; }
          c.t = 4 + Math.random() * 6;
        }
      } else {
        // walking: face the target, trot with a bob, quicker tail
        c.group.scale.y = lerp(c.group.scale.y, 1, 1 - Math.exp(-6 * dt));
        const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz);
        if (d < 0.05) { c.state = 'sit'; c.t = 4 + Math.random() * 7; }
        else {
          const step = Math.min(d, SPEED * dt);
          c.x += (dx / d) * step; c.z += (dz / d) * step;
          c.group.rotation.y = Math.atan2(dx, dz);
          c.group.position.y = Math.abs(Math.sin(t * 9 + c.phase)) * 0.03;
          c.tail.rotation.z = Math.sin(t * 5 + c.phase) * 0.25;
          c.head.rotation.y = 0;
        }
        c.group.position.x = c.x; c.group.position.z = c.z;
      }
    }
  }

  return { update };
}
