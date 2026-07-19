import { chromium } from '@playwright/test';
import { pathToFileURL } from 'url';
import path from 'path';

const file = pathToFileURL(path.resolve('dist-kitchen/kitchen.html')).href;
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
const startSel = await page.evaluate(() => {
  const b = document.querySelector('#startBtn') || [...document.querySelectorAll('button')].find(x => /start|begin|play|open/i.test(x.textContent));
  if (b) { b.click(); return b.textContent.trim(); }
  return null;
});
await page.waitForTimeout(600);

// drive the sim forward deterministically so customers arrive + orders show
await page.evaluate(() => { for (let i = 0; i < 600; i++) window.__kitchen.stepSim(window.__kitchen.state, 1/60, {move:{x:0,y:0},primary:false,primaryDown:false}); });
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(shotDir, 'kitchen-1-gameplay.png') });

// close-up: point the camera at the first waiting customer's order bubble
await page.evaluate(() => {
  const k = window.__kitchen;
  const cust = k.state.customers.find(c => c.state === 'waiting');
  if (cust) {
    // find the bubble in scene by walking groups is hard; instead reframe camera
    k.camera.position.set(k.camera.position.x, 3.4, k.camera.position.z + 2.5);
  }
});
await page.evaluate(() => { for (let i = 0; i < 60; i++) window.__kitchen.stepSim(window.__kitchen.state, 1/60, {move:{x:0,y:0},primary:false,primaryDown:false}); });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(shotDir, 'kitchen-2-closeup.png') });

const st = await page.evaluate(() => {
  const k = window.__kitchen;
  return {
    customers: k.state.customers.length,
    waiting: k.state.customers.filter(c => c.state === 'waiting').length,
    dishes: k.state.customers.map(c => c.dish),
    carrying: k.state.chef.carrying,
    children: k.scene.children.length,
  };
});

await browser.close();
console.log('STATE:', JSON.stringify(st));
console.log('START:', startSel);
console.log('ERRORS:', errors.length ? '\n' + errors.join('\n') : 'none');
process.exit(errors.length ? 1 : 0);
