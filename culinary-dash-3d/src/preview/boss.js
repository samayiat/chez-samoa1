// Vince — the wrecking-ball landlord. Built from stylized primitives, flat-shaded
// for a brutish faceted look, lit dramatically. A menacing silhouette that towers
// over the chef, with a wrecking ball on a chain as his signature weapon.
//
// State machine: idle -> windup (telegraph) -> slam -> recover -> idle. HP phases
// escalate him (redder, faster, angrier). Getting hit flashes + recoils him.
import * as THREE from 'three';
import { mat, box, put, easeOut, easeIn, easeOutBack, clamp01, lerp, smooth } from './util.js';

const SUIT = 0x2b2f3a;      // charcoal landlord suit
const SUIT_DK = 0x1d2028;
const SKIN = 0xb9835b;
const HAT = 0xf6a01f;       // hazard hard-hat orange
const HAT_DK = 0xc47908;
const TIE = 0x8a1f24;       // blood-red tie
const METAL = 0x3a3f47;

export function buildVince() {
  const g = new THREE.Group();       // origin at feet
  const lean = new THREE.Group();    // whole-body lean pivot (windup rear-back)
  lean.position.y = 0;
  g.add(lean);

  // legs — planted wide, heavy
  const trouser = mat(SUIT_DK, { flat: true, rough: 0.85 });
  lean.add(put(box(0.62, 1.15, 0.68, trouser), -0.5, 0.58, 0));
  lean.add(put(box(0.62, 1.15, 0.68, trouser), 0.5, 0.58, 0));
  const shoe = mat(0x0d0e12, { flat: true, rough: 0.6 });
  lean.add(put(box(0.72, 0.28, 0.95, shoe), -0.5, 0.14, 0.12));
  lean.add(put(box(0.72, 0.28, 0.95, shoe), 0.5, 0.14, 0.12));

  // torso — a tapered slab, broad up top. breathes.
  const suit = mat(SUIT, { flat: true, rough: 0.78 });
  const belly = new THREE.Group();
  belly.position.y = 1.55;
  lean.add(belly);
  belly.add(put(box(1.7, 1.5, 1.05, suit), 0, 0.1, 0));
  // vest / shirt front
  belly.add(put(box(0.9, 1.25, 0.06, mat(0xcbd3de, { rough: 0.6 })), 0, 0.12, 0.53));
  // blood-red tie
  belly.add(put(box(0.16, 0.9, 0.04, mat(TIE, { flat: true })), 0, 0.0, 0.57));
  // shoulders — wide, imposing
  const shoulders = put(box(2.35, 0.55, 1.1, suit), 0, 0.95, 0);
  belly.add(shoulders);

  // head + neck
  const head = new THREE.Group();
  head.position.set(0, 2.95, 0.05);
  lean.add(head);
  head.add(put(box(0.34, 0.35, 0.34, mat(SKIN, { flat: true, rough: 0.7 })), 0, -0.42, 0)); // neck
  const skull = put(box(0.78, 0.72, 0.8, mat(SKIN, { flat: true, rough: 0.72 })), 0, 0, 0);
  head.add(skull);
  // heavy scowling brow
  head.add(put(box(0.82, 0.16, 0.12, mat(SKIN, { flat: true, rough: 0.7 })), 0, 0.12, 0.38));
  // glowing angry eyes (bloom picks these up)
  const eyeMat = mat(0xff5a2a, { emissive: 0xff5a2a, emi: 2.4 });
  const eyeL = put(box(0.15, 0.09, 0.06, eyeMat), -0.19, 0.02, 0.41);
  const eyeR = put(box(0.15, 0.09, 0.06, eyeMat), 0.19, 0.02, 0.41);
  head.add(eyeL, eyeR);
  // grim mouth
  head.add(put(box(0.34, 0.06, 0.05, mat(0x2a1810)), 0, -0.22, 0.4));
  // jowls
  head.add(put(box(0.86, 0.2, 0.6, mat(SKIN, { flat: true, rough: 0.75 })), 0, -0.28, 0.05));

  // hard hat — foreman menace, faceted dome + brim
  const hat = new THREE.Group();
  hat.position.y = 0.34;
  head.add(hat);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
    mat(HAT, { flat: true, rough: 0.5, emissive: HAT_DK, emi: 0.35 })
  );
  dome.castShadow = true; dome.scale.set(1, 0.85, 1.05);
  hat.add(dome);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 12), mat(HAT_DK, { flat: true }));
  brim.castShadow = true; brim.position.set(0, 0.0, 0.08); brim.scale.z = 1.15;
  hat.add(brim);
  hat.add(put(box(0.3, 0.14, 0.02, mat(0x1a1a1f)), 0, 0.18, 0.5)); // hazard badge slot

  // LEFT arm (his left) — free fist, guards / gestures
  const armL = new THREE.Group();
  armL.position.set(-1.12, 2.45, 0);
  belly.add(armL); // note: parented to belly so lean+breathe carry it
  armL.add(put(box(0.42, 1.15, 0.46, suit), 0, -0.5, 0));
  armL.add(put(box(0.5, 0.4, 0.5, mat(SKIN, { flat: true })), 0, -1.15, 0.05)); // fist

  // RIGHT arm — holds the chain. Upper arm fixed; chain+ball hang from a pivot.
  const armR = new THREE.Group();
  armR.position.set(1.12, 2.45, 0);
  belly.add(armR);
  armR.add(put(box(0.42, 1.15, 0.46, suit), 0, -0.5, 0));
  const gripHand = put(box(0.52, 0.42, 0.52, mat(SKIN, { flat: true })), 0, -1.12, 0.08);
  armR.add(gripHand);

  // wrecking ball assembly — swings from the grip, can be hauled up for a slam.
  // Sits forward of the body and lit brighter so it reads as the signature weapon.
  const ballPivot = new THREE.Group();
  ballPivot.position.set(-0.15, -1.1, 0.55);
  armR.add(ballPivot);
  const chainMat = mat(0x6b7078, { metal: 0.85, rough: 0.45, flat: true, emissive: 0x0a0a0c, emi: 1 });
  const chain = put(box(0.13, 1.5, 0.13, chainMat), 0, -0.75, 0);
  ballPivot.add(chain);
  const ball = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.82, 0),
    mat(0x565b64, { metal: 0.9, rough: 0.42, flat: true, emissive: 0x3a1c0e, emi: 0.9 })
  );
  ball.castShadow = true;
  ball.position.y = -1.9;
  ballPivot.add(ball);
  // rivets on the ball for read + scale
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const bolt = put(box(0.16, 0.16, 0.16, mat(0x3a3f47, { metal: 0.8, rough: 0.4, flat: true })),
      Math.cos(a) * 0.78, -1.9, Math.sin(a) * 0.78);
    ballPivot.add(bolt);
  }
  // a cold rim glint so the ball pops off the dark background even when still
  const glint = new THREE.PointLight(0xbcd0ff, 6, 4, 2);
  glint.position.set(0, -1.9, 0.6);
  ballPivot.add(glint);

  // menace uplight that flares during a telegraph
  const rageLight = new THREE.PointLight(0xff3a12, 0, 9, 2);
  rageLight.position.set(0, 1.6, 1.2);
  lean.add(rageLight);

  g.userData = {
    lean, belly, head, hat, armL, armR, ballPivot, ball, chain, eyeMat, rageLight,
    suitMats: [suit, trouser], tieMat: null,
  };
  return g;
}

// A boss controller wrapping the mesh with a state machine + HP.
export function createBoss(scene) {
  const mesh = buildVince();
  scene.add(mesh);
  const u = mesh.userData;

  const b = {
    mesh, u,
    pos: new THREE.Vector3(0, 0, -5.5),
    facing: 0,
    hp: 28, maxHp: 28,
    state: 'idle', t: 0, nextAttack: 2.6,
    hurtT: 0, recoilZ: 0,
    slamFired: false,
    telegraph: 0,          // 0..1 during windup
    slamTarget: new THREE.Vector3(),
    slamR: 3.0,
    dead: false, winT: 0,
  };
  mesh.position.copy(b.pos);

  b.phase = () => (b.hp <= b.maxHp * 0.33 ? 3 : b.hp <= b.maxHp * 0.66 ? 2 : 1);

  b.hit = (w) => {
    if (b.dead) return;
    b.hp = Math.max(0, b.hp - w);
    b.hurtT = 0.16;
    b.recoilZ = Math.min(0.5, 0.14 * w);
    if (b.hp <= 0 && !b.dead) { b.dead = true; b.state = 'dead'; b.t = 0; }
  };

  b.update = (dt, ctx) => {
    b.t += dt;
    const ph = b.phase();

    // face the chef
    const dx = ctx.chefPos.x - b.pos.x, dz = ctx.chefPos.z - b.pos.z;
    const want = Math.atan2(dx, dz);
    b.facing = want; // Vince is slow but always squares up
    u.lean.rotation.y = 0; // body faces +Z; whole mesh yaws:
    mesh.rotation.y += (want - mesh.rotation.y) * smooth(dt, b.dead ? 2 : 3);

    // idle breathing + ball pendulum
    const breathe = Math.sin(b.t * 1.7) * 0.03;
    u.belly.scale.y = 1 + breathe;
    u.belly.scale.x = 1 - breathe * 0.5;

    // hurt flash
    if (b.hurtT > 0) {
      b.hurtT -= dt;
      const f = Math.max(0, b.hurtT / 0.16);
      u.suitMats.forEach((m) => m.emissive.setRGB(f, f, f));
    } else {
      u.suitMats.forEach((m) => m.emissive.setScalar(0));
    }
    // recoil
    b.recoilZ *= Math.exp(-10 * dt);

    // enrage tint by phase
    const rage = ph === 3 ? 1 : ph === 2 ? 0.4 : 0;
    u.eyeMat.emissiveIntensity = 2.0 + rage * 2.5 + Math.sin(b.t * 8) * rage * 0.6;
    u.rageLight.intensity = lerp(u.rageLight.intensity, b.telegraph * (1.4 + rage * 1.4), smooth(dt, 8));

    if (b.state === 'dead') {
      // topple + fade the fight to a win
      b.winT += dt;
      u.lean.rotation.x = lerp(u.lean.rotation.x, -Math.PI * 0.42, smooth(dt, 3));
      mesh.position.y = -Math.min(1.0, b.winT * 0.4);
      u.ballPivot.rotation.x = lerp(u.ballPivot.rotation.x, 1.4, smooth(dt, 4));
      ctx.hud.boss = 0;
      return;
    }

    const windupDur = ({ 1: 1.0, 2: 0.8, 3: 0.6 }[ph]);
    const gap = ({ 1: 3.0, 2: 2.4, 3: 1.8 }[ph]);

    if (b.state === 'idle') {
      u.ballPivot.rotation.x = Math.sin(b.t * 1.4) * 0.32;       // pendulum
      u.ballPivot.rotation.z = Math.sin(b.t * 1.1) * 0.1;
      u.lean.rotation.x = lerp(u.lean.rotation.x, -b.recoilZ, smooth(dt, 8));
      b.telegraph = lerp(b.telegraph, 0, smooth(dt, 6));
      if (b.t > b.nextAttack) { b.state = 'windup'; b.t = 0; b.slamFired = false;
        // aim the slam where the chef is now
        b.slamTarget.set(ctx.chefPos.x, 0, ctx.chefPos.z);
      }
    } else if (b.state === 'windup') {
      const k = clamp01(b.t / windupDur);
      b.telegraph = k;
      // rear back, haul the ball up and behind
      u.lean.rotation.x = lerp(0, 0.28, easeIn(k));
      u.ballPivot.rotation.x = lerp(0.3, -1.7, easeOut(k));
      u.armR.rotation.x = lerp(0, -0.6, easeOut(k));
      if (b.t >= windupDur) { b.state = 'slam'; b.t = 0; }
    } else if (b.state === 'slam') {
      const dur = 0.36;
      const k = clamp01(b.t / dur);
      // whip the body and ball forward/down
      u.lean.rotation.x = lerp(0.28, -0.34, easeIn(Math.min(1, k * 1.4)));
      u.ballPivot.rotation.x = lerp(-1.7, 1.5, easeOutBack(k));
      u.armR.rotation.x = lerp(-0.6, 0.5, easeOut(k));
      if (!b.slamFired && k > 0.55) {
        b.slamFired = true;
        ctx.onSlam(b.slamTarget, b.slamR, ph);
      }
      if (b.t >= dur) { b.state = 'recover'; b.t = 0; }
    } else if (b.state === 'recover') {
      const k = clamp01(b.t / 0.7);
      u.lean.rotation.x = lerp(-0.34, 0, easeOut(k));
      u.ballPivot.rotation.x = lerp(1.5, 0.3, easeOut(k));
      u.armR.rotation.x = lerp(0.5, 0, easeOut(k));
      b.telegraph = lerp(b.telegraph, 0, smooth(dt, 6));
      if (b.t >= 0.7) { b.state = 'idle'; b.t = 0; b.nextAttack = gap; }
    }

    ctx.hud.boss = b.hp / b.maxHp;
    ctx.hud.enraged = ph === 3;
  };

  // world position of the ball, for hit reactions (unused in preview but handy)
  b.ballWorld = () => {
    const v = new THREE.Vector3();
    u.ball.getWorldPosition(v);
    return v;
  };

  return b;
}
