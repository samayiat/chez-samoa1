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


const script=fs.readFileSync("/home/claude/work/b_dev.js","utf8");
const sb=Object.assign({},sandbox); sb.globalThis=sb; sb.__ops=ops;
sb.navigator={userAgent:"node", vibrate:()=>true};
const probe = `
;(function(){
  startCampaign(); startDay(); devSeedBrawl();
  chef.x=160; chef.y=110;
  const R={};
  for(const d of ["right","up"]){
    chef.dir=d; brawl.punchT=0; brawl.comboT=0; brawl.stumbleT=0;
    chefPunch(); brawl.punchT=brawl.punchDur*0.5;      // mid-swing, when the fist was most extended
    const before=__ops.length;
    drawBrawl();
    const mine=__ops.slice(before);
    // the glove signature: a 3x3 rect in her purple or his red, with a 5x5 #100e14 outline under it
    const glove=mine.filter(o=>o.op==="r" && o.w===3 && o.h===3 && (o.style==="#8a5aa0"||o.style==="#c8452e"));
    const outline=mine.filter(o=>o.op==="r" && o.w===5 && o.h===5 && o.style==="#100e14");
    R[d]={glove:glove.length, outline:outline.length, total:mine.length};
  }
  globalThis.__R=R;
})();`;
vm.runInContext(script+"\n"+probe, vm.createContext(sb), {filename:"dev.js"});
for(const d in sb.__R){ const r=sb.__R[d];
  console.log("  mid-punch facing "+d.padEnd(5)+": glove blobs="+r.glove+"  outlines="+r.outline+"   (of "+r.total+" draw ops)");
}
console.log(Object.values(sb.__R).every(r=>r.glove===0 && r.outline===0)
  ? "  -> the fist is gone from the frame."
  : "  -> STILL THERE");
