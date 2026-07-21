import { describe, it, expect, beforeEach } from 'vitest';
import { createState, stepSim } from '../src/sim/state.js';
import { startBrawl } from '../src/sim/combat.js';
import { forwardVec } from '../src/sim/movement.js';
import { COMBAT, COMBO, STATIONS, TILL, DOOR, STEAL } from '../src/sim/data.js';
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
    // put an enemy close so its lunge (windup -> strike) connects
    s.enemies = [{ id: 'X', kind: 'chaser', x: s.chef.x + 5, y: s.chef.y, hp: 9, maxHp: 9,
      speed: 0, dmg: 5, atkInterval: 0.1, r: 6, atkCd: 0, kx: 0, ky: 0, hurtT: 0 }];
    drive(s, 70, null);                     // the whole windup + strike plays out
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

describe('the steal (brawl thieves)', () => {
  // startBrawl(s, 3) spawns chaser, smasher, thief; park the fighters far away
  function thiefBrawl() {
    const s = createState(7);
    startBrawl(s, 3);
    for (const e of s.enemies) if (e.kind !== 'thief') { e.x = 30; e.y = 340; e.speed = 0; e.atkCd = 99; }
    return [s, s.enemies.find((e) => e.kind === 'thief')];
  }

  it('the thief makes for the till, grabs the cash, then runs for the door', () => {
    const [s, th] = thiefBrawl();
    const d0 = Math.hypot(th.x - TILL.x, th.y - TILL.y);
    drive(s, 60, null);
    expect(Math.hypot(th.x - TILL.x, th.y - TILL.y)).toBeLessThan(d0);   // closing on the till
    for (let i = 0; i < 900 && !th.carry; i++) stepSim(s, STEP, NO);
    expect(th.carry).toBe(true);
    expect(th.state).toBe('flee');
    const f0 = Math.hypot(th.x - DOOR.x, th.y - DOOR.y);
    drive(s, 60, null);
    expect(Math.hypot(th.x - DOOR.x, th.y - DOOR.y)).toBeLessThan(f0);   // now closing on the door
  });

  it('an escaped thief runs off with the till money', () => {
    const [s, th] = thiefBrawl();
    th.state = 'flee'; th.carry = true; th.x = DOOR.x - 20; th.y = DOOR.y;
    s.money = 10;
    drive(s, 60, null);
    expect(s.money).toBe(10 - STEAL.LOSS);
    expect(s.enemies.find((e) => e.id === th.id)).toBeUndefined();       // gone out the door
  });

  it('punching the carrying thief drops the cash and pays the bounty', () => {
    const [s, th] = thiefBrawl();
    const chef = s.chef;
    chef.x = 300; chef.y = 250; chef.facing = Math.PI / 2;               // face +x
    th.state = 'flee'; th.carry = true; th.x = chef.x + 12; th.y = chef.y;
    drive(s, 12, PRESS);
    expect(th.carry).toBe(false);
    expect(s.money).toBe(STEAL.BOUNTY);
    expect(th.hp).toBe(th.maxHp - 1);                                    // hit, not necessarily KO'd
  });
});

describe('the moveset (telegraph -> strike -> recover)', () => {
  // one fighter of `kind`, `dist` px from the chef, ready to swing NOW
  function fighter(s, kind, dist, dmg = 1) {
    const chef = s.chef; chef.x = 300; chef.y = 250;
    s.enemies = [{ id: 'M', kind, x: chef.x + dist, y: chef.y, hp: 9, maxHp: 9,
      speed: 0, dmg, atkInterval: 9, r: 7, atkCd: 0, kx: 0, ky: 0, hurtT: 0,
      role: 'fighter', job: 'chase', thirstAt: Infinity, buffed: false, chugT: 0 }];
    return s.enemies[0];
  }

  it('the chaser telegraphs a windup, then lunges into contact', () => {
    const s = createState(3); startBrawl(s, 1);
    const e = fighter(s, 'chaser', 40);
    const hp0 = s.chef.hp;
    drive(s, 10, null);
    expect(e.atk && e.atk.phase).toBe('windup');       // rearing back, readable
    expect(s.chef.hp).toBe(hp0);                        // nothing lands yet
    drive(s, 40, null);
    expect(s.chef.hp).toBe(hp0 - 1);                    // the lunge connected
  });

  it("the smasher's slam is an AOE — standing in it hurts, leaving it doesn't", () => {
    const stay = createState(3); startBrawl(stay, 1);
    fighter(stay, 'smasher', 15, 2);
    const hp0 = stay.chef.hp;
    drive(stay, 80, null);
    expect(stay.chef.hp).toBe(hp0 - 2);                 // ate the slam

    const flee = createState(3); startBrawl(flee, 1);
    const e2 = fighter(flee, 'smasher', 15, 2);
    for (let i = 0; i < 80; i++) {
      if (e2.atk && e2.atk.phase === 'strike' && !e2.atk.hit) { flee.chef.x = 60; flee.chef.y = 60; }
      stepSim(flee, STEP, NO);
    }
    expect(flee.chef.hp).toBe(hp0);                     // left the circle in time
  });

  it('a punch during the windup cancels the attack', () => {
    const s = createState(3); startBrawl(s, 1);
    const e = fighter(s, 'chaser', 15);
    s.chef.facing = Math.PI / 2;                        // face him
    drive(s, 6, null);
    expect(e.atk && e.atk.phase).toBe('windup');
    drive(s, 12, PRESS);                                // knock him off his swing
    expect(e.atk).toBe(null);
    expect(e.hp).toBe(8);
  });
});

describe('the mob drinks too (enemy bar buffs)', () => {
  // a lone chaser, thirsty NOW, parked by the bar spot; chef far away
  function thirstyBrawl() {
    const s = createState(7); startBrawl(s, 1);
    const e = s.enemies[0];
    e.thirstAt = 0; e.x = 545; e.y = 78;
    s.chef.x = 60; s.chef.y = 300;
    return [s, e];
  }

  it('a thirsty fighter chugs at the bar and comes back LIT', () => {
    const [s, e] = thirstyBrawl();
    const spd = e.speed, dmg = e.dmg, maxHp = e.maxHp;
    for (let i = 0; i < 60 * 4 && !e.buffed; i++) stepSim(s, STEP, NO);
    expect(e.buffed).toBe(true);
    expect(e.job).toBe('chase');
    expect(e.speed).toBeCloseTo(spd * 1.4);
    expect(e.dmg).toBe(dmg + 1);
    expect(e.maxHp).toBe(maxHp + 2);
    expect(e.hp).toBe(e.maxHp);                       // topped up by the bottle
  });

  it('punching him mid-chug spills the bottle for good', () => {
    const s = createState(7); startBrawl(s, 1);
    const e = s.enemies[0];
    const chef = s.chef;
    chef.x = 300; chef.y = 250; chef.facing = Math.PI / 2;
    e.thirstAt = 0; e.job = 'drink'; e.x = chef.x + 14; e.y = chef.y;
    drive(s, 12, PRESS);
    expect(e.buffed).toBe(false);
    expect(e.job).toBe('chase');
    expect(e.thirstAt).toBe(Infinity);                // he doesn't try again
  });
});

describe('liquid courage (the drinking mechanic)', () => {
  const NO = { move: { x: 0, y: 0 }, primary: false, primaryDown: false, secondary: false, secondaryDown: false };
  const PRESS = { ...NO, primary: true, primaryDown: true };
  const bar = STATIONS.find((s) => s.id === 'bar');

  it('chugs a carried sour: +1 heart, +1 shot, hands free, no swing', () => {
    const s = createState(7); startBrawl(s, 1);
    s.chef.hp = 2;
    s.chef.carrying = { kind: 'dish', dish: 'whiskey-sour', cooked: true, quality: 'perfect' };
    s.enemies[0].x = 40; s.enemies[0].y = 40;      // out of everything
    stepSim(s, 1 / 60, PRESS);
    expect(s.chef.drinks).toBe(1);
    expect(s.chef.hp).toBe(3);
    expect(s.chef.carrying).toBe(null);
    expect(s.chef.swing).toBe(null);               // the press drank, it did not punch
  });

  it('pours shots at the bar, and 3+ makes punches hit double', () => {
    const s = createState(7); startBrawl(s, 1);
    s.chef.x = bar.x; s.chef.y = bar.y;
    s.enemies[0].x = 500; s.enemies[0].y = 300;
    for (let i = 0; i < 3; i++) { stepSim(s, 1 / 60, PRESS); for (let j = 0; j < 30; j++) stepSim(s, 1 / 60, NO); }
    expect(s.chef.drinks).toBe(3);
    // now square up on the enemy and land one punch — chaser (3hp) should take 2
    const e = s.enemies[0];
    s.chef.x = e.x - 15; s.chef.y = e.y; s.chef.facing = Math.atan2(1, 0);   // face +x
    stepSim(s, 1 / 60, PRESS);
    for (let j = 0; j < 30; j++) stepSim(s, 1 / 60, NO);                     // swing completes
    expect(e.hp).toBe(1);                          // 3 - 2 (buzzed damage)
  });

  it('drinking away from the bar with empty hands just punches', () => {
    const s = createState(7); startBrawl(s, 1);
    s.chef.x = 300; s.chef.y = 250; s.chef.carrying = null;
    s.enemies[0].x = 40; s.enemies[0].y = 40;
    stepSim(s, 1 / 60, PRESS);
    expect(s.chef.drinks).toBe(0);
    expect(s.chef.swing).not.toBe(null);           // the press was a punch
  });
});
