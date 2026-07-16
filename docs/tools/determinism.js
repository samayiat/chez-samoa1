/* DETERMINISM PROBE — can two devices run the same game?
 *
 * Boots the built game TWICE in two isolated VM contexts ("two RP5s"), feeds both the IDENTICAL
 * scripted input at a FIXED timestep, snapshots the sim state after every frame, and reports the first
 * frame where they disagree — and which field.
 *
 * Why this exists: lockstep multiplayer (send inputs, both sides simulate) needs update() to be a pure
 * function of (state, input, dt). It currently isn't, and auditing 86 Math.random() + 64
 * performance.now() call sites by eye would miss things — e.g. the drunk-drift steers chef.x off
 * performance.now(), which no one would think to look for. This finds them instead of guessing.
 *
 *   node docs/tools/determinism.js [frames] [--verbose]
 *   node docs/tools/determinism.js [frames] --seeded     <- pretend Math.random is already fixed
 *
 * --seeded replaces Math.random with an identical seeded LCG on BOTH devices. That answers the question
 * that actually matters for scoping: once the 63 sim-side Math.random calls are seeded, is anything ELSE
 * still nondeterministic? Whatever it reports is the part nobody would have found by reading.
 *
 * EXIT 0 = the two devices agree (lockstep is possible for the exercised paths).
 * EXIT 1 = they diverged; the report names the frame and the field.
 *
 * NB a PASS here only covers the code paths the script below actually walks. It is evidence, not proof.
 */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const BUILT = path.join(ROOT, "culinary-dash.html");

const FRAMES = Number(process.argv[2]) || 900;      // ~15s at 60Hz
const VERBOSE = process.argv.includes("--verbose");
const SEEDED = process.argv.includes("--seeded");
const STEP = 1 / 60;                                 // the fixed step lockstep would use

// ---- pull the script out of the built file (same trick the other probes use) ----
function gameScript() {
  const html = fs.readFileSync(BUILT, "utf8");
  const a = html.indexOf("<script>");
  const b = html.indexOf("</script>", a);
  if (a < 0 || b < 0) throw new Error("no <script> in " + BUILT);
  return html.slice(a + 8, b);
}

// ---- a browser stub, per device ----
function makeCtx() {
  return new Proxy({}, {
    get(_t, k) {
      if (k === "canvas") return { width: 1920, height: 1080 };
      if (k === "createImageData" || k === "getImageData")
        return (w = 1, h = 1) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
      if (k === "measureText") return () => ({ width: 10 });
      if (k === "createLinearGradient" || k === "createRadialGradient" || k === "createPattern")
        return () => ({ addColorStop() {} });
      return typeof k === "string" ? (function () {}) : undefined;
    },
    set() { return true; },
  });
}

/* Each device gets its OWN clock. That's the whole point: two machines don't share performance.now().
 * Device B's clock is deliberately offset and running at a slightly different rate, exactly like two
 * consoles booted at different times. If the sim reads wall-clock ANYWHERE, this is what exposes it. */
function makeDevice(name, clockOffset, clockRate) {
  let t = clockOffset;
  /* --seeded: hand both devices the SAME deterministic Math.random. Not a fix — a probe. It simulates
     the world where step 1 (seeded rnd) is already done, so whatever still diverges is the real
     remaining work. */
  let seed = 0x2f6f2b79;
  const lcg = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const M = SEEDED ? Object.create(Math) : Math;
  if (SEEDED) M.random = lcg;
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    document: {
      getElementById: () => ({ getContext: () => makeCtx(), addEventListener() {}, style: {},
                               width: 1920, height: 1080, getBoundingClientRect: () => ({ left:0, top:0, width:1920, height:1080 }) }),
      createElement: () => ({ getContext: () => makeCtx(), width: 0, height: 0, style: {} }),
      addEventListener() {}, body: { appendChild() {}, style: {} },
    },
    window: { addEventListener() {}, innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 1,
              requestAnimationFrame: () => 0, matchMedia: () => ({ matches: false, addEventListener(){} }) },
    navigator: { userAgent: "node", vibrate: () => true },
    performance: { now: () => (t += clockRate * 16.667) },   // ticks per call, per device
    requestAnimationFrame: () => 0,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    Image: function () { return { addEventListener() {}, set src(v) {}, get src() { return ""; },
                                  complete: false, naturalWidth: 0, naturalHeight: 0, width: 16, height: 16 }; },
    AudioContext: function () { return { createOscillator: () => ({ connect(){}, start(){}, stop(){},
                                           frequency: { setValueAtTime(){}, exponentialRampToValueAtTime(){} }, type: "" }),
                                         createGain: () => ({ connect(){}, gain: { setValueAtTime(){},
                                           exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){}, value: 0 } }),
                                         destination: {}, currentTime: 0, state: "running", resume(){} }; },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    Math: M, JSON, Date, Object, Array, String, Number, Boolean, Set, Map, Promise, isNaN, parseInt, parseFloat,
    Uint8ClampedArray, Uint8Array, Float32Array, Infinity, NaN, undefined,
  };
  sandbox.globalThis = sandbox;
  sandbox.webkitAudioContext = sandbox.AudioContext;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(gameScript(), ctx, { filename: name + ".js" });
  return { name, sandbox, ctx };
}

/* THE SNAPSHOT — sim state only, never render caches.
 * Floats are compared EXACTLY and on purpose: lockstep desync starts as one ulp and compounds. If this
 * ever needs a tolerance, lockstep is already dead and host-authoritative is the answer instead. */
const SNAP = `(() => {
  const r = (v) => (typeof v === "number" ? (Object.is(v, -0) ? 0 : v) : v);
  const chefS = [r(chef.x), r(chef.y), chef.dir, chef.moving, chef.carry && chef.carry.id || null];
  const cust = (typeof customers !== "undefined" ? customers : []).map(c =>
      [r(c.x), r(c.y), c.dir, c.state, r(c.hearts), c.type, r(c.orderT), c.dish || null]);
  const kats = (typeof cats !== "undefined" ? cats : []).filter(Boolean).map(c =>
      [r(c.x), r(c.y), c.dir, c.state, r(c.t), r(c.tail)]);
  const B = (typeof brawl !== "undefined" && brawl) ? {
      t: r(brawl.t), hp: r(brawl.chefHP), punchT: r(brawl.punchT), step: r(brawl.comboStep),
      move: brawl.move || null, drinks: r(brawl.drinks), wastedT: r(brawl.wastedT),
      bufT: r(brawl.bufT), inv: r(brawl.inv), stumbleT: r(brawl.stumbleT),
      e: (brawl.enemies || []).map(e => [r(e.x), r(e.y), r(e.hp), e.state, r(e.t)]),
      p: brawl.partner ? [r(brawl.partner.x), r(brawl.partner.y), r(brawl.partner.hp), brawl.partner.dir] : null,
    } : null;
  return JSON.stringify({
    phase, chef: chefS, cust, cats: kats, brawl: B,
    tips: r(typeof tips !== "undefined" ? tips : 0),
    served: r(typeof served !== "undefined" ? served : 0),
    lost: r(typeof lost !== "undefined" ? lost : 0),
    combo: r(typeof combo !== "undefined" ? combo : 0),
    dayT: r(typeof dayT !== "undefined" ? dayT : 0),
    spawnT: r(typeof spawnT !== "undefined" ? spawnT : 0),
    hitstop: r(hitstopT), shake: r(shake),
  });
})()`;

/* Identical scripted input for both devices — a deterministic "player". No randomness here, or the
 * probe would be testing itself.
 * It must walk the BRAWL, and it must get DRUNK: drinkDrift() only steers when drinks>0, and that's the
 * path that reads performance.now() to move chef.x. A day-only script reports "identical" and means
 * nothing. Anything this doesn't walk, it can't vouch for. */
const BRAWL_AT = 240;
function inputAt(f) {
  const p = Math.floor(f / 37) % 4;
  const vx = [1, 0, -1, 0][p], vy = [0, 1, 0, -1][p];
  return { vx, vy,
    punch: f > BRAWL_AT && f % 19 === 0,
    drink: f > BRAWL_AT && f < BRAWL_AT + 420 && f % 11 === 0,   // chug hard: get properly wasted
    seedBrawl: f === BRAWL_AT };
}

function step(dev, f) {
  const inp = inputAt(f);
  vm.runInContext(
    (inp.seedBrawl ? `devSeedBrawl(); chef.x=BAR.x; chef.y=BAR.y+14;` : "") +
    `joy.vx=${inp.vx}; joy.vy=${inp.vy}; joy.active=true;` +
    (inp.punch ? ` if(phase==="brawl") chefPunch();` : "") +
    (inp.drink ? ` if(phase==="brawl" && typeof chefDrink==="function"){ chef.x=BAR.x; chef.y=BAR.y+14; chefDrink(); }` : "") +
    ` if(!tickHitstop(${STEP})) { update(${STEP}); tickKick(${STEP}); }`,
    dev.ctx, { filename: "step.js" });
  return vm.runInContext(SNAP, dev.ctx, { filename: "snap.js" });
}

function firstDiff(a, b) {
  const A = JSON.parse(a), B = JSON.parse(b);
  const walk = (x, y, p) => {
    if (typeof x !== "object" || x === null || typeof y !== "object" || y === null)
      return Object.is(x, y) ? null : { path: p, a: x, b: y };
    const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
    for (const k of keys) { const d = walk(x[k], y[k], p ? p + "." + k : k); if (d) return d; }
    return null;
  };
  return walk(A, B, "");
}

// ---------------------------------------------------------------- run
console.log("determinism probe: two devices, identical input, fixed " + (1 / STEP).toFixed(0) + "Hz step\n");

// Device B's clock starts 9.13s later and runs 1.7% fast — two machines, two clocks.
const A = makeDevice("A", 0, 1.0);
const B = makeDevice("B", 9130, 1.017);

for (const d of [A, B])
  vm.runInContext(`startCampaign(); startDay(); if(typeof devSeedBrawl==="function"){} `, d.ctx, { filename: "boot.js" });

let diverged = null;
for (let f = 0; f < FRAMES && !diverged; f++) {
  const sa = step(A, f), sb = step(B, f);
  if (sa !== sb) diverged = { frame: f, diff: firstDiff(sa, sb) };
  else if (VERBOSE && f % 120 === 0) console.log("  frame " + String(f).padStart(4) + "  identical");
}

if (!diverged) {
  console.log("  " + FRAMES + " frames, both devices IDENTICAL.");
  console.log("\n  -> the exercised paths are deterministic. (Evidence, not proof: only what the");
  console.log("     scripted input walked. Widen the script to widen the claim.)");
  process.exit(0);
} else {
  const d = diverged.diff;
  console.log("  DIVERGED at frame " + diverged.frame + " (" + (diverged.frame * STEP).toFixed(2) + "s)\n");
  if (d) {
    console.log("    field : " + d.path);
    console.log("    dev A : " + JSON.stringify(d.a));
    console.log("    dev B : " + JSON.stringify(d.b));
  } else {
    console.log("    (snapshots differ but no scalar diff found — check the snapshot shape)");
  }
  console.log("\n  -> update() is not a pure function of (state, input, dt) on this path.");
  console.log("     Lockstep needs it to be. Fix, re-run; this is the todo list.");
  process.exit(1);
}
