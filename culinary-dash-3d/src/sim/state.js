// Deterministic simulation state + fixed-step update.
// Everything here is pure with respect to (state, input, dt) — no wall clock,
// no Math.random (RNG is seeded and lives on the state). This is what lets the
// determinism harness run two clocks and get byte-identical results.

import { makeRng } from './rng.js';
import { WORLD } from './data.js';
import { initService, updateService } from './service.js';
import { updateCombat } from './combat.js';
import { buildObstacles, moveChef, findNearStation } from './movement.js';

export function createState(seed = 12345) {
  const state = {
    t: 0,
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
