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
    setTransform: () => ops.push(["ident"]),
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
const scenario = process.argv[2] || "day";
const env = process.argv[3] || "0";
const probe = `
;(function(){
  startCampaign(); startDay(); ENV=${JSON.stringify(env)}|0; FLOOR_CV=null; PLANT_CACHE&&0;
  if(${JSON.stringify(scenario)}==="wrecked") plants.forEach((p,i)=>{ if(i%2===0) p.broken=true; });
  if(${JSON.stringify(scenario)}==="bare"){ plants.length=0; HANG_SPOTS.length=0; VINE_SPOTS.length=0;
     MOTES.length=0; cat=null; drawDrifter=function(){}; drawGlass=function(){}; }
  if(${JSON.stringify(scenario)}==="nocat"){ cat=null; }
  if(${JSON.stringify(scenario)}==="nomotes"){ MOTES.length=0; }
  if(${JSON.stringify(scenario)}==="nodrift"){ drawDrifter=function(){}; }
  if(${JSON.stringify(scenario)}==="noglass"){ drawGlass=function(){}; }
  if(${JSON.stringify(scenario)}==="notables"){ drawTable=function(){}; drawCandle=function(){}; }
})();`;
const ctx = vm.createContext(sandbox);
vm.runInContext(script + "\n" + probe, ctx, { filename: "game.js" });
T = Number(process.argv[4]||3000);
MAIN.__ops.length = 0;
vm.runInContext("draw();", ctx, { filename: "draw.js" });
const dump = {};
for (const k in ALL) dump[k] = ALL[k];
fs.writeFileSync("/home/claude/work/room_ops.json", JSON.stringify({ main: MAIN.__id, all: dump }));
console.log("main ops:", MAIN.__ops.length,
  "| rects:", MAIN.__ops.filter(o=>o[0]==="r").length,
  "| blits:", MAIN.__ops.filter(o=>o[0]==="img").length,
  "| canvases:", Object.keys(ALL).length);
