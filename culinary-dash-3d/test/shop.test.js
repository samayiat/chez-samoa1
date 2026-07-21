import { describe, it, expect } from 'vitest';
import { UPGRADES, STATS, statCost, modsFor, NEUTRAL_MODS } from '../src/engine/shop.js';
import { createState, stepSim } from '../src/sim/state.js';
import { startBrawl } from '../src/sim/combat.js';
import { COMBAT } from '../src/sim/data.js';

const STEP = 1 / 60;
const NO = { move: { x: 0, y: 0 }, primary: false, primaryDown: false, secondary: false, secondaryDown: false };
const PRESS = { ...NO, primary: true, primaryDown: true };

describe('the back office (shop)', () => {
  it('an empty run collapses to fully neutral modifiers', () => {
    expect(modsFor(null)).toEqual({ tip: 1, patience: 1, spawn: 1, hp: 0, pow: 0, speed: 1 });
    expect(modsFor({ upgrades: {}, stats: {} })).toEqual(NEUTRAL_MODS);
  });

  it('a maxed run collapses to the 2D multipliers', () => {
    const run = { upgrades: { tipjar: true, stools: true, neon: true }, stats: { hp: 2, pow: 2, feet: 3 } };
    const m = modsFor(run);
    expect(m.tip).toBeCloseTo(1.15);
    expect(m.patience).toBeCloseTo(0.78);
    expect(m.spawn).toBeCloseTo(0.8);
    expect(m.hp).toBe(2);
    expect(m.pow).toBe(2);
    expect(m.speed).toBeCloseTo(1.24);
  });

  it('stat prices climb per level (2D statCost)', () => {
    for (const s of STATS) {
      expect(statCost(s.id, 0)).toBe(s.base);
      expect(statCost(s.id, 1)).toBe(s.base * 2);
    }
    expect(UPGRADES.every((u) => u.cost > 0)).toBe(true);
  });

  it('Iron Gut adds hearts when the brawl starts', () => {
    const s = createState(3, 1, { hp: 2 });
    startBrawl(s, 1);
    expect(s.chef.hp).toBe(COMBAT.CHEF_HP + 2);
    expect(s.chef.maxHp).toBe(COMBAT.CHEF_HP + 2);
  });

  it('Heavy Hands adds punch damage', () => {
    const s = createState(3, 1, { pow: 1 });
    startBrawl(s, 1);
    const chef = s.chef;
    chef.x = 160; chef.y = 90; chef.facing = Math.PI / 2;
    s.enemies = [{ id: 'E', kind: 'chaser', x: chef.x + 15, y: chef.y, hp: 3, maxHp: 3,
      speed: 0, dmg: 1, atkInterval: 1, r: 6, atkCd: 5, kx: 0, ky: 0, hurtT: 0 }];
    stepSim(s, STEP, PRESS);
    for (let i = 0; i < 11; i++) stepSim(s, STEP, NO);
    expect(s.enemies[0].hp).toBe(1);                       // 3 - (1 base + 1 heavy hands)
  });

  it('Quick Feet moves the chef further on the same input', () => {
    const slow = createState(3, 1);
    const fast = createState(3, 1, { speed: 1.24 });
    const RIGHT = { ...NO, move: { x: 1, y: 0 } };
    for (let i = 0; i < 30; i++) { stepSim(slow, STEP, RIGHT); stepSim(fast, STEP, RIGHT); }
    expect(fast.chef.x - 300).toBeGreaterThan((slow.chef.x - 300) * 1.2);
  });

  it('Bigger Tip Jar pays more for the same serve', () => {
    const money = (mods) => {
      const s = createState(3, 1, mods);
      s.nextSpawn = 999;
      s.customers = [{ id: 'c', table: 't0', x: s.chef.x, y: s.chef.y, dish: 'salad',
        hearts: 3, orderAge: 0, state: 'waiting', leaveT: 0 }];
      s.chef.carrying = { kind: 'dish', dish: 'salad', cooked: true, quality: 'perfect' };
      stepSim(s, STEP, PRESS);
      return s.money;
    };
    const plain = money(null), tipped = money({ tip: 1.15 });
    expect(plain).toBeGreaterThan(0);
    expect(tipped).toBeGreaterThan(plain);
  });
});
