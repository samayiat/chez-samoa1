// The service loop: customers arrive, order, wait (patience drains); the chef
// walks to the right station, cooks/assembles/sources the dish, carries the
// plate back, and serves. Faster serves tip more. Unserved customers leave
// angry and count as "bad orders" — enough of them starts the brawl.
//
// Ported concepts from the 2D game: station kinds (timing/assemble/source), the
// one-clock tip+patience model, per-dish points. All deterministic — spawn RNG
// lives on the state.

import {
  DISHES, MENU, STATIONS, TABLES,
  HEARTS_MAX, PATIENCE_DRAIN, SPEED_TIP_MAX, SPEED_TIP_WINDOW, ORDER_INTERVAL,
  DAY_SPAWN_K, DAY_DRAIN_K,
  COMBAT,
} from './data.js';
import { range, pick } from './rng.js';
import { startBrawl } from './combat.js';

const stationById = (id) => STATIONS.find((s) => s.id === id);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export function initService(state) {
  state.customers = [];
  state.nextSpawn = 1.5;
  state.stations = {};
  for (const s of STATIONS) {
    if (s.kind === 'timing') state.stations[s.id] = { cooking: false, t: 0, plated: false, quality: null };
    else if (s.kind === 'prep') state.stations[s.id] = { chopping: false, t: 0 };
    else if (s.kind === 'pass') state.stations[s.id] = { slots: [] };
  }
  state.msg = '';       // brief feedback line for the HUD
  state.msgT = 0;
}

function flash(state, text) { state.msg = text; state.msgT = 1.6; }
function cue(state, name) { if (state.sounds) state.sounds.push(name); }

// A free table with no customer, or null.
function freeTable(state) {
  const taken = new Set(state.customers.map((c) => c.table));
  // a flipped table seats nobody until it's righted overnight
  const open = TABLES.filter((t) => !taken.has(t.id) && !state.flipped[t.id]);
  return open.length ? open : null;
}

function spawnCustomer(state) {
  const open = freeTable(state);
  if (!open) return;
  const table = pick(state.rng, open);
  const dish = pick(state.rng, MENU);
  state.customers.push({
    id: 'c' + Math.floor(range(state.rng, 1, 1e9)),
    table: table.id, x: table.x, y: table.y,
    // they read the menu first — patience only starts draining once they order
    dish, hearts: HEARTS_MAX, orderAge: 0, state: 'reading',
    readT: range(state.rng, 2.2, 3.8),
    leaveT: 0,
  });
}

// What a timing station is doing, given elapsed cook time.
function timingPhase(st, station) {
  const t = st.t;
  if (t < station.cook) return 'raw';
  if (t < station.cook + station.green) return 'perfect';
  return 'burnt';
}

// Context-sensitive interact (primary button). Returns a short verb for feedback.
function interact(state) {
  const chef = state.chef;
  const near = state.nearStation ? stationById(state.nearStation) : null;

  // 1) serving: carrying a finished dish, standing by a waiting customer who wants it
  if (chef.carrying && chef.carrying.cooked) {
    let best = null, bestD = 26;
    for (const c of state.customers) {
      if (c.state !== 'waiting') continue;
      const d = dist(chef.x, chef.y, c.x, c.y);
      if (d < bestD && c.dish === chef.carrying.dish) { bestD = d; best = c; }
    }
    if (best) { serve(state, best); return; }
  }

  if (!near) return;

  // a wrecked station cooks nothing (2D rule) — the office sells repairs
  if (state.broken[near.id]) {
    flash(state, `the ${near.label || near.id} is WRECKED — repair it in the back office`);
    return;
  }

  // 1b) the pass: set a carried item down, or pick the last one back up
  if (near.kind === 'pass') {
    const st = state.stations[near.id];
    if (chef.carrying) {
      if (st.slots.length >= near.slots) { flash(state, 'the pass is full'); return; }
      st.slots.push(chef.carrying); chef.carrying = null;
      flash(state, 'set it down on the pass'); cue(state, 'plate');
    } else if (st.slots.length) {
      chef.carrying = st.slots.pop();
      flash(state, 'picked up from the pass'); cue(state, 'grab');
    }
    return;
  }

  // 2) source station (icebox): pick up the raw ingredient to carry
  if (near.kind === 'source') {
    if (!chef.carrying) {
      chef.carrying = { kind: 'raw', dish: near.starts, cooked: false };
      flash(state, 'grabbed raw ' + near.starts);
      cue(state, 'grab');
    }
    return;
  }

  // 2b) prep station (cutting board): chop veg into a carried ingredient. Start
  // with empty hands, wait out the chop, then grab the chopped veg.
  if (near.kind === 'prep') {
    if (chef.carrying) return;                         // starting and grabbing both need free hands
    const st = state.stations[near.id];
    if (!st.chopping) { st.chopping = true; st.t = 0; flash(state, 'chopping the veg…'); cue(state, 'cook'); return; }
    if (st.t >= near.cut) {
      chef.carrying = { kind: 'prep', dish: near.dish, cooked: false };
      st.chopping = false; st.t = 0;
      flash(state, 'chopped — take it to the salad bar'); cue(state, 'plate'); return;
    }
    flash(state, 'still chopping…'); return;
  }

  // 3) assemble station. The bar pours instantly; the salad bar is multi-step now
  // and needs chopped veg carried from the cutting board.
  if (near.kind === 'assemble') {
    if (near.id === 'salad') {
      if (chef.carrying && chef.carrying.kind === 'prep' && chef.carrying.dish === 'salad') {
        chef.carrying = { kind: 'dish', dish: 'salad', cooked: true, quality: 'perfect' };
        flash(state, 'plated ' + DISHES.salad.label); cue(state, 'plate');
      } else if (!chef.carrying) {
        flash(state, 'chop veg at the cutting board first');
      }
      return;
    }
    if (chef.carrying) return;
    const choices = near.dishes || [near.dish];
    const wanted = state.customers.find((c) => c.state === 'waiting' && choices.includes(c.dish));
    const dish = wanted ? wanted.dish : choices[0];
    chef.carrying = { kind: 'dish', dish, cooked: true, quality: 'perfect' };
    flash(state, 'plated ' + DISHES[dish].label);
    cue(state, 'plate');
    return;
  }

  // 4) timing station (fryer / pot)
  if (near.kind === 'timing') {
    const st = state.stations[near.id];
    if (!st.cooking && !st.plated) {
      // pot needs raw lobster carried from the icebox; fryer has its own crate
      if (near.id === 'pot') {
        if (!(chef.carrying && chef.carrying.kind === 'raw' && chef.carrying.dish === near.dish)) {
          flash(state, 'need raw lobster from the ice box');
          return;
        }
        chef.carrying = null;
      } else if (chef.carrying) {
        return; // hands full, can't start the fryer
      }
      st.cooking = true; st.t = 0;
      flash(state, near.verb + 'ing ' + DISHES[near.dish].label + '…');
      cue(state, 'cook');
      return;
    }
    // plate what's cooking (perfect if in the green window, else burnt)
    if (chef.carrying) return;
    const phase = timingPhase(st, near);
    const quality = phase === 'perfect' ? 'perfect' : 'burnt';
    chef.carrying = { kind: 'dish', dish: near.dish, cooked: true, quality };
    st.cooking = false; st.plated = false; st.t = 0;
    flash(state, (quality === 'perfect' ? 'PERFECT ' : 'burnt ') + DISHES[near.dish].label);
    cue(state, 'plate');
    return;
  }
}

function serve(state, c) {
  const chef = state.chef;
  const dish = DISHES[c.dish];
  const quality = chef.carrying.quality || 'perfect';
  const base = dish.pts[quality] ?? dish.pts.perfect;
  // speed tip: decays over SPEED_TIP_WINDOW from the moment the order was taken
  const speed = Math.max(0, 1 - c.orderAge / SPEED_TIP_WINDOW);
  const tip = SPEED_TIP_MAX * speed;
  const pay = Math.round(base * (1 + tip) * ((state.mods && state.mods.tip) || 1));
  state.money += pay;
  state.served += 1;
  c.state = 'served'; c.leaveT = 0.6;
  chef.carrying = null;
  cue(state, 'serve');
  flash(state, `served ${dish.label}  +$${pay}` + (quality === 'perfect' ? '' : ' (burnt)'));
}

export function updateService(state, dt, input) {
  if (state.msgT > 0) { state.msgT -= dt; if (state.msgT <= 0) state.msg = ''; }

  // advance timing (cook clock) + prep (chop clock) stations
  for (const id in state.stations) {
    const st = state.stations[id];
    if (st.cooking || st.chopping) st.t += dt;
  }

  // spawn
  state.nextSpawn -= dt;
  if (state.nextSpawn <= 0) {
    spawnCustomer(state);
    state.nextSpawn = range(state.rng, ORDER_INTERVAL[0], ORDER_INTERVAL[1]) * DAY_SPAWN_K(state.day)
      * ((state.mods && state.mods.spawn) || 1);   // Neon Sign: a busier house
  }

  // patience + departures
  for (const c of state.customers) {
    if (c.state === 'reading') {
      c.readT -= dt;
      if (c.readT <= 0) { c.state = 'waiting'; cue(state, 'order'); }
    } else if (c.state === 'waiting') {
      c.orderAge += dt;
      c.hearts -= PATIENCE_DRAIN * DAY_DRAIN_K(state.day) * ((state.mods && state.mods.patience) || 1) * dt;
      if (c.hearts <= 0) {
        c.hearts = 0; c.state = 'leaving'; c.leaveT = 0.6;
        state.badOrders += 1;
        cue(state, 'walkout');
        flash(state, 'walked out! bad orders: ' + state.badOrders);
      }
    } else {
      c.leaveT -= dt;
    }
  }
  state.customers = state.customers.filter((c) => !((c.state === 'served' || c.state === 'leaving') && c.leaveT <= 0));

  if (input.primaryDown) interact(state);

  // enough walkouts and the mob comes back swinging (BRAWL_SPEC trigger)
  if (state.badOrders > COMBAT.BRAWL_TRIGGER) startBrawl(state);
}
