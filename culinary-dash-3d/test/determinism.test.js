// Determinism harness — the 3D port of the 2D game's lockstep guarantee
// (docs/tools/determinism.js). Two sims with the SAME seed fed the SAME scripted
// inputs must stay byte-identical frame for frame. This is what keeps the parked
// lockstep-coop goal alive: send inputs, let both machines simulate, and floats
// agree because nothing in the sim reads a wall clock or Math.random.

import { describe, it, expect } from 'vitest';
import { createState, stepSim } from '../src/sim/state.js';
import { startBrawl } from '../src/sim/combat.js';

const STEP = 1 / 60;

// A deterministic input script: sweep the stick around and press on a cadence.
function scriptedInput(i) {
  const a = i * 0.03;
  const x = Math.sin(a), y = Math.cos(a * 0.7);
  const press = i % 25 === 0;
  return { move: { x, y }, primary: press, primaryDown: press, secondary: false, secondaryDown: false };
}

// Order-stable snapshot of everything the sim owns. Floats are stringified, so
// equality is bit-exact — one ulp of drift fails the test.
function snap(s) {
  const c = s.chef;
  return JSON.stringify({
    t: s.t, phase: s.phase, money: s.money, served: s.served, bad: s.badOrders,
    chef: [c.x, c.y, c.facing, c.hp ?? null, c.carrying?.dish ?? null, c.comboIdx ?? null],
    cust: (s.customers || []).map((k) => [k.id, k.x, k.y, k.dish, k.hearts, k.state]),
    enemy: (s.enemies || []).map((e) => [e.id, e.x, e.y, e.hp, e.kx, e.ky]),
  });
}

describe('determinism', () => {
  it('two sims with the same seed + inputs stay byte-identical (service + brawl)', () => {
    const a = createState(2026);
    const b = createState(2026);
    const start = snap(a);
    let diverged = -1;
    let sawBrawl = false;

    for (let i = 0; i < 2400; i++) {
      if (a.phase === 'brawl') sawBrawl = true;
      const inA = scriptedInput(i);
      const inB = scriptedInput(i);
      // trigger the brawl on both at the identical frame (rng consumed in step)
      if (i === 800) { startBrawl(a, 4); startBrawl(b, 4); }
      stepSim(a, STEP, inA);
      stepSim(b, STEP, inB);
      if (snap(a) !== snap(b)) { diverged = i; break; }
    }

    expect(diverged).toBe(-1);
    // and prove the run actually exercised things (not a trivial pass)
    expect(a.t).toBeGreaterThan(30);
    expect(sawBrawl).toBe(true);          // the brawl ran under lockstep
    expect(snap(a)).not.toBe(start);      // state genuinely evolved
  });

  it('a different seed produces a different history (RNG is actually used)', () => {
    const a = createState(1);
    const b = createState(2);
    for (let i = 0; i < 600; i++) {
      const inp = scriptedInput(i);
      stepSim(a, STEP, { ...inp });
      stepSim(b, STEP, { ...inp });
    }
    expect(snap(a)).not.toBe(snap(b));
  });
});
