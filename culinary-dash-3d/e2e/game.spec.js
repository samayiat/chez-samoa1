import { test, expect } from '@playwright/test';

async function boot(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__game, null, { timeout: 5000 });
  return errors;
}

test('renders, sim advances, chef walks and collides', async ({ page }) => {
  const errors = await boot(page);
  const before = await page.evaluate(() => ({ ...window.__game.state.chef }));
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyD');
  const after = await page.evaluate(() => ({ x: window.__game.state.chef.x, y: window.__game.state.chef.y, t: window.__game.state.t }));
  expect(after.t).toBeGreaterThan(0.5);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(5);
  expect(errors).toEqual([]);
});

test('a customer arrives and can be served', async ({ page }) => {
  await boot(page);
  // force a known order at a known table, then teleport + interact via the sim API
  const paid = await page.evaluate(async () => {
    const g = window.__game, s = g.state;
    s.customers = [{ id: 'x', table: 't0', x: 96, y: 128, dish: 'salad', hearts: 3, orderAge: 0, state: 'waiting', leaveT: 0 }];
    s.nextSpawn = 999;
    const money0 = s.money;
    // stand at the salad bar and assemble, then at the table and serve
    s.chef.x = 123; s.chef.y = 48;
    await new Promise((r) => setTimeout(r, 60));
    // press E twice with a reposition between — done through the keyboard for realism
    return money0;
  });
  // salad bar assemble
  await page.evaluate(() => { window.__game.state.chef.x = 123; window.__game.state.chef.y = 50; });
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(60);
  await page.evaluate(() => { window.__game.state.chef.x = 96; window.__game.state.chef.y = 128; });
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(60);
  const money = await page.evaluate(() => window.__game.state.money);
  expect(money).toBeGreaterThan(paid);
});

test('the brawl triggers, punches land, and shake fires', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => window.__game.startBrawl(window.__game.state, 4));
  const n0 = await page.evaluate(() => window.__game.state.enemies.length);
  expect(n0).toBe(4);

  await page.keyboard.down('KeyS');
  let peakShake = 0;
  for (let i = 0; i < 24; i++) {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(110);
    peakShake = Math.max(peakShake, await page.evaluate(() => window.__game.bus.shake));
  }
  await page.keyboard.up('KeyS');

  const left = await page.evaluate(() => window.__game.state.enemies.length);
  expect(left).toBeLessThan(4);      // we knocked some out
  expect(peakShake).toBeGreaterThan(0); // the impact spine drove screen shake
  expect(errors).toEqual([]);
});
