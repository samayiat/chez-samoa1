// Bootstrap: renderer + scene + fixed-perspective camera + fixed-step loop.
import * as THREE from 'three';
import { createState, stepSim } from './sim/state.js';
import { initInput, pollInput } from './engine/input.js';
import { startLoop } from './engine/loop.js';
import { createCamera, updateCamera, resizeCamera } from './engine/camera.js';
import { buildWorld, buildChef, addLights } from './render/meshes.js';
import { syncScene, commitPrev, attachScene } from './render/scene.js';
import { createImpactBus, decayImpact } from './fx/impact.js';

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
initInput(window);

let lastRenderT = performance.now() / 1000;

startLoop({
  tick(dt) {
    // hitstop freezes the SIM only; the camera keeps moving (see impact.js).
    if (bus.hitstop > 0) return;
    const input = pollInput();
    stepSim(state, dt, input);
    commitPrev(state);
  },
  render(alpha, now) {
    const t = now / 1000;
    const rdt = t - lastRenderT;
    lastRenderT = t;

    decayImpact(bus, rdt);
    syncScene(refs, state, bus.hitstop > 0 ? 1 : alpha);
    updateCamera(camera, bus, t);
    renderer.render(scene, camera);

    hud.textContent = state.msg
      ? `$${state.money}  served ${state.served}   —   ${state.msg}`
      : `$${state.money}  served ${state.served}  ·  bad ${state.badOrders}`
        + (state.nearStation ? `   · press E at ${state.nearStation}` : '')
        + (state.chef.carrying ? `   · carrying ${state.chef.carrying.dish}` : '');
  },
});

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  resizeCamera(camera, innerWidth / innerHeight);
});

// expose for the e2e harness to drive/inspect
window.__game = { state, bus, THREE };
