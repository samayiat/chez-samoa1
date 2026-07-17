// Placeholder 3D geometry. Deliberately primitive (boxes/capsules/cylinders)
// with flat toon-ish materials — enough to prove the game in 3D and stay
// readable, while keeping the door open to swap in modelled glTF assets later.
// A thin dark outline via inverted-hull backfaces preserves the 2D game's
// "subtle 1px outline" Habbo look.

import * as THREE from 'three';
import { STATIONS, TABLES, PASS, WORLD, to3, len2 } from '../sim/data.js';

const STATION_COLOR = {
  fryer: 0xd8862e, salad: 0x4caf50, icebox: 0x8fd3ff,
  pot: 0xb0563a, bar: 0x9a6cff,
};

function outlined(geo, color, outline = 0x1a1420) {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color }));
  const hull = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: outline, side: THREE.BackSide })
  );
  hull.scale.multiplyScalar(1.06);
  g.add(mesh, hull);
  return g;
}

export function buildWorld(scene) {
  // --- floor ---
  const floorW = len2(WORLD.w), floorD = len2(WORLD.h);
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(floorW, 0.5, floorD),
    new THREE.MeshToonMaterial({ color: 0x2a2233 })
  );
  floor.position.set(0, -0.25, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  // --- back counter wall (behind the stations, at z for y=40) ---
  const back = to3(0, 22);
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(floorW, 4, 1),
    new THREE.MeshToonMaterial({ color: 0x1d1826 })
  );
  wall.position.set(0, 2, back.z);
  scene.add(wall);

  // --- stations ---
  const stationMeshes = {};
  for (const s of STATIONS) {
    const p = to3(s.x, s.y);
    const box = outlined(new THREE.BoxGeometry(1.8, 1.6, 1.4), STATION_COLOR[s.id] ?? 0x888888);
    box.position.set(p.x, 0.8, p.z);
    box.userData.id = s.id;
    scene.add(box);
    stationMeshes[s.id] = box;
  }

  // --- dining tables ---
  const tableMeshes = {};
  for (const t of TABLES) {
    const p = to3(t.x, t.y);
    const tbl = outlined(new THREE.CylinderGeometry(0.9, 0.9, 1.0, 16), 0x6b4a2f);
    tbl.position.set(p.x, 0.5, p.z);
    scene.add(tbl);
    tableMeshes[t.id] = tbl;
  }

  // --- pass (plated-dish counter) ---
  const pp = to3(PASS.x, PASS.y);
  const pass = new THREE.Mesh(
    new THREE.BoxGeometry(6, 0.4, 1.2),
    new THREE.MeshToonMaterial({ color: 0xece0c8 })
  );
  pass.position.set(pp.x, 0.4, pp.z);
  scene.add(pass);

  return { stationMeshes, tableMeshes };
}

export function buildChef(scene) {
  const g = new THREE.Group();

  const body = outlined(new THREE.CapsuleGeometry(0.7, 1.1, 6, 12), 0x3a2f5c);
  body.position.y = 1.2;
  g.add(body);

  // white chef hat (a nod to the character)
  const hat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.6, 0.6, 12),
    new THREE.MeshToonMaterial({ color: 0xf5f5f0 })
  );
  hat.position.y = 2.3;
  g.add(hat);

  // facing indicator (a little nose) so rotation reads even on a capsule
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.6, 8),
    new THREE.MeshToonMaterial({ color: 0xffcf9e })
  );
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.3, 0.8);
  g.add(nose);

  // carried-dish marker (hidden until carrying)
  const carry = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 12),
    new THREE.MeshToonMaterial({ color: 0xffd24a })
  );
  carry.position.set(0, 2.0, 0.7);
  carry.visible = false;
  g.add(carry);
  g.userData.carry = carry;

  scene.add(g);
  return g;
}

export function addLights(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const key = new THREE.DirectionalLight(0xffe9c7, 1.1);
  key.position.set(6, 18, 10);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6a8cff, 0.35);
  rim.position.set(-8, 6, -10);
  scene.add(rim);
}
