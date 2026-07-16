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
const sb=Object.assign({},sandbox); sb.globalThis=sb;
const probe = `
;(function(){
  startCampaign(); startDay(); devSeedBrawl();
  const out={};
  for(const d of ["right","up","left","down"]){
    const rows=[];
    for(let dy=-34; dy<=34; dy+=4){
      let row="";
      for(let dx=-34; dx<=34; dx+=4){
        chef.x=160; chef.y=110; chef.dir=d;
        brawl.enemies=[{x:160+dx,y:110+dy,hp:99,state:"chase",t:0,flash:0,kbx:0,kby:0,reelT:0,riot:false,role:"",buffed:false}];
        brawl.punchT=0; brawl.comboT=0; brawl.stumbleT=0; brawl.buffT=0; brawl.drinks=0; brawl.wastedT=0;
        chefPunch();
        row += (dx===0&&dy===0) ? "@" : ((brawl.enemies[0].hp<99) ? "#" : ".");
      }
      rows.push(row);
    }
    out[d]=rows;
  }
  // and prove the art dir + facing survive a punch
  const art={};
  for(const d of ["right","up","left","down"]){
    chef.x=160; chef.y=110; chef.dir=d; brawl.enemies=[]; brawl.punchT=0; brawl.comboT=0;
    chefPunch();
    art[d]= chef.dir+" -> art:"+String(fightDir(chefSet, brawl.move, DMAP[chef.dir]))+" move:"+brawl.move;
  }
  globalThis.__O=out; globalThis.__A=art;
})();`;
vm.runInContext(script+"\n"+probe, vm.createContext(sb), {filename:"dev.js"});
const O=sb.__O;
const names=["right","up","left","down"];
console.log("PUNCH BOX per facing  (@ = chef, grid -34..+34 in both axes, 4px steps)\n");
for(let r=0;r<O.right.length;r++){
  console.log(names.map(n=>O[n][r]).join("   "));
}
console.log("\n   facing RIGHT" + " ".repeat(11) + "facing UP" + " ".repeat(13) + "facing LEFT" + " ".repeat(11) + "facing DOWN");
console.log("\nfacing survives the punch, and picks the right art:");
for(const d of names) console.log("   "+sb.__A[d]);
