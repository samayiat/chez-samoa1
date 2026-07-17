import { chromium } from '@playwright/test';
import { pathToFileURL } from 'url';
import path from 'path';
const file = pathToFileURL(path.resolve('dist-vince/vince.html')).href;
async function run(label, killGL) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  if (killGL) await page.addInitScript(() => { const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(t){ if(String(t).includes('webgl')) return null; return orig.call(this,t); }; });
  await page.goto(file, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.click('#startBtn').catch(e => errs.push('click: ' + e.message));
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => ({
    gone: document.getElementById('start')?.classList.contains('gone') ?? 'no-el',
    gameUp: !!window.__vince,
    glnote: !!document.getElementById('glnote'),
  }));
  console.log(`[${label}] overlayDismissed=${r.gone} gameUp=${r.gameUp} glnoteShown=${r.glnote} pageerrors=${errs.length}`);
  errs.slice(0,3).forEach(e => console.log('   ' + e));
  await browser.close();
}
await run('normal-GL', false);
await run('no-WebGL', true);
