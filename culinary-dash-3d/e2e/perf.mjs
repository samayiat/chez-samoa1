// Frame-time probe at a mobile profile (high deviceScaleFactor = the real cost).
// Loads the built single-file game, starts a brawl (heaviest scene), and counts
// real requestAnimationFrame ticks over a window to get average FPS.
import { chromium } from '@playwright/test';

const FILE = process.env.FILE || 'file:///home/user/chez-samoa1/culinary-dash-3d/play/index.html';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 400, height: 760 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
await p.goto(FILE, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__game);
await p.evaluate(() => { document.getElementById('startBtn')?.click(); window.__game.startBrawl(window.__game.state, 4); });
await p.waitForTimeout(600); // warm up

const fps = await p.evaluate(() => new Promise((resolve) => {
  let frames = 0; const t0 = performance.now();
  function tick() { frames++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else resolve(frames / ((performance.now() - t0) / 1000)); }
  requestAnimationFrame(tick);
}));
const dpr = await p.evaluate(() => window.__game.renderer?.getPixelRatio?.() ?? null);
await b.close();
console.log(`avg FPS: ${fps.toFixed(1)} | frame time: ${(1000 / fps).toFixed(1)}ms | renderer pixelRatio: ${dpr}`);
