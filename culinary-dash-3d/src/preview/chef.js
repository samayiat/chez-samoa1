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

// combo moves: [armSide, dur, reach, weight, knock, lunge]
const COMBO = [
  { side: 'R', dur: 0.24, reach: 1.7, w: 0.6, lunge: 0.35 }, // jab
  { side: 'L', dur: 0.28, reach: 1.9, w: 1.0, lunge: 0.5 },  // cross
  { side: 'R', dur: 0.38, reach: 2.1, w: 1.9, lunge: 0.7 },  // roundhouse
];

export function buildChef() {
  const g = new THREE.Group();     // origin at feet, front = +Z
  const body = new THREE.Group();  // bob/squash pivot
  g.add(body);

  // legs — thigh + shin, hinged at a knee (userData.knee bends the shin)
  const trouser = mat(TROUSER, { flat: true, rough: 0.8 });
  const shoeMat = mat(0x1a1a20, { flat: true });
  function leg() {
    const hip = new THREE.Group();                                  // hip pivot
    hip.add(put(box(0.22, 0.27, 0.25, trouser), 0, -0.135, 0));      // thigh
    const knee = new THREE.Group(); knee.position.y = -0.27; hip.add(knee);
    knee.add(put(box(0.2, 0.26, 0.22, trouser), 0, -0.13, 0));       // shin
    knee.add(put(box(0.26, 0.12, 0.34, shoeMat), 0, -0.27, 0.05));   // foot
    hip.userData.knee = knee;
    return hip;
  }
  const legL = leg(); legL.position.set(-0.16, 0.5, 0); body.add(legL);
  const legR = leg(); legR.position.set(0.16, 0.5, 0); body.add(legR);

  // torso — pink top under a tan apron
  const topMat = mat(TOP, { flat: true, rough: 0.7 });
  const torso = new THREE.Group(); torso.position.y = 0.9; body.add(torso);
  torso.add(put(box(0.6, 0.72, 0.42, topMat), 0, 0, 0));
  // apron over the front, with a waist tie
  torso.add(put(box(0.46, 0.66, 0.06, mat(APRON, { flat: true, rough: 0.8 })), 0, -0.08, 0.22));
  torso.add(put(box(0.62, 0.08, 0.06, mat(0x6f4626, { flat: true })), 0, 0.02, 0.235)); // apron tie
  // collar of the top
  torso.add(put(box(0.5, 0.1, 0.3, topMat), 0, 0.4, 0.06));

  // head — dark braided hair framing a brown face, cream toque on top
  const head = new THREE.Group(); head.position.y = 1.42; body.add(head);
  const hairMat = mat(HAIR, { flat: true, rough: 0.85 });
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), hairMat);
  hair.castShadow = true; hair.position.z = -0.02; head.add(hair);   // hair behind
  head.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.235, 16, 12), mat(SKIN, { rough: 0.72 })), 0, 0, 0.04)); // face in front
  // braids down both sides
  head.add(put(box(0.09, 0.5, 0.09, hairMat), -0.22, -0.18, -0.02));
  head.add(put(box(0.09, 0.5, 0.09, hairMat), 0.22, -0.18, -0.02));
  head.add(put(box(0.1, 0.1, 0.1, hairMat), -0.22, -0.44, -0.02)); // braid beads
  head.add(put(box(0.1, 0.1, 0.1, hairMat), 0.22, -0.44, -0.02));
  // eyes
  head.add(put(box(0.05, 0.06, 0.03, mat(0x120a06)), -0.09, 0.02, 0.24));
  head.add(put(box(0.05, 0.06, 0.03, mat(0x120a06)), 0.09, 0.02, 0.24));
  // toque — puffy squashed sphere + band
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), mat(HAT, { rough: 0.85 }));
  puff.castShadow = true; puff.position.y = 0.32; puff.scale.set(1.05, 0.9, 1.05);
  head.add(puff);
  head.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.14, 16), mat(HAT, { rough: 0.8 })), 0, 0.15, 0));

  // arms — pink upper sleeve, bare brown forearm + fist, hinged at an elbow
  // (userData.elbow bends the forearm; userData.fist is the hand).
  const skinMat = mat(SKIN, { flat: true, rough: 0.7 });
  function arm() {
    const sh = new THREE.Group();                                   // shoulder pivot
    sh.add(put(box(0.16, 0.28, 0.16, topMat), 0, -0.14, 0));         // upper arm (sleeve)
    const elbow = new THREE.Group(); elbow.position.y = -0.28; sh.add(elbow);
    elbow.add(put(box(0.14, 0.26, 0.14, skinMat), 0, -0.13, 0));     // forearm (bare)
    const fist = put(box(0.18, 0.18, 0.18, skinMat), 0, -0.3, 0);
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
