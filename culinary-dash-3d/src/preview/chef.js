// The chef (player). Upgraded from the module's capsule into a readable little
// character with the 2D game's identity (white jacket, toque, her purple apron),
// and — the whole point of this preview — VISIBLE punches: a 3-hit combo where the
// arm actually thrusts, the body lunges, it squashes on contact, and a trail sells
// the speed. Plus a dodge dash (the dormant `secondary` input) with i-frames.
//
// Built facing local +Z; the group yaws so +Z points where the chef faces, so a
// punch always thrusts along the facing.
import * as THREE from 'three';
import { mat, box, put, easeOut, easeOutBack, clamp01, lerp, smooth } from './util.js';

// Her real palette, sampled from the 2D chef sprite (pixel lab masters,
// sprites/chef/v2_south.png): dark-brown skin, a mauve-pink top, a tan apron,
// a cream toque, dark braided hair. She must read as the SAME person across the
// 2D->3D cut, so these are matched, not invented.
const TOP = 0xb56a92;      // mauve-pink top (#905070 sample, brightened to read in 3D light)
const APRON = 0x9c6636;    // tan/brown apron (#a06030)
const SKIN = 0x7a4328;     // dark brown (#703020)
const HAIR = 0x17110d;     // dark braided hair
const TROUSER = 0x2a1f18;  // dark leggings under the skirt
const HAT = 0xf1efe6;      // cream toque (#f0f0f0)
const MALE_TOP = 0x356b7a; // the male chef's deep teal top (distinct from her mauve)

// rounded low-poly primitives — a tapered limb (cyl) and a joint/cap (ball).
// Soft, faceted forms so the body reads as a body, not a stack of blocks.
const cyl = (rt, rb, h, material, seg = 8) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material); m.castShadow = true; return m; };
const ball = (r, material, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), material); m.scale.set(sx, sy, sz); m.castShadow = true; return m; };

// combo moves: [armSide, dur, reach, weight, knock, lunge]
const COMBO = [
  { side: 'R', dur: 0.24, reach: 1.7, w: 0.6, lunge: 0.35 }, // jab
  { side: 'L', dur: 0.28, reach: 1.9, w: 1.0, lunge: 0.5 },  // cross
  { side: 'R', dur: 0.38, reach: 2.1, w: 1.9, lunge: 0.7 },  // roundhouse
];

export function buildChef(opts = {}) {
  const male = !!opts.male;         // male variant: teal top, bushy top-knot, no toque
  const topCol = male ? MALE_TOP : TOP;
  const g = new THREE.Group();     // origin at feet, front = +Z
  const body = new THREE.Group();  // bob/squash pivot
  g.add(body);

  // legs — tapered thigh + shin, rounded hip/knee joints, a shoe with a toe.
  // (userData.knee bends the shin — the rig hook the animation drives.)
  const trouser = mat(TROUSER, { flat: true, rough: 0.8 });
  const shoeMat = mat(0x1a1a20, { flat: true });
  function leg() {
    const hip = new THREE.Group();                                   // hip pivot
    hip.add(put(ball(0.12, trouser, 1, 0.9, 1), 0, 0, 0));           // hip joint
    hip.add(put(cyl(0.12, 0.095, 0.28, trouser), 0, -0.15, 0));      // thigh (tapered)
    const knee = new THREE.Group(); knee.position.y = -0.29; hip.add(knee);
    knee.add(put(ball(0.09, trouser), 0, 0, 0));                     // knee cap
    knee.add(put(cyl(0.09, 0.07, 0.26, trouser), 0, -0.14, 0));      // shin (tapered)
    knee.add(put(box(0.15, 0.08, 0.24, shoeMat), 0, -0.29, 0.05));   // shoe sole
    knee.add(put(ball(0.09, shoeMat, 1.0, 0.7, 1.15), 0, -0.29, 0.17)); // rounded toe
    hip.userData.knee = knee;
    return hip;
  }
  const legL = leg(); legL.position.set(-0.16, 0.5, 0); body.add(legL);
  const legR = leg(); legR.position.set(0.16, 0.5, 0); body.add(legR);

  // torso — a soft elliptical column (chest a touch wider than the waist), her
  // pink top with a tan apron panel, round shoulder caps, a neck and a collar.
  const topMat = mat(topCol, { flat: true, rough: 0.7 });
  const torso = new THREE.Group(); torso.position.y = 0.9; body.add(torso);
  const core = cyl(0.3, 0.26, 0.72, topMat, 12); core.scale.z = 0.66; torso.add(put(core, 0, 0, 0));
  torso.add(put(ball(0.15, topMat, 1, 0.85, 0.9), -0.28, 0.3, 0));   // shoulder caps
  torso.add(put(ball(0.15, topMat, 1, 0.85, 0.9), 0.28, 0.3, 0));
  const apronMat = mat(0xf1ede2, { flat: true, rough: 0.8 });   // white apron
  const apron = cyl(0.3, 0.35, 0.82, apronMat, 12); apron.scale.z = 0.66; apron.castShadow = true; torso.add(put(apron, 0, -0.2, 0));   // apron wraps around and hangs toward the ground (flares a touch for leg room)
  const tie = cyl(0.325, 0.325, 0.07, mat(0x6f4626, { flat: true }), 12); tie.scale.z = 0.66; torso.add(put(tie, 0, 0.09, 0));            // waist tie band around
  torso.add(put(cyl(0.1, 0.11, 0.14, mat(SKIN, { rough: 0.72 }), 10), 0, 0.44, 0.02)); // neck
  torso.add(put(cyl(0.17, 0.19, 0.1, topMat, 12), 0, 0.37, 0.02));   // collar

  // head — a brown face. Her: dreadlocks + toque. Him: short hair + a bushy top-knot.
  const head = new THREE.Group(); head.position.y = 1.42; body.add(head);
  const hairMat = mat(HAIR, { flat: true, rough: 0.9 });
  const UP = new THREE.Vector3(0, 1, 0);
  // face in front of the hair (shared)
  head.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.235, 16, 12), mat(SKIN, { rough: 0.72 })), 0, 0, 0.06));

  if (!male) {
    // rounded hair base (under the toque) so gaps between locs read as hair, not scalp
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.245, 14, 12), hairMat);
    base.castShadow = true; base.position.set(0, 0.0, -0.03); base.scale.set(1.12, 0.9, 1.05); head.add(base);
    // a hidden hair backing behind the shirt — its only job is to block the top from
    // showing through the gaps between locs. Kept inside the loc envelope so the locs
    // overhang it on every side and it never reads as its own shape.
    const backfill = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.33, 0.52, 12), hairMat);
    backfill.castShadow = true; backfill.position.set(0, -0.2, -0.26); backfill.scale.set(1, 1, 0.22); head.add(backfill);
    // ~35 thin straight locs emerging from under the hat brim, each flaring DOWN-AND-
    // OUTWARD/BACK so it falls clear of the shoulders (no body clip); face left open.
    const R = 0.24, FRONT_GAP = 0.95;   // radians of open face around +Z
    const rings = [
      { phi: 1.40, n: 16, len: 0.42 },
      { phi: 1.52, n: 20, len: 0.54 },
      { phi: 1.62, n: 22, len: 0.62 },
    ];
    for (const ring of rings) {
      const hr = R * Math.sin(ring.phi), ry = R * Math.cos(ring.phi);
      for (let i = 0; i < ring.n; i++) {
        const th = (i / ring.n) * Math.PI * 2;
        const rx = hr * Math.sin(th), rz = hr * Math.cos(th);       // th=0 -> +Z (front)
        if (Math.abs(Math.atan2(rx, rz)) < FRONT_GAP) continue;     // keep the face open
        const jit = Math.sin(i * 12.9 + ring.phi * 78.2);           // deterministic wobble
        const len = ring.len * (0.9 + 0.16 * (jit * 0.5 + 0.5));
        const root = new THREE.Vector3(rx, ry + 0.02, rz - 0.02);
        const dir = new THREE.Vector3(rx * 0.4, 0, rz * 1.6 - 0.1).normalize()
          .multiplyScalar(0.62 + 0.12 * jit).add(new THREE.Vector3(0, -1, 0)).normalize();
        const loc = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.033, len, 5), hairMat);
        loc.castShadow = true;
        loc.quaternion.setFromUnitVectors(UP, dir);
        loc.position.copy(root).add(dir.clone().multiplyScalar(len / 2));
        head.add(loc);
      }
    }
    // toque — a bigger, boxier chef's hat: faceted drum band + fat cuff brim + puff
    const hatMat = mat(HAT, { flat: true, rough: 0.85 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.28, 0.24, 12), hatMat);
    band.castShadow = true; band.position.set(0, 0.2, -0.02); head.add(band);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.055, 8, 18), hatMat);
    cuff.castShadow = true; cuff.rotation.x = Math.PI / 2; cuff.position.set(0, 0.09, -0.02); head.add(cuff);
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.31, 10, 8), hatMat);
    puff.castShadow = true; puff.position.set(0, 0.36, -0.02); puff.scale.set(1.12, 0.82, 1.12); head.add(puff);
  } else {
    // MALE — short-hair cap: sits high, tapered so it stops above the ears (not a bob)
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 12), hairMat);
    cap.castShadow = true; cap.scale.set(1.04, 0.78, 1.0); cap.position.set(0, 0.06, -0.03); head.add(cap);
    head.add(put(ball(0.16, hairMat, 1, 0.6, 0.9), 0, 0.02, -0.16));   // fuller short hair at the back

    // a BUSHY PONYTAIL sprouting directly from the top-center of the head: a wound
    // hair tie, a volume puff at the base, then a fountain of thick fronds fanning up
    // and out — the fronds read as the bushy tail, a small top puff just rounds it.
    const gather = new THREE.Vector3(0, 0.27, -0.02);
    const tie = cyl(0.055, 0.05, 0.06, hairMat, 8); tie.position.copy(gather); head.add(tie);
    head.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), hairMat), gather.x, gather.y + 0.06, gather.z));   // base bush
    const FR = 16;
    for (let i = 0; i < FR; i++) {
      const a = (i / FR) * Math.PI * 2;
      const jit = Math.sin(i * 12.9 + 3.1);
      const spread = 0.5 + 0.32 * (jit * 0.5 + 0.5);
      const dir = new THREE.Vector3(Math.cos(a) * spread, 1, Math.sin(a) * spread - 0.12).normalize();  // up, fan out, slight back
      const len = 0.3 + 0.16 * (jit * 0.5 + 0.5);
      const frond = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.026, len, 5), hairMat);          // fat tip = bushy
      frond.castShadow = true;
      frond.quaternion.setFromUnitVectors(UP, dir);
      frond.position.copy(gather).add(dir.clone().multiplyScalar(len / 2 + 0.05));
      head.add(frond);
    }
    head.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), hairMat), gather.x, gather.y + 0.22, gather.z - 0.02));  // round the top
  }
  // eyes (shared)
  head.add(put(box(0.05, 0.06, 0.03, mat(0x120a06)), -0.09, 0.02, 0.25));
  head.add(put(box(0.05, 0.06, 0.03, mat(0x120a06)), 0.09, 0.02, 0.25));

  // arms — pink upper sleeve, bare brown forearm + fist, hinged at an elbow
  // (userData.elbow bends the forearm; userData.fist is the hand).
  const skinMat = mat(SKIN, { flat: true, rough: 0.7 });
  function arm() {
    const sh = new THREE.Group();                                   // shoulder pivot
    sh.add(put(ball(0.1, topMat, 1, 0.95, 1), 0, 0, 0));            // shoulder round
    sh.add(put(cyl(0.095, 0.075, 0.28, topMat), 0, -0.15, 0));      // upper arm (tapered sleeve)
    const elbow = new THREE.Group(); elbow.position.y = -0.29; sh.add(elbow);
    elbow.add(put(ball(0.075, skinMat), 0, 0, 0));                  // elbow
    elbow.add(put(cyl(0.072, 0.058, 0.26, skinMat), 0, -0.14, 0));  // forearm (bare, tapered)
    const fist = ball(0.09, skinMat, 1, 0.95, 1.05); fist.position.set(0, -0.3, 0.01); // mitt hand
    elbow.add(fist);
    sh.userData = { elbow, fist };
    return sh;
  }
  const armL = arm(); armL.position.set(-0.34, 1.16, 0); body.add(armL);
  const armR = arm(); armR.position.set(0.34, 1.16, 0); body.add(armR);

  // punch trail — a stretched additive quad along the punching arm
  const trailMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const trail = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.6), trailMat);
  trail.visible = false;
  body.add(trail);

  g.userData = { body, torso, head, legL, legR, armL, armR, trail, trailMat };
  return g;
}

export function createChef(scene) {
  const mesh = buildChef();
  scene.add(mesh);
  const u = mesh.userData;

  const c = {
    mesh, u,
    pos: new THREE.Vector3(0, 0, 1.5),
    vel: new THREE.Vector3(),
    facing: Math.PI,          // face -Z (toward Vince) to start
    hp: 6, maxHp: 6,
    step: 0, punchT: 0, punchDur: 0, move: null, comboIdx: 0, comboGap: 0,
    hitFired: false, hurtT: 0, invuln: 0,
    dashT: 0, dashDir: new THREE.Vector3(),
    walkPhase: 0, lungeZ: 0, squash: 0,
    kbx: 0, kbz: 0,
    ghosts: [],
  };
  mesh.position.copy(c.pos);

  c.knockback = (kx, kz, s) => { const m = Math.hypot(kx, kz) || 1; c.kbx += (kx / m) * s; c.kbz += (kz / m) * s; };

  const SPEED = 4.6, DASH_SPEED = 12, ARENA_R = 8.5;

  c.hurt = (dmg = 1) => {
    if (c.invuln > 0) return false;
    c.hp = Math.max(0, c.hp - dmg);
    c.hurtT = 0.3; c.invuln = 0.6;
    return true;
  };

  c.update = (dt, ctx) => {
    const inp = ctx.input;
    c.comboGap += dt;
    if (c.comboGap > 0.9) c.comboIdx = 0;

    // --- dodge dash (secondary) ---
    if (inp.secondaryDown && c.dashT <= 0 && c.punchT <= 0) {
      c.dashT = 0.3; c.invuln = 0.34;
      let dx = inp.move.x, dz = inp.move.y;
      if (Math.hypot(dx, dz) < 0.2) { // no stick -> dodge back from boss
        dx = c.pos.x - ctx.bossPos.x; dz = c.pos.z - ctx.bossPos.z;
        const m = Math.hypot(dx, dz) || 1; dx /= m; dz /= m;
      } else { const m = Math.hypot(dx, dz); dx /= m; dz /= m; }
      c.dashDir.set(dx, 0, dz);
      ctx.sound && ctx.sound('dash');
    }

    // --- movement ---
    let mx = 0, mz = 0;
    if (c.dashT > 0) {
      c.dashT -= dt;
      mx = c.dashDir.x * DASH_SPEED; mz = c.dashDir.z * DASH_SPEED;
      // afterimage ghosts
      if (Math.random() < 0.7) ctx.spawnGhost(c.pos, c.facing);
    } else if (c.punchT > 0) {
      // rooted during a swing except the lunge impulse
    } else {
      mx = inp.move.x * SPEED; mz = inp.move.y * SPEED;
    }
    // lunge impulse (drive window of a punch)
    if (c.punchT > 0 && c.move) {
      const k = 1 - clamp01(c.punchT / (c.punchDur * 0.5));
      const drive = c.move.lunge * 9 * (c.punchT > c.punchDur * 0.5 ? 1 : 0);
      mx += Math.sin(c.facing) * drive;
      mz += Math.cos(c.facing) * drive;
    }
    c.pos.x += mx * dt; c.pos.z += mz * dt;
    // knockback impulse (from a slam / charge / grab)
    c.pos.x += c.kbx * dt; c.pos.z += c.kbz * dt;
    c.kbx *= Math.exp(-9 * dt); c.kbz *= Math.exp(-9 * dt);

    // clamp to arena, push out of the boss
    const rr = Math.hypot(c.pos.x, c.pos.z);
    if (rr > ARENA_R) { c.pos.x *= ARENA_R / rr; c.pos.z *= ARENA_R / rr; }
    const bdx = c.pos.x - ctx.bossPos.x, bdz = c.pos.z - ctx.bossPos.z;
    const bd = Math.hypot(bdx, bdz);
    if (bd < 1.7) { const p = (1.7 - bd) / (bd || 1); c.pos.x += bdx * p; c.pos.z += bdz * p; }
    mesh.position.set(c.pos.x, 0, c.pos.z);

    // --- facing ---
    const moving = Math.hypot(inp.move.x, inp.move.y) > 0.2;
    let wantFace = c.facing;
    if (c.punchT > 0) {
      wantFace = Math.atan2(ctx.bossPos.x - c.pos.x, ctx.bossPos.z - c.pos.z); // face boss mid-punch
    } else if (moving && c.dashT <= 0) {
      wantFace = Math.atan2(inp.move.x, inp.move.y);
    }
    let d = wantFace - c.facing;
    while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    c.facing += d * smooth(dt, 16);
    mesh.rotation.y = c.facing;

    // --- start a punch ---
    if (inp.primaryDown && c.punchT <= 0 && c.dashT <= 0) {
      c.move = COMBO[c.comboIdx % COMBO.length];
      c.punchDur = c.move.dur; c.punchT = c.punchDur; c.hitFired = false;
      c.comboIdx++; c.comboGap = 0;
      ctx.sound && ctx.sound('whiff');
    }

    // --- animate punch ---
    const armL = u.armL, armR = u.armR;
    if (c.punchT > 0) {
      c.punchT -= dt;
      const k = 1 - clamp01(c.punchT / c.punchDur);   // 0..1 through the swing
      const arm = c.move.side === 'R' ? armR : armL;
      const other = c.move.side === 'R' ? armL : armR;
      // thrust: swing from down (0) to forward (-PI/2 past for overshoot) then back
      const out = k < 0.42 ? easeOutBack(k / 0.42) : easeOut(1 - (k - 0.42) / 0.58);
      // shoulder thrusts forward while the elbow snaps from bent to straight — the
      // extension IS the strike (replaces the old scale-stretch).
      arm.rotation.x = lerp(0.3, -1.7, out);
      arm.userData.elbow.rotation.x = lerp(1.5, 0.05, out);
      other.rotation.x = lerp(other.rotation.x, -0.35, smooth(dt, 12));                          // guard up
      other.userData.elbow.rotation.x = lerp(other.userData.elbow.rotation.x, 1.3, smooth(dt, 12));
      // squash body at the peak
      c.squash = Math.sin(clamp01(k / 0.5) * Math.PI) * 0.12;
      // trail
      const fw = new THREE.Vector3(); arm.userData.fist.getWorldPosition(fw);
      u.trail.visible = out > 0.3;
      u.trailMat.opacity = Math.max(0, out - 0.2) * 0.8;
      u.trail.position.copy(mesh.worldToLocal(fw.clone())).multiplyScalar(1);
      u.trail.position.z += 0.2; u.trail.lookAt(0, u.trail.position.y, 10);
      // contact
      if (!c.hitFired && k >= 0.4) {
        c.hitFired = true;
        arm.userData.fist.getWorldPosition(fw);
        ctx.onPunch(c.move, fw);
      }
    } else {
      armR.rotation.x = lerp(armR.rotation.x, moving ? Math.sin(c.walkPhase) * 0.5 : 0, smooth(dt, 10));
      armL.rotation.x = lerp(armL.rotation.x, moving ? -Math.sin(c.walkPhase) * 0.5 : 0, smooth(dt, 10));
      armR.userData.elbow.rotation.x = lerp(armR.userData.elbow.rotation.x, 0.35, smooth(dt, 10)); // relaxed bend
      armL.userData.elbow.rotation.x = lerp(armL.userData.elbow.rotation.x, 0.35, smooth(dt, 10));
      u.trail.visible = false; u.trailMat.opacity = 0;
      c.squash = lerp(c.squash, 0, smooth(dt, 12));
    }

    // --- walk cycle + bob/squash ---
    const spd = Math.hypot(mx, mz);
    if (spd > 0.5 && c.dashT <= 0 && c.punchT <= 0) {
      c.walkPhase += dt * 11;
      u.legL.rotation.x = Math.sin(c.walkPhase) * 0.6;
      u.legR.rotation.x = -Math.sin(c.walkPhase) * 0.6;
      u.legL.userData.knee.rotation.x = 0.15 + Math.max(0, -Math.sin(c.walkPhase)) * 0.7;   // knee bends on the back swing
      u.legR.userData.knee.rotation.x = 0.15 + Math.max(0, Math.sin(c.walkPhase)) * 0.7;
      u.body.position.y = Math.abs(Math.sin(c.walkPhase)) * 0.06;
    } else {
      u.legL.rotation.x = lerp(u.legL.rotation.x, 0, smooth(dt, 10));
      u.legR.rotation.x = lerp(u.legR.rotation.x, 0, smooth(dt, 10));
      u.legL.userData.knee.rotation.x = lerp(u.legL.userData.knee.rotation.x, 0.08, smooth(dt, 10));
      u.legR.userData.knee.rotation.x = lerp(u.legR.userData.knee.rotation.x, 0.08, smooth(dt, 10));
      u.body.position.y = lerp(u.body.position.y, Math.sin(c.step += dt * 2) * 0.015, smooth(dt, 8));
    }
    // dash stretch / squash
    const stretch = c.dashT > 0 ? 0.18 : 0;
    u.body.scale.set(1 - c.squash * 0.6 + stretch * 0.3, 1 + c.squash - stretch * 0.0 - stretch * 0.3, 1 - c.squash * 0.6 + stretch);

    // hurt flash
    if (c.hurtT > 0) c.hurtT -= dt;
    if (c.invuln > 0) c.invuln -= dt;
    const hf = Math.max(0, c.hurtT / 0.3);
    mesh.visible = !(c.invuln > 0 && Math.floor(c.invuln * 20) % 2 === 0 && c.dashT <= 0); // i-frame blink
    void hf;

    ctx.hud.hp = c.hp;
    ctx.hud.combo = c.comboGap < 0.9 ? c.comboIdx : 0;
  };

  return c;
}
