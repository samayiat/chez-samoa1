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

  // Rounded low-poly primitives — the same form vocabulary as the chef and the
  // diners (tapered cylinder limbs, ball joints), scaled up to landlord bulk so
  // the whole cast reads as one art pass. Faceted (flat) shading keeps the menace.
  const cyl = (rt, rb, h, material, seg = 10) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material); m.castShadow = true; return m; };
  const orb = (r, material, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), material); m.scale.set(sx, sy, sz); m.castShadow = true; return m; };

  // legs — planted wide and heavy: tapered thigh + shin, ball hips/knees, a slight
  // bent-knee stance, and boots with a rounded toe
  const trouser = mat(SUIT_DK, { flat: true, rough: 0.85 });
  const shoe = mat(0x0d0e12, { flat: true, rough: 0.6 });
  for (const sx of [-0.5, 0.5]) {
    const hip = new THREE.Group(); hip.position.set(sx, 1.15, 0); hip.rotation.x = 0.12; lean.add(hip);
    hip.add(put(orb(0.34, trouser, 1, 0.9, 1), 0, 0, 0));                     // hip joint
    hip.add(put(cyl(0.33, 0.28, 0.56, trouser), 0, -0.28, 0));                 // thigh (tapered)
    const knee = new THREE.Group(); knee.position.y = -0.56; knee.rotation.x = -0.22; hip.add(knee);
    knee.add(put(orb(0.27, trouser), 0, 0, 0));                               // knee cap
    knee.add(put(cyl(0.27, 0.23, 0.54, trouser), 0, -0.27, 0));                // shin (tapered)
    knee.add(put(box(0.5, 0.24, 0.7, shoe), 0, -0.52, 0.1));                   // boot sole
    knee.add(put(orb(0.28, shoe, 1, 0.7, 1.25), 0, -0.5, 0.35));              // rounded toe
  }

  // torso — a soft tapered barrel, broad up top, with big ball shoulders. breathes.
  const suit = mat(SUIT, { flat: true, rough: 0.78 });
  const belly = new THREE.Group();
  belly.position.y = 1.55;
  lean.add(belly);
  const core = cyl(0.95, 0.8, 1.55, suit, 12); core.scale.z = 0.64; belly.add(put(core, 0, 0.12, 0));
  belly.add(put(orb(0.46, suit, 1, 0.8, 0.9), -0.92, 0.85, 0));               // shoulder boulders
  belly.add(put(orb(0.46, suit, 1, 0.8, 0.9), 0.92, 0.85, 0));
  belly.add(put(orb(0.62, suit, 1.35, 0.55, 0.85), 0, 0.95, 0));              // trapezius mass
  // vest / shirt front + blood-red tie
  belly.add(put(box(0.82, 1.25, 0.06, mat(0xcbd3de, { rough: 0.6 })), 0, 0.12, 0.56));
  belly.add(put(box(0.16, 0.9, 0.04, mat(TIE, { flat: true })), 0, 0.0, 0.6));

  // head + neck — a faceted skull sphere with heavy jaw, keeping the scowl
  const head = new THREE.Group();
  head.position.set(0, 2.95, 0.05);
  lean.add(head);
  head.add(put(cyl(0.24, 0.28, 0.4, mat(SKIN, { flat: true, rough: 0.7 }), 8), 0, -0.42, 0));  // neck
  const skull = put(orb(0.42, mat(SKIN, { flat: true, rough: 0.72 }), 1.0, 0.92, 0.98), 0, 0, 0);
  head.add(skull);
  // heavy scowling brow
  head.add(put(box(0.72, 0.15, 0.14, mat(SKIN, { flat: true, rough: 0.7 })), 0, 0.12, 0.34));
  // glowing angry eyes (bloom picks these up)
  const eyeMat = mat(0xff5a2a, { emissive: 0xff5a2a, emi: 2.4 });
  const eyeL = put(box(0.15, 0.09, 0.06, eyeMat), -0.17, 0.02, 0.37);
  const eyeR = put(box(0.15, 0.09, 0.06, eyeMat), 0.17, 0.02, 0.37);
  head.add(eyeL, eyeR);
  // grim mouth
  head.add(put(box(0.3, 0.06, 0.05, mat(0x2a1810)), 0, -0.2, 0.36));
  // jowls — a wide jaw ball
  head.add(put(orb(0.34, mat(SKIN, { flat: true, rough: 0.75 }), 1.25, 0.6, 1.0), 0, -0.26, 0.02));

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

  // LEFT arm (his left) — free fist: tapered upper arm + forearm, ball elbow
  const armL = new THREE.Group();
  armL.position.set(-1.12, 2.45, 0);
  belly.add(armL); // parented to belly so lean+breathe carry it
  armL.add(put(orb(0.26, suit, 1, 0.9, 1), 0, 0, 0));                                      // shoulder round
  armL.add(put(cyl(0.25, 0.21, 0.62, suit), 0, -0.31, 0));                                  // upper arm
  const armLElbow = new THREE.Group(); armLElbow.position.y = -0.62; armLElbow.rotation.x = 0.4; armL.add(armLElbow);
  armLElbow.add(put(orb(0.21, suit), 0, 0, 0));                                            // elbow
  armLElbow.add(put(cyl(0.21, 0.18, 0.58, suit), 0, -0.29, 0));                             // forearm
  armLElbow.add(put(orb(0.3, mat(SKIN, { flat: true }), 1, 0.9, 1.1), 0, -0.62, 0.05));    // fist
  // RIGHT arm — same build; the chain hangs from his grip hand.
  const armR = new THREE.Group();
  armR.position.set(1.12, 2.45, 0);
  belly.add(armR);
  armR.add(put(orb(0.26, suit, 1, 0.9, 1), 0, 0, 0));
  armR.add(put(cyl(0.25, 0.21, 0.62, suit), 0, -0.31, 0));
  const armRElbow = new THREE.Group(); armRElbow.position.y = -0.62; armRElbow.rotation.x = 0.32; armR.add(armRElbow);
  armRElbow.add(put(orb(0.21, suit), 0, 0, 0));
  armRElbow.add(put(cyl(0.21, 0.18, 0.58, suit), 0, -0.29, 0));
  armRElbow.add(put(orb(0.31, mat(SKIN, { flat: true }), 1, 0.9, 1.1), 0, -0.6, 0.08));    // grip hand

  // wrecking ball assembly — hangs from the grip hand (on the forearm), hauled up
  // for a slam. Lit brighter so it reads as the signature weapon.
  const ballPivot = new THREE.Group();
  ballPivot.position.set(-0.15, -0.58, 0.5);
  armRElbow.add(ballPivot);
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

// THE HEALTH INSPECTOR — the zoner (2D BOSSES[1]). Trim, clinical, white coat,
// clipboard raised like a gavel; every attack is a marked circle or a fan of
// violation notices. Same form vocabulary, opposite silhouette to Vince.
export function buildInspector() {
  const g = new THREE.Group();
  const lean = new THREE.Group(); g.add(lean);
  const cyl = (rt, rb, h, material, seg = 10) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material); m.castShadow = true; return m; };
  const orb = (r, material, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), material); m.scale.set(sx, sy, sz); m.castShadow = true; return m; };

  const coat = mat(0xe9e5d8, { flat: true, rough: 0.8 });
  const slacks = mat(0x39404a, { flat: true, rough: 0.85 });
  const skinM = mat(0x8a5636, { flat: true, rough: 0.7 });

  // legs — long, precise, planted narrow
  for (const sx of [-0.3, 0.3]) {
    const hip = new THREE.Group(); hip.position.set(sx, 1.48, 0); hip.rotation.x = 0.04; lean.add(hip);
    hip.add(put(orb(0.21, slacks, 1, 0.9, 1), 0, 0, 0));
    hip.add(put(cyl(0.2, 0.16, 0.7, slacks), 0, -0.35, 0));
    const knee = new THREE.Group(); knee.position.y = -0.7; knee.rotation.x = -0.08; hip.add(knee);
    knee.add(put(orb(0.16, slacks), 0, 0, 0));
    knee.add(put(cyl(0.16, 0.13, 0.66, slacks), 0, -0.33, 0));
    knee.add(put(box(0.26, 0.16, 0.5, mat(0x14161a, { flat: true, rough: 0.5 })), 0, -0.68, 0.08));
  }

  // torso — a buttoned white coat, trim taper, squared little shoulders
  const belly = new THREE.Group(); belly.position.y = 2.0; lean.add(belly);
  const core = cyl(0.52, 0.4, 1.35, coat, 12); core.scale.z = 0.6; belly.add(put(core, 0, 0.1, 0));
  belly.add(put(orb(0.24, coat, 1, 0.8, 0.9), -0.5, 0.68, 0));
  belly.add(put(orb(0.24, coat, 1, 0.8, 0.9), 0.5, 0.68, 0));
  for (let i = 0; i < 4; i++) belly.add(put(box(0.06, 0.06, 0.03, mat(0x8a8578, { flat: true })), 0, 0.55 - i * 0.3, 0.33));
  belly.add(put(box(0.34, 0.1, 0.06, mat(0xf7f3ea, { rough: 0.6 })), 0, 0.72, 0.26));   // collar

  // head — small skull, tight bun, thin glasses over cold green eyes
  const head = new THREE.Group(); head.position.set(0, 3.15, 0.03); lean.add(head);
  head.add(put(cyl(0.14, 0.17, 0.3, skinM, 8), 0, -0.28, 0));
  head.add(put(orb(0.32, skinM, 0.95, 1, 0.95), 0, 0, 0));
  head.add(put(orb(0.34, mat(0x241b12, { flat: true, rough: 0.9 }), 1, 0.9, 0.95), 0, 0.06, -0.07));  // hair sweep
  head.add(put(orb(0.16, mat(0x241b12, { flat: true, rough: 0.9 })), 0, 0.3, -0.22));                  // the bun
  const eyeMat = mat(0x6aff86, { emissive: 0x6aff86, emi: 2.2 });
  head.add(put(box(0.11, 0.07, 0.05, eyeMat), -0.12, 0.03, 0.28));
  head.add(put(box(0.11, 0.07, 0.05, eyeMat), 0.12, 0.03, 0.28));
  const rim = mat(0x14161a, { flat: true });
  head.add(put(box(0.15, 0.11, 0.02, rim), -0.12, 0.03, 0.31));     // glasses frames
  head.add(put(box(0.15, 0.11, 0.02, rim), 0.12, 0.03, 0.31));
  head.add(put(box(0.09, 0.03, 0.02, rim), 0, 0.05, 0.31));         // the bridge
  head.add(put(box(0.22, 0.04, 0.04, mat(0x3a2418, { flat: true })), 0, -0.18, 0.28));  // a flat, unimpressed mouth

  // arms — slim; the RIGHT hand raises the clipboard like a sentence
  const armL = new THREE.Group(); armL.position.set(-0.58, 0.62, 0); belly.add(armL);
  armL.add(put(cyl(0.13, 0.11, 0.5, coat), 0, -0.25, 0));
  const armLElbow = new THREE.Group(); armLElbow.position.y = -0.5; armLElbow.rotation.x = 0.35; armL.add(armLElbow);
  armLElbow.add(put(orb(0.11, coat), 0, 0, 0));
  armLElbow.add(put(cyl(0.1, 0.09, 0.44, coat), 0, -0.22, 0));
  armLElbow.add(put(orb(0.13, skinM), 0, -0.48, 0.03));
  const armR = new THREE.Group(); armR.position.set(0.58, 0.62, 0); belly.add(armR);
  armR.add(put(cyl(0.13, 0.11, 0.5, coat), 0, -0.25, 0));
  const armRElbow = new THREE.Group(); armRElbow.position.y = -0.5; armRElbow.rotation.x = 0.5; armR.add(armRElbow);
  armRElbow.add(put(orb(0.11, coat), 0, 0, 0));
  armRElbow.add(put(cyl(0.1, 0.09, 0.44, coat), 0, -0.22, 0));
  armRElbow.add(put(orb(0.13, skinM), 0, -0.48, 0.03));
  // the clipboard — her signature prop, gripped in the right hand
  const board = new THREE.Group(); board.position.set(0, -0.52, 0.14); board.rotation.x = -0.5; armRElbow.add(board);
  board.add(put(box(0.4, 0.55, 0.04, mat(0x8a6a42, { flat: true, rough: 0.8 })), 0, 0, 0));
  board.add(put(box(0.32, 0.44, 0.02, mat(0xf2efe0, { rough: 0.9 })), 0, -0.02, 0.03));
  board.add(put(box(0.14, 0.06, 0.06, mat(0x6b7078, { metal: 0.8, rough: 0.4, flat: true })), 0, 0.24, 0.03));

  // condemnation uplight — flares green during a telegraph
  const rageLight = new THREE.PointLight(0x3aff5a, 0, 9, 2);
  rageLight.position.set(0, 1.8, 1.2);
  lean.add(rageLight);

  g.userData = { lean, belly, head, armL, armR, eyeMat, rageLight, suitMats: [coat, slacks], ballPivot: null, ball: null };
  return g;
}

// CHEF BRUNO "THE RINGER" — the trickster (2D BOSSES[2]). A rival chef built
// like a prizefighter: whites, neckerchief, tall toque, a mustache you can read
// at range. No props — his hands are the weapon, and his tells lie.
export function buildBruno() {
  const g = new THREE.Group();
  const lean = new THREE.Group(); g.add(lean);
  const cyl = (rt, rb, h, material, seg = 10) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material); m.castShadow = true; return m; };
  const orb = (r, material, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), material); m.scale.set(sx, sy, sz); m.castShadow = true; return m; };

  const whites = mat(0xf0ece0, { flat: true, rough: 0.75 });
  const check = mat(0x2e3038, { flat: true, rough: 0.85 });
  const skinM = mat(0x9a6440, { flat: true, rough: 0.7 });

  // legs — a boxer's base, wide and springy
  for (const sx of [-0.42, 0.42]) {
    const hip = new THREE.Group(); hip.position.set(sx, 1.1, 0); hip.rotation.x = 0.1; lean.add(hip);
    hip.add(put(orb(0.28, check, 1, 0.9, 1), 0, 0, 0));
    hip.add(put(cyl(0.27, 0.23, 0.52, check), 0, -0.26, 0));
    const knee = new THREE.Group(); knee.position.y = -0.52; knee.rotation.x = -0.18; hip.add(knee);
    knee.add(put(orb(0.22, check), 0, 0, 0));
    knee.add(put(cyl(0.22, 0.19, 0.5, check), 0, -0.25, 0));
    knee.add(put(box(0.42, 0.2, 0.6, mat(0x0d0e12, { flat: true, rough: 0.6 })), 0, -0.48, 0.08));
  }

  // torso — the double-breasted whites over a fighter's barrel
  const belly = new THREE.Group(); belly.position.y = 1.45; lean.add(belly);
  const core = cyl(0.82, 0.68, 1.4, whites, 12); core.scale.z = 0.66; belly.add(put(core, 0, 0.1, 0));
  belly.add(put(orb(0.4, whites, 1, 0.8, 0.9), -0.78, 0.75, 0));
  belly.add(put(orb(0.4, whites, 1, 0.8, 0.9), 0.78, 0.75, 0));
  belly.add(put(orb(0.52, whites, 1.3, 0.5, 0.85), 0, 0.85, 0));
  for (const sx of [-0.18, 0.18]) for (let i = 0; i < 3; i++)
    belly.add(put(box(0.07, 0.07, 0.03, mat(0xc9c2b2, { flat: true })), sx, 0.5 - i * 0.32, 0.5));
  belly.add(put(box(0.5, 0.2, 0.08, mat(0xc0392b, { flat: true, rough: 0.7 })), 0, 0.82, 0.42));   // neckerchief

  // head — heavy jaw, THE mustache, amber eyes under a low brow
  const head = new THREE.Group(); head.position.set(0, 2.75, 0.05); lean.add(head);
  head.add(put(cyl(0.2, 0.24, 0.34, skinM, 8), 0, -0.36, 0));
  head.add(put(orb(0.38, skinM, 1, 0.92, 0.96), 0, 0, 0));
  head.add(put(orb(0.3, skinM, 1.25, 0.55, 1), 0, -0.24, 0.02));                       // jaw
  const eyeMat = mat(0xffb02a, { emissive: 0xffb02a, emi: 2.2 });
  head.add(put(box(0.13, 0.08, 0.05, eyeMat), -0.15, 0.05, 0.33));
  head.add(put(box(0.13, 0.08, 0.05, eyeMat), 0.15, 0.05, 0.33));
  head.add(put(box(0.6, 0.12, 0.12, skinM), 0, 0.16, 0.28));                            // brow shelf
  const mo = mat(0x2a1c12, { flat: true, rough: 0.9 });
  const moL = put(orb(0.14, mo, 1.4, 0.55, 0.7), -0.14, -0.12, 0.34); moL.rotation.z = 0.35; head.add(moL);
  const moR = put(orb(0.14, mo, 1.4, 0.55, 0.7), 0.14, -0.12, 0.34); moR.rotation.z = -0.35; head.add(moR);
  // the toque — tall, banded, unmistakably a chef even mid-uppercut
  const hat = new THREE.Group(); hat.position.y = 0.3; head.add(hat);
  hat.add(put(cyl(0.3, 0.32, 0.16, whites, 12), 0, 0.06, 0));
  const puffT = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), whites);
  puffT.castShadow = true; puffT.scale.set(1, 0.95, 1); puffT.position.y = 0.34; hat.add(puffT);
  hat.add(put(orb(0.18, whites), -0.16, 0.44, 0.05));
  hat.add(put(orb(0.18, whites), 0.17, 0.42, -0.06));

  // arms — thick, held in a half-guard even at rest; bare forearms, taped fists
  const armL = new THREE.Group(); armL.position.set(-0.92, 0.72, 0.05); belly.add(armL);
  armL.add(put(orb(0.22, whites, 1, 0.9, 1), 0, 0, 0));
  armL.add(put(cyl(0.21, 0.17, 0.52, whites), 0, -0.26, 0));
  const armLElbow = new THREE.Group(); armLElbow.position.y = -0.52; armLElbow.rotation.x = 0.9; armL.add(armLElbow);
  armLElbow.add(put(orb(0.17, skinM), 0, 0, 0));
  armLElbow.add(put(cyl(0.16, 0.14, 0.46, skinM), 0, -0.23, 0));
  armLElbow.add(put(orb(0.24, mat(0xd9d2c2, { flat: true, rough: 0.8 }), 1, 0.9, 1.1), 0, -0.5, 0.05));
  const armR = new THREE.Group(); armR.position.set(0.92, 0.72, 0.05); belly.add(armR);
  armR.add(put(orb(0.22, whites, 1, 0.9, 1), 0, 0, 0));
  armR.add(put(cyl(0.21, 0.17, 0.52, whites), 0, -0.26, 0));
  const armRElbow = new THREE.Group(); armRElbow.position.y = -0.52; armRElbow.rotation.x = 0.9; armR.add(armRElbow);
  armRElbow.add(put(orb(0.17, skinM), 0, 0, 0));
  armRElbow.add(put(cyl(0.16, 0.14, 0.46, skinM), 0, -0.23, 0));
  armRElbow.add(put(orb(0.24, mat(0xd9d2c2, { flat: true, rough: 0.8 }), 1, 0.9, 1.1), 0, -0.5, 0.05));

  const rageLight = new THREE.PointLight(0xff8a12, 0, 9, 2);
  rageLight.position.set(0, 1.6, 1.2);
  lean.add(rageLight);

  g.userData = { lean, belly, head, hat, armL, armR, eyeMat, rageLight, suitMats: [whites, check], ballPivot: null, ball: null };
  return g;
}

// --- attack roster (3D-tuned port of the 2D Vince, docs/BOSS_SHOP_SPEC + BOSSES[]) ---
// Same design: telegraph -> strike -> recover, every attack resolves into an opening.
// HP-gated rotations pick the moveset; phase only shortens WINDUP, never the recover
// (the strike window), so landing an opening is never punished harder.
const PHASE_TEMPO = { 1: 1, 2: 0.85, 3: 0.68 };
const ATK = {
  charge: { wu: 0.62, dash: 0.34, speed: 15, hitR: 1.7, dmg: 1, col: 0xffb14a },
  dcharge: { wu: 0.5, dash: 0.26, speed: 17, hitR: 1.6, dmg: 1, col: 0xffb14a, reps: 2 },
  pound: { wu: 0.9, strike: 0.36, r: 3.0, dmg: 1, col: 0xff7a3a },
  stomp: { wu: 0.5, strike: 0.3, r: 3.4, dmg: 1, col: 0xff9a3a },
  paper: { wu: 0.66, strike: 0.24, dmg: 1, col: 0xffd24a },
  grab: { wu: 0.36, strike: 0.28, r: 2.2, dmg: 2, col: 0xff4a4a },
  wreckingball: { wu: 1.4, strike: 0.44, r: 6.0, dmg: 2, col: 0xff3020 },
  // --- the Inspector's zoner kit (2D BOSSES[1]) ---
  citation:  { wu: 0.7, strike: 0.34, r: 2.1, dmg: 1, col: 0x8ae27a },              // a circle frozen at YOUR spot
  zones:     { wu: 1.0, strike: 0.36, r: 1.8, dmg: 1, col: 0x8ae27a, n: 3, spreadR: 2.6 },  // find the gap
  spread:    { wu: 0.66, strike: 0.3, dmg: 1, col: 0xd2ff4a, n: 3, fan: 0.5 },      // a fan of violation notices
  condemned: { wu: 1.5, strike: 0.44, r: 5.4, dmg: 2, col: 0xff3020 },              // stage 3: room-covering
  // --- Bruno's trickster kit (2D BOSSES[2]): the tells lie ---
  feint:     { wu: 0.5, strike: 0.22, r: 2.0, dmg: 0, col: 0xffb14a },              // same telegraph as jab. nothing comes.
  jab:       { wu: 0.5, strike: 0.22, r: 2.0, dmg: 1, col: 0xffb14a },
  combo:     { wu: 0.55, strike: 0.26, r: 2.1, dmg: 1, col: 0xff7a3a, reps: 2 },    // deliberate gap before hit 2
  counter:   { wu: 0.4, strike: 1.3, r: 2.4, dmg: 1, col: 0x4ad2ff },               // a SUSTAINED stance — punch it, get hit
  haymaker:  { wu: 1.15, strike: 0.3, r: 2.6, dmg: 2, col: 0xff3020 },              // stage 3 finisher
};
const ARENA_R = 7.4;

// The roster (2D BOSSES[], ported): who you meet on rent night rotates with
// every boss you've already put down. Each entry is model + moveset + voice.
export const ROSTER = ['vince', 'inspector', 'bruno'];
export const BOSS_DEFS = {
  vince: {
    build: buildVince, hp: 28, approach: 1.3, near: 3, grab: true, reward: 0,
    rot: {
      1: ['charge', 'pound', 'paper', 'stomp', 'dcharge'],
      2: ['stomp', 'dcharge', 'charge', 'pound', 'paper'],
      3: ['dcharge', 'stomp', 'wreckingball'],
    },
    h1: 'VINCE', kicker: 'EVICTION NIGHT', name: 'VINCE', sub: 'YOUR LANDLORD', cta: 'Face him',
    blurb: 'Your landlord came to collect — with a wrecking ball. Stay off his slam, punch on the openings, and knock him down before he levels the place.',
    ko: 'VINCE IS DOWN', lose: 'EVICTED',
  },
  inspector: {
    build: buildInspector, hp: 26, approach: 1.0, near: 5.2, grab: false, reward: 40,
    rot: {
      1: ['citation', 'zones', 'spread'],
      2: ['zones', 'spread', 'citation'],
      3: ['spread', 'zones', 'condemned'],
    },
    h1: 'THE INSPECTOR', kicker: 'INSPECTION NIGHT', name: 'THE INSPECTOR', sub: 'HEALTH DEPARTMENT', cta: 'Face her',
    blurb: "The Health Inspector doesn't brawl — she CONDEMNS. Circles close over the floor, citations fly in fans; stand in nothing, and make her openings hurt.",
    ko: 'INSPECTION FAILED — BY HER', lose: 'CONDEMNED',
  },
  bruno: {
    build: buildBruno, hp: 30, approach: 1.8, near: 2.3, grab: false, reward: 60,
    rot: {
      1: ['feint', 'jab', 'combo'],
      2: ['combo', 'counter', 'jab', 'feint'],
      3: ['counter', 'combo', 'haymaker'],
    },
    h1: 'CHEF BRUNO', kicker: 'CHALLENGE NIGHT', name: 'CHEF BRUNO', sub: 'THE RINGER', cta: 'Face him',
    blurb: "You're not the only one who can throw hands. Bruno's feint and his jab share one telegraph, his counter stance punishes a thrown punch — this fight tests your TIMING.",
    ko: 'BRUNO IS OUT COLD', lose: 'OUT-COOKED',
  },
};

export function createBoss(scene, bossId = 'vince') {
  const def = BOSS_DEFS[bossId] || BOSS_DEFS.vince;
  const ROT = def.rot;
  const mesh = def.build();
  scene.add(mesh);
  const u = mesh.userData;

  const b = {
    mesh, u, def, id: bossId,
    pos: new THREE.Vector3(0, 0, -5.5),
    hp: def.hp, maxHp: def.hp,
    state: 'idle', t: 0, gap: 1.4,
    hurtT: 0, recoilZ: 0,
    telegraph: 0,
    atk: null, cycle: 0, struck: false, reps: 0,
    countering: false,             // Bruno's stance: a landed punch fires back
    zones: [],                     // the Inspector's marked circles
    target: new THREE.Vector3(),   // remembered slam spot / charge destination
    dir: new THREE.Vector3(),
    dead: false, winT: 0,
  };
  mesh.position.copy(b.pos);

  b.phase = () => (b.hp <= b.maxHp * 0.33 ? 3 : b.hp <= b.maxHp * 0.66 ? 2 : 1);

  b.hit = (w) => {
    if (b.dead) return;
    b.hp = Math.max(0, b.hp - w);
    b.hurtT = 0.16;
    b.recoilZ = Math.min(0.5, 0.14 * w);
    if (b.hp <= 0 && !b.dead) { b.dead = true; b.state = 'dead'; b.t = 0; b.telegraph = 0; }
  };

  // pick the next attack: grab preempts if the chef is hugging him (Vince only);
  // else the phase rotation.
  function chooseAttack(ctx) {
    const ph = b.phase();
    const hug = def.grab && Math.hypot(ctx.chefPos.x - b.pos.x, ctx.chefPos.z - b.pos.z) < ATK.grab.r * 0.95;
    const type = hug ? 'grab' : ROT[ph][b.cycle++ % ROT[ph].length];
    b.atk = { type, ...ATK[type] };
    b.reps = b.atk.reps || 1;
    b.struck = false;
    b.countering = false;
    // remember the target NOW for slams/citations (dodge = leave the spot),
    // and aim for charges & thrown paper
    b.target.set(ctx.chefPos.x, 0, ctx.chefPos.z);
    if (type === 'zones') {
      // ring the marked circles around the chef's side of her — find the gap
      b.zones.length = 0;
      const a0 = Math.atan2(ctx.chefPos.x - b.pos.x, ctx.chefPos.z - b.pos.z);
      for (let i = 0; i < b.atk.n; i++) {
        const a = a0 + (i - (b.atk.n - 1) / 2) * 1.05;
        b.zones.push(new THREE.Vector3(
          b.pos.x + Math.sin(a) * b.atk.spreadR, 0, b.pos.z + Math.cos(a) * b.atk.spreadR));
      }
    }
  }

  // the point just in front of the boss, toward the chef — where a fist lands
  function frontPoint(ctx) {
    const dx = ctx.chefPos.x - b.pos.x, dz = ctx.chefPos.z - b.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    return { x: b.pos.x + (dx / d) * 1.5, z: b.pos.z + (dz / d) * 1.5, nx: dx / d, nz: dz / d };
  }

  b.update = (dt, ctx) => {
    b.t += dt;
    const ph = b.phase();
    const rage = ph === 3 ? 1 : ph === 2 ? 0.4 : 0;

    // face the chef (except while charging, where we face the locked direction)
    let faceX = ctx.chefPos.x - b.pos.x, faceZ = ctx.chefPos.z - b.pos.z;
    if (b.state === 'strike' && (b.atk?.type === 'charge' || b.atk?.type === 'dcharge')) {
      faceX = b.dir.x; faceZ = b.dir.z;
    }
    mesh.rotation.y += (Math.atan2(faceX, faceZ) - mesh.rotation.y) * smooth(dt, b.dead ? 2 : 5);

    // breathing + hurt flash + enrage glow (always)
    const breathe = Math.sin(b.t * 1.7) * 0.03;
    u.belly.scale.y = 1 + breathe; u.belly.scale.x = 1 - breathe * 0.5;
    if (b.hurtT > 0) { b.hurtT -= dt; const f = Math.max(0, b.hurtT / 0.16); u.suitMats.forEach((m) => m.emissive.setRGB(f, f, f)); }
    else u.suitMats.forEach((m) => m.emissive.setScalar(0));
    b.recoilZ *= Math.exp(-10 * dt);
    u.eyeMat.emissiveIntensity = 2.0 + rage * 2.5 + Math.sin(b.t * 8) * rage * 0.6;
    u.rageLight.intensity = lerp(u.rageLight.intensity, b.telegraph * (1.4 + rage * 1.4), smooth(dt, 8));

    if (b.state === 'dead') {
      b.winT += dt;
      u.lean.rotation.x = lerp(u.lean.rotation.x, -Math.PI * 0.42, smooth(dt, 3));
      mesh.position.y = -Math.min(1.0, b.winT * 0.4);
      if (u.ballPivot) u.ballPivot.rotation.x = lerp(u.ballPivot.rotation.x, 1.4, smooth(dt, 4));
      ctx.hud.boss = 0;
      return;
    }

    mesh.position.set(b.pos.x, 0, b.pos.z);

    if (b.state === 'idle' || b.state === 'recover') {
      // approach to this boss's preferred range + neutral pose
      const toX = ctx.chefPos.x - b.pos.x, toZ = ctx.chefPos.z - b.pos.z;
      const d = Math.hypot(toX, toZ) || 1;
      if (d > def.near) { const sp = def.approach * dt; b.pos.x += (toX / d) * sp; b.pos.z += (toZ / d) * sp; }
      if (u.ballPivot) {
        u.ballPivot.rotation.x = lerp(u.ballPivot.rotation.x, Math.sin(b.t * 1.4) * 0.3, smooth(dt, 5));
        u.ballPivot.rotation.z = Math.sin(b.t * 1.1) * 0.1;
      }
      u.lean.rotation.x = lerp(u.lean.rotation.x, -b.recoilZ, smooth(dt, 8));
      u.armR.rotation.x = lerp(u.armR.rotation.x, 0, smooth(dt, 8));
      u.armR.rotation.z = lerp(u.armR.rotation.z, 0, smooth(dt, 8));
      u.armL.rotation.x = lerp(u.armL.rotation.x, 0, smooth(dt, 8));
      b.telegraph = lerp(b.telegraph, 0, smooth(dt, 6));
      if (b.t > b.gap) { chooseAttack(ctx); b.state = 'windup'; b.t = 0; }
    } else if (b.state === 'windup') {
      const wu = b.atk.wu * PHASE_TEMPO[ph];
      const k = clamp01(b.t / wu);
      b.telegraph = k;
      windupPose(b.atk.type, k);
      showTelegraph(b.atk, ctx, k);
      if (b.t >= wu) { b.state = 'strike'; b.t = 0; }
    } else if (b.state === 'strike') {
      const done = doStrike(dt, ctx);
      if (done) {
        if (--b.reps > 0 && (b.atk.type === 'dcharge' || b.atk.type === 'charge' || b.atk.type === 'combo')) {
          // chain the next rep: re-aim + re-wind briefly (combo's deliberate gap)
          b.target.set(ctx.chefPos.x, 0, ctx.chefPos.z); b.struck = false; b.state = 'windup'; b.t = b.atk.wu * PHASE_TEMPO[ph] * 0.45;
        } else {
          b.state = 'recover'; b.t = 0;
          b.gap = 1.15 + Math.random() * 0.4;   // the opening (never tempo-shrunk)
        }
      }
    }

    ctx.hud.boss = b.hp / b.maxHp;
    ctx.hud.enraged = ph === 3;
  };

  // --- pose per attack windup ---
  function windupPose(type, k) {
    if (type === 'pound' || type === 'wreckingball') {
      u.lean.rotation.x = lerp(0, 0.3, easeIn(k)); u.ballPivot.rotation.x = lerp(0.3, -1.8, easeOut(k)); u.armR.rotation.x = lerp(0, -0.7, easeOut(k));
    } else if (type === 'stomp') {
      u.lean.rotation.x = lerp(0, -0.12, easeOut(k)); mesh.position.y = Math.sin(k * Math.PI) * 0.25;
    } else if (type === 'charge' || type === 'dcharge') {
      u.lean.rotation.x = lerp(0, 0.22, easeIn(k)); u.armL.rotation.x = lerp(0, -0.5, k); u.armR.rotation.x = lerp(0, -0.3, k);
    } else if (type === 'paper') {
      u.armL.rotation.x = lerp(0, -1.8, easeOut(k));
    } else if (type === 'grab') {
      u.armL.rotation.x = lerp(0, -1.4, easeOut(k)); u.armR.rotation.x = lerp(0, -1.4, easeOut(k)); u.lean.rotation.x = lerp(0, -0.15, k);
    } else if (type === 'citation' || type === 'zones') {
      u.armR.rotation.x = lerp(0, -2.3, easeOut(k));            // the clipboard rises like a gavel
      u.lean.rotation.x = lerp(0, -0.1, k);
    } else if (type === 'condemned') {
      u.armL.rotation.x = lerp(0, -2.6, easeOut(k)); u.armR.rotation.x = lerp(0, -2.6, easeOut(k));
      u.lean.rotation.x = lerp(0, -0.22, easeIn(k));
    } else if (type === 'spread') {
      u.armR.rotation.x = lerp(0, -1.6, easeOut(k)); u.armR.rotation.z = lerp(0, 0.7, k);
    } else if (type === 'feint' || type === 'jab') {
      // IDENTICAL on purpose — you cannot tell them apart on sight (2D design)
      u.armR.rotation.x = lerp(0, -1.25, easeOut(k)); u.lean.rotation.x = lerp(0, 0.14, k);
    } else if (type === 'combo') {
      u.armL.rotation.x = lerp(0, -1.25, easeOut(k)); u.lean.rotation.x = lerp(0, 0.16, k);
    } else if (type === 'counter') {
      u.armL.rotation.x = lerp(0, -0.95, k); u.armR.rotation.x = lerp(0, -0.95, k);
      u.lean.rotation.x = lerp(0, -0.18, easeOut(k));           // settles back into the stance
    } else if (type === 'haymaker') {
      u.armR.rotation.x = lerp(0, -2.5, easeOut(k)); u.lean.rotation.x = lerp(0, 0.32, easeIn(k));
    }
  }

  // --- telegraph decoration per attack ---
  function showTelegraph(atk, ctx, k) {
    const t = atk.type;
    if (t === 'pound' || t === 'wreckingball') ctx.fx.setDanger(b.target.x, b.target.z, atk.r, k, atk.col);
    else if (t === 'stomp') ctx.fx.setDanger(b.pos.x, b.pos.z, atk.r, k, atk.col);
    else if (t === 'charge' || t === 'dcharge') {
      // lock the lunge direction at 65% of the windup
      if (k < 0.65) b.target.set(ctx.chefPos.x, 0, ctx.chefPos.z);
      ctx.fx.setAim(b.pos.x, b.pos.z, b.target.x, b.target.z, k, 1.0);
    } else if (t === 'paper') ctx.fx.setAim(b.pos.x, b.pos.z, ctx.chefPos.x, ctx.chefPos.z, k * 0.7, 0.4);
    else if (t === 'grab') ctx.fx.setDanger(b.pos.x, b.pos.z, atk.r, k, atk.col);
    else if (t === 'citation') ctx.fx.setDanger(b.target.x, b.target.z, atk.r, k, atk.col);
    else if (t === 'condemned') ctx.fx.setDanger(b.pos.x, b.pos.z, atk.r, k, atk.col);
    else if (t === 'zones') b.zones.forEach((z, i) => ctx.fx.setDanger(z.x, z.z, atk.r, k, atk.col, i));
    else if (t === 'spread') ctx.fx.setAim(b.pos.x, b.pos.z, ctx.chefPos.x, ctx.chefPos.z, k * 0.8, 1.7);
    else if (t === 'feint' || t === 'jab' || t === 'combo' || t === 'haymaker') {
      const f = frontPoint(ctx);
      ctx.fx.setDanger(f.x, f.z, atk.r, k, atk.col);
    }
    // counter: no floor tell — the crossed-arm stance IS the telegraph
  }

  // --- execute a strike; return true when the strike phase is complete ---
  function doStrike(dt, ctx) {
    const a = b.atk, ph = b.phase();
    const k = clamp01(b.t / (a.strike || a.dash));
    if (a.type === 'pound' || a.type === 'wreckingball') {
      u.lean.rotation.x = lerp(0.3, -0.34, easeIn(Math.min(1, k * 1.4)));
      u.ballPivot.rotation.x = lerp(-1.8, 1.5, easeOutBack(k));
      u.armR.rotation.x = lerp(-0.7, 0.5, easeOut(k));
      if (!b.struck && k > 0.55) { b.struck = true; ctx.onGroundStrike(b.target, a.r, a.dmg, a.type === 'wreckingball'); }
      return b.t >= a.strike;
    }
    if (a.type === 'stomp') {
      mesh.position.y = lerp(0.25, 0, easeIn(Math.min(1, k * 1.6)));
      if (!b.struck && k > 0.4) { b.struck = true; ctx.onGroundStrike(b.pos, a.r, a.dmg, false); }
      return b.t >= a.strike;
    }
    if (a.type === 'charge' || a.type === 'dcharge') {
      if (b.t === dt || b.dir.lengthSq() === 0 || k < 0.02) {
        b.dir.set(b.target.x - b.pos.x, 0, b.target.z - b.pos.z);
        if (b.dir.lengthSq() < 0.01) b.dir.set(0, 0, 1); b.dir.normalize();
      }
      const step = a.speed * dt;
      b.pos.x += b.dir.x * step; b.pos.z += b.dir.z * step;
      const rr = Math.hypot(b.pos.x, b.pos.z);
      if (rr > ARENA_R) { b.pos.x *= ARENA_R / rr; b.pos.z *= ARENA_R / rr; }
      u.lean.rotation.x = 0.22;
      if (!b.struck) { if (ctx.resolveStrike(b.pos, a.hitR, a.dmg, b.dir)) b.struck = true; }
      return b.t >= a.dash;
    }
    if (a.type === 'paper') {
      u.armL.rotation.x = lerp(-1.8, 0.4, easeOut(k));
      if (!b.struck && k > 0.35) {
        b.struck = true;
        ctx.fx.spawnPaper(new THREE.Vector3(b.pos.x, 2.2, b.pos.z), ctx.chefPos, a.dmg);
        ctx.sound('whiff');
      }
      return b.t >= a.strike;
    }
    if (a.type === 'grab') {
      u.armL.rotation.x = lerp(-1.4, -0.2, easeOut(k)); u.armR.rotation.x = lerp(-1.4, -0.2, easeOut(k));
      if (!b.struck && k > 0.3) { b.struck = true; ctx.resolveStrike(b.pos, a.r, a.dmg, null, true); }
      return b.t >= a.strike;
    }
    if (a.type === 'citation' || a.type === 'condemned') {
      const self = a.type === 'condemned';
      u.armR.rotation.x = lerp(self ? -2.6 : -2.3, 0.5, easeOut(k));
      if (self) u.armL.rotation.x = lerp(-2.6, 0.5, easeOut(k));
      u.lean.rotation.x = lerp(self ? -0.22 : -0.1, 0.2, easeIn(Math.min(1, k * 1.4)));
      if (!b.struck && k > 0.45) { b.struck = true; ctx.onGroundStrike(self ? b.pos : b.target, a.r, a.dmg, self); }
      return b.t >= a.strike;
    }
    if (a.type === 'zones') {
      u.armR.rotation.x = lerp(-2.3, 0.5, easeOut(k));
      if (!b.struck && k > 0.45) {
        b.struck = true;
        for (const z of b.zones) ctx.onGroundStrike(z, a.r, a.dmg, false);
      }
      return b.t >= a.strike;
    }
    if (a.type === 'spread') {
      u.armR.rotation.x = lerp(-1.6, 0.5, easeOut(k)); u.armR.rotation.z = lerp(0.7, -0.35, k);
      if (!b.struck && k > 0.3) {
        b.struck = true;
        const base = Math.atan2(ctx.chefPos.x - b.pos.x, ctx.chefPos.z - b.pos.z);
        for (let i = 0; i < a.n; i++) {
          const ang = base + (i - (a.n - 1) / 2) * a.fan;
          ctx.fx.spawnPaper(new THREE.Vector3(b.pos.x, 2.4, b.pos.z),
            new THREE.Vector3(b.pos.x + Math.sin(ang) * 9, 0, b.pos.z + Math.cos(ang) * 9), a.dmg);
        }
        ctx.sound('whiff');
      }
      return b.t >= a.strike;
    }
    if (a.type === 'feint') {
      u.armR.rotation.x = lerp(-1.25, -0.5, easeOut(k));   // ...and pulls it back. nothing comes.
      return b.t >= a.strike;
    }
    if (a.type === 'jab' || a.type === 'combo' || a.type === 'haymaker') {
      const arm = a.type === 'combo' ? u.armL : u.armR;
      arm.rotation.x = lerp(a.type === 'haymaker' ? -2.5 : -1.25, 0.6, easeOut(k));
      u.lean.rotation.x = lerp(0.16, a.type === 'haymaker' ? 0.42 : 0.26, easeOut(k));
      if (!b.struck && k > 0.35) {
        b.struck = true;
        const f = frontPoint(ctx);
        ctx.resolveStrike(f, a.r, a.dmg, { x: f.nx, z: f.nz });
        if (a.type === 'haymaker') { ctx.fx.dust(new THREE.Vector3(f.x, 0, f.z), 12); ctx.sound('slam'); }
        else ctx.sound('whiff');
      }
      return b.t >= a.strike;
    }
    if (a.type === 'counter') {
      b.countering = true;                                  // punch him now and HE punches back
      u.armL.rotation.x = -0.95; u.armR.rotation.x = -0.95;
      if (b.t >= a.strike) { b.countering = false; return true; }
      return false;
    }
    return true;
  }

  b.ballWorld = () => { const v = new THREE.Vector3(); (u.ball || mesh).getWorldPosition(v); return v; };
  return b;
}
