// Fixed-perspective "diorama" camera.
// This deliberately REPLACES the 2D game's hand-tuned camera-crop subsystem
// (lean-not-follow, combat-zoom safety-floor, pan-clamp) — all of which existed
// only to work around a floor baked at exactly WxH with no bleed. A real 3D
// camera makes that whole problem vanish: we sit at a fixed angle that frames
// the entire room, and never follow. The impact spine's shake/kick are applied
// as small offsets on top, on the real clock.

import * as THREE from 'three';

export function createCamera(aspect) {
  const cam = new THREE.PerspectiveCamera(38, aspect, 0.1, 200);
  // fixed diorama pose: up and back, looking down at the room centre
  cam.position.set(0, 24, 22);
  cam.lookAt(0, 0, -1);
  return cam;
}

const base = new THREE.Vector3(0, 24, 22);
const target = new THREE.Vector3(0, 0, -1);

// Apply impact shake/kick each render frame (real clock). `t` is a monotonic
// seconds value used only for the shake oscillation — never touches the sim.
export function updateCamera(cam, bus, t) {
  const s = bus.shake * 0.03; // px-scale shake -> world units
  const ox = Math.sin(t * 53.0) * s + bus.kickX * 0.04;
  const oy = Math.cos(t * 61.0) * s * 0.6;
  const oz = bus.kickY * 0.04;
  cam.position.set(base.x + ox, base.y + oy, base.z + oz);
  cam.lookAt(target.x + ox * 0.5, target.y, target.z + oz * 0.5);
}

export function resizeCamera(cam, aspect) {
  cam.aspect = aspect;
  cam.updateProjectionMatrix();
}
