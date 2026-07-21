// 2.5D service loop — the tested service sim (sim/state.js) rendered in the warm
// diner from a fixed diorama camera. Customers order, you walk to a station, cook
// or assemble, carry the plate, and serve before patience runs out. Too many
// walkouts and the mob comes back swinging — the tie into the 3D boss fight.
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
import { createState, stepSim } from '../sim/state.js';
import { STATIONS, DISHES, COMBAT } from '../sim/data.js';
import { rpos } from './kitchen-space.js';
import { buildKitchen } from './kitchen-room.js';
import { createCustomers, DISH_COLOR } from './kitchen-customers.js';
import { createCats } from './kitchen-cats.js';
import { loadRun, saveRun } from '../engine/run.js';
import { buildChef } from './chef.js';
import { carriedModel } from './food.js';
import { lerp, smooth, clamp01, mat, box, put } from './util.js';

const app = document.getElementById('app');
// the persistent RUN — day number + banked money, carried across the fight hop
const run = loadRun();
if (run.day > 1) {
  const k = document.querySelector('#start .kicker');
  if (k) k.textContent = `DAY ${run.day} · $${run.money} BANKED`;
}
const startEl = document.getElementById('start');
const H = {
  money: document.getElementById('money'), served: document.getElementById('served'),
  day: document.getElementById('day'), danger: document.getElementById('danger'),
  msg: document.getElementById('msg'), prompt: document.getElementById('prompt'),
  end: document.getElementById('dayend'),
};

let renderer, scene, camera, kitchen, customers, cats, chef, cu, carry, composer, booted = false, lastT = 0;
let state, walkPhase = 0, facing = Math.PI, dayT = 80, ended = 0, workBurst = 0, lastCarryKey = null;
const stationDef = Object.fromEntries(STATIONS.map((s) => [s.id, s]));

function boot() {
  renderer = new THREE.WebGLRenderer({ antialias: RIM_LIGHT, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, PIXEL_CAP + 0.25));
  renderer.setSize(vw(), vh());
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  app.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x2a1e14, 0.012);
  {
    const c = document.createElement('canvas'); c.width = 2; c.height = 256;
    const cx = c.getContext('2d'); const grd = cx.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#3a2a1c'); grd.addColorStop(0.6, '#241811'); grd.addColorStop(1, '#160e09');
    cx.fillStyle = grd; cx.fillRect(0, 0, 2, 256);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; scene.background = tex;
  }

  camera = new THREE.PerspectiveCamera(46, vw() / vh(), 0.1, 100);
  camera.position.set(0.5, 13.6, 15.4); camera.lookAt(0, 0.4, -0.4);   // pulled back for the 1.5x floor

  state = createState((Date_now_safe() & 0x7fffffff) || 12345, run.day);
  kitchen = buildKitchen(scene);
  customers = createCustomers(scene, kitchen.tables);
  cats = createCats(scene);
  const male = /[?&]chef=male/.test(location.search);   // ?chef=male shows the male chef
  chef = buildChef({ male }); scene.add(chef); cu = chef.userData;

  // what the chef carries — the real dish/ingredient model, swapped when it changes
  carry = new THREE.Group();
  carry.position.set(0, 1.02, 0.42); carry.visible = false; chef.add(carry);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(vw(), vh()), 0.58, 0.5, 0.85));
  composer.addPass(new OutputPass());

  lastT = performance.now() / 1000;
  startLoop({ tick, render });
  window.__kitchen = { state, stepSim, scene, chef, camera, THREE, setDay: (v) => { dayT = v; } };
}
// createState wants a seed; avoid Date.now() being unavailable in some sandboxes
function Date_now_safe() { try { return Date.now(); } catch (e) { return 12345; } }

function tick(dt) {
  if (ended) return;
  const input = pollInput();
  stepSim(state, dt, input);
  // action cues (grab/plate/cook/serve) -> a quick "prepping" flourish
  if (state.sounds && state.sounds.length) {
    for (const s of state.sounds) if (s === 'grab' || s === 'plate' || s === 'cook' || s === 'serve') workBurst = 1;
    state.sounds.length = 0;
  }

  // day clock + endings
  dayT -= dt;
  if (state.phase === 'brawl' || state.badOrders >= COMBAT.BRAWL_TRIGGER) return endDay('mob');
  if (dayT <= 0 && state.customers.length === 0) return endDay('done');
}

function render(alpha, now) {
  const t = now / 1000; const rdt = Math.min(0.05, t - lastT); lastT = t;
  if (state) syncScene(rdt, t);
  kitchen && kitchen.update(rdt, t, 1 - Math.max(0, dayT) / 80);   // third arg: day progress 0..1 (drives the sunset)
  cats && cats.update(rdt, t);
  updateHud();
  composer.render();
}

function syncScene(dt, t) {
  const c = state.chef;
  const p = rpos(c.x, c.y);
  chef.position.set(p.x, 0, p.z);
  workBurst = Math.max(0, workBurst - dt * 2.2);
  const spd = Math.hypot(c.vx, c.vy);
  const moving = spd > 4;
  const nearDef = state.nearStation ? stationDef[state.nearStation] : null;
  const choppingHere = nearDef && nearDef.kind === 'prep' && state.stations[state.nearStation]?.chopping;
  const working = !moving && (choppingHere || workBurst > 0.05);

  const kL = cu.legL.userData.knee, kR = cu.legR.userData.knee;
  const eL = cu.armL.userData.elbow, eR = cu.armR.userData.elbow;
  if (moving) {
    facing = Math.atan2(c.vx, c.vy);
    walkPhase += dt * 13;   // doubled speed -> quicker cadence
    cu.legL.rotation.x = Math.sin(walkPhase) * 0.6; cu.legR.rotation.x = -Math.sin(walkPhase) * 0.6;
    kL.rotation.x = 0.15 + Math.max(0, -Math.sin(walkPhase)) * 0.7;                    // knees bend on the back swing
    kR.rotation.x = 0.15 + Math.max(0, Math.sin(walkPhase)) * 0.7;
    cu.armL.rotation.x = -Math.sin(walkPhase) * 0.4; cu.armR.rotation.x = Math.sin(walkPhase) * 0.4;
    eL.rotation.x = 0.4; eR.rotation.x = 0.4;                                          // arms swing with a relaxed bend
    cu.body.position.y = Math.abs(Math.sin(walkPhase)) * 0.06;
  } else if (working) {
    // turn to the counter and work the ingredients — upper arms forward, forearms
    // bent up and moving over the counter (the elbows do the work now)
    if (nearDef) {
      const sp = rpos(nearDef.x, nearDef.y);
      let d = Math.atan2(sp.x - p.x, sp.z - p.z) - facing;
      while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      facing += d * smooth(dt, 12);
    }
    const w = t * 12;
    cu.armL.rotation.x = -0.95; cu.armR.rotation.x = -0.95;
    eL.rotation.x = 1.35 + Math.sin(w) * 0.4;
    eR.rotation.x = 1.35 + Math.sin(w + Math.PI) * 0.4;
    cu.legL.rotation.x = lerp(cu.legL.rotation.x, 0, smooth(dt, 10));
    cu.legR.rotation.x = lerp(cu.legR.rotation.x, 0, smooth(dt, 10));
    kL.rotation.x = lerp(kL.rotation.x, 0.1, smooth(dt, 10)); kR.rotation.x = lerp(kR.rotation.x, 0.1, smooth(dt, 10));
    cu.body.position.y = Math.abs(Math.sin(w)) * 0.025;
  } else {
    cu.legL.rotation.x = lerp(cu.legL.rotation.x, 0, smooth(dt, 10));
    cu.legR.rotation.x = lerp(cu.legR.rotation.x, 0, smooth(dt, 10));
    kL.rotation.x = lerp(kL.rotation.x, 0.08, smooth(dt, 10)); kR.rotation.x = lerp(kR.rotation.x, 0.08, smooth(dt, 10));
    cu.armL.rotation.x = lerp(cu.armL.rotation.x, 0, smooth(dt, 10));
    cu.armR.rotation.x = lerp(cu.armR.rotation.x, 0, smooth(dt, 10));
    eL.rotation.x = lerp(eL.rotation.x, 0.28, smooth(dt, 10)); eR.rotation.x = lerp(eR.rotation.x, 0.28, smooth(dt, 10));
    cu.body.position.y = lerp(cu.body.position.y, 0, smooth(dt, 8));
  }
  // carrying a dish: bring both arms forward to hold it (overrides the swing)
  if (c.carrying && !working) {
    cu.armL.rotation.x = lerp(cu.armL.rotation.x, -0.7, smooth(dt, 12));
    cu.armR.rotation.x = lerp(cu.armR.rotation.x, -0.7, smooth(dt, 12));
    eL.rotation.x = lerp(eL.rotation.x, 0.95, smooth(dt, 12));
    eR.rotation.x = lerp(eR.rotation.x, 0.95, smooth(dt, 12));
  }
  chef.rotation.y = facing;

  // carried dish/ingredient — rebuild the model only when what she holds changes
  const carryKey = c.carrying ? (c.carrying.kind + ':' + (c.carrying.dish || '')) : null;
  if (carryKey !== lastCarryKey) {
    while (carry.children.length) carry.remove(carry.children[0]);
    if (c.carrying) { const fm = carriedModel(c.carrying); fm.scale.setScalar(0.85); carry.add(fm); }
    lastCarryKey = carryKey;
  }
  carry.visible = !!c.carrying;
  if (c.carrying) carry.position.y = 1.02 + Math.sin(t * 3) * 0.02;

  // stations: cooking bars + ready + near-highlight
  for (const s of STATIONS) {
    const ref = kitchen.stations[s.id];
    ref.setNear(state.nearStation === s.id);
    if (s.kind === 'timing') {
      const st = state.stations[s.id];
      const cooking = st && st.cooking;
      let frac = 0, phase = 'raw';
      if (cooking) {
        frac = clamp01(st.t / s.cook);
        phase = st.t < s.cook ? 'raw' : st.t < s.cook + s.green ? 'perfect' : 'burnt';
      }
      ref.setCook(cooking, frac, phase);
      ref.setPlated(cooking && phase !== 'raw');
    } else if (s.kind === 'prep') {
      const st = state.stations[s.id];
      const chopping = st && st.chopping;
      const done = chopping && st.t >= s.cut;
      ref.setCook(chopping, chopping ? clamp01(st.t / s.cut) : 0, done ? 'perfect' : 'raw');
      ref.setPlated(done);
    } else if (s.kind === 'pass') {
      ref.setSlots(state.stations[s.id]?.slots || []);
    }
  }

  customers.sync(state, dt, t);
}

// ---------- HUD ----------
function updateHud() {
  if (!state) return;
  H.money.textContent = '$' + (run.money + state.money);
  H.served.textContent = '★ ' + state.served;
  H.day.textContent = run.day + ' · ' + Math.max(0, Math.ceil(dayT)) + 's';
  // walkout danger pips (out of the trigger)
  const bad = state.badOrders, max = COMBAT.BRAWL_TRIGGER;
  H.danger.innerHTML = '';
  for (let i = 0; i < max; i++) { const d = document.createElement('span'); d.className = 'pip' + (i < bad ? ' on' : ''); H.danger.appendChild(d); }
  H.msg.textContent = state.msg || '';
  H.msg.style.opacity = state.msg ? '1' : '0';
  // action prompt
  let hint = '';
  const c = state.chef;
  if (c.carrying) {
    if (c.carrying.kind === 'prep') hint = 'take chopped veg to the salad bar';
    else if (c.carrying.kind === 'raw') hint = 'take raw lobster to the pot';
    else if (c.carrying.cooked) hint = 'carry to the table & serve';
  } else if (state.nearStation) {
    const s = stationDef[state.nearStation];
    hint = s.kind === 'source' ? 'grab raw lobster'
      : s.kind === 'prep' ? 'chop vegetables'
      : s.kind === 'assemble' ? (s.id === 'salad' ? 'plate the salad' : 'pour a drink')
      : (s.verb || 'cook');
  }
  H.prompt.textContent = hint ? '▲ ' + hint : '';
  H.prompt.style.opacity = hint ? '1' : '0';
}

function endDay(kind) {
  if (ended) return; ended = kind === 'mob' ? -1 : 1;
  const win = kind === 'done';
  // bank the day into the run — every close is rent night, so the fight is next
  saveRun({ ...run, money: run.money + state.money, served: run.served + state.served });
  H.end.querySelector('h2').textContent = win ? 'Closing time' : 'The mob is at the door';
  H.end.querySelector('p').innerHTML = win
    ? `Day ${run.day}: served <b>${state.served}</b>, banked <b>$${state.money}</b> ($${run.money + state.money} total).<br>Vince is at the door about the rent.`
    : `Too many walkouts — and Vince came to collect anyway. <b>Step into the fight.</b>`;
  const link = H.end.querySelector('a');
  link.style.display = 'inline-block';
  link.href = '../vince/?rent=1';
  H.end.classList.add('show');
}

// ---------- start / lifecycle (WebGL-safe) ----------
function begin() {
  if (booted || (startEl && startEl.classList.contains('gone'))) return;
  try { boot(); booted = true; }
  catch (e) {
    const note = document.getElementById('glnote') || document.createElement('p');
    note.id = 'glnote'; note.style.cssText = 'color:#e0a06a;max-width:30rem;margin-top:6px;font-size:13px';
    note.textContent = "This 3D preview needs WebGL, which isn't available in this view. Open it in your phone's browser (Chrome or Safari).";
    if (startEl && !document.getElementById('glnote')) startEl.appendChild(note); return;
  }
  initInput(window); initTouch({ primaryLabel: 'ACTION', dodge: false });
  const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (touch) { const el = document.documentElement; try { (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); } catch (e) {} try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (e) {} }
  startEl.classList.add('gone'); setTimeout(() => startEl && startEl.remove(), 400);
}
document.getElementById('startBtn')?.addEventListener('click', begin);
addEventListener('keydown', (e) => { if (!booted && (e.code === 'Enter' || e.code === 'Space')) begin(); });
addEventListener('resize', () => { if (!renderer) return; camera.aspect = vw() / vh(); camera.updateProjectionMatrix(); renderer.setSize(vw(), vh()); composer.setSize(vw(), vh()); });
