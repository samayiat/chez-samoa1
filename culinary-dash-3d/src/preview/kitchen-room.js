// The 2.5D diner, built at the service sim's real layout (stations along the back
// counter, tables in front — positions from sim/data.js via rpos), so what the
// player sees sits exactly where the sim's logic is. Warm, bright, fixed-camera:
// the cozy counter-note to the boss fight, same 3D world.
import * as THREE from 'three';
import { mat, box, put, lerp, clamp01 } from './util.js';
import { RIM_LIGHT } from '../engine/quality.js';
import { STATIONS, TABLES } from '../sim/data.js';
import { rpos } from './kitchen-space.js';
import { carriedModel } from './food.js';

const FLOOR = 0x8a5a34, WALL = 0xcaa47a, WOOD = 0x6e4526, CREAM = 0xe7d8b8;
const TEAL = 0x2f6e66, BRASS = 0xb8912f, STEEL = 0x8a9098;

// The locale outside the windows — a real miniature WORLD, not a painted card.
// A 360° cyclorama of concentric open cylinders (sky / horizon haze / distant
// sea) surrounds the diner at ~24 units, a genuine ocean plane spreads under and
// around the floating room carrying the drifting wave strips, the sun is a
// billboard hung BETWEEN the sky and sea cylinders (so sinking below the horizon
// genuinely occludes it), and the palms are crossed cards standing outside the
// windows. Because it is surrounding geometry, any camera angle or aspect —
// portrait, closeups, orbits — sees a coherent outside instead of a card's edge.
// The horizon sits low (y ~ -3.4) because the diorama camera is high and looks
// DOWN through the windows; these heights put sky/horizon/sea exactly where the
// window sight-lines land. Flat colours, fog off (it is "beyond" the room haze).
function localeWorld() {
  const v = new THREE.Group();
  const flat = (col, side) => new THREE.MeshBasicMaterial({ color: col, side, fog: false });
  // The backdrop is a straight theater flat behind the wall — stacked horizontal
  // bands on one huge vertical plane, so the horizon is a straight line (matching
  // the 2D game's envOcean), not a curved rim. Wide enough for any turned camera.
  const wallQuad = (w2, y0, y1, col, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w2, y1 - y0), flat(col));
    m.position.set(0, (y0 + y1) / 2, z); v.add(m); return m;
  };
  const sky = wallQuad(90, -4.9, 14, 0x8fc9e8, -26);                  // sky, up past any aspect's view
  const haze = wallQuad(90, -6.1, -4.9, 0xbfe3ea, -25.9);             // pale band at the horizon hand-off
  const sea = wallQuad(90, -14, -6.1, 0x35839b, -25.9);               // distant sea below the horizon line
  // the sun — a billboard in front of the flat; sinking below the far-sea shelf's
  // level hides it behind that shelf (the camera looks down over it)
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xfff2cf, fog: false }));
  sun.position.set(4, -4.2, -25.5); sun.scale.setScalar(2.4); v.add(sun);
  // island — a real mound ON the water (left window's view)
  const isl = new THREE.Mesh(new THREE.SphereGeometry(3, 18, 10), flat(0x86ad8c));
  isl.position.set(-7, -0.5, -9.5); isl.scale.set(1, 0.35, 0.6); v.add(isl);
  // the REAL ocean the diner floats on — a wide rectangle whose far edge is a
  // straight line parallel to the wall (this WAS the curved rim)
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(90, 27), flat(0x3f97ad));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(0, -0.45, -1.5); v.add(ocean);   // z -15 .. +12 (under the room too)
  // far sea shelf — a lower rectangle from the ocean's far edge out to the flat,
  // so looking down over the horizon shows deep water, never a void
  const seaFar = new THREE.Mesh(new THREE.PlaneGeometry(90, 11), flat(0x35839b));
  seaFar.rotation.x = -Math.PI / 2; seaFar.position.set(0, -5.62, -20.5); v.add(seaFar);
  // waves — DASHED strips lying on the water (per the 2D game: dashes are what
  // make the sideways drift VISIBLE; a solid line sliding shows nothing)
  const waves = [];
  [[-7, 0x2f7088], [-9.5, 0x5fb0c4], [-12, 0x2f7088]].forEach(([z, col], row) => {
    const g2 = new THREE.Group(); g2.position.set(0, -0.42, z); v.add(g2);
    const m = new THREE.MeshBasicMaterial({ color: col, fog: false });
    for (let x = -16; x <= 16; x += 2.6) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.22 + row * 0.06), m);
      dash.rotation.x = -Math.PI / 2; dash.position.x = x + (row % 2) * 1.3; g2.add(dash);
    }
    waves.push({ group: g2, material: m, row });
  });
  // sun glint running along the water toward the sun's azimuth
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 8.5), flat(0xcdeef0));
  glint.rotation.x = -Math.PI / 2; glint.rotation.z = -0.17; glint.position.set(2.2, -0.41, -9.5); v.add(glint);
  // a little sailboat drifting across the view (the 2D game has one too)
  const boat = new THREE.Group(); boat.position.set(0, -0.45, -11); v.add(boat);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.4), flat(0x1a2430));
  hull.position.y = 0.1; boat.add(hull);
  const sailShape = new THREE.Shape();
  sailShape.moveTo(0, 0); sailShape.lineTo(0, 1.3); sailShape.lineTo(0.8, 0.15); sailShape.closePath();
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), flat(0xf0ead8, THREE.DoubleSide));
  sail.position.set(-0.05, 0.24, 0); boat.add(sail);
  // sunset grade — each material lerps noon -> pinkish-orange dusk
  const C = (h) => new THREE.Color(h);
  const grade = [
    [sky.material, C(0x8fc9e8), C(0xef8a70)],
    [haze.material, C(0xbfe3ea), C(0xffb39c)],
    [sea.material, C(0x35839b), C(0x35597e)],
    [seaFar.material, C(0x35839b), C(0x35597e)],
    [sun.material, C(0xfff2cf), C(0xff9260)],
    [ocean.material, C(0x3f97ad), C(0x3d5f88)],
    [glint.material, C(0xcdeef0), C(0xffbfa4)],
    [isl.material, C(0x86ad8c), C(0x5e7a66)],
    [waves[0].material, C(0x2f7088), C(0x27556e)],
    [waves[1].material, C(0x5fb0c4), C(0x3f7a94)],
    [waves[2].material, C(0x2f7088), C(0x27556e)],
  ];
  const SUN_TOP = -4.2, SUN_SET = -7.6;                               // sinks behind the sea shell by close
  // palms standing outside the windows — TWO crossed cards each, so they hold up
  // when the camera looks from the side instead of vanishing edge-on
  const palms = [];
  const palmCard = (s) => {
    const p = new THREE.Group();
    const leafM = flat(0x2b3a26, THREE.DoubleSide), trunkM = flat(0x33422c, THREE.DoubleSide);
    const ts = new THREE.Shape();
    ts.moveTo(-s * 0.045, 0); ts.quadraticCurveTo(-s * 0.1, s * 0.55, -s * 0.1, s);
    ts.lineTo(-s * 0.045, s); ts.quadraticCurveTo(-s * 0.055, s * 0.5, s * 0.045, 0); ts.closePath();
    p.add(new THREE.Mesh(new THREE.ShapeGeometry(ts), trunkM));
    const crown = { x: -s * 0.075, y: s };
    const frond = (len, lift, droop, dir) => {
      const f = new THREE.Shape();
      f.moveTo(0, 0);
      f.quadraticCurveTo(len * 0.45, lift, len, lift - droop);
      f.quadraticCurveTo(len * 0.5, lift - len * 0.16, 0, -len * 0.1);
      f.closePath();
      const m = new THREE.Mesh(new THREE.ShapeGeometry(f), leafM);
      m.position.set(crown.x, crown.y, 0.001); m.scale.x = dir; p.add(m);
    };
    frond(s * 0.62, s * 0.3, s * 0.42, 1); frond(s * 0.56, s * 0.14, s * 0.4, 1);
    frond(s * 0.6, s * 0.3, s * 0.42, -1); frond(s * 0.52, s * 0.12, s * 0.38, -1);
    frond(s * 0.34, s * 0.42, s * 0.24, 1); frond(s * 0.3, s * 0.4, s * 0.2, -1);
    for (const [cx, cy] of [[-0.02, -0.02], [0.045, 0.005], [-0.085, 0.01]]) {
      const nut = new THREE.Mesh(new THREE.CircleGeometry(s * 0.045, 10), flat(0x4a3a22));
      nut.position.set(crown.x + cx * s, crown.y + cy * s, 0.002); p.add(nut);
    }
    return p;
  };
  const palm = (px, pz, s, flip) => {
    const p = new THREE.Group(); p.position.set(px, -0.45, pz); p.scale.x = flip ? -1 : 1; v.add(p); palms.push(p);
    const c1 = palmCard(s); p.add(c1);
    const c2 = palmCard(s); c2.rotation.y = Math.PI / 2; p.add(c2);
  };
  palm(-10.4, -7.8, 3.6, false);   // outside the left window
  palm(10.2, -7.9, 3.3, true);     // outside the right window
  return {
    group: v,
    update(dt, t, day = 0) {
      // dashed strips slide continuously in alternating directions — visible motion
      for (let i = 0; i < waves.length; i++) {
        const dir = i % 2 ? -1 : 1;
        waves[i].group.position.x = ((t * 0.32 * dir + i * 0.9) % 2.6 + 2.6) % 2.6 - 1.3;
      }
      boat.position.x = ((t * 0.28) % 34) - 17;                   // the sailboat crosses, wraps, crosses again
      boat.position.y = -0.45 + Math.sin(t * 1.1) * 0.05;         // riding the swell
      for (let i = 0; i < palms.length; i++) palms[i].rotation.z = Math.sin(t * 0.5 + i * 1.7) * 0.02;   // breeze in the fronds
      v.position.y = Math.sin(t * 0.42) * 0.07;                   // the whole outside world bobs against the frames...
      v.rotation.z = Math.sin(t * 0.27 + 1) * 0.006;              // ...and rolls a touch — we're afloat
      // the sun sets as the day runs out: noon for the first third, then it slides
      // down behind the horizon while the whole world grades pinkish orange
      let k = Math.min(1, Math.max(0, (day - 0.3) / 0.65));
      k = k * k * (3 - 2 * k);                                    // smoothstep
      for (const [m, a, b] of grade) m.color.copy(a).lerp(b, k);
      sun.position.y = SUN_TOP + (SUN_SET - SUN_TOP) * k;
      sun.scale.setScalar(2.4 * (1 + 0.35 * k));                  // the low sun looms bigger
    },
  };
}

// Generative tropical plants — potted foliage grown from a seed, so every pot is
// its own plant. Three growth habits (broad leaves / arching fronds / upright
// spikes), leaf counts, lengths and bends all seeded; greens picked from the same
// family as the locale outside the windows, in terracotta pots.
function pottedPlant(seed, s = 1) {
  let st = (seed >>> 0) || 1;
  const rnd = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
  const p = new THREE.Group();
  const GREENS = [0x3f7a3a, 0x4f8f46, 0x2e6b34, 0x63a04f];
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.23 * s, 0.4 * s, 10), mat(0xa4593a, { flat: true, rough: 0.8 }));
  pot.position.y = 0.2 * s; pot.castShadow = true; p.add(pot);
  p.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.33 * s, 0.31 * s, 0.09 * s, 10), mat(0xb26443, { flat: true, rough: 0.8 })), 0, 0.4 * s, 0));   // rim
  p.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.27 * s, 0.27 * s, 0.05 * s, 10), mat(0x2e2018, { rough: 1 })), 0, 0.42 * s, 0));               // soil
  const fol = new THREE.Group(); fol.position.y = 0.44 * s; p.add(fol);
  const habit = Math.floor(rnd() * 3);          // 0 broad leaves, 1 arching fronds, 2 upright spikes
  const n = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.8;
    const lm = mat(GREENS[Math.floor(rnd() * GREENS.length)], { flat: true, rough: 0.85 });
    lm.side = THREE.DoubleSide;
    const len = s * (habit === 2 ? 0.85 + rnd() * 0.45 : 0.55 + rnd() * 0.4);
    const wid = s * (habit === 0 ? 0.26 + rnd() * 0.12 : habit === 1 ? 0.13 + rnd() * 0.06 : 0.06 + rnd() * 0.04);
    const bend = habit === 1 ? 0.5 + rnd() * 0.35 : habit === 0 ? 0.24 + rnd() * 0.18 : 0.06 + rnd() * 0.1;
    // a curved, tapered blade — same construction as the locale's palm fronds
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.quadraticCurveTo(bend * len * 0.6, len * 0.55, bend * len, len);        // spine out to the tip
    sh.quadraticCurveTo(bend * len * 0.55 + wid, len * 0.5, wid * 0.7, 0);     // back edge, widest near the base
    sh.closePath();
    const leaf = new THREE.Mesh(new THREE.ShapeGeometry(sh), lm);
    leaf.castShadow = true; leaf.rotation.y = a;                               // fan around the pot
    fol.add(leaf);
  }
  return { group: p, fol };
}

// A potted indoor tree — the tall sibling of pottedPlant: a big pot, a leaning
// segmented trunk, and a crown of long arching fronds. Same seeded variation.
function pottedTree(seed, s = 1) {
  let st = (seed >>> 0) || 1;
  const rnd = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
  const p = new THREE.Group();
  const GREENS = [0x3f7a3a, 0x4f8f46, 0x2e6b34, 0x63a04f];
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.38 * s, 0.3 * s, 0.5 * s, 10), mat(0xa4593a, { flat: true, rough: 0.8 }));
  pot.position.y = 0.25 * s; pot.castShadow = true; p.add(pot);
  p.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.41 * s, 0.39 * s, 0.1 * s, 10), mat(0xb26443, { flat: true, rough: 0.8 })), 0, 0.5 * s, 0));
  p.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.34 * s, 0.34 * s, 0.06 * s, 10), mat(0x2e2018, { rough: 1 })), 0, 0.53 * s, 0));
  // leaning, segmented trunk — each segment tips a little further over
  const trunkMat = mat(0x7a5a38, { flat: true, rough: 0.85 });
  const lean = (rnd() - 0.5) * 0.3;
  const segs = 3 + Math.floor(rnd() * 2), segH = 0.5 * s;
  let parent = p, py = 0.5 * s;
  for (let i = 0; i < segs; i++) {
    const seg = new THREE.Group(); seg.position.y = py; seg.rotation.z = lean * (0.5 + rnd() * 0.9); parent.add(seg);
    const r0 = (0.1 - i * 0.015) * s, r1 = (0.085 - i * 0.015) * s;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, segH, 8), trunkMat);
    trunk.position.y = segH / 2; trunk.castShadow = true; seg.add(trunk);
    parent = seg; py = segH;
  }
  // crown of long arching fronds at the top of the trunk
  const fol = new THREE.Group(); fol.position.y = segH; parent.add(fol);
  const n = 7 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.6;
    const lm = mat(GREENS[Math.floor(rnd() * GREENS.length)], { flat: true, rough: 0.85 });
    lm.side = THREE.DoubleSide;
    const len = s * (0.85 + rnd() * 0.5), wid = s * (0.15 + rnd() * 0.06), bend = 0.7 + rnd() * 0.35;
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.quadraticCurveTo(bend * len * 0.6, len * 0.55, bend * len, len * (1 - bend * 0.45));   // arcs hard outward
    sh.quadraticCurveTo(bend * len * 0.55 + wid, len * 0.45, wid * 0.7, 0);
    sh.closePath();
    const leaf = new THREE.Mesh(new THREE.ShapeGeometry(sh), lm);
    leaf.castShadow = true; leaf.rotation.y = a;
    fol.add(leaf);
  }
  return { group: p, fol };
}

export function buildKitchen(scene) {
  const g = new THREE.Group(); scene.add(g);
  const steamers = [];

  // floor + planks (roomier now that 2.5D lifts the size limit)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(28, 0.4, 17), mat(FLOOR, { rough: 0.85 }));
  floor.position.set(0, -0.2, 0.6); floor.receiveShadow = true; g.add(floor);
  for (let i = -13; i <= 13; i++) g.add(put(box(0.04, 0.01, 17, mat(0x5f3f22, { rough: 1 })), i * 1.05, 0.011, 0.6));

  // walls — the back wall has three real openings cut into it (bottom strip, top
  // strip, and piers between the windows) so all windows see one shared outside
  const wallMat = mat(WALL, { rough: 0.95 });
  g.add(put(box(28, 2.25, 0.4, wallMat), 0, 0.725, -6.4));    // below the sills
  g.add(put(box(28, 0.95, 0.4, wallMat), 0, 5.125, -6.4));    // above the windows
  g.add(put(box(2.3, 2.8, 0.4, wallMat), -12.85, 3.25, -6.4)); // piers between openings
  g.add(put(box(2.1, 2.8, 0.4, wallMat), -4.25, 3.25, -6.4));
  g.add(put(box(2.1, 2.8, 0.4, wallMat), 4.25, 3.25, -6.4));
  g.add(put(box(2.3, 2.8, 0.4, wallMat), 12.85, 3.25, -6.4));
  g.add(put(box(0.4, 6, 17, wallMat), -13.8, 2.6, 0.6));
  g.add(put(box(0.4, 6, 17, wallMat), 13.8, 2.6, 0.6));
  g.add(put(box(28, 1.0, 0.5, mat(TEAL, { rough: 0.7 })), 0, 0.3, -6.35));
  g.add(put(box(28, 0.12, 0.55, mat(BRASS, { metal: 0.6, rough: 0.4 })), 0, 0.85, -6.33));

  // the shared tropical panorama behind the wall, seen through every opening
  const locale = localeWorld(); g.add(locale.group);

  // window frames over the openings
  const addWindow = (x, w, h) => {
    const win = new THREE.Group(); win.position.set(x, 3.25, -6.2); g.add(win);
    win.add(put(box(w + 0.3, 0.18, 0.24, mat(WOOD)), 0, h / 2, 0.08));            // top rail
    win.add(put(box(w + 0.3, 0.18, 0.24, mat(WOOD)), 0, -h / 2, 0.08));           // sill
    win.add(put(box(0.13, h, 0.24, mat(WOOD)), 0, 0, 0.08));                      // center mullion
    win.add(put(box(0.16, h, 0.24, mat(WOOD)), -w / 2, 0, 0.08));                 // side frames
    win.add(put(box(0.16, h, 0.24, mat(WOOD)), w / 2, 0, 0.08));
  };
  addWindow(-8.5, 6.4, 2.8); addWindow(0, 6.4, 2.8); addWindow(8.5, 6.4, 2.8);

  // the entry door on the right wall — where customers come in
  {
    const door = new THREE.Group(); door.position.set(13.58, 0, 3.2); door.rotation.y = -Math.PI / 2; g.add(door);
    door.add(put(box(1.7, 3.1, 0.22, mat(WOOD, { rough: 0.75 })), 0, 1.55, 0));                  // frame
    door.add(put(box(1.36, 2.8, 0.14, mat(TEAL, { rough: 0.6 })), 0, 1.4, 0.08));                // door panel
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 18), mat(BRASS, { metal: 0.6, rough: 0.4 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(0, 1.9, 0.12); door.add(ring);              // brass rim
    const port = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 18), mat(0xbfe0ef, { rough: 0.3, emissive: 0x2a4a5a, emi: 0.4 }));
    port.rotation.x = Math.PI / 2; port.position.set(0, 1.9, 0.13); door.add(port);              // porthole window
    door.add(put(box(0.08, 0.3, 0.08, mat(BRASS, { metal: 0.6, rough: 0.4 })), -0.52, 1.35, 0.16)); // handle
    door.add(put(box(1.9, 0.12, 0.7, mat(0x6a4526, { rough: 0.8 })), 0, 0.03, 0.2));             // threshold mat
  }

  // back counter running behind the stations
  const counter = put(box(26, 1.2, 0.7, mat(WOOD, { rough: 0.8 })), 0, 0.6, -5.6);
  counter.castShadow = true; counter.receiveShadow = true; g.add(counter);
  g.add(put(box(26.2, 0.12, 0.85, mat(CREAM, { rough: 0.5 })), 0, 1.25, -5.6));

  // generative plants echoing the locale — big pots in the front corners, medium
  // ones by the counter ends, small ones up on the countertop
  const plants = [];
  const plantAt = (x, y, z, seed, s) => { const pl = pottedPlant(seed, s); pl.group.position.set(x, y, z); g.add(pl.group); plants.push(pl); };
  plantAt(-12.9, 0, 3.6, 11, 1.3);   // (right side keeps the doorway clear)
  plantAt(-12.9, 0, -3.8, 39, 0.9); plantAt(12.9, 0, -3.8, 53, 0.95);
  plantAt(-12.4, 1.3, -5.6, 68, 0.45); plantAt(12.4, 1.3, -5.6, 81, 0.5);
  // and proper indoor trees along the side walls
  const treeAt = (x, z, seed, s) => { const tr = pottedTree(seed, s); tr.group.position.set(x, 0, z); g.add(tr.group); plants.push(tr); };
  treeAt(-12.9, 0.2, 101, 1.15); treeAt(12.9, 0.6, 117, 1.05);
  treeAt(-12.8, 6.2, 133, 1.25); treeAt(12.8, 6.4, 149, 1.2);

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
  [-9, -3, 3, 9].forEach((x) => {
    const lg = new THREE.Group(); lg.position.set(x, 4.3, 0.8); g.add(lg);
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
  const S = 16; key.shadow.camera.left = -S; key.shadow.camera.right = S; key.shadow.camera.top = S; key.shadow.camera.bottom = -S;
  key.shadow.bias = -0.0008; key.shadow.normalBias = 0.02; scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xffe0b0, 0.32); fill.position.set(-4, 5, 9); scene.add(fill);   // gentle warm fill from camera side
  if (RIM_LIGHT) { const rim = new THREE.DirectionalLight(0x6d84ff, 0.95); rim.position.set(-6, 7, -9); scene.add(rim); }   // cold back rim → edge separation

  return {
    stations, tables,
    update(dt, t, day) {
      for (const s of steamers) s.update(dt, t);
      for (let i = 0; i < lamps.length; i++) lamps[i].rotation.z = Math.sin(t * 0.7 + i) * 0.02;
      for (const id in stations) stations[id].tickAnim(dt, t);
      for (let i = 0; i < plants.length; i++) plants[i].fol.rotation.z = Math.sin(t * 0.6 + i * 2.4) * 0.03;   // a light breeze in the leaves
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

  // a wooden produce crate with contents — shared by the fryer (chicken) and
  // the cutting board (vegetables)
  const crate = (fill) => {
    const cr = new THREE.Group();
    cr.add(put(box(0.72, 0.36, 0.55, mat(0x8a6234, { rough: 0.85 })), 0, 0.55, 0));
    cr.add(put(box(0.76, 0.06, 0.59, mat(0x6a4526, { rough: 0.85 })), 0, 0.72, 0));      // rim
    cr.add(put(box(0.76, 0.06, 0.59, mat(0x6a4526, { rough: 0.85 })), 0, 0.42, 0));
    fill(cr);
    return cr;
  };

  if (def.kind === 'timing') {
    if (def.id === 'pot') {
      // THE STOVE — black cooktop, two burner grates, knobs, and a big stock pot
      s.add(put(box(1.5, 0.1, 0.92, mat(0x22262c, { metal: 0.4, rough: 0.5 })), 0, 1.4, 0));                 // cooktop
      for (const bx of [-0.38, 0.38]) {
        s.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 16), mat(0x111418, { rough: 0.7 })), bx, 1.46, 0.05));  // burner
        const grate = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 6, 14), mat(0x3a4048, { metal: 0.5, rough: 0.5 }));
        grate.rotation.x = Math.PI / 2; grate.position.set(bx, 1.49, 0.05); s.add(grate);
      }
      for (let k = 0; k < 4; k++) { const kn = put(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.07, 8), mat(0xd8dde2, { metal: 0.6, rough: 0.35 })), -0.45 + k * 0.3, 1.02, 0.48); kn.rotation.x = Math.PI / 2; s.add(kn); }   // knobs
      const pot = new THREE.Group(); pot.position.set(-0.38, 1.5, 0.05); s.add(pot);
      pot.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.36, 18), mat(0x8a9098, { metal: 0.65, rough: 0.35 })), 0, 0.18, 0));  // stock pot
      const rim = put(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 6, 18), mat(0x6a7078, { metal: 0.6, rough: 0.4 })), 0, 0.37, 0); rim.rotation.x = Math.PI / 2; pot.add(rim);
      for (const hx of [-1, 1]) pot.add(put(box(0.06, 0.05, 0.14, mat(0x30343a, { metal: 0.5 })), hx * 0.33, 0.28, 0));               // handles
      pot.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 18), mat(0x2a6a86, { rough: 0.4, emissive: 0x0a2a3a, emi: 0.4 })), 0, 0.365, 0));  // water
    } else {
      // THE FRYER — stainless vat of golden oil with two wire baskets, and the
      // chicken crate sitting right beside it
      s.add(put(box(1.3, 0.16, 0.7, mat(0xb0b6bc, { metal: 0.55, rough: 0.35 })), 0, 1.42, 0));               // vat rim
      s.add(put(box(1.1, 0.1, 0.52, mat(0xcaa23a, { metal: 0.3, rough: 0.4, emissive: 0x3a2a08, emi: 0.4 })), 0, 1.46, 0));  // oil
      for (const bx of [-0.28, 0.28]) {
        const basket = new THREE.Group(); basket.position.set(bx, 1.5, 0); s.add(basket);
        basket.add(put(box(0.34, 0.14, 0.34, mat(0x3a4048, { metal: 0.5, rough: 0.6 })), 0, 0, 0));           // basket
        const hd = put(box(0.05, 0.05, 0.34, mat(0x1a1a20, { rough: 0.6 })), 0, 0.08, 0.3); hd.rotation.x = 0.5; basket.add(hd);  // handle
      }
      const chix = crate((cr) => {
        for (let i = 0; i < 4; i++) cr.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat(0xe8b49a, { rough: 0.75 })), -0.2 + (i % 2) * 0.36 + (i > 1 ? 0.06 : -0.03), 0.76, i > 1 ? 0.12 : -0.1));
      });
      chix.position.set(-1.15, 0, 0.15); s.add(chix);                                                          // chicken by the fryer
    }
    glow = new THREE.PointLight(0xff7a30, 0, 2.4, 2); glow.position.set(0, 1.4, 0); s.add(glow);
    steam = makeSteam(s, 0, 1.9, 0); steam.setRate(0); steamers.push(steam);
  } else if (def.kind === 'source') {
    body.material = mat(0x9fbfd0, { metal: 0.2, rough: 0.4 }); // icy box
    s.add(put(box(1.5, 0.5, 0.9, mat(0xbfe0ef, { rough: 0.3, emissive: 0x143244, emi: 0.3 })), 0, 1.0, 0.02));
  } else if (def.kind === 'prep') {
    // cutting board with the knife, and the VEGETABLES right next to it — some
    // spread on the counter, the rest in a crate beside the station
    s.add(put(box(1.1, 0.08, 0.6, mat(0xc9a06a, { rough: 0.6 })), -0.15, 1.42, 0));                            // cutting board
    s.add(put(box(0.28, 0.13, 0.28, mat(0x6a9a4a, { rough: 0.7 })), -0.35, 1.5, 0.04));                        // lettuce on the board
    s.add(put(box(0.05, 0.03, 0.34, mat(0xd8dde2, { metal: 0.6, rough: 0.3 })), 0.1, 1.5, -0.02));             // knife blade
    s.add(put(box(0.06, 0.07, 0.16, mat(0x3a2a1a)), 0.1, 1.5, 0.2));                                           // knife handle
    s.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(0xc23a2a, { rough: 0.7 })), 0.55, 1.48, 0.1));   // tomatoes on the counter
    s.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat(0xc23a2a, { rough: 0.7 })), 0.62, 1.46, -0.14));
    const veg = crate((cr) => {
      cr.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), mat(0x6a9a4a, { rough: 0.75 })), -0.18, 0.76, -0.05));  // lettuce heads
      cr.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mat(0x5a8a3e, { rough: 0.75 })), 0.12, 0.76, 0.1));
      cr.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(0xc23a2a, { rough: 0.7 })), 0.2, 0.74, -0.12));     // tomato
      const car = put(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26, 7), mat(0xe0862a, { rough: 0.7 })), -0.05, 0.76, 0.16);
      car.rotation.z = 1.35; cr.add(car);                                                                       // carrot
    });
    veg.position.set(1.15, 0, 0.1); s.add(veg);                                                                 // the veg by the board
  } else if (def.id === 'salad') {
    s.add(put(box(1.4, 0.08, 0.7, mat(CREAM, { rough: 0.5 })), 0, 1.4, 0));
    s.add(put(box(0.36, 0.1, 0.28, mat(0x6a9a4a, { rough: 0.7 })), -0.3, 1.48, 0.06));
    s.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(0xc23a2a, { rough: 0.7 })), 0.3, 1.5, 0));
  } else if (def.id === 'bar') {
    // THE BAR — dark polished front, brass foot rail, a lit back-shelf of
    // bottles, glasses, and the cocktail shaker on the counter
    body.material = mat(0x4a2f1c, { rough: 0.55 });
    s.add(put(box(1.7, 0.1, 1.0, mat(0x6e4526, { rough: 0.35, metal: 0.15 })), 0, 1.38, 0));                    // polished top
    s.add(put(box(1.6, 0.06, 0.08, mat(BRASS, { metal: 0.7, rough: 0.35 })), 0, 0.25, 0.5));                    // foot rail
    // back shelf riser with a bottle row, softly backlit
    s.add(put(box(1.6, 0.08, 0.34, mat(0x3a2415, { rough: 0.6 })), 0, 2.0, -0.32));
    for (const px of [-0.72, 0.72]) s.add(put(box(0.07, 0.62, 0.07, mat(0x3a2415, { rough: 0.6 })), px, 1.7, -0.32));
    s.add(put(box(1.5, 0.5, 0.05, mat(0xffdca6, { emissive: 0xcf9a4a, emi: 0.55, rough: 0.8 })), 0, 1.74, -0.44));  // glow panel
    const BOTTLES = [0x2f6e66, 0xb8912f, 0x8a2f3f, 0x3a5f8a, 0x6a8a3a, 0x8a5f2f];
    BOTTLES.forEach((col, i) => {
      const h = 0.34 + (i % 3) * 0.07;
      const b = put(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, h, 10), mat(col, { metal: 0.3, rough: 0.35 })), -0.62 + i * 0.25, 2.04 + h / 2, -0.32);
      s.add(b);
      s.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), mat(col, { metal: 0.3, rough: 0.35 })), -0.62 + i * 0.25, 2.04 + h + 0.04, -0.32));  // neck
    });
    // on the counter: two glasses + the shaker
    for (const gx of [0.45, 0.62]) {
      const gl = put(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.16, 10), mat(0xdfeef2, { rough: 0.1, metal: 0.1, transparent: true, opacity: 0.45 })), gx, 1.51, 0.18);
      s.add(gl);
    }
    const shk = new THREE.Group(); shk.position.set(-0.5, 1.43, 0.2); s.add(shk);
    shk.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.22, 12), mat(0xd8dde2, { metal: 0.75, rough: 0.25 })), 0, 0.11, 0));
    shk.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.1, 12), mat(0xd8dde2, { metal: 0.75, rough: 0.25 })), 0, 0.27, 0));
  } else if (def.kind === 'pass') {
    // the pass — a warm wooden counter with brass heat lamps; dishes wait here
    body.material = mat(WOOD, { rough: 0.7 });
    body.scale.set(1.2, 0.85, 1); body.position.y = 0.55;
    s.add(put(box(1.9, 0.09, 1.0, mat(CREAM, { rough: 0.5 })), 0, 1.18, 0));
    for (const lx of [-0.55, 0.55]) {
      s.add(put(box(0.05, 0.9, 0.05, mat(BRASS, { metal: 0.6, rough: 0.4 })), lx, 1.65, -0.4));
      const sh = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.18, 12, 1, true), mat(BRASS, { metal: 0.5, rough: 0.5, emissive: 0x3a2a10, emi: 0.5 }));
      sh.position.set(lx, 2.06, -0.15); sh.rotation.x = 0.5; s.add(sh);
      s.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 6), mat(0xfff0c8, { emissive: 0xffcf8a, emi: 2 })), lx, 2.0, -0.1));
    }
  }
  // slot anchors on the pass top — setSlots() parks the waiting dish models here
  const slotGroup = new THREE.Group(); slotGroup.position.y = 1.24; s.add(slotGroup);
  let lastSlotsKey = null;

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
    // items waiting on the pass — rebuilt only when the set changes
    setSlots(items) {
      const key = items.map((it) => it.kind + ':' + it.dish).join('|');
      if (key === lastSlotsKey) return;
      lastSlotsKey = key;
      slotGroup.clear();
      items.forEach((it, i) => {
        const m = carriedModel(it); m.scale.setScalar(0.8);
        m.position.x = (i - (items.length - 1) / 2) * 0.62;
        slotGroup.add(m);
      });
    },
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
