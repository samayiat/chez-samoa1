// The impact spine — ported architecture from the 2D game's crown-jewel system
// (docs/DECISIONS.md: "One weight, every channel"). Every blow is ONE ranked
// scalar weight; that single number drives shake, hitstop, camera-kick, sparks,
// sound and haptics. Call sites never hand-tune individual channels — they give
// a weight, and the channels follow. That discipline is exactly what kept the
// 2D feedback from inverting (the biggest move becoming the quietest).
//
// Crucially, hitstop lives OUT here, not in the sim: it freezes the simulation
// but the CAMERA keeps animating on the real clock (the documented trap — a
// frozen sim must not freeze the zoom/shake or you get a dead frame).

import { COMBAT } from '../sim/data.js';

export function createImpactBus() {
  return {
    shake: 0,        // current shake magnitude (decays)
    hitstop: 0,      // seconds of remaining sim freeze
    kickX: 0, kickY: 0, // directional camera kick (decays)
    sparks: [],      // {x,y,z,dx,dy,dz,life} spawned per blow, drained by fx
    onSound: null,   // hook: (weight) => void
    onHaptic: null,  // hook: (weight) => void
  };
}

// Register a blow of ranked weight `w` at world point (x,y,z), knocked toward
// (dx,dz). Every channel derives from `w` — never pass per-channel values.
export function impact(bus, w, x, y, z, dx = 0, dz = 0) {
  bus.shake = Math.min(bus.shake + COMBAT.SHAKE_PER_W * w, COMBAT.SHAKE_MAX);
  bus.hitstop = Math.min(bus.hitstop + COMBAT.STOP_PER_W * w, COMBAT.STOP_MAX);
  const kick = 0.12 * w;
  bus.kickX += dx * kick;
  bus.kickY += dz * kick;
  for (let i = 0; i < Math.round(4 + w * 6); i++) {
    bus.sparks.push({ x, y, z, dx, dz, w, life: 0.35 });
  }
  if (bus.onSound) bus.onSound(w);
  if (bus.onHaptic) bus.onHaptic(w);
}

// Advance decaying channels on the REAL clock (never the sim step).
export function decayImpact(bus, rdt) {
  if (bus.shake > 0) {
    bus.shake -= COMBAT.SHAKE_DECAY * rdt;
    if (bus.shake < 0) bus.shake = 0;
  }
  const k = Math.exp(-14 * rdt);
  bus.kickX *= k; bus.kickY *= k;
  if (bus.hitstop > 0) bus.hitstop = Math.max(0, bus.hitstop - rdt);
}
