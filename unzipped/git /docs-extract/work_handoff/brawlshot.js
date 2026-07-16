// Record the room as actually drawn: per-canvas op streams, so the baked FLOOR_CV (which reaches the
// screen via drawImage) composites instead of vanishing.
const fs = require("fs"), vm = require("vm");

const ALL = {};
let cid = 0;
function makeRec(ops) {
  const st = { fillStyle: "#000", globalAlpha: 1 };
  const ctx = {
    fillRect: (x, y, w, h) => ops.push(["r", x, y, w, h, st.fillStyle, st.globalAlpha]),
    strokeRect: () => {},
    clearRect: (x, y, w, h) => ops.push(["clr", x, y, w, h]),
    drawImage: (img, ...a) => {
      const id = img && img.__id;
      if (a.length >= 8) ops.push(["img", id, a[4], a[5], a[6], a[7], st.globalAlpha]);
      else ops.push(["img", id, a[0], a[1], a[2], a[3], st.globalAlpha]);
    },
    save: () => ops.push(["save"]),
    restore: () => ops.push(["restore"]),
    translate: (x, y) => ops.push(["tr", x, y]),
    rotate: (a) => ops.push(["rot", a]),
    scale: (x, y) => ops.push(["sc", x, y]),
    setTransform: (a,b,c,d,e,f) => ops.push(a===undefined?["ident"]:["xform",a,b,c,d,e,f]),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: () => {},
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => null,
    measureText: () => ({ width: 4 }),
    fillText: () => {}, strokeText: () => {},
    beginPath() {}, closePath() {}, clip() {}, stroke() {}, fill() {},
    moveTo() {}, lineTo() {}, rect() {}, arc() {}, arcTo() {},
    quadraticCurveTo() {}, bezierCurveTo() {}, ellipse() {}, setLineDash() {},
  };
  for (const k of ["fillStyle","strokeStyle","globalAlpha","lineWidth","font","textAlign","textBaseline",
                   "globalCompositeOperation","imageSmoothingEnabled","lineCap","lineJoin","shadowBlur",
                   "shadowColor","filter"]) {
    Object.defineProperty(ctx, k, { get: () => st[k], set: (v) => { st[k] = v; }, configurable: true });
  }
  return ctx;
}
function makeCanvas() {
  const id = "cv" + (cid++), ops = [];
  ALL[id] = ops;
  const cv = {
    width: 320, height: 180, style: {}, __id: id, __ops: ops,
    getContext: () => (cv.__ctx = cv.__ctx || makeRec(ops)),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 180 }),
    addEventListener: () => {},
  };
  return cv;
}
const AudioStub = function () {
  return {
    createOscillator: () => ({ connect(){}, start(){}, stop(){}, frequency:{setValueAtTime(){},value:0}, type:"" }),
    createGain: () => ({ connect(){}, gain:{setValueAtTime(){},exponentialRampToValueAtTime(){},value:0} }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(8) }),
    createBufferSource: () => ({ connect(){}, start(){}, stop(){}, buffer:null }),
    destination: {}, currentTime: 0, state: "running", resume(){},
  };
};
let T = 0;
const MAIN = makeCanvas();
const sandbox = {
  console, performance: { now: () => T },
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, setTimeout: () => 0, clearTimeout: () => {},
  Image: function () { return { addEventListener(){}, set src(v){}, get src(){ return ""; }, width:16, height:16 }; },
  document: {
    createElement: (t) => (t === "canvas" ? makeCanvas() : { style:{}, getContext:()=>makeRec([]), appendChild(){}, addEventListener(){} }),
    getElementById: () => MAIN, addEventListener: () => {}, body: { appendChild(){}, style:{} },
  },
  window: { innerWidth:320, innerHeight:180, devicePixelRatio:1, addEventListener: () => {}, AudioContext: AudioStub, webkitAudioContext: AudioStub },
  navigator: { userAgent: "node" }, localStorage: { getItem: () => null, setItem: () => {} },
  addEventListener: () => {},
};
sandbox.globalThis = sandbox;
sandbox.AudioContext = AudioStub; sandbox.webkitAudioContext = AudioStub;

const script = fs.readFileSync("/home/claude/work/b_dev.js", "utf8");
const env = process.argv[2] || "0";
const want = process.argv[3] || "flash";   // flash | hud
const probe = `
;(function(){
  startCampaign(); startDay(); ENV=${JSON.stringify(env)}|0; FLOOR_CV=null;
  devWaves=2; devEnemies=8; devDrinks=0; devSeedBrawl();
  // Roam a real fight (NOT a force-kill probe - see HANDOFF section 3) until a contact flash is live.
  const route=[[40,130],[280,120],[60,110],[300,140],[150,125]];
  let ri=0, g=0;
  globalThis.__HIT=0;
  while(g++ < 60*220){
    if(!tickHitstop(1/60)){
      const [tx,ty]=route[ri];
      const dx=tx-chef.x, dy=ty-chef.y, d=Math.hypot(dx,dy)||1;
      if(d<6) ri=(ri+1)%route.length;
      else { chef.x+=dx/d*1.1; chef.y+=dy/d*1.1; chef.dir = dx<0?"left":"right"; chef.moving=true; }
      updateBrawl(1/60);
      brawl.chefHP=999; brawl.t=90;
      brawl.punchT=0; brawl.stumbleT=0; chefPunch();
    }
    if(typeof iflashes!=="undefined" && iflashes.length){ globalThis.__HIT=1; break; }
  }
  globalThis.__DBG={ frames:g, flashes:(typeof iflashes!=="undefined"?iflashes.length:-1),
                     hitstop:(typeof hitstopT!=="undefined"?+hitstopT.toFixed(3):-1),
                     phase:phase, enemies:brawl.enemies.filter(e=>e.state!=="ko").length,
                     hp:brawl.chefHP };
})();`;
sandbox.__CHEFX = Number(process.argv[5]||160);
const ctx = vm.createContext(sandbox);
vm.runInContext(script + "\n" + probe, ctx, { filename: "game.js" });
T = Number(process.argv[4]||3000);
console.log("state:", JSON.stringify(sandbox.__DBG));
MAIN.__ops.length = 0;
vm.runInContext(`
  // the roam forced HP=999 to survive; set a real value so the bar is honest, and fire the
  // GO-LIVE banner so both surviving HUD elements are in frame at once.
  brawl.chefHP = CHEF_HP*0.22; brawl.liveT = 0.6;
  chef.x = Number(globalThis.__CHEFX); chef.y = 120;
  shake=0; kick.x=0; kick.y=0;   // zero the shake so the measured shift is PURE camera, not sx noise
  camLeanX = camLeanTarget(chef.x, W); camLeanY = camLeanTarget(chef.y, H);
  const sx = Math.round((shake>0 ? (Math.random()*2-1)*shake : 0) + kick.x);
  const sy = Math.round((shake>0 ? (Math.random()*2-1)*shake : 0) + kick.y);
  const __M = camMatrix(shake, kick.x, kick.y, camLeanX, camLeanY, sx, sy);
  globalThis.__Z = __M.a; globalThis.__CAMX = __M.camX; globalThis.__E = __M.e;
  X.setTransform(SS,0,0,SS,0,0);
  X.clearRect(-8,-8,W+16,H+16);
  X.setTransform(SS*__M.a,0,0,SS*__M.a, __M.e*SS, __M.f*SS);
  drawWorldBase(); drawBrawl();
  drawDrunkWarp();
  X.setTransform(SS,0,0,SS,0,0);
  drawBrawlHUD();
`, ctx, { filename: "frame.js" });
const dump = {};
for (const k in ALL) dump[k] = ALL[k];
fs.writeFileSync("/home/claude/work/brawl_ops.json", JSON.stringify({ main: MAIN.__id, all: dump }));
console.log("chef.x:", process.argv[5], "| z:", sandbox.__Z.toFixed(3), "| camX:", sandbox.__CAMX.toFixed(1), "| e:", sandbox.__E.toFixed(1));
console.log("main ops:", MAIN.__ops.length,
  "| rects:", MAIN.__ops.filter(o=>o[0]==="r").length,
  "| blits:", MAIN.__ops.filter(o=>o[0]==="img").length,
  "| canvases:", Object.keys(ALL).length);
