// The brawl: the service loop's bad customers come back swinging. This is the
// beat-'em-up half. It ports the 2D game's crown-jewel ideas:
//
//  - ONE ranked weight per blow drives every feedback channel (shake, hitstop,
//    camera-kick, sparks, sound, haptics). The sim only *emits* weighted hit
//    events into state.hits[]; main.js drains them into the impact bus. Keeping
//    the bus out of the sim preserves determinism.
//  - A square-cornered punch box in front of the chef (PUNCH_REACH forward,
//    PUNCH_YBAND lateral — lateral wider than forward, the locked invariant),
//    rotated onto real 3D facing instead of a 4-direction table.
//  - Per-move knockback (jab holds, finisher sends), integrated exactly like the
//    2D game (v*dt, v *= 0.80^(dt*60)) so the settle distance matches.
//  - The swing COMMITS: the chef is rooted for the whole swing with a short
//    forward drive window — commitment is what reads as weight.
//  - Input BUFFERS (PUNCH_BUFFER), it never accelerates; cadence comes from the
//    animation frame counts, not from mashing.

import { COMBAT, COMBO, WORLD, STATIONS } from './data.js';
import { moveChef, resolveCollision, forwardVec, lateralVec } from './movement.js';
import { range } from './rng.js';

const ENEMY_R = 6;
// LIQUID COURAGE (ported from the 2D game's drink system): a shot heals a heart
// and stacks courage — harder knockback, and at 3+ shots the punches deal double.
// But the room starts to lean: 3+ shots wobble your steering, 5+ is WASTED.
const BAR = STATIONS.find((s) => s.id === 'bar');
const DRINK_REACH = 26, BUZZED_AT = 3, WASTED_AT = 5;
const isSour = (d) => d === 'whiskey-sour' || d === 'gin-sour';
const LUNGE_SPEED = 42;      // px/s forward drive during the first 45% of a swing
const DRIVE_WINDOW = 0.45;
const CONTACT_AT = 0.4;      // fraction of the swing where the blow lands
const COMBO_RESET = 0.6;     // s of idle before the combo drops back to the jab

// Enemy archetypes (from BRAWL_SPEC): a chaser, a slow tanky smasher, a fast
// thief. For the slice they share one AI with tuned numbers.
const ARCHETYPES = {
  chaser:  { hp: 3, speed: 44, dmg: 1, atkInterval: 1.0, r: 6,  color: 0xc0392b },
  smasher: { hp: 5, speed: 30, dmg: 2, atkInterval: 1.4, r: 7,  color: 0x8e44ad },
  thief:   { hp: 2, speed: 62, dmg: 1, atkInterval: 0.8, r: 5,  color: 0xe67e22 },
};

export function startBrawl(state, count = 4) {
  state.phase = 'brawl';
  state.customers = [];
  const chef = state.chef;
  chef.drinks = 0;
  chef.hp = COMBAT.CHEF_HP;
  chef.maxHp = COMBAT.CHEF_HP;
  chef.swing = null;
  chef.comboIdx = 0;
  chef.comboT = 0;
  chef.bufT = 0;
  chef.hurtT = 0;
  state.enemies = [];
  state.hits = [];
  state.brawlResult = null;

  const kinds = Object.keys(ARCHETYPES);
  for (let i = 0; i < count; i++) {
    const kind = kinds[i % kinds.length];
    const a = ARCHETYPES[kind];
    // spawn spread across the dining floor (they storm back in from the front)
    const x = range(state.rng, WORLD.w * 0.1, WORLD.w * 0.9);
    const y = range(state.rng, WORLD.h * 0.55, WORLD.h * 0.92);
    state.enemies.push({
      id: 'e' + i, kind, x, y, hp: a.hp, maxHp: a.hp,
      speed: a.speed, dmg: a.dmg, atkInterval: a.atkInterval, r: a.r,
      atkCd: range(state.rng, 0.3, 1.0), kx: 0, ky: 0, hurtT: 0,
    });
  }
  state.msg = 'THE BRAWL — clear them out!';
  state.msgT = 2;
}

function emitHit(state, w, x, y, fx, fy) {
  state.hits.push({ w, x, y, dx: fx, dy: fy });
}

// The punch connects: sweep the square-cornered box, damage + knock everyone in
// it, then emit ONE weighted hit event (base weight + extra bodies + any KO).
function landPunch(state) {
  const chef = state.chef;
  const step = COMBO[chef.swing.step];
  const F = forwardVec(chef.facing);
  const L = lateralVec(chef.facing);
  const baseW = COMBAT.W[step.weight];
  const impulse = COMBAT.BRAWL_KNOCK * (COMBAT.MOVE_KNOCK[step.move] ?? 1);

  let bodies = 0, anyKO = false;
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - chef.x, dy = e.y - chef.y;
    const fwd = dx * F.x + dy * F.y;
    const lat = dx * L.x + dy * L.y;
    if (fwd < -COMBAT.PUNCH_BACK || fwd > COMBAT.PUNCH_REACH + e.r) continue;
    if (Math.abs(lat) > COMBAT.PUNCH_YBAND) continue;
    e.hp -= chef.drinks >= BUZZED_AT ? 2 : 1;                       // courage hits harder
    e.hurtT = 0.18;
    const send = impulse * Math.min(2, 1 + 0.25 * (chef.drinks || 0));
    e.kx += F.x * send;
    e.ky += F.y * send;
    bodies++;
    if (e.hp <= 0) anyKO = true;
  }

  if (bodies > 0) {
    let w = baseW + (bodies - 1) * COMBAT.HIT_BODY + (anyKO ? COMBAT.HIT_KO : 0);
    const cx = chef.x + F.x * COMBAT.PUNCH_REACH * 0.5;
    const cy = chef.y + F.y * COMBAT.PUNCH_REACH * 0.5;
    emitHit(state, w, cx, cy, F.x, F.y);
    state.enemies = state.enemies.filter((e) => e.hp > 0);
  }
}

function updatePunch(state, dt, input) {
  const chef = state.chef;

  // buffer the press (never accelerate)
  if (input.primaryDown) chef.bufT = COMBAT.PUNCH_BUFFER;
  else if (chef.bufT > 0) chef.bufT = Math.max(0, chef.bufT - dt);

  if (chef.swing) {
    chef.swing.t += dt;
    const s = chef.swing;
    if (!s.hit && s.t >= s.dur * CONTACT_AT) { landPunch(state); s.hit = true; }
    if (s.t >= s.dur) { chef.swing = null; chef.comboIdx = (chef.comboIdx + 1) % COMBO.length; chef.comboT = 0; }
  } else {
    chef.comboT += dt;
    if (chef.comboT > COMBO_RESET) chef.comboIdx = 0;
    if (chef.bufT > 0) {
      const step = COMBO[chef.comboIdx];
      chef.swing = { step: chef.comboIdx, dur: (step.frames * COMBAT.FIGHT_FRAME_MS) / 1000, t: 0, hit: false };
      chef.bufT = 0;
    }
  }
}

function updateEnemies(state, dt) {
  const chef = state.chef;
  for (const e of state.enemies) {
    if (e.hurtT > 0) e.hurtT -= dt;
    // integrate knockback (matches the 2D integrator)
    e.x += e.kx * dt; e.y += e.ky * dt;
    const decay = Math.pow(0.80, dt * 60);
    e.kx *= decay; e.ky *= decay;

    const dx = chef.x - e.x, dy = chef.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const kb = Math.hypot(e.kx, e.ky);
    if (d > COMBAT.ATK_REACH) {
      if (kb < 20) { e.x += (dx / d) * e.speed * dt; e.y += (dy / d) * e.speed * dt; }
      e.atkCd = Math.max(0, e.atkCd - dt);
    } else {
      e.atkCd -= dt;
      if (e.atkCd <= 0) {
        chef.hp -= e.dmg;
        chef.hurtT = 0.25;
        e.atkCd = e.atkInterval;
        // getting hit is a light shake — a real (small) weighted event
        emitHit(state, COMBAT.W.scuff, chef.x, chef.y, -dx / d, -dy / d);
      }
    }
    resolveCollision(e, state.obstacles, e.r);
  }
  if (chef.hurtT > 0) chef.hurtT -= dt;
}

function endBrawl(state, won) {
  state.brawlResult = won ? 'win' : 'lose';
  state.phase = 'service';
  state.badOrders = 0;               // the reckoning is over either way
  state.enemies = [];
  state.chef.swing = null;
  state.msg = won ? 'you cleared the brawl!' : 'KO! …you live to cook again';
  state.msgT = 2.4;
}

// Take a drink instead of throwing a punch: chug the sour you were carrying
// (anywhere), or pour a fresh one at the bar. Consumes the press.
function tryDrink(state) {
  const chef = state.chef;
  const carriedSour = chef.carrying && chef.carrying.cooked && isSour(chef.carrying.dish);
  const nearBar = Math.hypot(chef.x - BAR.x, chef.y - BAR.y) < DRINK_REACH;
  if (carriedSour) chef.carrying = null;
  else if (!nearBar) return false;
  chef.drinks = (chef.drinks || 0) + 1;
  chef.hp = Math.min(chef.maxHp, chef.hp + 1);
  state.msg = chef.drinks >= WASTED_AT ? 'WASTED…' : 'liquid courage! +1 ♥';
  state.msgT = 1.4;
  if (state.sounds) state.sounds.push('drink');
  return true;
}

export function updateCombat(state, dt, input) {
  if (state.msgT > 0) { state.msgT -= dt; if (state.msgT <= 0) state.msg = ''; }

  const drank = input.primaryDown && !state.chef.swing && tryDrink(state);
  updatePunch(state, dt, drank ? { ...input, primaryDown: false } : input);

  // movement: rooted during a swing (with a short forward drive), else free
  const chef = state.chef;
  if (chef.swing) {
    if (chef.swing.t < chef.swing.dur * DRIVE_WINDOW) {
      const F = forwardVec(chef.facing);
      moveChef(state, dt, F.x, F.y, LUNGE_SPEED, true);
    } else {
      moveChef(state, dt, 0, 0, 0, true);
    }
  } else {
    // buzzed steering: 3+ shots rotate your input by a slow deterministic sway
    let mx = input.move.x, my = input.move.y;
    const dr = chef.drinks || 0;
    if (dr >= BUZZED_AT) {
      const a = Math.sin(state.t * 6) * 0.5 * Math.min(1, (dr - BUZZED_AT + 1) / 3);
      const ca = Math.cos(a), sa = Math.sin(a);
      const rx = mx * ca - my * sa, ry = mx * sa + my * ca;
      mx = rx; my = ry;
    }
    moveChef(state, dt, mx, my);
  }

  updateEnemies(state, dt);

  if (state.enemies.length === 0) endBrawl(state, true);
  else if (chef.hp <= 0) endBrawl(state, false);
}
