// Vince preview — bootstrap. Wires the arena, boss, chef and FX into a cinematic,
// bloom-lit, shadow-cast beat-'em-up vertical slice. This is the "what would the 3D
// boss fight LOOK like" prototype: elevated procedural art, no models.
//
// The 3D is booted LAZILY inside the start button (not at module load), so:
//  - the button handler is always attached even if WebGL/init would fail, and
//  - a viewer without WebGL (an inline preview sandbox, some in-app webviews) gets a
//    clear message to open it in a real browser instead of a dead button.
import * as THREE from 'three';
import { vw, vh } from '../engine/orient.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { startLoop } from '../engine/loop.js';
import { initInput, pollInput } from '../engine/input.js';
import { initTouch } from '../engine/touch.js';
import { PIXEL_CAP, RIM_LIGHT } from '../engine/quality.js';
import { buildArena } from './arena.js';
import { createBoss } from './boss.js';
import { loadRun, saveRun, clearRun, loadChef } from '../engine/run.js';
import { createChef } from './chef.js';
import { createFx } from './fx.js';
import { clamp01, lerp, smooth } from './util.js';

// ---------- impact spine (local) ----------
const bus = { shake: 0, hitstop: 0, kickX: 0, kickZ: 0, punch: 0, hurtFlash: 0 };
function impact(w, dx = 0, dz = 0) {
  bus.shake = Math.min(bus.shake + w * 0.85, 6);
  bus.hitstop = Math.min(bus.hitstop + 0.02 + w * 0.03, 0.16);
  bus.kickX += dx * w * 0.35; bus.kickZ += dz * w * 0.35;
  bus.punch = Math.min(bus.punch + 0.5 + w * 0.35, 2.2);
}

// ---------- audio (tiny procedural; tolerant of a missing AudioContext) ----------
const audio = (() => {
  let ac = null;
  const on = () => { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac && ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; } };
  function blip(freq, dur, type, gain, slideTo) {
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
  }
  function noise(dur, gain) {
    if (!ac) return;
    const n = ac.sampleRate * dur, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = ac.createBufferSource(); s.buffer = buf;
    const g = ac.createGain(); g.gain.value = gain;
    s.connect(g).connect(ac.destination); s.start();
  }
  return {
    on,
    hit: (w) => { blip(180 - w * 20, 0.12, 'square', 0.18, 70); noise(0.12, 0.12 + w * 0.05); },
    whiff: () => blip(320, 0.08, 'sawtooth', 0.04, 180),
    slam: () => { noise(0.3, 0.3); blip(70, 0.35, 'sine', 0.25, 35); },
    dash: () => blip(500, 0.12, 'triangle', 0.06, 900),
    hurt: () => blip(140, 0.2, 'sawtooth', 0.14, 60),
    win: () => { [0, 0.12, 0.24].forEach((t, i) => setTimeout(() => blip(400 + i * 160, 0.2, 'triangle', 0.12), t * 1000)); },
  };
})();

// ---------- DOM ----------
const app = document.getElementById('app');
const startEl = document.getElementById('start');
const H = {
  bossFill: document.getElementById('bossFill'),
  hearts: document.getElementById('hearts'),
  combo: document.getElementById('combo'),
  danger: document.getElementById('danger'),
  hurt: document.getElementById('hurt'),
  banner: document.getElementById('banner'),
  enraged: document.getElementById('enraged'),
};

// ---------- state (assigned in boot) ----------
let renderer, scene, camera, arena, fx, boss, chef, composer, booted = false;
const hud = { boss: 1, hp: 6, combo: 0, enraged: false };
const tmp = new THREE.Vector3();
let ended = 0, lastT = 0, resultPosted = false;

// ---------- embed mode (launched by the 2D game as an overlay) ----------
// When run inside an iframe / with ?embed, the arena takes a fight payload from
// the host (chef HP, etc.) and posts the result back, per docs/SEAM_CONTRACT.md.
// Standalone (the /vince/ preview) is unchanged.
const EMBED = new URLSearchParams(location.search).has('embed') || window.parent !== window;
// RENT NIGHT — launched from the kitchen's day end; the run is on the line
const RENT = new URLSearchParams(location.search).has('rent');
const run = loadRun();
let fightPayload = { chefHp: 6 };
function postToHost(msg) { try { window.parent.postMessage(msg, '*'); } catch (e) { /* no host */ } }
const camPos = new THREE.Vector3(0, 6, 10);
const camLook = new THREE.Vector3(0, 1.2, 0);
let camStrike = 0, camKO = 0, introT = 0;

// ---------- combat glue ----------
function onPunch(move, fistWorld) {
  const dx = boss.pos.x - chef.pos.x, dz = boss.pos.z - chef.pos.z;
  const d = Math.hypot(dx, dz);
  const reach = 1.6 + move.reach * 0.7;   // boss radius folded in
  if (d < reach && !boss.dead) {
    const nx = dx / (d || 1), nz = dz / (d || 1);
    boss.hit(move.w);
    impact(move.w, nx, nz);
    fx.sparkBurst(fistWorld, move.w, nx, nz);
    fx.flash(fistWorld, 0.5 + move.w * 0.3, 0xfff2c8);
    audio.hit(move.w);
    if (boss.dead) audio.win();
  }
}
// a hit that checks the chef against a circle (AOE, charge body, grab). Respects
// i-frames (dodge), damages, knocks back, and shakes.
function resolveStrike(center, r, dmg, dir = null, isGrab = false) {
  if (chef.invuln > 0) return false;
  const d = Math.hypot(chef.pos.x - center.x, chef.pos.z - center.z);
  if (d >= r) return false;
  if (!chef.hurt(dmg)) return false;
  bus.hurtFlash = 1; audio.hurt();
  bus.shake = Math.min(bus.shake + 2 + dmg, 6);
  const kx = dir ? dir.x : (chef.pos.x - center.x) / (d || 1);
  const kz = dir ? dir.z : (chef.pos.z - center.z) / (d || 1);
  chef.knockback(kx, kz, isGrab ? 5 : 2.6);
  fx.flash(tmp.set(chef.pos.x, 0.9, chef.pos.z), 0.9, 0xff4a4a);
  return true;
}
// a ground slam (pound / stomp / wrecking ball): FX + AOE resolution.
function onGroundStrike(target, r, dmg, isWreck) {
  fx.shockwave(target, r + 0.5, isWreck ? 0xff3020 : 0xff7a3a);
  fx.dust(target, isWreck ? 26 : 16);
  fx.flash(tmp.set(target.x, 0.6, target.z), isWreck ? 2.4 : 1.5, 0xff8a3a);
  impact(isWreck ? 3.6 : 2.4, 0, 0);
  audio.slam();
  resolveStrike(target, r, dmg);
}
const spawnGhost = (p, f) => fx.ghost(p, f);
const sound = (s) => audio[s] && audio[s]();

// ---------- loop callbacks ----------
function tick(dt) {
  if (bus.hitstop > 0) return;              // hitstop freezes the sim, not the camera
  if (ended) return;
  const input = pollInput();
  cameraRelative(input);                    // stick maps to the screen, not world axes
  chef.update(dt, { input, bossPos: boss.pos, hud, onPunch, spawnGhost, sound });
  boss.update(dt, { chefPos: chef.pos, chefInvuln: chef.invuln > 0, hud, fx, resolveStrike, onGroundStrike, sound });
  const sub = RENT ? '' : EMBED ? 'returning to the restaurant…' : 'tap to rematch';
  if (boss.dead && boss.winT > 1.3 && !ended) {
    ended = 1;
    showBanner('VINCE IS DOWN', RENT ? `Rent waived — day ${run.day + 1} starts tomorrow…` : 'Your lease is safe — ' + sub);
    reportResult('win'); settleRent('win');
  }
  if (chef.hp <= 0 && !ended) {
    ended = -1;
    showBanner('EVICTED', RENT ? 'He took the restaurant. Starting over…' : 'Vince got the better of you — ' + sub);
    reportResult('lose'); settleRent('lose');
  }
}
// hand the outcome back to the 2D game (it maps win/lose -> Beli + wrecked
// stations via its existing bossNightWin/Lose path). Held ~1.6s so the KO reads.
// rent night verdict: a win banks the day and unlocks the next (harder) one; a
// loss ends the run. Either way we ride back to the kitchen after the KO beat.
function settleRent(outcome) {
  if (!RENT) return;
  if (outcome === 'win') saveRun({ ...run, day: run.day + 1 });
  else clearRun();
  setTimeout(() => { location.href = '../kitchen/'; }, 3200);
}
function reportResult(outcome) {
  if (!EMBED || resultPosted) return;
  resultPosted = true;
  setTimeout(() => postToHost({ type: 'chez:fightResult', result: { outcome, boss: 'vince', chefHpLeft: Math.max(0, chef.hp) } }), 1600);
}
function render(alpha, now) {
  const t = now / 1000;
  const rdt = Math.min(0.05, t - lastT); lastT = t;
  if (bus.hitstop > 0) bus.hitstop = Math.max(0, bus.hitstop - rdt);
  bus.shake = Math.max(0, bus.shake - 10 * rdt);
  bus.kickX *= Math.exp(-12 * rdt); bus.kickZ *= Math.exp(-12 * rdt);
  bus.punch = Math.max(0, bus.punch - 3 * rdt);
  bus.hurtFlash = Math.max(0, bus.hurtFlash - 3 * rdt);
  introT = Math.max(0, introT - rdt * 1.1);

  arena.update(rdt, t);
  fx.update(rdt, {
    chefPos: chef.pos,
    invuln: chef.invuln > 0,
    hit: (dmg, pos) => { if (chef.hurt(dmg)) { bus.hurtFlash = 1; audio.hurt(); bus.shake = Math.min(bus.shake + 2, 6); fx.flash(pos, 0.8, 0xffd24a); } },
  });
  updateCamera(rdt, t);
  updateHud();
  composer.render();
}

// Rotate the raw stick/keys into the CAMERA's frame so "up" is always "away from
// the camera / up the screen", regardless of where the orbiting camera sits. This
// is what kills the "controls randomly invert" feeling when the camera crosses to
// the chef's other side (e.g. after Vince charges past her).
function cameraRelative(input) {
  let fx = chef.pos.x - camera.position.x, fz = chef.pos.z - camera.position.z;
  const m = Math.hypot(fx, fz);
  if (m < 0.001) return;
  fx /= m; fz /= m;                 // camera-forward on the ground plane
  const rx = -fz, rz = fx;          // camera-right (screen-right)
  const ix = input.move.x, iy = input.move.y;
  input.move.x = ix * rx + (-iy) * fx;
  input.move.y = ix * rz + (-iy) * fz;
}

// ---------- cinematic camera ----------
function updateCamera(dt, t) {
  const cp = chef.pos, bp = boss.pos;
  let fx2 = bp.x - cp.x, fz2 = bp.z - cp.z;
  const sep = Math.hypot(fx2, fz2) || 1; fx2 /= sep; fz2 /= sep;
  const rx = fz2, rz = -fx2;               // right vector

  // swing toward a profile while the chef is mid-punch (strike reads laterally),
  // and dolly in on the KO for a finisher beat.
  camStrike = lerp(camStrike, chef.punchT > 0 ? 1 : 0, smooth(dt, chef.punchT > 0 ? 11 : 3.5));
  camKO = lerp(camKO, boss.dead ? 1 : 0, smooth(dt, 1.6));

  const lookBias = boss.dead ? 0.75 : 0.44;
  const look = tmp.set(cp.x + fx2 * sep * lookBias, 1.3 + camKO * 0.2, cp.z + fz2 * sep * lookBias);
  // camera sits behind + well off to one side (3/4-profile); swoops in on arrival.
  const back = 4.6 - camStrike * 1.3 - camKO * 1.6 + sep * 0.42 - bus.punch * 0.7 + introT * 4;
  const side = 4.8 + camStrike * 2.8 + Math.sin(t * 0.25) * 0.5;
  const height = 3.9 + sep * 0.12 - camKO * 0.9 + introT * 7;
  const wantX = cp.x - fx2 * back + rx * side;
  const wantZ = cp.z - fz2 * back + rz * side;
  const s = smooth(dt, 4.5);
  camPos.x = lerp(camPos.x, wantX, s);
  camPos.y = lerp(camPos.y, height, s);
  camPos.z = lerp(camPos.z, wantZ, s);
  camLook.lerp(look, smooth(dt, 6));

  const sh = bus.shake * 0.05;
  camera.position.set(
    camPos.x + (Math.random() - 0.5) * sh + bus.kickX,
    camPos.y + (Math.random() - 0.5) * sh * 0.6,
    camPos.z + (Math.random() - 0.5) * sh + bus.kickZ
  );
  camera.lookAt(camLook.x, camLook.y + (Math.random() - 0.5) * sh * 0.3, camLook.z);
}

// ---------- HUD ----------
function updateHud() {
  H.bossFill.style.width = (clamp01(hud.boss) * 100).toFixed(1) + '%';
  H.hearts.textContent = '❤'.repeat(Math.max(0, hud.hp)) + '·'.repeat(Math.max(0, chef.maxHp - hud.hp));
  H.combo.style.opacity = hud.combo >= 2 ? '1' : '0';
  H.combo.textContent = hud.combo >= 2 ? 'COMBO ×' + hud.combo : '';
  H.danger.style.opacity = (boss.telegraph * 0.55).toFixed(2);
  H.hurt.style.opacity = (bus.hurtFlash * 0.6).toFixed(2);
  H.enraged.classList.toggle('on', !!hud.enraged && !ended);
}
function showBanner(title, sub) {
  H.banner.querySelector('h2').textContent = title;
  H.banner.querySelector('p').textContent = sub;
  H.banner.classList.add('show');
}

// ---------- boot the 3D (may throw if WebGL is unavailable) ----------
function boot() {
  renderer = new THREE.WebGLRenderer({ antialias: RIM_LIGHT, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, PIXEL_CAP + 0.25));
  renderer.setSize(vw(), vh());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  app.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b0810, 0.028);
  {
    const c = document.createElement('canvas'); c.width = 2; c.height = 256;
    const cx = c.getContext('2d');
    const grd = cx.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#1a1226'); grd.addColorStop(0.5, '#100b18'); grd.addColorStop(1, '#050407');
    cx.fillStyle = grd; cx.fillRect(0, 0, 2, 256);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex;
  }

  camera = new THREE.PerspectiveCamera(50, vw() / vh(), 0.1, 100);
  camera.position.set(0, 6, 10);

  arena = buildArena(scene, renderer);
  fx = createFx(scene);
  boss = createBoss(scene);
  if (RENT && run.day > 1) {
    // Vince gets meaner as the days stack up
    const k = 1 + 0.15 * (run.day - 1);
    boss.hp = Math.round(boss.hp * k); boss.maxHp = boss.hp;
  }
  chef = createChef(scene, { male: loadChef() === 'm' });   // same chef as the kitchen

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(vw(), vh()), 0.7, 0.5, 0.82));
  composer.addPass(new OutputPass());

  lastT = performance.now() / 1000;
  startLoop({ tick, render });
  window.__vince = { boss, chef, bus, scene, THREE };
}

// ---------- start / lifecycle ----------
function begin() {
  if (booted || (startEl && startEl.classList.contains('gone'))) return;
  audio.on();
  try {
    boot();
    booted = true;
    // apply the host's fight payload (chef HP scaled by her upgrades, etc.)
    if (chef && fightPayload.chefHp) { chef.maxHp = fightPayload.chefHp; chef.hp = chef.maxHp; hud.hp = chef.hp; }
  } catch (e) {
    // no WebGL here — tell the player how to actually run it, keep the button alive
    const note = document.getElementById('glnote') || document.createElement('p');
    note.id = 'glnote';
    note.style.cssText = 'color:#ff9a8a;max-width:30rem;margin-top:6px;font-size:13px';
    note.textContent = "This 3D preview needs WebGL, which isn't available in this view. Open the file in your phone's browser (Chrome or Safari) and tap Face him there.";
    if (startEl && !document.getElementById('glnote')) startEl.appendChild(note);
    return;
  }
  initInput(window); initTouch();
  goLandscape();
  startEl.classList.add('gone');
  setTimeout(() => startEl && startEl.remove(), 400);
  introT = 1.3; bus.shake = 5; audio.slam();   // arrival beat: swoop in + Vince announces himself
}

// force landscape on the first gesture: fullscreen (so the lock is allowed) then
// lock the orientation. Both are best-effort — iOS Safari ignores the lock, which
// is why the CSS "rotate your device" guard in portrait is the real backstop.
function goLandscape() {
  const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (!touch) return;                 // don't yank a desktop mouse user into fullscreen
  const el = document.documentElement;
  const fs = el.requestFullscreen || el.webkitRequestFullscreen;
  try { fs && fs.call(el).then?.(lockLandscape).catch?.(lockLandscape); } catch (e) { lockLandscape(); }
  lockLandscape();
}
function lockLandscape() {
  try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* unsupported */ }
}

document.getElementById('startBtn')?.addEventListener('click', begin);
addEventListener('keydown', (e) => { if (!booted && (e.code === 'Enter' || e.code === 'Space')) begin(); });

// embed: take the fight payload from the 2D host, then auto-start. If the host
// never speaks (opened directly), fall back to starting on its own so it's never
// stuck on the overlay.
if (EMBED) {
  addEventListener('message', (e) => {
    const d = e.data;
    if (d && d.type === 'chez:startFight') { fightPayload = { ...fightPayload, ...(d.payload || {}) }; begin(); }
  });
  postToHost({ type: 'chez:ready' });
  setTimeout(() => { if (!booted) begin(); }, 1800);
}

addEventListener('resize', () => {
  if (!renderer) return;
  camera.aspect = vw() / vh(); camera.updateProjectionMatrix();
  renderer.setSize(vw(), vh()); composer.setSize(vw(), vh());
});

// tap / key to rematch once the fight has ended — standalone only; embedded, the
// host closes the overlay after it gets the result.
addEventListener('pointerdown', () => { if (ended && !EMBED) location.reload(); });
addEventListener('keydown', (e) => { if (ended && !EMBED && (e.code === 'Enter' || e.code === 'Space')) location.reload(); });
