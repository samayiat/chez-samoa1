// Bootstrap: renderer + scene + fixed-perspective camera + fixed-step loop.
import * as THREE from 'three';
import { createState, stepSim } from './sim/state.js';
import { to3 } from './sim/data.js';
import { initInput, pollInput } from './engine/input.js';
import { initTouch } from './engine/touch.js';
import { startLoop } from './engine/loop.js';
import { createCamera, updateCamera, resizeCamera } from './engine/camera.js';
import { buildWorld, buildChef, addLights } from './render/meshes.js';
import { syncScene, commitPrev, attachScene } from './render/scene.js';
import { createSparks } from './render/sparks.js';
import { createAudio } from './fx/audio.js';
import { createImpactBus, decayImpact, impact } from './fx/impact.js';
import { startBrawl } from './sim/combat.js';

const app = document.getElementById('app');
const hud = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0810);
scene.fog = new THREE.Fog(0x0b0810, 40, 80);

const camera = createCamera(innerWidth / innerHeight);
addLights(scene);
attachScene(scene);
const refs = buildWorld(scene);
refs.chef = buildChef(scene);

const state = createState();
const bus = createImpactBus();
const sparks = createSparks(scene);
const audio = createAudio();
bus.onSound = (w) => audio.hit(w);   // impact spine drives combat sound
initInput(window);
initTouch();

let lastRenderT = performance.now() / 1000;

startLoop({
  tick(dt) {
    // hitstop freezes the SIM only; the camera keeps moving (see impact.js).
    if (bus.hitstop > 0) return;
    const input = pollInput();
    stepSim(state, dt, input);
    // drain weighted hit events -> the impact spine (one weight, every channel)
    if (state.hits && state.hits.length) {
      for (const h of state.hits) {
        const p = to3(h.x, h.y);
        impact(bus, h.w, p.x, 1.2, p.z, h.dx, h.dy);
      }
      state.hits.length = 0;
    }
    // drain service sfx cues
    if (state.sounds && state.sounds.length) {
      for (const s of state.sounds) audio[s]?.();
      state.sounds.length = 0;
    }
    commitPrev(state);
  },
  render(alpha, now) {
    const t = now / 1000;
    const rdt = t - lastRenderT;
    lastRenderT = t;

    decayImpact(bus, rdt);
    sparks.update(bus, rdt);
    syncScene(refs, state, bus.hitstop > 0 ? 1 : alpha);
    updateCamera(camera, bus, t);
    renderer.render(scene, camera);

    if (state.phase === 'brawl') {
      const hp = '❤'.repeat(Math.max(0, state.chef.hp)) + '·'.repeat(Math.max(0, state.chef.maxHp - state.chef.hp));
      hud.textContent = `BRAWL   HP ${hp}   enemies ${state.enemies.length}`
        + (state.msg ? `   —   ${state.msg}` : '   · E to punch');
    } else {
      hud.textContent = state.msg
        ? `$${state.money}  served ${state.served}   —   ${state.msg}`
        : `$${state.money}  served ${state.served}  ·  bad ${state.badOrders}/${5}`
          + (state.nearStation ? `   · press E at ${state.nearStation}` : '')
          + (state.chef.carrying ? `   · carrying ${state.chef.carrying.dish}` : '');
    }
  },
});

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  resizeCamera(camera, innerWidth / innerHeight);
});

// dev: press B to trigger the brawl on demand
addEventListener('keydown', (e) => {
  if (e.code === 'KeyB' && state.phase === 'service') startBrawl(state);
});

// dismiss the start overlay on button, key, or tap
const startEl = document.getElementById('start');
function dismissStart() {
  if (!startEl || startEl.classList.contains('gone')) return;
  audio.resume();               // unlock Web Audio on the first gesture
  startEl.classList.add('gone');
  setTimeout(() => startEl.remove(), 450);
}
document.getElementById('startBtn')?.addEventListener('click', dismissStart);
addEventListener('keydown', dismissStart, { once: true });
addEventListener('pointerdown', dismissStart, { once: true });

// expose for the e2e harness to drive/inspect
window.__game = { state, bus, THREE, startBrawl };
