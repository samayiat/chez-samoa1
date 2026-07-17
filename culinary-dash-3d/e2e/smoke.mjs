// Standalone smoke check: load the game, drive movement, assert the sim
// advanced and the chef actually moved, then screenshot the rendered 3D frame.
import { chromium } from '@playwright/test';

const URL = process.env.URL || 'http://localhost:4173/';

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__game, null, { timeout: 5000 });

const before = await page.evaluate(() => ({ ...window.__game.state.chef }));

// walk up-right for ~1s
await page.keyboard.down('KeyW');
await page.keyboard.down('KeyD');
await page.waitForTimeout(1000);
await page.keyboard.up('KeyW');
await page.keyboard.up('KeyD');

const after = await page.evaluate(() => ({ ...window.__game.state.chef, t: window.__game.state.t }));
await page.screenshot({ path: 'e2e/smoke.png' });

const moved = Math.hypot(after.x - before.x, after.y - before.y);
await browser.close();

console.log('sim time:', after.t.toFixed(2), 's');
console.log('chef moved:', moved.toFixed(1), 'px', before, '->', { x: after.x, y: after.y });
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
if (after.t < 0.5) { console.error('FAIL: sim did not advance'); process.exit(1); }
if (moved < 5) { console.error('FAIL: chef did not move'); process.exit(1); }
console.log('OK: renders, sim advances, chef moves.');
