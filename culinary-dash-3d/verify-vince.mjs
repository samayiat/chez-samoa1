import { chromium } from '@playwright/test';
import { pathToFileURL } from 'url';
import path from 'path';

const file = pathToFileURL(path.resolve('dist-vince/vince.html')).href;
const shotDir = process.argv[2] || '.';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(file, { waitUntil: 'load' });
await page.waitForTimeout(400);

// start
await page.click('#startBtn');
await page.waitForTimeout(2200);
await page.screenshot({ path: path.join(shotDir, 'vince-1-open.png') });

// place the chef in punching range (headless sim runs in slow-motion under
// swiftshader, so walking there wall-clock is unreliable — this tests the
// combat/contact logic, not the movement integrator).
await page.evaluate(() => { const c = window.__vince.chef; c.pos.set(0, 0, -3.4); });
const hpBefore = await page.evaluate(() => window.__vince.boss.hp);
// throw a combo with held presses so the edge is caught between sparse polls
for (let i = 0; i < 3; i++) {
  await page.keyboard.down('KeyE');
  await page.waitForTimeout(110);
  if (i === 1) await page.screenshot({ path: path.join(shotDir, 'vince-2-punch.png') });
  await page.keyboard.up('KeyE');
  await page.waitForTimeout(280);
}
const hpAfter = await page.evaluate(() => window.__vince.boss.hp);
console.log('BOSS HP:', hpBefore, '->', hpAfter, '(combo landed:', hpBefore > hpAfter, ')');

// back off to mid-range so the rotation (not just grab) fires; capture a
// ground-slam telegraph and collect which attack types actually run.
await page.evaluate(() => { window.__vince.chef.pos.set(3.2, 0, 3.4); });
let captured = false, seen = new Set();
for (let i = 0; i < 110; i++) {
  await page.waitForTimeout(110);
  const s = await page.evaluate(() => { const b = window.__vince.boss; return { tg: b.telegraph, type: b.atk && b.atk.type, state: b.state, chefHp: window.__vince.chef.hp }; });
  if (s.type && s.state === 'windup') seen.add(s.type);
  if (!captured && s.tg > 0.55 && (s.type === 'pound' || s.type === 'stomp' || s.type === 'wreckingball')) {
    await page.screenshot({ path: path.join(shotDir, 'vince-3-action.png') }); captured = true;
  }
}
if (!captured) await page.screenshot({ path: path.join(shotDir, 'vince-3-action.png') });
console.log('ATTACKS SEEN:', [...seen].join(', ') || 'none');

// probe live state
const state = await page.evaluate(() => {
  const v = window.__vince;
  return v ? { bossHp: v.boss.hp, bossState: v.boss.state, chefHp: v.chef.hp, children: v.scene.children.length } : null;
});

await browser.close();
console.log('STATE:', JSON.stringify(state));
console.log('ERRORS:', errors.length ? '\n' + errors.join('\n') : 'none');
process.exit(errors.length ? 1 : 0);
