// The BRAWL's angry customers — walkouts who stormed back in swinging. One
// standing figure per sim enemy (state.enemies), in the cast's shared form
// vocabulary, tinted by archetype: the red CHASER, the big purple SMASHER, the
// quick orange THIEF. Purely a render layer over sim/combat.js — position,
// facing, hurt flashes and deaths all read from the sim.
import * as THREE from 'three';
import { mat, box, put, clamp01, lerp } from './util.js';
import { rpos } from './kitchen-space.js';
import { TILL, DOOR, STATIONS } from '../sim/data.js';

const BAR = STATIONS.find((s) => s.id === 'bar');

const ARCH = {
  chaser:  { top: 0xc0392b, scale: 1.3 },    // bigger across the board — they
  smasher: { top: 0x8e44ad, scale: 1.55 },   // should crowd the room, not
  thief:   { top: 0xe67e22, scale: 1.1 },    // blend in with the diners
};
const SKINS = [0x7a4328, 0x8a5a3a, 0xb07a4e, 0x633119];

function buildBrawler(kind, seed) {
  const a = ARCH[kind] || ARCH.chaser;
  const skin = SKINS[seed % SKINS.length];
  const g = new THREE.Group();
  const topMat = mat(a.top, { flat: true, rough: 0.7 });
  const skinMat = mat(skin, { rough: 0.7 });
  const trouser = mat(0x2e2e38, { flat: true, rough: 0.85 });
  const cyl = (rt, rb, h, mt, seg = 10) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mt); m.castShadow = true; return m; };
  const ball = (r, mt, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mt); m.scale.set(sx, sy, sz); m.castShadow = true; return m; };

  // standing legs
  for (const sx of [-0.13, 0.13]) {
    g.add(put(cyl(0.095, 0.075, 0.52, trouser), sx, 0.28, 0));
    g.add(put(ball(0.08, mat(0x1a1a20, { flat: true }), 1, 0.7, 1.25), sx, 0.05, 0.05));
  }
  // torso + shoulders + neck
  const torso = cyl(0.24, 0.2, 0.55, topMat, 10); torso.scale.z = 0.72; torso.position.y = 0.82; g.add(torso);
  g.add(put(ball(0.11, topMat, 1, 0.85, 0.9), -0.21, 1.05, 0));
  g.add(put(ball(0.11, topMat, 1, 0.85, 0.9), 0.21, 1.05, 0));
  g.add(put(cyl(0.075, 0.085, 0.14, skinMat, 8), 0, 1.15, 0.02));
  // head — ANGRY: knitted brows over the eyes
  const head = new THREE.Group(); head.position.set(0, 1.36, 0); g.add(head);
  head.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), skinMat), 0, 0, 0.02));
  head.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), mat(0x1a1210, { flat: true, rough: 0.9 })), 0, 0.06, -0.05)); // hair
  head.add(put(box(0.045, 0.045, 0.03, mat(0x120a06)), -0.07, 0.0, 0.19));   // eyes
  head.add(put(box(0.045, 0.045, 0.03, mat(0x120a06)), 0.07, 0.0, 0.19));
  const browL = put(box(0.09, 0.03, 0.03, mat(0x120a06)), -0.07, 0.06, 0.2); browL.rotation.z = -0.45; head.add(browL);
  const browR = put(box(0.09, 0.03, 0.03, mat(0x120a06)), 0.07, 0.06, 0.2); browR.rotation.z = 0.45; head.add(browR);
  // arms up in a guard, fists ready
  const arms = [];
  for (const sx of [-0.28, 0.28]) {
    const sh = new THREE.Group(); sh.position.set(sx, 1.05, 0.02); sh.rotation.x = -0.7; g.add(sh);
    sh.add(put(cyl(0.07, 0.058, 0.26, topMat), 0, -0.14, 0));
    const elbow = new THREE.Group(); elbow.position.y = -0.28; elbow.rotation.x = 1.5; sh.add(elbow);
    elbow.add(put(cyl(0.055, 0.05, 0.22, skinMat), 0, -0.12, 0));
    elbow.add(put(ball(0.075, skinMat), 0, -0.26, 0));                        // fist
    arms.push({ sh, elbow });
  }
  // the whiskey bottle — amber glass in the right fist, out only mid-chug
  const bottle = new THREE.Group(); bottle.position.set(0, -0.3, 0.06); bottle.visible = false;
  const glassMat = mat(0xb8681e, { rough: 0.3, emissive: 0x5a2c08, emi: 0.5 });
  bottle.add(put(cyl(0.045, 0.05, 0.16, glassMat, 8), 0, 0, 0));
  bottle.add(put(cyl(0.02, 0.022, 0.09, glassMat, 8), 0, 0.11, 0));           // the neck
  arms[1].elbow.add(bottle);
  // the loot — a knotted money sack slung over the shoulder, shown mid-flee
  const loot = new THREE.Group(); loot.position.set(-0.24, 1.28, -0.18); loot.visible = false;
  const sackMat = mat(0xc9a94e, { flat: true, rough: 0.8 });
  loot.add(put(ball(0.17, sackMat, 1, 1.15, 1), 0, 0, 0));
  loot.add(put(cyl(0.05, 0.08, 0.1, sackMat, 8), 0, 0.2, 0));                 // the knot
  loot.add(put(box(0.1, 0.1, 0.02, mat(0x7a5c1e, { flat: true })), 0, 0, 0.17)); // the $ patch
  g.add(loot);
  g.scale.setScalar(a.scale);
  return { group: g, torso, head, loot, armL: arms[0], armR: arms[1], bottle };
}

export function createBrawlers(scene) {
  const group = new THREE.Group(); scene.add(group);
  const map = new Map();
  const dying = [];

  function sync(state, dt, t) {
    const enemies = state.phase === 'brawl' ? state.enemies : [];
    // arrivals
    for (const e of enemies) {
      if (!map.has(e.id)) {
        const b = buildBrawler(e.kind, e.id.charCodeAt(1) || 0);
        const p = rpos(e.x, e.y);
        b.group.position.set(p.x, 0, p.z);
        group.add(b.group); map.set(e.id, b);
      }
    }
    // departures -> a quick crumple-out
    for (const [id, b] of map) {
      if (!enemies.find((e) => e.id === id)) { map.delete(id); dying.push({ b, t: 0 }); }
    }
    for (let i = dying.length - 1; i >= 0; i--) {
      const d = dying[i]; d.t += dt;
      const k = clamp01(d.t / 0.28);
      d.b.group.scale.y = (1 - k) * d.b.group.scale.x;    // crumple down
      d.b.group.rotation.x = k * 0.8;
      if (k >= 1) { group.remove(d.b.group); dying.splice(i, 1); }
    }
    // live updates
    for (const e of enemies) {
      const b = map.get(e.id); if (!b) continue;
      const p = rpos(e.x, e.y);
      // thieves face where they're running (till, then door); a drink run faces
      // the bar; fighters square up on the chef
      const aim = e.role === 'thief'
        ? rpos((e.state === 'flee' ? DOOR : TILL).x, (e.state === 'flee' ? DOOR : TILL).y)
        : e.job === 'drink'
          ? rpos(BAR.x, BAR.y)
          : rpos(state.chef.x, state.chef.y);
      b.group.position.set(p.x, Math.abs(Math.sin(t * 8 + p.x)) * 0.04, p.z);   // stomping bob
      b.group.rotation.y = Math.atan2(aim.x - p.x, aim.z - p.z);
      b.loot.visible = !!e.carry;
      // mid-chug: head back, bottle up. LIT: a hot ember glow under the shirt.
      const chugging = e.job === 'drink' && !e.buffed && (e.chugT || 0) > 0;
      b.bottle.visible = chugging;

      // THE MOVESET reads on the body: rear back on the windup, commit on the
      // strike, slump on the recover. (sim: e.atk {kind, phase, k})
      const atk = e.atk;
      let lean = 0, armLX = -0.7, armRX = chugging ? -2.3 : -0.7, headX = chugging ? -0.4 : 0;
      if (e.guard > 0) {
        // covered up (glass jaw block): arms crossed high, chin tucked
        armLX = armRX = -1.85; headX = 0.22; lean = 0.08;
      } else if (atk) {
        if (atk.phase === 'windup') {
          lean = -0.32 * atk.k;                                     // rearing back
          if (atk.kind === 'slam') { armLX = armRX = lerp(-0.7, -2.7, atk.k); headX = -0.25 * atk.k; }
          else { armLX = -1.1; armRX = lerp(-0.7, -1.6, atk.k); }   // fist drawn
        } else if (atk.phase === 'strike') {
          lean = atk.kind === 'lunge' ? 0.45 : 0.3;                 // committed
          if (atk.kind === 'slam') { armLX = armRX = lerp(-2.7, 0.4, atk.k); }
          else { armRX = 0.5; armLX = -0.9; }
        } else {
          lean = 0.14 * (1 - atk.k);                                // the opening
        }
      }
      b.group.rotation.x = lerp(b.group.rotation.x, lean, clamp01(dt * 14));
      b.armL.sh.rotation.x = lerp(b.armL.sh.rotation.x, armLX, clamp01(dt * 16));
      b.armR.sh.rotation.x = lerp(b.armR.sh.rotation.x, armRX, clamp01(dt * 16));
      b.head.rotation.x = lerp(b.head.rotation.x, headX, clamp01(dt * 10));

      const flash = e.hurtT > 0 ? 0.45 : 0;
      const lit = e.buffed ? 0.3 + Math.sin(t * 9) * 0.1 : 0;
      // the telegraph glows hotter as the strike closes in (red pulse); a held
      // guard reads as a cool steel sheen instead
      const tele = atk && atk.phase === 'windup' ? atk.k * (0.4 + 0.25 * Math.sin(t * 22)) : 0;
      const grd = e.guard > 0 ? 0.22 : 0;
      b.torso.material.emissive.setRGB(Math.max(flash, lit, tele), Math.max(lit * 0.22, grd * 0.6), grd);
    }
  }

  return { sync };
}
