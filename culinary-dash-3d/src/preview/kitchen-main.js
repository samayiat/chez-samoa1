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
import { forwardVec } from '../sim/movement.js';
import { STATIONS, DISHES, COMBAT, RENT_DUE } from '../sim/data.js';
import { rpos } from './kitchen-space.js';
import { buildKitchen } from './kitchen-room.js';
import { createCustomers, DISH_COLOR } from './kitchen-customers.js';
import { createCats } from './kitchen-cats.js';
import { createBrawlers } from './kitchen-brawlers.js';
import { loadRun, saveRun, loadChef, saveChef } from '../engine/run.js';
import { initSfx, sfx } from '../engine/sfx.js';
import { buildChef } from './chef.js';
import { carriedModel } from './food.js';
import { lerp, smooth, clamp01, mat, box, put } from './util.js';

const app = document.getElementById('app');
// the persistent RUN — day number + banked money, carried across the fight hop
const run = loadRun();
{
  const k = document.querySelector('#start .kicker');
  if (k) k.textContent = run.day > 1
    ? `DAY ${run.day} · $${run.money} BANKED · RENT $${RENT_DUE(run.day)} DUE AT CLOSE`
    : `DAY 1 · RENT $${RENT_DUE(1)} DUE AT CLOSE`;
}
const startEl = document.getElementById('start');
// who's cooking — persisted choice; ?chef=male still forces him (deep links)
let chefSel = /[?&]chef=male/.test(location.search) ? 'm' : loadChef();
{
  const opts = [...document.querySelectorAll('.chefopt')];
  const syncSel = () => opts.forEach((x) => x.classList.toggle('on', x.dataset.chef === chefSel));
  syncSel();
  opts.forEach((b) => b.addEventListener('click', () => { chefSel = b.dataset.chef; saveChef(chefSel); syncSel(); }));
}
const H = {
  money: document.getElementById('money'), served: document.getElementById('served'),
  day: document.getElementById('day'), danger: document.getElementById('danger'),
  msg: document.getElementById('msg'), prompt: document.getElementById('prompt'),
  end: document.getElementById('dayend'), rent: document.getElementById('rent'),
  pay: document.getElementById('payBtn'),
};

let renderer, scene, camera, kitchen, customers, cats, brawlers, chef, cu, carry, composer, booted = false, lastT = 0;
let camShake = 0, lastPhase = 'service';
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
  brawlers = createBrawlers(scene);
  chef = buildChef({ male: chefSel === 'm' }); scene.add(chef); cu = chef.userData;

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
  // action cues -> the shared beep-synth voice + a quick "prepping" flourish
  if (state.sounds && state.sounds.length) {
    for (const s of state.sounds) {
      if (s === 'grab' || s === 'plate' || s === 'cook' || s === 'serve') workBurst = 1;
      sfx(s);
    }
    state.sounds.length = 0;
  }

  // the brawl storming in / clearing out — stings + no day clock while fighting
  if (state.phase !== lastPhase) {
    if (state.phase === 'brawl') sfx('brawl');
    else sfx(state.brawlResult === 'win' ? 'perfect' : 'burnt');
    lastPhase = state.phase;
  }
  // weighted hit events -> the impact bus (camera shake + the crack-and-thump)
  if (state.hits && state.hits.length) {
    for (const h of state.hits) { camShake = Math.min(0.55, camShake + h.w * 0.09); sfx(h.w > 1.4 ? 'ko' : 'hit'); }
    state.hits.length = 0;
  }

  // day clock + endings (the clock holds its breath during a brawl)
  if (state.phase !== 'brawl') dayT -= dt;
  if (dayT <= 0 && state.phase !== 'brawl' && state.customers.length === 0) return endDay('done');
}

function render(alpha, now) {
  const t = now / 1000; const rdt = Math.min(0.05, t - lastT); lastT = t;
  if (state) syncScene(rdt, t);
  // impact shake + the drunk lean (buzzed brawling tilts the whole room a touch)
  const drinks = state && state.phase === 'brawl' ? state.chef.drinks || 0 : 0;
  const sway = drinks >= 3 ? Math.sin(t * 1.3) * 0.12 * Math.min(1, (drinks - 2) / 3) : 0;
  if (camShake > 0.002 || sway) {
    camera.position.set(0.5 + (Math.random() - 0.5) * camShake + sway * 2, 13.6 + (Math.random() - 0.5) * camShake * 0.6, 15.4);
    camera.lookAt(0, 0.4, -0.4);
    camera.rotation.z += sway * 0.25;
    camShake *= Math.exp(-7 * rdt);
  } else if (camera.rotation.z !== 0) {
    camera.position.set(0.5, 13.6, 15.4); camera.lookAt(0, 0.4, -0.4);
  }
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

  // THE BRAWL — face where the sim faces, guard up, and swing the combo arms
  if (state.phase === 'brawl') {
    const F = forwardVec(c.facing);
    facing = Math.atan2(F.x, F.y);
    chef.rotation.y = facing;
    if (c.swing) {
      const k = clamp01(c.swing.t / c.swing.dur);
      const out = k < 0.42 ? k / 0.42 : 1 - (k - 0.42) / 0.58;
      const right = c.swing.step !== 1;                       // jab R, cross L, hook R
      const arm = right ? cu.armR : cu.armL, other = right ? cu.armL : cu.armR;
      arm.rotation.x = lerp(0.3, -1.7, out);
      arm.userData.elbow.rotation.x = lerp(1.5, 0.05, out);
      other.rotation.x = -0.5; other.userData.elbow.rotation.x = 1.3;   // guard
    } else {
      cu.armL.rotation.x = -0.5; cu.armL.userData.elbow.rotation.x = 1.2;
      cu.armR.rotation.x = -0.5; cu.armR.userData.elbow.rotation.x = 1.2;
    }
    // buzzed: the whole chef sways with the same rhythm steering the input drift
    const dr = c.drinks || 0;
    cu.body.rotation.z = dr >= 3 ? Math.sin(state.t * 6) * 0.07 * Math.min(1, (dr - 2) / 3) : 0;
  } else if (cu.body.rotation.z !== 0) {
    cu.body.rotation.z = 0;
  }
  brawlers && brawlers.sync(state, dt, t);
  customers.sync(state, dt, t);
}

// ---------- HUD ----------
function updateHud() {
  if (!state) return;
  H.money.textContent = '$' + (run.money + state.money);
  H.served.textContent = '★ ' + state.served;
  H.day.textContent = run.day + ' · ' + Math.max(0, Math.ceil(dayT)) + 's';
  const rentDue = RENT_DUE(run.day);
  H.rent.textContent = '$' + rentDue;
  H.rent.classList.toggle('ok', run.money + state.money >= rentDue);   // green once covered
  // pips: walkout danger during service, chef hearts during the brawl
  const brawl = state.phase === 'brawl';
  const max = brawl ? COMBAT.CHEF_HP : COMBAT.BRAWL_TRIGGER;
  const on = brawl ? Math.max(0, state.chef.hp) : state.badOrders;
  H.danger.innerHTML = '';
  for (let i = 0; i < max; i++) { const d = document.createElement('span'); d.className = 'pip' + (i < on ? ' on' : ''); H.danger.appendChild(d); }
  if (brawl) {
    const dr = state.chef.drinks || 0;
    H.prompt.textContent = 'FIGHT! E / ACTION to punch' +
      (dr >= 5 ? ` · WASTED (${dr} shots)` : dr > 0 ? ` · ${dr} shot${dr > 1 ? 's' : ''} of courage` : ' · drink at the bar for courage');
    H.prompt.style.opacity = '1';
  }
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
  const total = run.money + state.money;
  const rent = RENT_DUE(run.day);
  // bank the day; the choice below decides whether the rent leaves the bank
  saveRun({ ...run, money: total, served: run.served + state.served });
  sfx(win ? 'dayend' : 'burnt');
  // THE DECISION: pay up and sleep safe, or refuse and settle it in the alley.
  // A mob night (or an empty wallet) takes the choice away — Vince is coming.
  const canPay = win && total >= rent;
  H.end.querySelector('h2').textContent = win ? 'Closing time' : 'The mob is at the door';
  H.end.querySelector('p').innerHTML = win
    ? `Day ${run.day}: served <b>${state.served}</b>, banked <b>$${state.money}</b> — <b>$${total}</b> in the till.<br>` +
      (canPay ? `Vince wants <b>$${rent}</b> rent. Pay him… or don't.` : `Vince wants <b>$${rent}</b> rent — and you don't have it.`)
    : `Too many walkouts — and Vince came for the <b>$${rent}</b> rent anyway. <b>Step into the fight.</b>`;
  H.pay.style.display = canPay ? 'inline-block' : 'none';
  H.pay.textContent = `Pay the $${rent}`;
  H.pay.onclick = () => {
    saveRun({ day: run.day + 1, money: total - rent, served: run.served + state.served });
    sfx('serve');
    location.reload();                       // sleep; next day opens in the kitchen
  };
  const link = H.end.querySelector('a');
  link.style.display = 'inline-block';
  link.textContent = canPay ? `Refuse — fight him →` : `Face him →`;
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
  initSfx();                                       // unlock audio on the start tap
  window.addEventListener('pointerdown', initSfx);  // and keep it unlocked on mobile
  const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (touch) { const el = document.documentElement; try { (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); } catch (e) {} try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (e) {} }
  startEl.classList.add('gone'); setTimeout(() => startEl && startEl.remove(), 400);
}
document.getElementById('startBtn')?.addEventListener('click', begin);
addEventListener('keydown', (e) => { if (!booted && (e.code === 'Enter' || e.code === 'Space')) begin(); });
addEventListener('resize', () => { if (!renderer) return; camera.aspect = vw() / vh(); camera.updateProjectionMatrix(); renderer.setSize(vw(), vh()); composer.setSize(vw(), vh()); });
