// Shared floor movement + collision, used by both the service loop and the
// brawl. Kept in its own module so sim/state.js and sim/combat.js can both use
// it without an import cycle.

import { STATIONS, TABLES, TABLE_R, CHEF, WORLD } from './data.js';

const CLAMP = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function buildObstacles() {
  const obs = TABLES.map((t) => ({ x: t.x, y: t.y, r: TABLE_R }));
  for (const s of STATIONS) obs.push({ x: s.x, y: s.y, r: 7 });
  return obs;
}

// Push a moving circle out of any solid obstacle it overlaps (ported
// resolveChefCollision: circle-vs-circle, slide around).
export function resolveCollision(ent, obstacles, r = CHEF.r) {
  for (let pass = 0; pass < 2; pass++) {
    for (const o of obstacles) {
      const dx = ent.x - o.x, dy = ent.y - o.y;
      const min = o.r + r;
      const d = Math.hypot(dx, dy);
      if (d < min) {
        if (d > 0.01) { ent.x = o.x + (dx / d) * min; ent.y = o.y + (dy / d) * min; }
        else { ent.y = o.y + min; }
      }
    }
  }
  ent.x = CLAMP(ent.x, r, WORLD.w - r);
  ent.y = CLAMP(ent.y, r, WORLD.h - r);
}

// Analog movement for the chef. `speed` lets combat slow/root; `faceLock` keeps
// the current facing (used mid-punch so a swing commits to its direction).
export function moveChef(state, dt, mx, my, speed = CHEF.speed, faceLock = false) {
  const chef = state.chef;
  const mag = Math.hypot(mx, my);
  if (mag > 1) { mx /= mag; my /= mag; }
  if (mag > 0.001) {
    chef.vx = mx * speed;
    chef.vy = my * speed;
    if (!faceLock) chef.facing = Math.atan2(mx, -my);
  } else {
    chef.vx = 0; chef.vy = 0;
  }
  chef.x += chef.vx * dt;
  chef.y += chef.vy * dt;
  resolveCollision(chef, state.obstacles);
}

export function findNearStation(chef) {
  let best = null, bestD = 22;
  for (const s of STATIONS) {
    const d = Math.hypot(chef.x - s.x, chef.y - s.y);
    if (d < bestD) { bestD = d; best = s.id; }
  }
  return best;
}

// Forward / lateral unit vectors for a facing angle (px space).
// facing 0 = up (-y), +pi/2 = right (+x). Matches moveChef's atan2(mx,-my).
export const forwardVec = (f) => ({ x: Math.sin(f), y: -Math.cos(f) });
export const lateralVec = (f) => ({ x: Math.cos(f), y: Math.sin(f) });
