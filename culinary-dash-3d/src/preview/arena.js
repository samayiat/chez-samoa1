// The boss arena — AFTER HOURS AT CHEZ SAMOA. Every boss fight happens inside
// the restaurant now: the dining tables shoved to the walls, chairs up, the
// back counter dark, moonlit ocean in the windows — and a hazard-tape ring
// where the mob cleared the floor. Same room the day is served in, so a fight
// reads as YOUR place being trashed, not a place you were dragged to.
import * as THREE from 'three';
import { mat, box, put } from './util.js';
import { RIM_LIGHT } from '../engine/quality.js';

export function buildArena(scene, renderer) {
  const g = new THREE.Group();
  scene.add(g);

  // floor — the restaurant's plank wood, dark under the night lights
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(11, 48),
    new THREE.MeshStandardMaterial({ color: 0x4a331f, roughness: 0.9, metalness: 0.0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);

  // plank seams
  const grid = new THREE.GridHelper(22, 22, 0x000000, 0x3a2a1c);
  grid.position.y = 0.01;
  grid.material.opacity = 0.3; grid.material.transparent = true;
  g.add(grid);

  // hazard-tape ring border
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(9.2, 0.14, 8, 64),
    mat(0xf6a01f, { emissive: 0xf6a01f, emi: 0.5, rough: 0.5 })
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
  g.add(ring);

  // hazard stripes painted across the floor near the ring
  const stripeMat = mat(0xf6a01f, { emissive: 0xf6a01f, emi: 0.25, rough: 0.7 });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const s = put(box(0.5, 0.02, 0.9, i % 2 ? stripeMat : mat(0x111116)), Math.cos(a) * 9.2, 0.02, Math.sin(a) * 9.2);
    s.rotation.y = -a; s.receiveShadow = false;
    g.add(s);
  }

  // back wall — the restaurant's warm plaster, dark for the night
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(12, 12, 9, 32, 1, true, Math.PI * 0.75, Math.PI * 0.5),
    new THREE.MeshStandardMaterial({ color: 0x2e2118, roughness: 1, side: THREE.BackSide })
  );
  wall.position.set(0, 4.5, 0);
  g.add(wall);

  // the restaurant's windows — moonlit ocean panes with a palm silhouette
  const frame = mat(0x5a3f28, { flat: true, rough: 0.8 });
  function oceanWindow(x, z, ry, palm) {
    const w = new THREE.Group(); w.position.set(x, 2.9, z); w.rotation.y = ry;
    w.add(put(box(3.2, 2.4, 0.14, frame), 0, 0, 0));                                    // frame
    w.add(put(box(2.9, 2.1, 0.06, mat(0x123240, { emissive: 0x16404e, emi: 0.55 })), 0, 0, 0.06));  // night sea
    w.add(put(box(2.9, 0.08, 0.08, mat(0x0c2028, { flat: true })), 0, 0.35, 0.1));      // the horizon line
    w.add(put(box(0.4, 0.06, 0.08, mat(0xcfe8ef, { emissive: 0xcfe8ef, emi: 0.8 })), 0.6, 0.85, 0.1)); // the moon's smear
    w.add(put(box(0.1, 2.1, 0.08, frame), 0, 0, 0.09));                                 // mullion
    if (palm) {
      const trunk = put(box(0.12, 1.1, 0.08, mat(0x0a1a20, { flat: true })), -0.85, -0.4, 0.1);
      trunk.rotation.z = 0.25; w.add(trunk);
      for (let i = 0; i < 4; i++) {
        const fr = put(box(0.7, 0.07, 0.06, mat(0x0a1a20, { flat: true })), -0.65, 0.25, 0.11);
        fr.rotation.z = 0.5 - i * 0.5; w.add(fr);
      }
    }
    g.add(w);
  }
  oceanWindow(-5.2, -7.4, 0.5, true);
  oceanWindow(5.2, -7.4, -0.5, false);

  // the back counter, dark, with the stock pot still on the stove
  {
    const c = new THREE.Group(); c.position.set(0, 0, -8.2); g.add(c);
    c.add(put(box(7.5, 1.15, 0.9, mat(0x5a4028, { rough: 0.85 })), 0, 0.58, 0));
    c.add(put(box(7.7, 0.12, 1.0, mat(0xd8cbb0, { rough: 0.55 })), 0, 1.2, 0));
    c.add(put(box(1.2, 0.5, 0.7, mat(0x3a3f45, { metal: 0.4, rough: 0.6 })), -2.2, 1.5, 0));   // the stove hunched in the dark
    const pot = put(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.4, 12), mat(0x2e3238, { metal: 0.5, rough: 0.5 })), -2.2, 1.95, 0);
    c.add(pot);
    for (let i = 0; i < 5; i++)
      c.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.36, 8), mat(0x7a4e2e, { rough: 0.4, emissive: 0x2a1408, emi: 0.5 })), 1.2 + i * 0.42, 1.55, -0.15));  // the bar's bottles
  }

  // "CONDEMNED" placard — red, glows a little (bloom)
  const sign = put(box(3.2, 0.7, 0.15, mat(0x7a0f12, { emissive: 0x7a0f12, emi: 0.6 })), 0, 4.6, -8.4);
  g.add(sign);
  for (let i = 0; i < 5; i++) sign.add(put(box(0.32, 0.42, 0.05, mat(0xe8d9b0, { emissive: 0xe8d9b0, emi: 0.3 })), -1.0 + i * 0.5, 0, 0.12));

  // potted palms flanking the floor — the restaurant's own greenery, moonlit
  for (const [sx, sz] of [[-8.6, -3], [8.6, -3]]) {
    const p = new THREE.Group(); p.position.set(sx, 0, sz); g.add(p);
    p.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.85, 10), mat(0x6a3a24, { flat: true, rough: 0.9 })), 0, 0.42, 0));
    const trunk = put(box(0.18, 2.4, 0.18, mat(0x54381e, { flat: true, rough: 0.9 })), 0, 2, 0);
    trunk.rotation.z = sx > 0 ? -0.12 : 0.12; p.add(trunk);
    for (let i = 0; i < 6; i++) {
      const fr = put(box(1.7, 0.1, 0.26, mat(0x1e4a30, { flat: true, rough: 0.85 })), 0, 3.2, 0);
      fr.rotation.y = (i / 6) * Math.PI * 2; fr.rotation.z = 0.42;
      p.add(fr);
    }
  }

  // dining tables shoved to the rim — chairs up, candles out, one knocked over
  const tableWood = mat(0x5a4028, { rough: 0.7, flat: true });
  const tableSpots = [[-6.5, 3.2, 0, false], [6.8, 2.4, 0.4, false], [7.2, 5.6, 0.9, true], [-7.4, 5.2, 0.5, false]];
  for (const [x, z, ry, tipped] of tableSpots) {
    const tb = new THREE.Group(); tb.position.set(x, 0, z); tb.rotation.y = ry; g.add(tb);
    const body = new THREE.Group(); tb.add(body);
    body.add(put(box(0.18, 0.9, 0.18, mat(0x2e2114, { flat: true })), 0, 0.45, 0));
    const top = put(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 16), tableWood), 0, 0.95, 0);
    top.castShadow = true; body.add(top);
    if (tipped) { body.rotation.z = 1.35; body.position.y = 0.35; body.position.x = 0.5; }
    else {
      // chairs stacked seat-down on the tabletop, closing-time style
      body.add(put(box(0.5, 0.1, 0.5, mat(0x3a2c1c, { flat: true })), 0.2, 1.06, 0.1));
      body.add(put(box(0.1, 0.5, 0.5, mat(0x3a2c1c, { flat: true })), 0.42, 1.34, 0.1));
    }
  }

  // ---------- lighting ----------
  const amb = new THREE.HemisphereLight(0x3a3550, 0x0a0a10, 0.55);
  scene.add(amb);

  // key stage light — warm, from above-front, casts the shadows
  const key = new THREE.DirectionalLight(0xffe6b0, 2.1);
  key.position.set(4, 11, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(RIM_LIGHT ? 2048 : 1024, RIM_LIGHT ? 2048 : 1024);
  key.shadow.camera.near = 1; key.shadow.camera.far = 40;
  const S = 13;
  key.shadow.camera.left = -S; key.shadow.camera.right = S;
  key.shadow.camera.top = S; key.shadow.camera.bottom = -S;
  key.shadow.bias = -0.0008; key.shadow.normalBias = 0.02;
  scene.add(key);
  scene.add(key.target);

  // cold rim from behind for silhouette separation
  if (RIM_LIGHT) {
    const rim = new THREE.DirectionalLight(0x5566ff, 0.8);
    rim.position.set(-6, 6, -9);
    scene.add(rim);
  }

  // caged work-lamp swinging overhead — warm point light + a visible bulb/cage
  const lampPivot = new THREE.Group();
  lampPivot.position.set(0, 8.5, -1);
  g.add(lampPivot);
  const cord = put(box(0.04, 3, 0.04, mat(0x111111)), 0, -1.5, 0);
  lampPivot.add(cord);
  const lamp = new THREE.Group(); lamp.position.y = -3; lampPivot.add(lamp);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8), mat(0xfff0c0, { emissive: 0xffd98a, emi: 3 }));
  lamp.add(bulb);
  const cage = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 6, 12), mat(0x222, { metal: 0.6 }));
  lamp.add(cage);
  const cage2 = cage.clone(); cage2.rotation.x = Math.PI / 2; lamp.add(cage2);
  const lampLight = new THREE.PointLight(0xffdd9e, 30, 16, 2);
  lamp.add(lampLight);

  // floating dust motes
  const moteN = 120;
  const mp = new Float32Array(moteN * 3);
  for (let i = 0; i < moteN; i++) {
    mp[i * 3] = (Math.random() - 0.5) * 18;
    mp[i * 3 + 1] = Math.random() * 7 + 0.3;
    mp[i * 3 + 2] = (Math.random() - 0.5) * 18;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: 0xffe9c7, size: 0.05, transparent: true, opacity: 0.5, depthWrite: false }));
  g.add(motes);

  return {
    update(dt, t) {
      lampPivot.rotation.z = Math.sin(t * 0.9) * 0.12;
      lampPivot.rotation.x = Math.cos(t * 0.7) * 0.08;
      motes.rotation.y = t * 0.02;
      const arr = moteGeo.attributes.position.array;
      for (let i = 0; i < moteN; i++) {
        arr[i * 3 + 1] += dt * 0.15 * ((i % 3) - 1);
        if (arr[i * 3 + 1] > 7.5) arr[i * 3 + 1] = 0.3;
        if (arr[i * 3 + 1] < 0.3) arr[i * 3 + 1] = 7.5;
      }
      moteGeo.attributes.position.needsUpdate = true;
    },
    key,
  };
}
