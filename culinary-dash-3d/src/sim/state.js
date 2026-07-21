// Deterministic simulation state + fixed-step update.
// Everything here is pure with respect to (state, input, dt) — no wall clock,
// no Math.random (RNG is seeded and lives on the state). This is what lets the
// determinism harness run two clocks and get byte-identical results.

import { makeRng } from './rng.js';
import { WORLD } from './data.js';
import { initService, updateService } from './service.js';
import { updateCombat } from './combat.js';
import { buildObstacles, moveChef, findNearStation } from './movement.js';

// `mods` = the back office's purchases collapsed to multipliers/bonuses (see
// engine/shop.js modsFor). Everything defaults neutral, so states created
// without them behave exactly as before the shop existed.
const NEUTRAL = { tip: 1, patience: 1, spawn: 1, hp: 0, pow: 0, speed: 1 };

export function createState(seed = 12345, day = 1, mods = null, broken = null) {
  const state = {
    t: 0,
    day,                      // 1-based run day; drives service escalation
    mods: { ...NEUTRAL, ...(mods || {}) },
    broken: { ...(broken || {}) },   // wrecked stations (carry over until repaired)
    flipped: {},                     // tables tipped in a brawl (righted overnight)
    stationHp: {},                   // raid chip damage in progress
    phase: 'service', // 'service' | 'brawl'
    rng: makeRng(seed),
    chef: {
      x: WORLD.w / 2, y: WORLD.h / 2,   // room centre (2D px space)
      facing: -Math.PI / 2,   // radians on XZ plane; start facing the counter
      carrying: null,         // dish id being carried, or null
      vx: 0, vy: 0,
    },
    obstacles: buildObstacles(),
    money: 0,
    served: 0,
    badOrders: 0,
    nearStation: null,        // station id within reach, for the interact prompt
    sounds: [],               // queued non-combat sfx cues, drained by main.js
  };
  initService(state);
  return state;
}

// One fixed simulation step. `input` = { move:{x,y}, primary, primaryDown, ... }.
export function stepSim(state, dt, input) {
  state.t += dt;

  if (state.phase === 'brawl') {
    updateCombat(state, dt, input);
  } else {
    moveChef(state, dt, input.move.x, input.move.y);
    state.nearStation = findNearStation(state.chef);
    updateService(state, dt, input);
  }
  return state;
}
