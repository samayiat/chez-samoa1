// The 2.5D diner, built at the service sim's real layout (stations along the back
// counter, tables in front — positions from sim/data.js via rpos), so what the
// player sees sits exactly where the sim's logic is. Warm, bright, fixed-camera:
// the cozy counter-note to the boss fight, same 3D world.
import * as THREE from 'three';
import { mat, box, put, lerp, clamp01 } from './util.js';
import { RIM_LIGHT } from '../engine/quality.js';
import { STATIONS, TABLES } from '../sim/data.js';
import { rpos } from './kitchen-space.js';

const FLOOR = 0x8a5a34, WALL = 0xcaa47a, WOOD = 0x6e4526, CREAM = 0xe7d8b8;
const TEAL = 0x2f6e66, BRASS = 0xb8912f, STEEL = 0x8a9098;

// The locale outside the windows — ONE continuous tropical panorama behind the
// whole wall, so all three windows look into the same world (one sun, one island,
// one ocean). Flat-coloured geometry, on-style and moiré-free. Returns update():
// wave bands drift, palms sway, and the whole view bobs + rolls gently against
// the window frames — the diner reads as floating.
function localePanorama() {
  const W = 22, H = 4.5, BASE_Y = 3.1;
  const v = new THREE.Group(); v.position.set(0, BASE_Y, -4.55);
  const flat = (col) => new THREE.MeshBasicMaterial({ color: col });
  const quad = (qw, qh, col, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(qw, qh), flat(col)); m.position.set(x, y, z); v.add(m); return m; };
  const HZ = -0.15;                                              // horizon (local y)
  const sky = quad(W, H, 0x8fc9e8, 0, 0, 0);                     // sky
  const haze = quad(W, 0.5, 0xbfe3ea, 0, HZ + 0.25, 0.001);      // pale haze at the horizon
  const sun = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), flat(0xfff2cf)); sun.position.set(1.3, 1.05, 0.002); v.add(sun);   // the ONE sun (center window)
  const isl = new THREE.Mesh(new THREE.CircleGeometry(1.15, 18, 0, Math.PI), flat(0x86ad8c)); isl.position.set(-5.6, HZ, 0.003); isl.scale.set(1, 0.4, 1); v.add(isl);   // island (left window)
  const ocean = quad(W, HZ + H / 2, 0x3f97ad, 0, (HZ - H / 2) / 2, 0.004);     // ocean up to the horizon (in FRONT of the sun, so it sinks behind the water)
  const glint = quad(0.9, HZ + H / 2, 0xcdeef0, 1.3, (HZ - H / 2) / 2, 0.0045); // sun glint on the water
  // wave bands — long light/dark strips that update() drifts sideways
  const waves = [
    quad(W + 2, 0.09, 0x59acc0, 0, HZ - 0.28, 0.005),
    quad(W + 2, 0.12, 0x357f95, 0, HZ - 0.8, 0.005),
    quad(W + 2, 0.15, 0x59acc0, 0, HZ - 1.45, 0.005),
  ];
  // sunset grade — each material lerps noon -> dusk as the day runs out
  const C = (h) => new THREE.Color(h);
  const grade = [
    [sky.material, C(0x8fc9e8), C(0xef8a70)],   // late day goes pinkish orange
    [haze.material, C(0xbfe3ea), C(0xffb39c)],
    [sun.material, C(0xfff2cf), C(0xff9260)],
    [ocean.material, C(0x3f97ad), C(0x3d5f88)], // deep with a violet cast under the pink sky
    [glint.material, C(0xcdeef0), C(0xffbfa4)],
    [isl.material, C(0x86ad8c), C(0x5e7a66)],
    [waves[0].material, C(0x59acc0), C(0x3f7a94)],
    [waves[1].material, C(0x357f95), C(0x27556e)],
    [waves[2].material, C(0x59acc0), C(0x3f7a94)],
  ];
  const SUN_TOP = 1.05, SUN_SET = HZ - 0.24;                     // half-sunk into the sea by close
  const palms = [];
  const palm = (px, s, flip) => {
    const p = new THREE.Group(); p.position.set(px, -H / 2 + 0.05, 0.01); p.scale.x = flip ? -1 : 1; v.add(p); palms.push(p);
    // gently curved, tapered trunk (a shape, not a rectangle)
    const ts = new THREE.Shape();
    ts.moveTo(-s * 0.045, 0); ts.quadraticCurveTo(-s * 0.1, s * 0.55, -s * 0.1, s);
    ts.lineTo(-s * 0.045, s); ts.quadraticCurveTo(-s * 0.055, s * 0.5, s * 0.045, 0); ts.closePath();
    const trunk = new THREE.Mesh(new THREE.ShapeGeometry(ts), flat(0x33422c)); p.add(trunk);
    // fronds — curved blades arching out of the crown and drooping at the tip
    const crown = { x: -s * 0.075, y: s };
    const frond = (len, lift, droop, dir) => {
      const f = new THREE.Shape();
      f.moveTo(0, 0);
      f.quadraticCurveTo(len * 0.45, lift, len, lift - droop);                    // upper edge out to the tip
      f.quadraticCurveTo(len * 0.5, lift - len * 0.16, 0, -len * 0.1);           // lower edge back, fatter near the crown
      f.closePath();
      const m = new THREE.Mesh(new THREE.ShapeGeometry(f), flat(0x2b3a26));
      m.position.set(crown.x, crown.y, 0.001); m.scale.x = dir; p.add(m);
    };
    frond(s * 0.62, s * 0.3, s * 0.42, 1);     // right: high arch, deep droop
    frond(s * 0.56, s * 0.14, s * 0.4, 1);     // right: lower, droopier
    frond(s * 0.6, s * 0.3, s * 0.42, -1);     // left: mirrored pair
    frond(s * 0.52, s * 0.12, s * 0.38, -1);
    frond(s * 0.34, s * 0.42, s * 0.24, 1);    // short top tuft either side
    frond(s * 0.3, s * 0.4, s * 0.2, -1);
    // coconuts at the crown
    for (const [cx, cy] of [[-0.02, -0.02], [0.045, 0.005], [-0.085, 0.01]]) {
      const nut = new THREE.Mesh(new THREE.CircleGeometry(s * 0.045, 10), flat(0x4a3a22));
      nut.position.set(crown.x + cx * s, crown.y + cy * s, 0.002); p.add(nut);
    }
  };
  palm(-7.6, 2.7, false);   // left window
  palm(7.3, 2.4, true);     // right window
  return {
    group: v,
    update(dt, t, day = 0) {
      for (let i = 0; i < waves.length; i++) waves[i].position.x = Math.sin(t * (0.22 + i * 0.09) + i * 2.1) * 0.5;   // bands slide at offset rates
      for (let i = 0; i < palms.length; i++) palms[i].rotation.z = Math.sin(t * 0.5 + i * 1.7) * 0.02;                 // breeze in the fronds
      v.position.y = BASE_Y + Math.sin(t * 0.42) * 0.06;          // the world bobs against the frames...
      v.rotation.z = Math.sin(t * 0.27 + 1) * 0.007;              // ...and rolls a touch — we're afloat
      // the sun sets as the day runs out: noon for the first third, then it slides
      // down and half-sinks behind the water while the whole view grades warm
      let k = Math.min(1, Math.max(0, (day - 0.3) / 0.65));
      k = k * k * (3 - 2 * k);                                    // smoothstep
      for (const [m, a, b] of grade) m.color.copy(a).lerp(b, k);
      sun.position.y = SUN_TOP + (SUN_SET - SUN_TOP) * k;
      sun.scale.setScalar(1 + 0.4 * k);                           // the low sun looms bigger
    },
  };
}

export function buildKitchen(scene) {
  const g = new THREE.Group(); scene.add(g);
  const steamers = [];

  // floor + planks (roomier now that 2.5D lifts the size limit)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(19, 0.4, 12), mat(FLOOR, { rough: 0.85 }));
  floor.position.set(0, -0.2, 0.5); floor.receiveShadow = true; g.add(floor);
  for (let i = -9; i <= 9; i++) g.add(put(box(0.04, 0.01, 12, mat(0x5f3f22, { rough: 1 })), i * 1.05, 0.011, 0.5));

  // walls — the back wall has three real openings cut into it (bottom strip, top
  // strip, and piers between the windows) so all windows see one shared outside
  const wallMat = mat(WALL, { rough: 0.95 });
  g.add(put(box(19, 2.25, 0.4, wallMat), 0, 0.725, -4.2));    // below the sills
  g.add(put(box(19, 0.95, 0.4, wallMat), 0, 5.125, -4.2));    // above the windows
  g.add(put(box(1.4, 2.8, 0.4, wallMat), -8.8, 3.25, -4.2));  // piers between openings
  g.add(put(box(1.8, 2.8, 0.4, wallMat), -3.0, 3.25, -4.2));
  g.add(put(box(1.8, 2.8, 0.4, wallMat), 3.0, 3.25, -4.2));
  g.add(put(box(1.4, 2.8, 0.4, wallMat), 8.8, 3.25, -4.2));
  g.add(put(box(0.4, 6, 12, wallMat), -9.4, 2.6, 0.5));
  g.add(put(box(0.4, 6, 12, wallMat), 9.4, 2.6, 0.5));
  g.add(put(box(19, 1.0, 0.5, mat(TEAL, { rough: 0.7 })), 0, 0.3, -4.15));
  g.add(put(box(19, 0.12, 0.55, mat(BRASS, { metal: 0.6, rough: 0.4 })), 0, 0.85, -4.13));

  // the shared tropical panorama behind the wall, seen through every opening
  const locale = localePanorama(); g.add(locale.group);

  // window frames over the openings
  const addWindow = (x, w, h) => {
    const win = new THREE.Group(); win.position.set(x, 3.25, -4.0); g.add(win);
    win.add(put(box(w + 0.3, 0.18, 0.24, mat(WOOD)), 0, h / 2, 0.08));            // top rail
    win.add(put(box(w + 0.3, 0.18, 0.24, mat(WOOD)), 0, -h / 2, 0.08));           // sill
    win.add(put(box(0.13, h, 0.24, mat(WOOD)), 0, 0, 0.08));                      // center mullion
    win.add(put(box(0.16, h, 0.24, mat(WOOD)), -w / 2, 0, 0.08));                 // side frames
    win.add(put(box(0.16, h, 0.24, mat(WOOD)), w / 2, 0, 0.08));
  };
  addWindow(-6, 4.2, 2.8); addWindow(0, 4.2, 2.8); addWindow(6, 4.2, 2.8);

  // back counter running behind the stations
  const counter = put(box(18, 1.2, 0.7, mat(WOOD, { rough: 0.8 })), 0, 0.6, -3.5);
  counter.castShadow = true; counter.receiveShadow = true; g.add(counter);
  g.add(put(box(18.2, 0.12, 0.85, mat(CREAM, { rough: 0.5 })), 0, 1.25, -3.5));

  // ---- stations at the sim's positions ----
  const stations = {};
  for (const s of STATIONS) {
    const p = rpos(s.x, s.y);
    stations[s.id] = buildStation(g, p.x, p.z, s, steamers);
  }

  // ---- tables (static; customers are added dynamically) ----
  const tables = {};
  for (const t of TABLES) {
    const p = rpos(t.x, t.y);
    tables[t.id] = { x: p.x, z: p.z };
    diningTable(g, p.x, p.z);
  }

  // ---- warm hanging lamps ----
  const lamps = [];
  [-5.5, -1.8, 1.8, 5.5].forEach((x) => {
    const lg = new THREE.Group(); lg.position.set(x, 4.3, 0.4); g.add(lg);
    lg.add(put(box(0.05, 1.3, 0.05, mat(0x2a2a2a)), 0, 0.65, 0));
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.46, 16, 1, true), mat(BRASS, { metal: 0.5, rough: 0.5, emissive: 0x3a2a10, emi: 0.4 }));
    shade.rotation.x = Math.PI; lg.add(shade);
    lg.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), mat(0xfff0c8, { emissive: 0xffcf8a, emi: 2.4 })), 0, -0.1, 0));
    const pl = new THREE.PointLight(0xffd9a0, 14, 9, 2); pl.position.y = -0.1; lg.add(pl); lamps.push(lg);
  });

  // ---- lighting: bright warm + soft shadows ----
  // Dramatic diner light (matches the boss arena's character): a LOWER ambient so the
  // strong warm KEY does the modelling instead of a flat wash, plus a cold RIM from
  // behind for silhouette separation. Warm key + cool rim is what makes figures pop.
  scene.add(new THREE.HemisphereLight(0xffe9cf, 0x3a2c1e, 0.5));
  const key = new THREE.DirectionalLight(0xfff0d0, 2.1);
  key.position.set(5, 11, 6); key.castShadow = true;
  key.shadow.mapSize.set(RIM_LIGHT ? 2048 : 1024, RIM_LIGHT ? 2048 : 1024);
  key.shadow.camera.near = 1; key.shadow.camera.far = 40;
  const S = 11; key.shadow.camera.left = -S; key.shadow.camera.right = S; key.shadow.camera.top = S; key.shadow.camera.bottom = -S;
  key.shadow.bias = -0.0008; key.shadow.normalBias = 0.02; scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xffe0b0, 0.32); fill.position.set(-4, 5, 9); scene.add(fill);   // gentle warm fill from camera side
  if (RIM_LIGHT) { const rim = new THREE.DirectionalLight(0x6d84ff, 0.95); rim.position.set(-6, 7, -9); scene.add(rim); }   // cold back rim → edge separation

  return {
    stations, tables,
    update(dt, t, day) {
      for (const s of steamers) s.update(dt, t);
      for (let i = 0; i < lamps.length; i++) lamps[i].rotation.z = Math.sin(t * 0.7 + i) * 0.02;
      for (const id in stations) stations[id].tickAnim(dt, t);
      locale.update(dt, t, day);
    },
  };
}

// A station with a per-kind body + a floating progress/ready indicator + a
// near-highlight. Returns setters the render loop drives from the sim state.
function buildStation(g, x, z, def, steamers) {
  const s = new THREE.Group(); s.position.set(x, 0, z); g.add(s);
  const body = put(box(1.5, 1.3, 0.9, mat(STEEL, { metal: 0.3, rough: 0.55 })), 0, 0.65, 0);
  body.castShadow = true; body.receiveShadow = true; s.add(body);
  s.add(put(box(1.6, 0.1, 1.0, mat(0xb0b6bc, { metal: 0.5, rough: 0.4 })), 0, 1.35, 0));

  let steam = null, glow = null;
  const label = new THREE.Group(); label.position.set(0, 1.9, 0); s.add(label);

  if (def.kind === 'timing') {
    if (def.id === 'pot') { s.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.42, 18), mat(0x30343a, { metal: 0.6, rough: 0.4 })), 0, 1.55, 0)); }
    else { s.add(put(box(1.1, 0.24, 0.6, mat(0xcaa23a, { metal: 0.4, rough: 0.4, emissive: 0x3a2a08, emi: 0.35 })), 0, 1.42, 0)); }
    glow = new THREE.PointLight(0xff7a30, 0, 2.4, 2); glow.position.set(0, 1.4, 0); s.add(glow);
    steam = makeSteam(s, 0, 1.9, 0); steam.setRate(0); steamers.push(steam);
  } else if (def.kind === 'source') {
    body.material = mat(0x9fbfd0, { metal: 0.2, rough: 0.4 }); // icy box
    s.add(put(box(1.5, 0.5, 0.9, mat(0xbfe0ef, { rough: 0.3, emissive: 0x143244, emi: 0.3 })), 0, 1.0, 0.02));
  } else if (def.kind === 'prep') {
    s.add(put(box(1.1, 0.08, 0.6, mat(0xc9a06a, { rough: 0.6 })), 0, 1.42, 0));            // cutting board
    s.add(put(box(0.3, 0.14, 0.3, mat(0x6a9a4a, { rough: 0.7 })), -0.22, 1.5, 0.04));      // veg
    s.add(put(box(0.05, 0.03, 0.34, mat(0xd8dde2, { metal: 0.6, rough: 0.3 })), 0.24, 1.5, -0.02)); // knife blade
    s.add(put(box(0.06, 0.07, 0.16, mat(0x3a2a1a)), 0.24, 1.5, 0.2));                       // knife handle
  } else if (def.id === 'salad') {
    s.add(put(box(1.4, 0.08, 0.7, mat(CREAM, { rough: 0.5 })), 0, 1.4, 0));
    s.add(put(box(0.36, 0.1, 0.28, mat(0x6a9a4a, { rough: 0.7 })), -0.3, 1.48, 0.06));
    s.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(0xc23a2a, { rough: 0.7 })), 0.3, 1.5, 0));
  } else if (def.id === 'bar') {
    for (let i = 0; i < 4; i++) s.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.42, 10), mat([0x2f6e66, 0xb8912f, 0x8a2f3f, 0x3a5f8a][i], { metal: 0.3, rough: 0.4 })), -0.45 + i * 0.3, 1.6, 0));
  }

  // floating indicator: a bar that fills while cooking (green window = green,
  // overcooked = red), or a "ready" dish once plated.
  const barBg = put(box(0.94, 0.12, 0.04, mat(0x1a1a1a, { rough: 0.9 })), 0, 0, 0); barBg.visible = false; label.add(barBg);
  const bar = put(box(0.9, 0.09, 0.06, mat(0x8be27a, { emissive: 0x2a5a20, emi: 0.5 })), 0, 0, 0.01); bar.visible = false; label.add(bar);
  const ready = put(new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), mat(0xffcf6a, { emissive: 0xffcf6a, emi: 0.6 })), 0, 0.05, 0); ready.visible = false; label.add(ready);
  const ring = put(new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 22), mat(0xffe6a0, { emissive: 0xffd98a, emi: 0.8 })), 0, -1.85, 0); ring.rotation.x = -Math.PI / 2; ring.visible = false; s.add(ring);

  let nearT = 0, glowT = 0;
  return {
    group: s,
    // cooking: bool, frac: 0..1 within cook window, phase: 'raw'|'perfect'|'burnt'
    setCook(cooking, frac, phase) {
      if (steam) steam.setRate(cooking ? 1 : 0);
      glowT = cooking ? 1 : 0;
      barBg.visible = cooking; bar.visible = cooking;
      if (cooking) {
        bar.scale.x = clamp01(frac); bar.position.x = -0.45 * (1 - clamp01(frac));
        const col = phase === 'perfect' ? 0x8be27a : phase === 'burnt' ? 0xd8452a : 0xffd06a;
        bar.material.color.setHex(col); bar.material.emissive.setHex(phase === 'perfect' ? 0x2a5a20 : 0x3a1a0a);
      }
    },
    setPlated(on) { ready.visible = on; },
    setNear(on) { nearT = on ? 1 : 0; },
    tickAnim(dt, t) {
      if (glow) glow.intensity = lerp(glow.intensity, glowT * 2.2, 1 - Math.exp(-8 * dt));
      ring.visible = nearT > 0.02;
      ring.material.opacity = nearT; ring.material.transparent = true;
      ring.scale.setScalar(1 + Math.sin(t * 4) * 0.03);
      if (ready.visible) ready.position.y = 0.05 + Math.sin(t * 3) * 0.03;
    },
  };
}

function diningTable(g, x, z) {
  const t = new THREE.Group(); t.position.set(x, 0, z); g.add(t);
  t.add(put(box(0.16, 0.85, 0.16, mat(0x3a2a1a)), 0, 0.42, 0));
  const top = put(new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.1, 20), mat(WOOD, { rough: 0.6 })), 0, 0.88, 0);
  top.castShadow = true; top.receiveShadow = true; t.add(top);
  t.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 8), mat(CREAM)), 0, 0.98, 0));
  t.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(0xffb040, { emissive: 0xffa030, emi: 1.3 })), 0, 1.08, 0));
  // two chairs
  t.add(put(box(0.46, 0.5, 0.46, mat(0x4a3a2a, { rough: 0.8 })), 0, 0.25, 0.92));
  t.add(put(box(0.46, 0.5, 0.46, mat(0x4a3a2a, { rough: 0.8 })), 0, 0.25, -0.92));
}

function makeSteam(parent, x, y, z) {
  const N = 12; const pos = new Float32Array(N * 3); const seeds = [];
  for (let i = 0; i < N; i++) { pos[i * 3] = x; pos[i * 3 + 1] = y + i * 0.05; pos[i * 3 + 2] = z; seeds.push(Math.random()); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, transparent: true, opacity: 0, depthWrite: false });
  const pts = new THREE.Points(geo, m); parent.add(pts);
  let rate = 0;
  return {
    setRate(r) { rate = r; },
    update(dt, t) {
      m.opacity = lerp(m.opacity, rate * 0.3, 1 - Math.exp(-4 * dt));
      const a = geo.attributes.position.array;
      for (let i = 0; i < N; i++) { a[i * 3 + 1] += dt * 0.5; a[i * 3] = x + Math.sin(t * 1.6 + seeds[i] * 6) * 0.1 * (a[i * 3 + 1] - y); if (a[i * 3 + 1] > y + 1.2) a[i * 3 + 1] = y; }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
