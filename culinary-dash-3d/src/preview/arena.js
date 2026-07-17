// The boss arena — an "eviction night" back-alley: a dark concrete floor ringed
// with hazard tape, boarded windows behind Vince, hazard-striped pillars, scattered
// crates, and a caged work-lamp swinging overhead. Dramatic stage lighting with
// real shadows for ground contact. This is deliberately NOT the cozy restaurant —
// the whole point is that a fight reads as a place you've been dragged into.
import * as THREE from 'three';
import { mat, box, put } from './util.js';
import { RIM_LIGHT } from '../engine/quality.js';

export function buildArena(scene, renderer) {
  const g = new THREE.Group();
  scene.add(g);

  // floor — dark poured concrete
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(11, 48),
    new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.95, metalness: 0.0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);

  // subtle grout grid
  const grid = new THREE.GridHelper(22, 22, 0x000000, 0x2a2a33);
  grid.position.y = 0.01;
  grid.material.opacity = 0.35; grid.material.transparent = true;
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

  // back wall behind Vince (a boarded, condemned storefront)
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(12, 12, 9, 32, 1, true, Math.PI * 0.75, Math.PI * 0.5),
    new THREE.MeshStandardMaterial({ color: 0x15151b, roughness: 1, side: THREE.BackSide })
  );
  wall.position.set(0, 4.5, 0);
  g.add(wall);

  // boarded windows + planks
  const plank = mat(0x3b2c1e, { flat: true, rough: 0.9 });
  function boardedWindow(x, z, ry) {
    const w = new THREE.Group(); w.position.set(x, 2.6, z); w.rotation.y = ry;
    w.add(put(box(2.4, 3.0, 0.15, mat(0x0a0a0e)), 0, 0, 0));           // dark pane
    w.add(put(box(2.7, 0.34, 0.25, plank), 0, 0.85, 0.1));             // top plank
    w.add(put(box(2.7, 0.34, 0.25, plank), 0, -0.85, 0.1));            // bottom plank
    const d1 = put(box(3.4, 0.34, 0.24, plank), 0, 0, 0.14); d1.rotation.z = 0.72; w.add(d1);  // boarded X
    const d2 = put(box(3.4, 0.34, 0.24, plank), 0, 0, 0.16); d2.rotation.z = -0.72; w.add(d2);
    g.add(w);
  }
  boardedWindow(-5.2, -7.4, 0.5);
  boardedWindow(5.2, -7.4, -0.5);

  // "CONDEMNED" placard — red, glows a little (bloom)
  const sign = put(box(3.2, 0.7, 0.15, mat(0x7a0f12, { emissive: 0x7a0f12, emi: 0.6 })), 0, 4.6, -8.4);
  g.add(sign);
  for (let i = 0; i < 5; i++) sign.add(put(box(0.32, 0.42, 0.05, mat(0xe8d9b0, { emissive: 0xe8d9b0, emi: 0.3 })), -1.0 + i * 0.5, 0, 0.12));

  // hazard pillars flanking the arena
  const pillarMat = mat(0x24242c, { rough: 0.9, flat: true });
  for (const sx of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(sx * 8.6, 0, -3);
    const col = put(box(0.8, 6, 0.8, pillarMat), 0, 3, 0); col.castShadow = true; p.add(col);
    for (let i = 0; i < 4; i++) p.add(put(box(0.86, 0.4, 0.86, stripeMat), 0, 0.6 + i * 1.3, 0));
    g.add(p);
  }

  // scattered crates
  const crateMat = mat(0x4a3826, { flat: true, rough: 0.95 });
  const crateSpots = [[-6.5, 3, 0.4], [6.8, 2, -0.3], [-7.2, 4.5, 1.1], [7.4, 5.5, 0.2]];
  for (const [x, z, ry] of crateSpots) {
    const s = 0.9 + Math.random() * 0.5;
    const cr = put(box(s, s, s, crateMat), x, s / 2, z); cr.rotation.y = ry; cr.castShadow = true; cr.receiveShadow = true;
    g.add(cr);
    cr.add(put(box(s + 0.02, s * 0.14, s + 0.02, mat(0x2e2216, { flat: true })), 0, 0, 0));
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
