import { describe, it, expect, beforeEach } from 'vitest';
import { createState, stepSim } from '../src/sim/state.js';
import { STEP } from '../src/engine/loop.js';
import { STATIONS, TABLES } from '../src/sim/data.js';

const NO = { move: { x: 0, y: 0 }, primary: false, primaryDown: false, secondary: false, secondaryDown: false };
const PRESS = { ...NO, primary: true, primaryDown: true };

// step helpers -------------------------------------------------------------
function idle(state, seconds) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) stepSim(state, STEP, NO);
}
function teleport(state, id, isTable) {
  const s = (isTable ? TABLES : STATIONS).find((o) => o.id === id);
  state.chef.x = s.x; state.chef.y = s.y;
  stepSim(state, STEP, NO); // refresh nearStation + resolve out of the solid
}
function press(state) { stepSim(state, STEP, PRESS); }

// a single controlled customer wanting `dish`, seated at t0; no random spawns
function seat(state, dish) {
  state.customers = [{
    id: 'test', table: 't0', x: TABLES[0].x, y: TABLES[0].y,
    dish, hearts: 3, orderAge: 0, state: 'waiting', leaveT: 0,
  }];
  state.nextSpawn = 999;
}

describe('service loop', () => {
  let s;
  beforeEach(() => { s = createState(1); s.nextSpawn = 999; });

  it('advances time and keeps the chef still with no input', () => {
    idle(s, 1);
    expect(s.t).toBeGreaterThan(0.9);
    expect(s.chef.x).toBe(160);
  });

  it('assembles a salad and serves it for money', () => {
    seat(s, 'salad');
    teleport(s, 'salad');
    press(s);                               // assemble
    expect(s.chef.carrying?.dish).toBe('salad');
    teleport(s, 't0', true);
    press(s);                               // serve
    expect(s.served).toBe(1);
    expect(s.money).toBeGreaterThan(0);
    expect(s.chef.carrying).toBe(null);
  });

  it('cooks karaage in the green window for a PERFECT plate', () => {
    seat(s, 'karaage');
    teleport(s, 'fryer');
    press(s);                               // start frying
    expect(s.stations.fryer.cooking).toBe(true);
    idle(s, 3.0);                           // into the [2.6, 4.2] perfect window
    press(s);                               // plate
    expect(s.chef.carrying?.dish).toBe('karaage');
    expect(s.chef.carrying?.quality).toBe('perfect');
  });

  it('burns karaage if plated past the window', () => {
    seat(s, 'karaage');
    teleport(s, 'fryer');
    press(s);
    idle(s, 6.0);                           // well past 4.2s
    press(s);
    expect(s.chef.carrying?.quality).toBe('burnt');
  });

  it('requires raw lobster from the ice box before the pot will cook', () => {
    teleport(s, 'pot');
    press(s);                               // no raw -> refused
    expect(s.stations.pot.cooking).toBe(false);
    teleport(s, 'icebox');
    press(s);                               // grab raw lobster
    expect(s.chef.carrying?.kind).toBe('raw');
    teleport(s, 'pot');
    press(s);                               // now it cooks, consuming the raw
    expect(s.stations.pot.cooking).toBe(true);
    expect(s.chef.carrying).toBe(null);
  });

  it('counts a walkout as a bad order when patience runs out', () => {
    seat(s, 'salad');
    const before = s.badOrders;
    idle(s, 31);                            // hearts drain at 0.10/s from 3
    expect(s.badOrders).toBe(before + 1);
    expect(s.customers.length).toBe(0);     // they left
  });
});
