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
  globalThis.__SC=0; globalThis.__MD=1e9;
  const realSmash = smashPlantsNear;
  smashPlantsNear = function(x,y,w){
    globalThis.__SC++;
    for(const p of plants){ const d=Math.hypot(p.x-x,(p.y-7)-y); if(d<globalThis.__MD) globalThis.__MD=d; }
    return realSmash(x,y,w);
  };
  // Representative fight: the chef ROAMS (enemies chase her), instead of teleporting onto the mob at
  // their spawn band. The mob follows her past the walls, which is when greenery is actually at risk.
  startCampaign(); startDay(); devWaves=2; devEnemies=8; devDrinks=0; devSeedBrawl();
  const route=[[40,130],[280,120],[60,110],[300,140],[150,125],[30,140],[260,105]];
  let ri=0, g=0;
  while(!brawl.outcome && g++ < 60*220){
    if(!tickHitstop(1/60)){
      const [tx,ty]=route[ri];
      const dx=tx-chef.x, dy=ty-chef.y, d=Math.hypot(dx,dy)||1;
      if(d<6) ri=(ri+1)%route.length;
      else { chef.x+=dx/d*1.1; chef.y+=dy/d*1.1; chef.dir = dx<0?"left":"right"; chef.moving=true; }
      updateBrawl(1/60);
      brawl.chefHP=999; brawl.t=90;
      for(const p of plants){ const d=Math.hypot(p.x-chef.x,(p.y-7)-chef.y);
        if(d<(globalThis.__CD===undefined?1e9:globalThis.__CD)) globalThis.__CD=d; }
      for(const e of brawl.enemies){ if(e.state==="ko") continue;
        for(const p of plants){ const d=Math.hypot(p.x-e.x,(p.y-7)-e.y);
          if(d<(globalThis.__ED===undefined?1e9:globalThis.__ED)) globalThis.__ED=d; } }
      brawl.punchT=0; brawl.stumbleT=0; chefPunch();
    }
  }
  globalThis.__R={ outcome:brawl.outcome, secs:+(g/60).toFixed(1),
                   wrecked: plants.filter(p=>p.broken).length, total: plants.length,
                   hp: plants.map(p=>+p.hp.toFixed(2)), smashCalls: globalThis.__SC||0,
                   minDist: +(globalThis.__MD===undefined?-1:globalThis.__MD).toFixed(1),
                   chefD:+(globalThis.__CD||0).toFixed(1), enemyD:+(globalThis.__ED||0).toFixed(1) };
  startDay();
  globalThis.__R.nextMorning = plants.filter(p=>!p.broken).length;
})();`;
vm.runInContext(script+"\n"+probe, vm.createContext(sb), {filename:"dev.js"});
const R=sb.__R;
console.log("roaming fight:", R.outcome, "in", R.secs+"s", "| plants wrecked:", R.wrecked+"/"+R.total);
console.log("  smashPlantsNear calls:", R.smashCalls, "| closest any call got to a plant:", R.minDist+"px  (needs <"+16+")");
console.log("  plant hp:", R.hp.join(", "), " (start "+3.2+")");
console.log("  closest the CHEF ever got to a plant:", R.chefD+"px | closest any ENEMY ever got:", R.enemyD+"px");
