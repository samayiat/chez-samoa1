// 2.5D kitchen look-proof — the diner in the same 3D world as the boss fight, shot
// from a FIXED diorama camera so the whole floor reads at once. Walk her around to
// feel the legibility. Reuses the fight's chef model (Blender models come later).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { startLoop } from '../engine/loop.js';
import { initInput, pollInput } from '../engine/input.js';
import { initTouch } from '../engine/touch.js';
import { PIXEL_CAP, RIM_LIGHT } from '../engine/quality.js';
import { buildKitchen } from './kitchen-room.js';
import { buildChef } from './chef.js';
import { lerp, smooth, clamp01 } from './util.js';

const app = document.getElementById('app');
const startEl = document.getElementById('start');

let renderer, scene, camera, kitchen, chef, cu, composer, booted = false, lastT = 0;
let walkPhase = 0, facing = Math.PI;
const pos = new THREE.Vector3(0, 0, -1.8);

function boot() {
  renderer = new THREE.WebGLRenderer({ antialias: RIM_LIGHT, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, PIXEL_CAP + 0.25));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  app.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x2a1e14, 0.012);
  {
    const c = document.createElement('canvas'); c.width = 2; c.height = 256;
    const cx = c.getContext('2d');
    const grd = cx.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#3a2a1c'); grd.addColorStop(0.6, '#241811'); grd.addColorStop(1, '#160e09');
    cx.fillStyle = grd; cx.fillRect(0, 0, 2, 256);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; scene.background = tex;
  }

  // FIXED diorama camera — angled down over the floor, framing the whole room.
  camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0.5, 8.6, 9.6);
  camera.lookAt(0, 0.6, -1.6);

  kitchen = buildKitchen(scene);
  chef = buildChef(); scene.add(chef); chef.position.copy(pos);
  cu = chef.userData;

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.38, 0.5, 0.9));
  composer.addPass(new OutputPass());

  lastT = performance.now() / 1000;
  startLoop({ tick, render });
  window.__kitchen = { scene, chef, camera, THREE };
}

const SPEED = 4.4;
// floor bounds: dining side + behind the pass, but not through walls
function clampFloor(p) {
  p.x = Math.max(-7, Math.min(7, p.x));
  p.z = Math.max(-5.6, Math.min(4.6, p.z));
  // don't walk through the solid pass counter band (z ≈ -3.4), except the gaps at the ends
  if (p.z > -4 && p.z < -2.9 && Math.abs(p.x) < 5.4) p.z = p.z > -3.4 ? -2.9 : -4;
}

function tick(dt) {
  const input = pollInput();
  // fixed camera: stick up = into the screen (toward the pass), right = +x
  const mx = input.move.x * SPEED, mz = input.move.y * SPEED;
  const moving = Math.hypot(mx, mz) > 0.4;
  pos.x += mx * dt; pos.z += mz * dt;
  clampFloor(pos);
  chef.position.set(pos.x, 0, pos.z);

  if (moving) {
    const want = Math.atan2(mx, mz);
    let d = want - facing; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    facing += d * smooth(dt, 16);
    walkPhase += dt * 10;
    cu.legL.rotation.x = Math.sin(walkPhase) * 0.6; cu.legR.rotation.x = -Math.sin(walkPhase) * 0.6;
    cu.armL.rotation.x = -Math.sin(walkPhase) * 0.4; cu.armR.rotation.x = Math.sin(walkPhase) * 0.4;
    cu.body.position.y = Math.abs(Math.sin(walkPhase)) * 0.06;
  } else {
    cu.legL.rotation.x = lerp(cu.legL.rotation.x, 0, smooth(dt, 10));
    cu.legR.rotation.x = lerp(cu.legR.rotation.x, 0, smooth(dt, 10));
    cu.armL.rotation.x = lerp(cu.armL.rotation.x, 0, smooth(dt, 10));
    cu.armR.rotation.x = lerp(cu.armR.rotation.x, 0, smooth(dt, 10));
    cu.body.position.y = lerp(cu.body.position.y, Math.sin(performance.now() / 1000 * 1.6) * 0.012, smooth(dt, 6));
  }
  chef.rotation.y = facing;
}

function render(alpha, now) {
  const t = now / 1000; const rdt = Math.min(0.05, t - lastT); lastT = t;
  kitchen.update(rdt, t);
  composer.render();
}

// ---------- start / lifecycle (WebGL-safe, like the fight) ----------
function begin() {
  if (booted || (startEl && startEl.classList.contains('gone'))) return;
  try { boot(); booted = true; }
  catch (e) {
    const note = document.getElementById('glnote') || document.createElement('p');
    note.id = 'glnote'; note.style.cssText = 'color:#e0a06a;max-width:30rem;margin-top:6px;font-size:13px';
    note.textContent = "This 3D preview needs WebGL, which isn't available in this view. Open it in your phone's browser (Chrome or Safari).";
    if (startEl && !document.getElementById('glnote')) startEl.appendChild(note);
    return;
  }
  initInput(window); initTouch();
  const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (touch) { const el = document.documentElement; try { (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); } catch (e) {} try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (e) {} }
  startEl.classList.add('gone'); setTimeout(() => startEl && startEl.remove(), 400);
}
document.getElementById('startBtn')?.addEventListener('click', begin);
addEventListener('keydown', (e) => { if (!booted && (e.code === 'Enter' || e.code === 'Space')) begin(); });
addEventListener('resize', () => { if (!renderer) return; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });
