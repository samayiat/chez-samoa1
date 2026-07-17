// Deterministic simulation state + fixed-step update.
// Everything here is pure with respect to (state, input, dt) — no wall clock,
// no Math.random (RNG is seeded and lives on the state). This is what lets the
// determinism harness run two clocks and get byte-identical results.

import { STATIONS, TABLES, TABLE_R, CHEF, WORLD } from './data.js';
import { makeRng } from './rng.js';
import { initService, updateService } from './service.js';

// Solid obstacles the chef slides around: dining tables + station counters.
function buildObstacles() {
  const obs = TABLES.map((t) => ({ x: t.x, y: t.y, r: TABLE_R }));
  for (const s of STATIONS) obs.push({ x: s.x, y: s.y, r: 7 });
  return obs;
}

export function createState(seed = 12345) {
  const state = {
    t: 0,
    phase: 'service', // 'service' | 'brawl'
    rng: makeRng(seed),
    chef: {
      x: 160, y: 90,          // room centre (2D px space)
      facing: -Math.PI / 2,   // radians on XZ plane; start facing the counter
      carrying: null,         // dish id being carried, or null
      vx: 0, vy: 0,
    },
    obstacles: buildObstacles(),
    money: 0,
    served: 0,
    badOrders: 0,
    nearStation: null,        // station id within reach, for the interact prompt
  };
  initService(state);
  return state;
}

const CLAMP = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Push the chef out of any solid circle it overlaps (ported resolveChefCollision
// idea: circle-vs-circle, slide around). Runs a couple of passes so stacked
// obstacles resolve cleanly.
function resolveCollision(chef, obstacles) {
  for (let pass = 0; pass < 2; pass++) {
    for (const o of obstacles) {
      const dx = chef.x - o.x, dy = chef.y - o.y;
      const min = o.r + CHEF.r;
      const d = Math.hypot(dx, dy);
      if (d < min) {
        if (d > 0.01) { chef.x = o.x + (dx / d) * min; chef.y = o.y + (dy / d) * min; }
        else { chef.y = o.y + min; }
      }
    }
  }
  // keep inside the room
  chef.x = CLAMP(chef.x, CHEF.r, WORLD.w - CHEF.r);
  chef.y = CLAMP(chef.y, CHEF.r, WORLD.h - CHEF.r);
}

// Nearest station within interact range, or null.
function findNearStation(chef) {
  let best = null, bestD = 22; // px
  for (const s of STATIONS) {
    const d = Math.hypot(chef.x - s.x, chef.y - s.y);
    if (d < bestD) { bestD = d; best = s.id; }
  }
  return best;
}

// One fixed simulation step. `input` = { move:{x,y}, primary:bool, secondary:bool }.
export function stepSim(state, dt, input) {
  state.t += dt;
  const chef = state.chef;

  // --- movement (analog on the floor plane) ---
  let mx = input.move.x, my = input.move.y;
  const mag = Math.hypot(mx, my);
  if (mag > 1) { mx /= mag; my /= mag; }          // clamp diagonal
  const dead = 0.001;
  if (mag > dead) {
    chef.vx = mx * CHEF.speed;
    chef.vy = my * CHEF.speed;
    chef.facing = Math.atan2(mx, -my);            // face travel direction (XZ)
  } else {
    chef.vx = 0; chef.vy = 0;
  }
  chef.x += chef.vx * dt;
  chef.y += chef.vy * dt;

  resolveCollision(chef, state.obstacles);
  state.nearStation = findNearStation(chef);

  if (state.phase === 'service') updateService(state, dt, input);

  return state;
}
