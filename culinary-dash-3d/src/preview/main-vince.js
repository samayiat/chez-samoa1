// Vince preview — bootstrap. Wires the arena, boss, chef and FX into a cinematic,
// bloom-lit, shadow-cast beat-'em-up vertical slice. This is the "what would the 3D
// boss fight LOOK like" prototype: elevated procedural art, no models.
import * as THREE from 'three';
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
import { createChef } from './chef.js';
import { createFx } from './fx.js';
import { clamp01, lerp, smooth } from './util.js';

const app = document.getElementById('app');

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: RIM_LIGHT, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, PIXEL_CAP + 0.25));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
app.appendChild(renderer.domElement);

// ---------- scene + gradient backdrop ----------
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0b0810, 0.028);
{
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const ctx = c.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#1a1226'); grd.addColorStop(0.5, '#100b18'); grd.addColorStop(1, '#050407');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
}

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 6, 10);

const arena = buildArena(scene, renderer);
const fx = createFx(scene);
const boss = createBoss(scene);
const chef = createChef(scene);

// ---------- post: bloom ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.5, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- impact spine (local) ----------
const bus = { shake: 0, hitstop: 0, kickX: 0, kickZ: 0, punch: 0, hurtFlash: 0 };
function impact(w, dx = 0, dz = 0) {
  bus.shake = Math.min(bus.shake + w * 0.85, 6);
  bus.hitstop = Math.min(bus.hitstop + 0.02 + w * 0.03, 0.16);
  bus.kickX += dx * w * 0.35; bus.kickZ += dz * w * 0.35;
  bus.punch = Math.min(bus.punch + 0.5 + w * 0.35, 2.2);
}

// ---------- audio (tiny procedural) ----------
const audio = (() => {
  let ac = null;
  const on = () => { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); };
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

// ---------- HUD refs ----------
const H = {
  bossFill: document.getElementById('bossFill'),
  bossName: document.getElementById('bossName'),
  hearts: document.getElementById('hearts'),
  combo: document.getElementById('combo'),
  danger: document.getElementById('danger'),
  hurt: document.getElementById('hurt'),
  banner: document.getElementById('banner'),
  enraged: document.getElementById('enraged'),
};
const hud = { boss: 1, hp: 6, combo: 0, enraged: false };
let ended = 0;

// ---------- combat glue ----------
const tmp = new THREE.Vector3();
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
    if (boss.dead) { audio.win(); }
  }
}
function onSlam(target, r, phase) {
  fx.shockwave(target, r + 0.5, 0xff7a3a);
  fx.dust(target, 18);
  fx.flash(tmp.set(target.x, 0.6, target.z), 1.6, 0xff8a3a);
  impact(2.6, 0, 0);
  audio.slam();
  const d = Math.hypot(chef.pos.x - target.x, chef.pos.z - target.z);
  if (d < r) {
    if (chef.hurt(phase >= 3 ? 2 : 1)) { bus.hurtFlash = 1; audio.hurt(); bus.shake = Math.min(bus.shake + 3, 6); }
  }
}
function spawnGhost(p, f) { fx.ghost(p, f); }

// ---------- loop ----------
let lastT = performance.now() / 1000;
startLoop({
  tick(dt) {
    if (bus.hitstop > 0) return;              // hitstop freezes the sim, not the camera
    if (ended) return;
    const input = pollInput();
    chef.update(dt, { input, bossPos: boss.pos, hud, onPunch, spawnGhost, sound: (s) => audio[s] && audio[s]() });
    boss.update(dt, { chefPos: chef.pos, hud, onSlam, sound: (s) => audio[s] && audio[s]() });

    // end states
    if (boss.dead && boss.winT > 1.3 && !ended) { ended = 1; showBanner('VINCE IS DOWN', 'Your lease is safe — tap to rematch'); }
    if (chef.hp <= 0 && !ended) { ended = -1; showBanner('EVICTED', 'Vince got the better of you — tap to rematch'); }
  },
  render(alpha, now) {
    const t = now / 1000;
    const rdt = Math.min(0.05, t - lastT); lastT = t;

    // decay impact channels on the real clock
    if (bus.hitstop > 0) bus.hitstop = Math.max(0, bus.hitstop - rdt);
    bus.shake = Math.max(0, bus.shake - 10 * rdt);
    bus.kickX *= Math.exp(-12 * rdt); bus.kickZ *= Math.exp(-12 * rdt);
    bus.punch = Math.max(0, bus.punch - 3 * rdt);
    bus.hurtFlash = Math.max(0, bus.hurtFlash - 3 * rdt);

    arena.update(rdt, t);
    fx.update(rdt);
    updateCamera(rdt, t);
    updateHud();

    composer.render();
  },
});

// ---------- cinematic camera ----------
const camPos = new THREE.Vector3(0, 6, 10);
const camLook = new THREE.Vector3(0, 1.2, 0);
function updateCamera(dt, t) {
  const cp = chef.pos, bp = boss.pos;
  let fx2 = bp.x - cp.x, fz2 = bp.z - cp.z;
  const sep = Math.hypot(fx2, fz2) || 1; fx2 /= sep; fz2 /= sep;
  const rx = fz2, rz = -fx2;               // right vector
  // frame both: look at a point biased toward the boss
  const look = tmp.set(cp.x + fx2 * sep * 0.44, 1.3, cp.z + fz2 * sep * 0.44);
  // camera sits behind + well off to one side (a 3/4-profile), so a punch thrown
  // toward the boss reads laterally instead of hiding behind the chef's back.
  const back = 4.6 + sep * 0.42 - bus.punch * 0.7;
  const side = 4.8 + Math.sin(t * 0.25) * 0.5;   // gentle drift
  const height = 3.9 + sep * 0.12;
  const wantX = cp.x - fx2 * back + rx * side;
  const wantZ = cp.z - fz2 * back + rz * side;
  const s = smooth(dt, 4.5);
  camPos.x = lerp(camPos.x, wantX, s);
  camPos.y = lerp(camPos.y, height, s);
  camPos.z = lerp(camPos.z, wantZ, s);
  camLook.lerp(look, smooth(dt, 6));

  // shake + kick
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
  H.hearts.textContent = '❤'.repeat(Math.max(0, hud.hp)) + '<'.repeat(0) + '·'.repeat(Math.max(0, chef.maxHp - hud.hp));
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

// ---------- lifecycle ----------
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

const startEl = document.getElementById('start');
function begin() {
  if (!startEl || startEl.classList.contains('gone')) return;
  audio.on();
  initInput(window); initTouch();
  startEl.classList.add('gone');
  setTimeout(() => startEl.remove(), 400);
}
document.getElementById('startBtn')?.addEventListener('click', begin);
addEventListener('keydown', begin, { once: true });

// tap-to-rematch once ended
addEventListener('pointerdown', () => { if (ended) location.reload(); });
addEventListener('keydown', (e) => { if (ended && (e.code === 'Enter' || e.code === 'Space')) location.reload(); });

window.__vince = { boss, chef, bus, scene, THREE };
