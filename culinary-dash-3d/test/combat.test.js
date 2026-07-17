import { describe, it, expect, beforeEach } from 'vitest';
import { createState, stepSim } from '../src/sim/state.js';
import { startBrawl } from '../src/sim/combat.js';
import { forwardVec } from '../src/sim/movement.js';
import { COMBAT, COMBO } from '../src/sim/data.js';
import { createImpactBus, impact, decayImpact } from '../src/fx/impact.js';

const STEP = 1 / 60;
const NO = { move: { x: 0, y: 0 }, primary: false, primaryDown: false, secondary: false, secondaryDown: false };
const PRESS = { ...NO, primary: true, primaryDown: true };

function drive(state, steps, first) {
  for (let i = 0; i < steps; i++) stepSim(state, STEP, i === 0 && first ? first : NO);
}

// one controlled enemy `dist` px straight ahead of the chef
function oneEnemyAhead(state, hp = 3, dist = 15) {
  const chef = state.chef;
  chef.x = 160; chef.y = 90; chef.facing = Math.PI / 2; // face +x (right)
  const F = forwardVec(chef.facing);
  state.enemies = [{
    id: 'E', kind: 'chaser', x: chef.x + F.x * dist, y: chef.y + F.y * dist,
    hp, maxHp: hp, speed: 0, dmg: 1, atkInterval: 1, r: 6,
    atkCd: 5, kx: 0, ky: 0, hurtT: 0,
  }];
}

describe('brawl setup', () => {
  it('startBrawl arms HP, enemies and phase', () => {
    const s = createState(3);
    startBrawl(s, 4);
    expect(s.phase).toBe('brawl');
    expect(s.chef.hp).toBe(COMBAT.CHEF_HP);
    expect(s.enemies.length).toBe(4);
    expect(s.customers.length).toBe(0);
  });
});

describe('punch', () => {
  let s;
  beforeEach(() => { s = createState(3); startBrawl(s, 1); });

  it('a swing lands on an enemy in the box and damages it', () => {
    oneEnemyAhead(s, 3);
    drive(s, 12, PRESS);                    // press, then run through the contact frame
    expect(s.enemies[0].hp).toBe(2);
  });

  it('knocks the enemy along the facing (per-move knockback)', () => {
    oneEnemyAhead(s, 3, 15);
    const y0 = s.enemies[0].x;
    drive(s, 12, PRESS);
    // pushed further along +x (forward), so x increased
    expect(s.enemies[0].x).toBeGreaterThan(y0);
    expect(Math.abs(s.enemies[0].kx)).toBeGreaterThan(0);
  });

  it('does NOT hit an enemy behind the chef', () => {
    const chef = s.chef; chef.x = 160; chef.y = 90; chef.facing = Math.PI / 2;
    const F = forwardVec(chef.facing);
    s.enemies = [{ id: 'B', kind: 'chaser', x: chef.x - F.x * 15, y: chef.y - F.y * 15,
      hp: 3, maxHp: 3, speed: 0, dmg: 1, atkInterval: 1, r: 6, atkCd: 5, kx: 0, ky: 0, hurtT: 0 }];
    drive(s, 12, PRESS);
    expect(s.enemies[0].hp).toBe(3);        // untouched
  });

  it('a KO adds HIT_KO to the emitted weight', () => {
    oneEnemyAhead(s, 1);                     // one jab kills it
    s.hits.length = 0;
    drive(s, 12, PRESS);
    const last = s.hits[s.hits.length - 1];
    expect(last).toBeTruthy();
    expect(last.w).toBeGreaterThanOrEqual(COMBAT.W.jab + COMBAT.HIT_KO);
  });

  it('combo advances jab -> cross -> roundhouse across separate swings', () => {
    const idxSeen = [];
    for (let n = 0; n < 3; n++) {
      idxSeen.push(s.chef.comboIdx);
      // press and let the whole swing complete
      stepSim(s, STEP, PRESS);
      const dur = (COMBO[s.chef.comboIdx].frames * COMBAT.FIGHT_FRAME_MS) / 1000;
      drive(s, Math.ceil(dur / STEP) + 2, null);
    }
    expect(idxSeen).toEqual([0, 1, 2]);
  });
});

describe('brawl resolution', () => {
  it('clearing all enemies returns to service as a win', () => {
    const s = createState(3); startBrawl(s, 1);
    oneEnemyAhead(s, 1);
    drive(s, 12, PRESS);
    expect(s.enemies.length).toBe(0);
    expect(s.phase).toBe('service');
    expect(s.brawlResult).toBe('win');
  });

  it('losing all HP ends the brawl as a loss', () => {
    const s = createState(3); startBrawl(s, 2);
    s.chef.hp = 1;
    // put an enemy in contact so it attacks
    s.enemies = [{ id: 'X', kind: 'chaser', x: s.chef.x + 5, y: s.chef.y, hp: 9, maxHp: 9,
      speed: 0, dmg: 5, atkInterval: 0.1, r: 6, atkCd: 0, kx: 0, ky: 0, hurtT: 0 }];
    drive(s, 5, null);
    expect(s.phase).toBe('service');
    expect(s.brawlResult).toBe('lose');
  });
});

describe('day -> brawl transition', () => {
  it('more than the trigger of bad orders starts the brawl', () => {
    const s = createState(7); s.nextSpawn = 999;
    s.badOrders = COMBAT.BRAWL_TRIGGER;       // one more will cross it
    // seat a customer and starve them to push badOrders over the line
    s.customers = [{ id: 'z', table: 't0', x: 96, y: 128, dish: 'salad', hearts: 0.0001, orderAge: 5, state: 'waiting', leaveT: 0 }];
    for (let i = 0; i < 4 && s.phase === 'service'; i++) stepSim(s, STEP, NO);
    expect(s.phase).toBe('brawl');
  });
});

describe('impact spine', () => {
  it('weights are strictly ordered scuff < jab < hurt < heavy < stumble', () => {
    const W = COMBAT.W;
    expect(W.scuff).toBeLessThan(W.jab);
    expect(W.jab).toBeLessThan(W.hurt);
    expect(W.hurt).toBeLessThan(W.heavy);
    expect(W.heavy).toBeLessThan(W.stumble);
  });

  it('a bigger weight makes more shake, and shake decays', () => {
    const a = createImpactBus(); impact(a, COMBAT.W.jab, 0, 1, 0, 1, 0);
    const b = createImpactBus(); impact(b, COMBAT.W.heavy, 0, 1, 0, 1, 0);
    expect(b.shake).toBeGreaterThan(a.shake);
    const before = b.shake;
    decayImpact(b, 0.1);
    expect(b.shake).toBeLessThan(before);
  });

  it('hitstop accumulates but never exceeds STOP_MAX', () => {
    const bus = createImpactBus();
    for (let i = 0; i < 20; i++) impact(bus, COMBAT.W.stumble, 0, 1, 0, 1, 0);
    expect(bus.hitstop).toBeLessThanOrEqual(COMBAT.STOP_MAX + 1e-9);
  });
});
