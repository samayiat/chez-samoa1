import { chromium } from '@playwright/test';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 900, height: 520 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(process.env.URL || 'http://localhost:4175/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__game);

await p.evaluate(() => window.__game.startBrawl(window.__game.state, 4));
await p.waitForTimeout(300);
const enemies0 = await p.evaluate(() => window.__game.state.enemies.length);

// walk toward the mob and mash punch for a bit
await p.keyboard.down('KeyS');
for (let i = 0; i < 20; i++) { await p.keyboard.press('KeyE'); await p.waitForTimeout(120); }
await p.keyboard.up('KeyS');

const st = await p.evaluate(() => ({ enemies: window.__game.state.enemies.length, hp: window.__game.state.chef.hp, phase: window.__game.state.phase, shakePeak: window.__game.bus.shake }));
await p.screenshot({ path: 'e2e/brawl.png' });
await b.close();
console.log('enemies at start:', enemies0, '-> after mashing:', st.enemies, '| phase:', st.phase, '| chef hp:', st.hp);
if (errs.length) { console.error('PAGE ERRORS:\n' + errs.join('\n')); process.exit(1); }
