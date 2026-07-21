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

import { COMBAT, COMBO, WORLD, STATIONS, TABLES, TABLE_R, TILL, DOOR, STEAL, STATION_HP, WEAPONS } from './data.js';
import { moveChef, resolveCollision, forwardVec, lateralVec } from './movement.js';
import { range } from './rng.js';

const ENEMY_R = 6;
// LIQUID COURAGE (ported from the 2D game's drink system): a shot heals a heart
// and stacks courage — harder knockback, and at 3+ shots the punches deal double.
// But the room starts to lean: 3+ shots wobble your steering, 5+ is WASTED.
const BAR = STATIONS.find((s) => s.id === 'bar');
const DRINK_REACH = 26, BUZZED_AT = 3, WASTED_AT = 5;
// ...and the mob drinks too (2D smash/buffed port): thirsty fighters break for
// the bar, chug, and come back LIT — quicker, harder-hitting, and tougher.
// Punch them mid-chug and the bottle SPILLS (they don't try again).
const BAR_SPOT = { x: BAR.x, y: BAR.y + 16 };   // where a body stands to drink
const ENEMY_CHUG = 2.2;                          // seconds on the bottle
const BUFF_SPD = 1.4, BUFF_DMG = 1, BUFF_HP = 2; // 2D BUFF_ESPD / +dmg / +hp
const isSour = (d) => d === 'whiskey-sour' || d === 'gin-sour';
const LUNGE_SPEED = 42;      // px/s forward drive during the first 45% of a swing
const DRIVE_WINDOW = 0.45;
const CONTACT_AT = 0.4;      // fraction of the swing where the blow lands
const COMBO_RESET = 0.6;     // s of idle before the combo drops back to the jab

// Enemy archetypes (from BRAWL_SPEC): a chaser, a slow tanky smasher, a fast
// thief. Bigger bodies now (r), and each fighter kind owns a real MOVE.
const ARCHETYPES = {
  chaser:  { hp: 3, speed: 44, dmg: 1, atkInterval: 1.0, r: 7,  color: 0xc0392b },
  smasher: { hp: 5, speed: 30, dmg: 2, atkInterval: 1.4, r: 9,  color: 0x8e44ad },
  thief:   { hp: 2, speed: 62, dmg: 1, atkInterval: 0.8, r: 6,  color: 0xe67e22 },
};

// The fighters' moveset (2D windup->strike port): every attack TELEGRAPHS —
// they rear back for `windup` seconds (punch them then and it's cancelled),
// then the strike commits, then a `recover` opening. Buffed = quicker tempo.
//  - chaser LUNGES: a locked-direction dash that clips you on contact
//  - smasher SLAMS: an AOE thud around the spot he wound up on — leave it
const MOVES = {
  chaser:  { kind: 'lunge', windup: 0.5,  dur: 0.24, speed: 200, reach: 12, recover: 0.7,  trigger: 46 },
  smasher: { kind: 'slam',  windup: 0.85, dur: 0.34, r: 30,      recover: 1.05, trigger: 22 },
  thief:   { kind: 'lunge', windup: 0.4,  dur: 0.2,  speed: 220, reach: 10, recover: 0.6,  trigger: 30 },
};

// --- adopted from GLASS JAW (the boxing game's combat grammar) ---------------
//  - fighters BLOCK: a raised guard eats the jab and the cross; only the
//    roundhouse breaks through it (the uppercut's `breaks` rule)
//  - the smasher is a COUNTER-PUNCHER: a punch on his guard is answered
//    immediately with a fast-wound slam (`punish` + forceAttack)
//  - a whiffed strike opens a COUNTER window: the next landed punch doubles
//  - landed punches build a METER; full meter turns the next press into a
//    FLURRY — four rapid swings through the same punch pipeline
//  - chasers CIRCLE between swings and sometimes chain a second lunge
const GUARD_CHANCE = { chaser: 0.15, smasher: 0.45, thief: 0 };
const COUNTER_WINDOW = 1.1;
const METER_MAX = 10;
const FLURRY_SWINGS = 4;
const FLURRY_TEMPO = 0.55;

function openCounter(state) {
  state.counterT = COUNTER_WINDOW;
  state.msg = 'he missed — COUNTER!';
  state.msgT = 1.1;
}

export function startBrawl(state, count = 4) {
  state.phase = 'brawl';
  state.customers = [];
  const chef = state.chef;
  chef.drinks = 0;
  chef.hp = COMBAT.CHEF_HP + ((state.mods && state.mods.hp) || 0);   // Iron Gut
  chef.maxHp = chef.hp;
  chef.swing = null;
  chef.comboIdx = 0;
  chef.comboT = 0;
  chef.bufT = 0;
  chef.hurtT = 0;
  state.enemies = [];
  state.hits = [];
  state.brawlResult = null;

  chef.weapon = null;
  chef.flurryN = 0;
  state.combo = 0;         // landed-punch streak (glass-jaw combo)
  state.comboT = 0;
  state.meter = 0;         // fills as punches land; full = a FLURRY is loaded
  state.counterT = 0;      // the window a whiffed enemy strike leaves open
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
      // thieves don't fight — they make for the till, then run for the door
      role: kind === 'thief' ? 'thief' : 'fighter', state: 'steal', carry: false,
      // fighters get thirsty: most of them will break for the bar mid-fight
      job: 'chase', chugT: 0, buffed: false,
      guard: 0, punish: false,                    // glass-jaw: blocks + counters
      circle: range(state.rng, 0, 1) < 0.5 ? -1 : 1,
      circleT: range(state.rng, 0.9, 2.7),
      thirstAt: range(state.rng, 0, 1) < 0.6 ? state.t + range(state.rng, 1.5, 6) : Infinity,
      // ...and some come to WRECK the place (2D raid system)
      raidAt: range(state.rng, 0, 1) < 0.5 ? state.t + range(state.rng, 1, 5) : Infinity,
      raidT: 0, tgt: null,
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
  // an armed swing: the pan lands heavier + sends harder, the spatula sweeps wider
  const wp = chef.weapon ? WEAPONS[chef.weapon.id] : null;
  const baseW = COMBAT.W[step.weight] + (wp && wp.dmg ? 0.15 : 0);
  const impulse = COMBAT.BRAWL_KNOCK * (COMBAT.MOVE_KNOCK[step.move] ?? 1) * (wp ? wp.knock : 1);

  let bodies = 0, blockedN = 0, anyKO = false;
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - chef.x, dy = e.y - chef.y;
    const fwd = dx * F.x + dy * F.y;
    const lat = dx * L.x + dy * L.y;
    if (fwd < -COMBAT.PUNCH_BACK || fwd > COMBAT.PUNCH_REACH + (wp ? wp.reach : 0) + e.r) continue;
    if (Math.abs(lat) > COMBAT.PUNCH_YBAND + (wp ? wp.band : 0)) continue;
    // BLOCKED (glass jaw): a raised guard eats everything but the roundhouse.
    // The smasher is a counter-puncher — feed his guard and he answers NOW.
    if (e.guard > 0 && step.move !== 'roundhouse') {
      blockedN++;
      e.kx += F.x * impulse * 0.25;
      e.ky += F.y * impulse * 0.25;
      if (e.kind === 'smasher' && !e.atk) { e.guard = 0; e.punish = true; e.atkCd = 0; }
      continue;
    }
    const broke = e.guard > 0;                    // the roundhouse goes THROUGH
    if (broke) { e.guard = 0; e.punish = false; }
    // courage hits harder; Heavy Hands (the shop) and the pan stack on top —
    // and a counter (his whiff, your window) doubles the whole package
    const counter = state.counterT > 0 ? 2 : 1;
    e.hp -= ((chef.drinks >= BUZZED_AT ? 2 : 1) + ((state.mods && state.mods.pow) || 0) + (wp ? wp.dmg : 0)) * counter
      + (broke ? 1 : 0);
    e.hurtT = 0.18;
    if (e.role === 'thief' && e.carry) {
      // caught him — the cash drops and a bounty lands in the till (2D port)
      e.carry = false;
      state.money += STEAL.BOUNTY;
      state.msg = `caught him! +$${STEAL.BOUNTY} back`;
      state.msgT = 1.4;
      if (state.sounds) state.sounds.push('coin');
    }
    if (e.job === 'drink' && !e.buffed) {
      // knocked off the bottle (2D "SPILLED!") — and he doesn't get another
      e.job = 'chase'; e.chugT = 0; e.thirstAt = Infinity;
      state.msg = 'SPILLED!';
      state.msgT = 1.4;
    }
    if (e.atk) {
      // knocked clean off their swing (2D riot rule): the telegraph is the
      // counterplay — a landed punch cancels the wound-up attack
      e.atk = null;
      e.atkCd = Math.max(e.atkCd || 0, 0.6);
    }
    if (e.job === 'raid') {
      // beaten off the equipment — they'll circle back for it later
      e.job = 'chase'; e.raidT = 0; e.tgt = null;
      e.raidAt = state.t + 4;
    }
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
    // the streak: combo climbs, the meter loads, the ranks shout (glass jaw)
    if (state.counterT > 0) { state.counterT = 0; state.msg = 'COUNTERED!'; state.msgT = 1.2; }
    state.combo += 1;
    state.comboT = 1.25;
    state.meter = Math.min(METER_MAX, state.meter + 1 + (anyKO ? 1 : 0));
    if (state.combo === 3) { state.msg = 'NICE!'; state.msgT = 0.9; }
    else if (state.combo === 6) { state.msg = 'SHARP!'; state.msgT = 0.9; }
    else if (state.combo === 10) { state.msg = 'BRUTAL!'; state.msgT = 1.1; }
    if (wp) {
      // every landed swing wears the tool down — appliances aren't forever
      if (state.sounds) state.sounds.push('clang');
      chef.weapon.hits -= 1;
      if (chef.weapon.hits <= 0) {
        chef.weapon = null;
        state.msg = `the ${wp.label} gave out!`;
        state.msgT = 1.6;
      }
    }
  } else if (blockedN > 0) {
    emitHit(state, COMBAT.W.scuff, chef.x + F.x * 10, chef.y + F.y * 10, F.x, F.y);
    if (state.sounds) state.sounds.push('block');
    state.msg = 'BLOCKED — the roundhouse breaks a guard';
    state.msgT = 1.2;
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
    if (s.t >= s.dur) {
      chef.swing = null; chef.comboIdx = (chef.comboIdx + 1) % COMBO.length; chef.comboT = 0;
      if (chef.flurryN > 0) {
        // mid-FLURRY: the next swing throws itself, no press needed (glass jaw:
        // six real punches through the same pipeline — ours throws four)
        chef.flurryN -= 1;
        const nxt = COMBO[chef.comboIdx];
        chef.swing = { step: chef.comboIdx, dur: (nxt.frames * COMBAT.FIGHT_FRAME_MS) / 1000 * FLURRY_TEMPO, t: 0, hit: false };
      }
    }
  } else {
    chef.comboT += dt;
    if (chef.comboT > COMBO_RESET) chef.comboIdx = 0;
    if (chef.bufT > 0) {
      const step = COMBO[chef.comboIdx];
      let dur = (step.frames * COMBAT.FIGHT_FRAME_MS) / 1000;
      if (state.meter >= METER_MAX) {
        // full meter: this press IS the flurry
        state.meter = 0;
        chef.flurryN = FLURRY_SWINGS - 1;
        dur *= FLURRY_TEMPO;
        state.msg = 'FLURRY!';
        state.msgT = 1.2;
        if (state.sounds) state.sounds.push('perfect');
      }
      chef.swing = { step: chef.comboIdx, dur, t: 0, hit: false };
      chef.bufT = 0;
    }
  }
}

function updateEnemies(state, dt) {
  const chef = state.chef;
  let escaped = false;
  for (const e of state.enemies) {
    if (e.hurtT > 0) e.hurtT -= dt;
    // integrate knockback (matches the 2D integrator)
    e.x += e.kx * dt; e.y += e.ky * dt;
    const decay = Math.pow(0.80, dt * 60);
    e.kx *= decay; e.ky *= decay;

    // THE STEAL (2D port): thieves don't fight. They make for the till, snatch
    // the cash, then run for the door — catch them mid-flee to get it back.
    if (e.role === 'thief') {
      if (Math.hypot(e.kx, e.ky) < 20) {         // staggered thieves lose ground
        const tgt = e.state === 'flee' ? DOOR : TILL;
        const tx = tgt.x - e.x, ty = tgt.y - e.y;
        const td = Math.hypot(tx, ty) || 1;
        e.x += (tx / td) * e.speed * dt;
        e.y += (ty / td) * e.speed * dt;
        if (e.state !== 'flee' && td < STEAL.GRAB_R) {
          e.state = 'flee'; e.carry = true;
          state.msg = "he's got the till!"; state.msgT = 1.6;
          if (state.sounds) state.sounds.push('grab');
        } else if (e.state === 'flee' && td < STEAL.EXIT_R) {
          e.hp = 0; escaped = true;              // out the door
          if (e.carry) {
            state.money -= STEAL.LOSS;
            state.msg = `-$${STEAL.LOSS} STOLEN`; state.msgT = 2;
            if (state.sounds) state.sounds.push('walkout');
            emitHit(state, COMBAT.W.scuff, DOOR.x, DOOR.y, 0, 0);   // the door slams
          }
        }
      }
      resolveCollision(e, state.obstacles, e.r);
      continue;
    }

    // THE MOB DRINKS TOO (2D smash/buffed port): when the thirst hits, break
    // for the bar, chug, come back LIT — unless the chef spills it first.
    // a body barrelling past an upright table tips it over — procedural mayhem,
    // and every flipped table is a seat nobody fills for the rest of the day
    for (const tb of TABLES) {
      if (state.flipped[tb.id]) continue;
      if (Math.hypot(tb.x - e.x, tb.y - e.y) < TABLE_R + e.r + 3) {
        state.flipped[tb.id] = true;
        emitHit(state, COMBAT.W.jab, tb.x, tb.y, 0, 0);
        if (state.sounds) state.sounds.push('smash');
        if (!state.msg) { state.msg = 'they flipped a table!'; state.msgT = 1.4; }
      }
    }

    if (e.job === 'chase' && !e.atk && state.t >= e.thirstAt && !e.buffed) e.job = 'drink';
    if (e.job === 'chase' && !e.atk && state.t >= e.raidAt) { e.job = 'raid'; e.tgt = null; }
    if (e.job === 'drink') {
      const bx = BAR_SPOT.x - e.x, by = BAR_SPOT.y - e.y;
      const bd = Math.hypot(bx, by);
      if (bd > 8) {
        if (Math.hypot(e.kx, e.ky) < 20) { e.x += (bx / bd) * e.speed * dt; e.y += (by / bd) * e.speed * dt; }
        e.chugT = 0;
      } else {
        e.chugT += dt;                       // head back, bottle up
        if (e.chugT >= ENEMY_CHUG) {
          e.buffed = true; e.job = 'chase';
          e.speed *= BUFF_SPD;
          e.dmg += BUFF_DMG;
          e.maxHp += BUFF_HP; e.hp = Math.min(e.hp + BUFF_HP, e.maxHp);
          state.msg = 'he hit the bottle — he\'s LIT!';
          state.msgT = 1.8;
          if (state.sounds) state.sounds.push('cheer');
        }
      }
      e.atkCd = Math.max(0, e.atkCd - dt);
      resolveCollision(e, state.obstacles, e.r);
      continue;
    }

    // THE RAID (2D port): wreckers walk to a station and chip it dead. Every
    // chip shakes the room; the third one WRECKS it — no cooking there until
    // the back office sells you the repair.
    if (e.job === 'raid') {
      const s = e.tgt ? STATIONS.find((x) => x.id === e.tgt) : null;
      if (!s || state.broken[s.id]) {
        const nt = raidTarget(state, e);
        if (nt) e.tgt = nt.id;
        else { e.job = 'chase'; e.raidAt = Infinity; }    // nothing left to wreck
      } else {
        const sx = s.x - e.x, sy = s.y + 16 - e.y;
        const sd = Math.hypot(sx, sy);
        if (sd > 8) {
          if (Math.hypot(e.kx, e.ky) < 20) { e.x += (sx / sd) * e.speed * dt; e.y += (sy / sd) * e.speed * dt; }
          e.raidT = 0;
        } else {
          e.raidT += dt;
          if (e.raidT >= 0.6) {                           // one chip every 0.6s (2D cadence)
            e.raidT = 0;
            const hp = (state.stationHp[s.id] ?? STATION_HP) - 1;
            state.stationHp[s.id] = hp;
            emitHit(state, COMBAT.W.scuff, s.x, s.y, 0, 0);
            if (hp <= 0) {
              state.broken[s.id] = true;
              state.msg = `they WRECKED the ${s.id}!`;
              state.msgT = 2;
              if (state.sounds) state.sounds.push('smash');
              emitHit(state, COMBAT.W.hurt, s.x, s.y, 0, 0);
              e.job = 'chase'; e.tgt = null;
              e.raidAt = state.t + range(state.rng, 3, 7);
            }
          }
        }
      }
      e.atkCd = Math.max(0, e.atkCd - dt);
      resolveCollision(e, state.obstacles, e.r);
      continue;
    }

    const dx = chef.x - e.x, dy = chef.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const kb = Math.hypot(e.kx, e.ky);
    const mv = MOVES[e.kind] || MOVES.chaser;
    const tempo = e.buffed ? 0.78 : 1;               // lit brawlers swing sooner

    if (e.atk) {
      const a = e.atk;
      a.t += dt;
      if (a.phase === 'windup') {
        a.k = Math.min(1, a.t / (mv.windup * tempo));       // telegraph progress (render reads this)
        if (a.t >= mv.windup * tempo) {
          a.phase = 'strike'; a.t = 0; a.k = 0; a.hit = false;
          a.dx = dx / d; a.dy = dy / d;                     // direction locks HERE — sidestep it
          if (mv.kind === 'slam') { a.cx = e.x; a.cy = e.y; }
        }
      } else if (a.phase === 'strike') {
        a.k = Math.min(1, a.t / mv.dur);
        if (mv.kind === 'lunge') {
          e.x += a.dx * mv.speed * dt; e.y += a.dy * mv.speed * dt;
          const cd = Math.hypot(chef.x - e.x, chef.y - e.y);
          if (!a.hit && cd < mv.reach + 6) {
            a.hit = true;
            chef.hp -= e.dmg; chef.hurtT = 0.25;
            state.combo = 0;                                // eating one ends the streak
            emitHit(state, COMBAT.W.scuff, chef.x, chef.y, a.dx, a.dy);
          }
        } else if (!a.hit && a.t >= mv.dur * 0.5) {         // slam lands mid-swing
          a.hit = true;
          emitHit(state, COMBAT.W.jab, a.cx, a.cy, 0, 0);   // the floor jumps either way
          if (Math.hypot(chef.x - a.cx, chef.y - a.cy) < mv.r) {
            chef.hp -= e.dmg; chef.hurtT = 0.3;
            state.combo = 0;
          } else {
            openCounter(state);                             // slammed the floorboards
          }
        }
        if (a.t >= mv.dur) {
          if (mv.kind === 'lunge' && !a.hit) openCounter(state);   // sailed right past
          if (a.chain > 0) {
            // a swarmer chains the second lunge off a half windup (glass jaw AI.chain)
            e.atk = { phase: 'windup', t: mv.windup * tempo * 0.5, k: 0.5, kind: a.kind, chain: a.chain - 1 };
          } else { a.phase = 'recover'; a.t = 0; a.k = 0; }
        }
      } else if (a.phase === 'recover') {
        a.k = Math.min(1, a.t / (mv.recover * (e.buffed ? 0.8 : 1)));
        if (a.t >= mv.recover * (e.buffed ? 0.8 : 1)) { e.atk = null; e.atkCd = e.atkInterval; }
      }
    } else if (e.guard > 0) {
      // holding the guard — planted, arms up, waiting you out (glass jaw block)
      e.guard -= dt;
      e.atkCd = Math.max(0, e.atkCd - dt);
    } else {
      e.atkCd = Math.max(0, e.atkCd - dt);
      if (kb < 20 && d > 20) { e.x += (dx / d) * e.speed * dt; e.y += (dy / d) * e.speed * dt; }
      // footwork between swings: circle the chef instead of standing in line.
      // (?? guards: a half-set enemy must never NaN its own position)
      if (kb < 20 && e.atkCd > 0 && d < mv.trigger * 1.6) {
        e.circleT = (e.circleT ?? 1) - dt;
        if (e.circleT <= 0) { e.circle = -(e.circle || 1); e.circleT = range(state.rng, 0.9, 2.7); }
        e.x += (-dy / d) * (e.circle || 1) * e.speed * 0.6 * dt;
        e.y += (dx / d) * (e.circle || 1) * e.speed * 0.6 * dt;
      }
      if (e.atkCd <= 0 && d < mv.trigger) {
        if (!e.punish && range(state.rng, 0, 1) < (GUARD_CHANCE[e.kind] || 0)) {
          e.guard = range(state.rng, 0.5, 0.9);            // he covers up instead
        } else {
          // the punished answer comes off a half windup (glass jaw forceAttack)
          const head = e.punish ? mv.windup * tempo * 0.55 : 0;
          e.punish = false;
          e.atk = {
            phase: 'windup', t: head, k: 0, kind: mv.kind,
            chain: e.kind === 'chaser' && range(state.rng, 0, 1) < 0.35 ? 1 : 0,
          };
        }
      }
    }
    resolveCollision(e, state.obstacles, e.r);
  }
  if (escaped) state.enemies = state.enemies.filter((e) => e.hp > 0);
  if (chef.hurtT > 0) chef.hurtT -= dt;
}

// the nearest intact, wreckable station (the pass and the bar are off the list)
function raidTarget(state, e) {
  let best = null, bd = 1e9;
  for (const s of STATIONS) {
    if (s.kind === 'pass' || s.id === 'bar' || state.broken[s.id]) continue;
    const d = Math.hypot(s.x - e.x, s.y - e.y);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

function endBrawl(state, won) {
  state.brawlResult = won ? 'win' : 'lose';
  state.phase = 'service';
  state.badOrders = 0;               // the reckoning is over either way
  state.enemies = [];
  state.chef.swing = null;
  state.chef.weapon = null;          // the pan goes back on the hook
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
  if (state.counterT > 0) state.counterT -= dt;
  if (state.comboT > 0) { state.comboT -= dt; if (state.comboT <= 0) state.combo = 0; }

  // real appliances are real weapons: empty hands near the right station arms you
  if (!state.chef.weapon) {
    for (const id in WEAPONS) {
      const w = WEAPONS[id];
      const st = STATIONS.find((s) => s.id === w.station);
      if (st && !state.broken[st.id] && Math.hypot(state.chef.x - st.x, state.chef.y - st.y) < 26) {
        state.chef.weapon = { id, hits: w.hits };
        state.msg = `grabbed the ${w.label}!`;
        state.msgT = 1.6;
        if (state.sounds) state.sounds.push('grab');
        break;
      }
    }
  }

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
