// Visual verification for the ticket rail.
// The HARNESS ctx is a Proxy that discards writes (you cannot monkey-patch it — see CHANGELOG).
// So this uses its own RECORDING ctx: it keeps fillStyle state and logs real draw ops,
// which we then rasterize with PIL. This checks the pixels, not just the predicates.
const fs = require("fs");
const vm = require("vm");

const ops = [];
function makeRecCtx() {
  const st = { fillStyle: "#000", strokeStyle: "#000", globalAlpha: 1, lineWidth: 1, font: "", textAlign: "left", textBaseline: "alphabetic" };
  let path = [];
  const ctx = {
    get canvas() { return { width: 1920, height: 1080 }; },
    createImageData: (w = 1, h = 1) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
    getImageData: (x, y, w = 1, h = 1) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
    putImageData() {}, drawImage() {},
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => ({ addColorStop() {} }),
    fillRect(x, y, w, h) { ops.push({ op: "fillRect", x, y, w, h, style: st.fillStyle, alpha: st.globalAlpha }); },
    strokeRect() {}, clearRect() {},
    fillText(t, x, y) { ops.push({ op: "text", t: String(t), x, y, style: st.fillStyle, alpha: st.globalAlpha }); },
    strokeText() {},
    beginPath() { path = []; }, closePath() {},
    moveTo(x, y) { path.push([x, y]); }, lineTo(x, y) { path.push([x, y]); },
    arc(x, y, r) { ops.push({ op: "arc", x, y, r, style: st.fillStyle, alpha: st.globalAlpha }); },
    stroke() { if (path.length > 1) ops.push({ op: "stroke", pts: path.slice(), style: st.strokeStyle, alpha: st.globalAlpha, lw: st.lineWidth }); },
    fill() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, clip() {}, setTransform() {}, resetTransform() {},
    quadraticCurveTo() {}, bezierCurveTo() {}, ellipse() {}, rect() {}, setLineDash() {},
  };
  for (const k of ["fillStyle", "strokeStyle", "globalAlpha", "lineWidth", "font", "textAlign", "textBaseline", "globalCompositeOperation", "imageSmoothingEnabled", "lineCap", "lineJoin", "shadowBlur", "shadowColor", "filter"]) {
    Object.defineProperty(ctx, k, { get: () => st[k], set: (v) => { st[k] = v; }, configurable: true });
  }
  return ctx;
}
const REC = makeRecCtx();
function makeCanvas() {
  return { width: 320, height: 180, style: {}, getContext: () => REC,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 180 }), addEventListener: () => {} };
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
const sandbox = {
  console, performance: { now: () => T },
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, setTimeout: () => 0, clearTimeout: () => {},
  Image: function () { return { addEventListener(){}, set src(v){}, get src(){ return ""; }, width:16, height:16 }; },
  document: {
    createElement: (t) => (t === "canvas" ? makeCanvas() : { style:{}, getContext:()=>REC, appendChild(){}, addEventListener(){} }),
    getElementById: () => makeCanvas(), addEventListener: () => {}, body: { appendChild(){}, style:{} },
  },
  window: { innerWidth:320, innerHeight:180, devicePixelRatio:1, addEventListener: () => {}, AudioContext: AudioStub, webkitAudioContext: AudioStub },
  navigator: { userAgent: "node" }, localStorage: { getItem: () => null, setItem: () => {} },
  addEventListener: () => {},
  Math, Date, JSON, Array, Object, Number, String, Boolean, isNaN, parseInt, parseFloat,
};
sandbox.__tick = (ms) => { T += ms; };
sandbox.globalThis = sandbox;
sandbox.AudioContext = AudioStub; sandbox.webkitAudioContext = AudioStub;

const script = fs.readFileSync("/home/claude/work/game_script.js", "utf8");


const probe = `
;(function(){
  // Record what genPlant actually paints: swap in a canvas whose 2d ctx logs fillRect/fillStyle.
  const realCreate = document.createElement;
  document.createElement = function(t){
    if(t!=="canvas") return realCreate.call(document,t);
    const rec=[]; const cv={ width:0, height:0, __rec:rec,
      getContext:()=>({ 
        set fillStyle(v){ rec.push(["c",v]); }, get fillStyle(){ return "#000"; },
        fillRect:(x,y,w,h)=>rec.push(["r",x,y,w,h]),
        createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
        putImageData:()=>{}, drawImage:()=>{}, clearRect:()=>{},
        save(){},restore(){},translate(){},rotate(){},
        set imageSmoothingEnabled(v){}, get imageSmoothingEnabled(){ return false; } }) };
    return cv;
  };
  const out=[];
  for(let e=0;e<ENVS.length;e++){
    ENV=e;
    for(const seed of [11,23,37,41,53,67]){
      const key=ENV+":"+seed; delete PLANT_CACHE[key];
      const cv=genPlant(seed);
      out.push({env:e, name:ENVS[e].name, seed, w:cv.width, h:cv.height, rec:cv.__rec});
    }
  }
  document.createElement = realCreate;
  globalThis.__P=out;
})();
`;
const ctx = vm.createContext(sandbox);
vm.runInContext(script + "\n" + probe, ctx, { filename: "game.js" });
const P=sandbox.__P;
console.log("rects painted per plant, by locale:");
const byEnv={};
for(const r of P){ (byEnv[r.name]=byEnv[r.name]||[]).push(r.rec.filter(o=>o[0]==="r").length); }
for(const k in byEnv) console.log("  "+k.padEnd(14), byEnv[k].join(", "));
fs.writeFileSync("/home/claude/work/plants.json", JSON.stringify(P));
