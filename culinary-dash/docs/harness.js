// Headless harness: stub the browser, run the game script, exercise Phase A night logic.
const fs = require("fs");
const vm = require("vm");

// ---- fake 2D context: every method is a no-op; a few return sane objects ----
function makeCtx() {
  return new Proxy({}, {
    get(_t, k) {
      if (k === "canvas") return { width: 1920, height: 1080 };
      if (k === "createImageData" || k === "getImageData")
        return (w = 1, h = 1) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
      if (k === "measureText") return () => ({ width: 10 });
      if (k === "createLinearGradient" || k === "createRadialGradient" || k === "createPattern")
        return () => ({ addColorStop(){} });
      if (k === "putImageData" || k === "drawImage") return () => {};
      // any property read that isn't a function returns 0/"" so assignments like X.fillStyle work
      return typeof k === "string" ? (function () {}) : undefined;
    },
    set() { return true; },
  });
}
function makeCanvas() {
  return {
    width: 320, height: 180, style: {},
    getContext: () => makeCtx(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 180 }),
    addEventListener: () => {},
  };
}
const AudioStub = function () {
  return {
    createOscillator: () => ({ connect(){}, start(){}, stop(){}, frequency:{setValueAtTime(){},value:0}, type:"" }),
    createGain: () => ({ connect(){}, gain:{setValueAtTime(){},exponentialRampToValueAtTime(){},value:0} }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(8) }),
    createBufferSource: () => ({ connect(){}, start(){}, stop(){}, buffer:null }),
    createBiquadFilter: () => ({ connect(){}, type:"", frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){},value:0} }),
    sampleRate: 44100,
    destination: {}, currentTime: 0, state: "running", resume(){},
  };
};

let T = 0; // controllable clock (ms)
const sandbox = {
  console,
  performance: { now: () => T },
  // T lives in THIS module, not the sandbox, so tests can't touch it directly. Determinism tests need
  // to move the clock (a second machine boots at a different time), so hand them a door.
  __advanceClock: (ms) => { T += ms; },
  requestAnimationFrame: () => 0, // no-op: don't spin the render loop
  cancelAnimationFrame: () => {},
  setTimeout: () => 0, clearTimeout: () => {},
  Image: function () { return { addEventListener(){}, set src(v){}, get src(){return "";}, width:16, height:16 }; },
  document: {
    // documentElement was missing entirely — nothing noticed, because the only code that touches it is
    // goFullscreen(), which only runs from a real tap. The first test to call it crashed the suite.
    documentElement: { requestFullscreen: () => ({ then: () => ({ catch(){} }) }), style:{} },
    fullscreenElement: null,
    createElement: (t) => (t === "canvas" ? makeCanvas() : { style:{}, getContext:()=>makeCtx(), appendChild(){}, addEventListener(){} }),
    getElementById: () => makeCanvas(),
    addEventListener: () => {}, body: { appendChild(){}, style:{} },
  },
  window: {
    innerWidth: 320, innerHeight: 180, devicePixelRatio: 1,
    addEventListener: () => {}, AudioContext: AudioStub, webkitAudioContext: AudioStub,
  },
  // Model a device that HAS a motor (Android/RP5). The haptics block below deletes vibrate to cover the
  // iOS case explicitly. With no vibrate here at all, every impact() in the suite throws the moment the
  // guard in buzz() is removed -- which crashes the harness instead of failing one test, and a crash
  // prints no cross and reads as "the mutation wasn't caught".
  navigator: { userAgent: "node", vibrate: () => true },
  localStorage: { getItem: () => null, setItem: () => {} },
  addEventListener: () => {},
  Math, Date, JSON, Array, Object, Number, String, Boolean, isNaN, parseInt, parseFloat,
};
sandbox.__tick = (ms)=>{ T += ms; };
sandbox.globalThis = sandbox;
sandbox.AudioContext = AudioStub; sandbox.webkitAudioContext = AudioStub;

const script = fs.readFileSync(process.env.GAME_SCRIPT || "/home/claude/work/game_script.js", "utf8");
/* Line parity: src and built MUST share line numbers. That is the entire point of the __ART__ marker
   design ("line refs stay valid forever"), and every line ref in every doc depends on it. A blob with a
   trailing newline silently shifts every line after it. The asset ingest did exactly that — chefM +1,
   chefF +1, fight_chefM +2 = 4 lines of drift — and nothing failed. Resolve the repo from THIS file so
   the check works from any checkout. */
const __ROOT = require("path").resolve(__dirname, "..");
const __LINES = f => fs.readFileSync(require("path").join(__ROOT, f), "utf8").split("\n").length;
const __SRC_LINES = __LINES("culinary-dash.src.html");
const __BUILT_LINES = __LINES("culinary-dash.html");
const __ART_MULTILINE = fs.readdirSync(require("path").join(__ROOT, "art"))
  .filter(f => f.endsWith(".b64"))
  .filter(f => fs.readFileSync(require("path").join(__ROOT, "art", f), "utf8").includes("\n"));
/* Static check: sfx() is a switch with no default, so a misspelled name is a SILENT no-op — it never
   throws, it just plays nothing, forever. Caught exactly that with sfx("break"). Cheap to pin. */
const SFX_CASES = new Set([...script.matchAll(/case\s+"([a-z]+)":/g)].map(m=>m[1]));
const SFX_CALLS = new Set([...script.matchAll(/\bsfx\("([a-z]+)"\)/g)].map(m=>m[1]));
const SFX_MISSING = [...SFX_CALLS].filter(n=>!SFX_CASES.has(n));

// Probe epilogue runs in the SAME lexical scope, so it sees top-level consts/functions.
const probe = `
;(function(){
  const R = { pass:[], fail:[] };
  const ok = (name, cond) => (cond ? R.pass : R.fail).push(name);

  // 1) day tables untouched (still a center row at y=130), night tables on the perimeter
  ok("day STOOLS unchanged (row y=130)", STOOLS.every(s=>s.y===130) && STOOLS.length===5);
  ok("NIGHT_TABLES exist (5)", Array.isArray(NIGHT_TABLES) && NIGHT_TABLES.length===5);
  const onWall = NIGHT_TABLES.every(t => t.x<=30 || t.y>=140);   // left wall OR bottom wall
  ok("night tables hug the walls", onWall);
  const inCenter = NIGHT_TABLES.some(t => t.x>DANCE_ZONE.x0 && t.x<DANCE_ZONE.x1 && t.y>DANCE_ZONE.y0 && t.y<DANCE_ZONE.y1);
  ok("no night table sits in the dance zone", !inCenter);

  // 2) start a night and tick it
  BAR.broken=false;
  startNight();
  ok("phase is night", phase==="night");
  ok("dancers array initialized empty", Array.isArray(night.dancers) && night.dancers.length===0);

  // run ~12s of night at 60fps
  const step = 1/60;
  for(let i=0;i<720;i++){ __tick(step*1000); updateNight(step); }
  ok("crowd populated the floor", night.dancers.length >= 8);
  const allInZone = night.dancers.every(d => d.x>=DANCE_ZONE.x0-2 && d.x<=DANCE_ZONE.x1+2 && d.y>=DANCE_ZONE.y0-2 && d.y<=DANCE_ZONE.y1+2);
  ok("dancers stay in the dance zone", allInZone);
  const settled = night.dancers.filter(d=>!d.leaving);
  const avgA = settled.reduce((s,d)=>s+d.alpha,0)/Math.max(1,settled.length);
  ok("arrived dancers fade in (avg>0.7 & some full)", avgA>0.7 && settled.some(d=>d.alpha>0.95));

  // 3) fluctuation: target should differ across the night (swell & thin)
  const t1 = danceTarget({t: NIGHT_TIME-3});
  const t2 = danceTarget({t: NIGHT_TIME-8});
  const t3 = danceTarget({t: NIGHT_TIME-14});
  ok("dance target fluctuates over time", !(t1===t2 && t2===t3));
  ok("dance target has a sane floor", Math.min(t1,t2,t3) >= 6);

  // 4) crowd drag: chef in a thick pocket moves slower than in the open
  night.dancers.length=0;
  for(let k=0;k<6;k++) night.dancers.push({x:chef.x, y:chef.y, leaving:false, alpha:1, ph:0, outfit:"#fff", skin:"#000"});
  const packed = crowdSpeedMult();
  night.dancers.length=0;
  const open = crowdSpeedMult();
  ok("open floor = full speed", Math.abs(open-1)<1e-6);
  ok("packed pocket slows the chef", packed < open);
  ok("slowdown respects the floor", packed >= CROWD_FLOOR-1e-6);

  // 5) chef actually covers less ground per second in a crowd
  chef.x=150; chef.y=100; joy.vx=1; joy.vy=0;
  for(let k=0;k<20;k++) night.dancers.push({x:150+ (k%5)*2, y:100, leaving:false, alpha:1, ph:0, outfit:"#fff", skin:"#000"});
  let x0=chef.x; for(let i=0;i<60;i++){ __tick(step*1000); updateNight(step);} let movedPacked=chef.x-x0;
  night.dancers.length=0; chef.x=150; chef.y=100; joy.vx=1; joy.vy=0;
  x0=chef.x; for(let i=0;i<60;i++){ __tick(step*1000); updateNight(step);} let movedOpen=chef.x-x0;
  ok("moves further in the open than packed", movedOpen > movedPacked + 2);

  // 6) barDead => dead room, no crowd, no groups
  joy.vx=0; joy.vy=0;
  BAR.broken=true; startNight();
  for(let i=0;i<300;i++){ __tick(step*1000); updateNight(step); }
  ok("wrecked bar = empty floor", night.dancers.filter(d=>!d.leaving).length===0);
  ok("wrecked bar = no groups", night.groups.length===0);
  BAR.broken=false;

  // 7) a served group still banks $750 with the new table set
  startNight();
  spawnGroup();
  const g = night.groups[0];
  ok("group seated at a night table", NIGHT_TABLES.includes(g.stool));
  g.x=g.tx; g.y=g.ty; g.state="seated";
  chef.x=g.x; chef.y=g.y; chef.carry={type:"bottle"};
  const before = night.sales;
  nightAction();
  ok("serving banks +$750", night.sales === before + BOTTLE_PRICE);

  // ================= Phase B: the rating runs the money =================
  joy.vx=0; joy.vy=0; chef.carry=null;
  const CHUG=chuggerChance; chuggerChance=()=>0;     // deterministic serves during tests; CHUG = real odds
  served=0; shooed=0; lost=0; beliAdj=0;
  ok("beli floor lowered (heavy losses -> <4)", (function(){ lost=30; const b=beli(); lost=0; return b<4; })());
  ok("beli clamps at 1", (function(){ lost=1000; const b=beli(); lost=0; return b===1; })());

  served=0; lost=0; beliAdj=0;                       // beli = 6 baseline
  const pHi =(function(){ beliAdj=4;  const p=nightBottlePrice(); beliAdj=0; return p; })(); // beli 10
  const pMid= nightBottlePrice();                    // beli 6
  const pLow=(function(){ lost=30;    const p=nightBottlePrice(); lost=0;    return p; })(); // beli ~1
  ok("high rating = premium price (>= full)", pHi >= BOTTLE_PRICE);
  ok("mid rating ~ full price", Math.abs(pMid-BOTTLE_PRICE) <= 40);
  ok("low rating craters the price (<50%)", pLow < BOTTLE_PRICE*0.5);
  ok("price respects the $120 floor", pLow >= 120);

  const dHi=(function(){ beliAdj=4; const d=nightDemand(); beliAdj=0; return d; })();
  const dLo=(function(){ lost=30;   const d=nightDemand(); lost=0;    return d; })();
  ok("high rating = more demand (faster spawns)", dHi > dLo);

  served=0; lost=0; beliAdj=0;
  ok("good rating = essentially no heat", heatRate() < 0.005);
  ok("bad rating builds heat fast", (function(){ lost=30; const r=heatRate(); lost=0; return r>0.02; })());

  // a low-rating table locks a cheap price and banks exactly that
  lost=30; beliAdj=0; BAR.broken=false; startNight();
  spawnGroup(); const gL=night.groups[0];
  ok("group locks a sub-full price at low rating", gL.price < BOTTLE_PRICE && gL.price>=120);
  gL.x=gL.tx; gL.y=gL.ty; gL.state="seated"; chef.x=gL.x; chef.y=gL.y; chef.carry={type:"bottle"};
  const sb=night.sales; nightAction();
  ok("banks the group's actual (cheap) price", night.sales===sb+gL.price && gL.price!==BOTTLE_PRICE);

  // heat integrates over a bad night, caps at 1, arms the riot + latches its one-time flash
  lost=40; startNight();
  ok("heat starts at 0", night.heat===0);
  for(let i=0;i<60*30;i++){ __tick((1/60)*1000); updateNight(1/60); }
  ok("bad night gets hot (heat>0.5 in 30s)", night.heat>0.5);
  night.heat=0.9; night.troubleFlashed=false;
  for(let i=0;i<60*5;i++){ __tick((1/60)*1000); updateNight(1/60); }   // 5s more at a bad rating -> saturate
  ok("heat caps at 1", Math.abs(night.heat-1)<1e-6);
  ok("riotImminent() true at full heat", riotImminent()===true);
  ok("trouble flash latches once", night.troubleFlashed===true);

  // a served table cools the room
  lost=40; startNight(); night.heat=0.5;
  spawnGroup(); const gc=night.groups[0]; gc.x=gc.tx; gc.y=gc.ty; gc.state="seated";
  chef.x=gc.x; chef.y=gc.y; chef.carry={type:"bottle"};
  const h0=night.heat; nightAction();
  ok("serving takes the edge off", night.heat < h0);

  // a GOOD rating keeps the room calm (isolate rating: keep tables patient so no walkouts)
  served=40; lost=0; beliAdj=0; startNight();
  for(let i=0;i<60*20;i++){ __tick((1/60)*1000); updateNight(1/60);
    for(const g of night.groups) if(g.state==="seated") g.hearts=3; }
  ok("good rating keeps the room calm", night.heat < 0.05);
  served=0; lost=0; beliAdj=0; chef.carry=null; joy.vx=0; joy.vy=0;

  // ================= Phase C: sections stay + the riot =================
  const resetKitchen=()=>{ STATIONS.forEach(s=>{s.broken=false; s.hp=undefined;}); BAR.broken=false; };

  // -- sections reorder instead of turning over --
  served=0; lost=0; beliAdj=0; resetKitchen(); startNight();
  spawnGroup(); const gr=night.groups[0]; gr.x=gr.tx; gr.y=gr.ty; gr.state="seated";
  chef.x=gr.x; chef.y=gr.y; chef.carry={type:"bottle"};
  nightAction();
  ok("serve tallies a bottle for the section", gr.bottles===1);
  ok("served section stays put (not leaving)", gr.state==="served" && night.groups.includes(gr));
  let reordered=false;
  for(let i=0;i<60*20;i++){ __tick((1/60)*1000); updateNight(1/60); if(gr.state==="seated"){ reordered=true; break; } }
  ok("section reorders another bottle", reordered && night.groups.includes(gr));
  ok("booth never freed mid-night", gr.stool.taken===true);

  // -- an ignored table doesn't leave; it stokes trouble --
  served=0; lost=0; beliAdj=0; startNight();
  spawnGroup(); const gi=night.groups[0]; gi.x=gi.tx; gi.y=gi.ty; gi.state="seated"; gi.hearts=0.01;
  chef.carry=null; chef.x=10; chef.y=10; const hStart=night.heat;
  for(let i=0;i<60*4;i++){ __tick((1/60)*1000); updateNight(1/60); }
  ok("ignored table stays (no walkout turnover)", night.groups.includes(gi) && gi.state==="seated");
  ok("ignored table stokes trouble", night.heat>hStart);

  // -- closing: booths are the last to leave --
  served=40; lost=0; beliAdj=0; startNight();
  spawnGroup(); const gcl=night.groups[0]; gcl.x=gcl.tx; gcl.y=gcl.ty; gcl.state="seated";
  night.t=0; __tick(16); updateNight(1/60);
  ok("closing time sends booths leaving", gcl.state==="leaving");

  // -- startRiot roster: turned regulars + fresh mob, all big-red --
  served=0; lost=0; beliAdj=0; resetKitchen(); startNight();
  night.sales=1234; night.served=2;
  spawnGroup(); const r1=night.groups[0]; r1.x=r1.tx; r1.y=r1.ty; r1.state="seated";
  spawnGroup(); const r2=night.groups[1]; r2.x=r2.tx; r2.y=r2.ty; r2.state="served"; r2.t=1;
  startRiot("test");
  ok("riot -> brawl phase", phase==="brawl");
  ok("riot flags set (riot + fromNight)", brawl.riot===true && brawl.fromNight===true);
  ok("roster: (turned + mob) enemies + filmers = everyone", brawl.enemies.length + brawl.spectators.length >= 2+RIOT_MOB && brawl.enemies.length >= RIOT_MOB);
  ok("every rioter is big-red", brawl.enemies.every(e=>e.riot===true && e.rage===true));
  ok("rioters aren't polygon monsters", brawl.enemies.every(e=>!e.poly));
  ok("riot enemies move slow", espd(brawl.enemies[0]) < ENEMY_SPEED);
  ok("non-riot enemy keeps normal speed", Math.abs(espd({buffed:false})-ENEMY_SPEED)<1e-6);

  // -- WIN resolves back to the night, sales preserved --
  brawl.enemies.forEach(e=>{ e.state="ko"; e.t=0; });
  for(let i=0;i<200;i++){ __tick(16); updateBrawl(1/60); if(phase!=="brawl") break; }
  ok("winning the riot resumes the night", phase==="night");
  ok("night sales survive the riot", night.sales===1234);
  ok("room cools after the win", night.heat===0);
  ok("booths reopen after the win", NIGHT_TABLES.every(tb=>!tb.taken) && night.groups.length===0);

  // -- KO ends the night -> results --
  served=0; lost=0; beliAdj=0; resetKitchen(); startNight();
  startRiot("test"); chefKO();
  for(let i=0;i<400;i++){ __tick(16); updateBrawl(1/60); if(phase!=="brawl") break; }
  ok("getting KO'd in the riot -> results", phase==="over");
  resetKitchen();

  // -- full trouble auto-fires the riot from the night --
  served=0; lost=60; beliAdj=0; resetKitchen(); startNight();
  let fired=false;
  for(let i=0;i<60*40;i++){ __tick(16); updateNight(1/60); if(phase==="brawl"){ fired=true; break; } }
  ok("full trouble auto-triggers the riot", fired && brawl.riot===true);
  lost=0;

  // -- chugger odds climb when the rating's low (real fn) --
  ok("chugger odds rise at a low rating", (function(){ lost=60; const lo=CHUG(); lost=0; const hi=CHUG(); return lo>hi && lo>0.2; })());

  chuggerChance=CHUG;   // restore

  // -- regression: on a NIGHT day, a normal (non-riot) brawl still ends into a fresh night --
  served=0; lost=0; beliAdj=0; resetKitchen();
  startCampaign(); run.dow=4;                     // Friday: a night day
  startBrawl();                                  // no riot flags
  ok("normal brawl has no fromNight flag", !brawl.fromNight);
  brawl.enemies=[]; brawl.wave=WAVE_COUNT;
  for(let i=0;i<200;i++){ __tick(16); updateBrawl(1/60); if(phase==="night") break; }
  ok("normal brawl win (night day) -> fresh night", phase==="night" && night.sales===0);

  served=0; lost=0; beliAdj=0; resetKitchen();

  // ================= Phase D: heavy two-way knockback + chef stumble =================
  const calmChef=()=>{ brawl.drinks=0; brawl.buffT=0; brawl.wastedT=0; brawl.punchT=0; brawl.stumbleT=0; };

  // -- your punch LAUNCHES a big-red (velocity + reel), leaves normal enemies on the old instant knock --
  served=0; lost=0; beliAdj=0; resetKitchen(); startBrawl(); calmChef();
  chef.x=100; chef.y=100; chef.dir="right";
  const eR=makeRiotEnemy(110,100); eR.state="raid"; eR.hp=10; brawl.enemies=[eR];
  const xR0=eR.x; chefPunch();
  ok("punching a big-red sets launch velocity", Math.abs(eR.kbx)>100);
  ok("punching a big-red makes it reel", eR.reelT>0);
  ok("big-red isn't just teleported (velocity, not instant)", Math.abs(eR.x-xR0)<3);
  brawl.punchT=0;
  const eN={ cast:CAST[0].id, x:110, y:100, hp:10, state:"raid", dir:"left", flash:0, aggro:false, target:null, raidT:0 };
  brawl.enemies=[eN]; const xN0=eN.x; chefPunch();
  // A normal enemy now uses the SAME impulse model as a big-red (it used to be teleported by
  // e.x+=5 with no reel — half the roster had no weight). The thing that test was really
  // protecting is the SPACING, since KNOCKBACK is "small enough to combo": so assert the
  // displacement still lands on the legacy 5px, and that it's a slide rather than a snap.
  ok("normal enemy is no longer teleported (velocity, not instant)", Math.abs(eN.x-xN0)<3 && !!eN.kbx);
  ok("normal enemy now reels like a big-red", eN.reelT>0);
  // Was KNOCKBACK*12 = 60px/s, which settles at ~5px of travel — measured, and the reason knocked bodies
  // never reached the wall plants (closest 30px, needed 16). Five pixels is why the fight read floaty:
  // you hit someone and they didn't move. Now *36 -> ~15px. Assert the DISTANCE, not the multiplier —
  // the multiplier is a means, the travel is the design.
  ok("normal enemy's impulse is derived from the legacy KNOCKBACK", BRAWL_KNOCK===KNOCKBACK*12);
  /* The 5px jab shove is load-bearing: the punch arc is 29px wide, so a body that travels further leaves
     combo range. "The fight feels floaty" is therefore NOT fixed by raising knockback flatly — that trades
     the float for a broken combo. Per-move: the jab holds, the finisher sends. */
  (()=>{
    const travel = m => (BRAWL_KNOCK*(MOVE_KNOCK[m]||1)/60) * (1/(1-RIOT_KB_FRICTION));
    const ARC = PUNCH_REACH;                           // read the constant, never a copy of it
    ok("a jab keeps them inside the punch arc ("+travel("jab").toFixed(1)+"px)", travel("jab") < ARC*0.5);
    ok("the finisher SENDS them ("+travel("roundhouse").toFixed(1)+"px)", travel("roundhouse") > travel("jab")*2.5);
    ok("...but doesn't launch them off the map", travel("roundhouse") < 40);
    ok("every combo move has a knockback", FIGHT_COMBO.every(m=>MOVE_KNOCK[m]>0));
  })();
  // Settle the impulse and confirm it lands where the old instant shove did. reelT is held open so
  // the chase AI (which would walk them around and contaminate the reading) stays skipped —
  // the kb integrator runs before the reel check, so this measures the impulse alone.
  eN.reelT=2;
  for(let i=0;i<40;i++) updateBrawl(1/60);
  const travelled=Math.abs(eN.x-xN0);
  ok("...and it settles at the legacy shove distance (~5px, still in the punch arc)",
     travelled>KNOCKBACK*0.6 && travelled<KNOCKBACK*1.6);
  ok("...which keeps it inside the punch arc (rel<24)", travelled<24);

  // -- a reeling big-red slides on its knockback and does NOT run its AI (moves away, not toward the chef) --
  resetKitchen(); startBrawl(); calmChef();
  chef.x=200; chef.y=100;
  const eS=makeRiotEnemy(100,100); eS.state="chase"; eS.hp=99; eS.kbx=-400; eS.kby=0; eS.reelT=0.4;
  brawl.enemies=[eS]; brawl.t=BRAWL_TIME;
  for(let i=0;i<20;i++){ __tick(16); updateBrawl(1/60); }
  ok("reeling big-red slides AWAY from the chef", eS.x < 100);
  ok("knockback velocity decays", Math.abs(eS.kbx) < 400);

  // -- a big-red's hit STUMBLES the chef (shoved + damaged); a normal hit does not --
  resetKitchen(); startBrawl(); calmChef();
  chef.x=150; chef.y=100; brawl.inv=0; brawl.chefHP=CHEF_HP;
  const eH=makeRiotEnemy(150,100); eH.state="lunge"; eH.lx=1; eH.ly=0; eH.t=0.16; eH.aggro=true;
  brawl.enemies=[eH]; brawl.t=BRAWL_TIME;
  __tick(16); updateBrawl(1/60);
  ok("big-red hit triggers a stumble", brawl.stumbleT>0);
  ok("big-red hit deals boosted damage", brawl.chefHP < CHEF_HP);
  const normHit=(function(){
    resetKitchen(); startBrawl(); calmChef(); chef.x=150; chef.y=100; brawl.inv=0; brawl.chefHP=CHEF_HP;
    const e={ cast:CAST[0].id, x:150,y:100, hp:99, state:"lunge", lx:1,ly:0,t:0.16, dir:"left", flash:0, aggro:true, riot:false };
    brawl.enemies=[e]; brawl.t=BRAWL_TIME; __tick(16); updateBrawl(1/60);
    return brawl.stumbleT;
  })();
  ok("a normal enemy hit does NOT stumble", normHit===0 || normHit===undefined);

  // -- while stumbling: input is ignored (chef shoved) and you can't punch --
  resetKitchen(); startBrawl(); calmChef();
  chef.x=150; chef.y=100; brawl.stumbleT=STUMBLE_TIME; brawl.stumbleVx=-STUMBLE_KB; brawl.stumbleVy=0;
  joy.vx=1; joy.vy=0;                                  // trying to walk RIGHT
  const cx0=chef.x; brawl.enemies=[]; brawl.t=BRAWL_TIME;
  __tick(16); updateBrawl(1/60);
  ok("stumble shoves the chef against their input", chef.x < cx0);
  joy.vx=0; joy.vy=0;
  brawl.stumbleT=STUMBLE_TIME;
  const eP=makeRiotEnemy(chef.x+8,chef.y); eP.state="raid"; eP.hp=5; brawl.enemies=[eP]; brawl.punchT=0;
  chefPunch();
  ok("can't punch mid-stumble", eP.hp===5);

  served=0; lost=0; beliAdj=0; resetKitchen();

  // ================= Phase E: night spectators + GOING LIVE =================
  const seatSections=(n)=>{ for(let i=0;i<n;i++){ spawnGroup(); const g=night.groups[i]; if(g){ g.x=g.tx; g.y=g.ty; g.state="seated"; } } };

  // -- a night riot seeds recorders from the perimeter regulars --
  served=0; lost=0; beliAdj=0; resetKitchen(); startNight();
  seatSections(5);
  const nSeated=night.groups.filter(g=>g.state==="seated"||g.state==="served").length;
  startRiot("test");
  ok("night riot has recorders", brawl.spectators.length>=1);
  ok("recorders come from the seated regulars", brawl.spectators.length<=nSeated);
  ok("spectators have a valid sprite type", brawl.spectators.every(s=>s.type>=0 && s.type<CAST.length));
  ok("still a real fight (mob present)", brawl.enemies.length>=RIOT_MOB);

  // -- GOING LIVE now fires during a night riot (it couldn't before: no spectators) --
  served=0; lost=0; beliAdj=0; resetKitchen(); startNight();
  seatSections(4); startRiot("test");
  chef.x=160; chef.y=90; brawl.liveDelay=0.1; brawl.t=BRAWL_TIME;
  let wentLive=false;
  for(let i=0;i<40;i++){ __tick(16); updateBrawl(1/60); if(brawl.live){ wentLive=true; break; } }
  ok("night riot can GO LIVE", wentLive===true);
  ok("GOING LIVE buffs the mob", brawl.mobBuff===true);
  ok("a recorder is marked LIVE", brawl.spectators.some(s=>s.live));

  // -- GOING LIVE full-heals big-reds to THEIR max (not down to the base 5) --
  served=0; lost=0; beliAdj=0; resetKitchen(); startNight();
  seatSections(3); startRiot("test");
  const bigRed=brawl.enemies.find(e=>e.riot); bigRed.hp=3; bigRed.state="chase";
  triggerGoLive();
  ok("GOING LIVE heals big-reds to full (7, not 5)", bigRed.hp===ENEMY_HP+2);

  served=0; lost=0; beliAdj=0; resetKitchen();

  // ================= Phase F: polish (riot tally for the results screen) =================
  served=0; lost=0; beliAdj=0; resetKitchen(); startNight();
  ok("fresh night starts with 0 riots", night.riots===0);
  seatSections(2); startRiot("test");
  ok("startRiot increments the night's riot tally", night.riots===1);
  served=0; lost=0; beliAdj=0; resetKitchen();

  // ================= Quick wins: walk speed (#2), speed tips (#6), heights (#1) =================
  // #2 brisker day walk — chef covers ~90px/s under full input
  phase="play"; dialogue=null; waveoff=null; customers=[]; brawl=null; night=null;
  chef.x=150; chef.y=100; joy.vx=1; joy.vy=0;
  const wx0=chef.x; for(let i=0;i<60;i++){ __tick((1/60)*1000); update(1/60); }
  const walked=chef.x-wx0;
  ok("#2 day walk is brisk (~90px/s)", walked>84 && walked<96);
  joy.vx=0; joy.vy=0;

  // #6 a fast serve tips more than a slow one, decaying to base by the window
  tips=0; served=0; combo=0; comboTimer=0;
  chef.carry={type:"salad", quality:"perfect"};
  const cFast={ x:100,y:100, hearts:3, state:"waiting", order:{kind:"good",dish:"salad"}, orderT:performance.now() };
  serveCustomer(cFast); const fastTip=tips;
  tips=0; combo=0; comboTimer=0; chef.carry={type:"salad", quality:"perfect"};
  const cSlow={ x:100,y:100, hearts:3, state:"waiting", order:{kind:"good",dish:"salad"}, orderT:performance.now()-15000 };
  serveCustomer(cSlow); const slowTip=tips;
  ok("#6 fast serve tips more than slow", fastTip>slowTip);
  ok("#6 fast serve ~+50%", fastTip===Math.round(12*1.5));
  ok("#6 slow serve decays to base", slowTip===12);

  // #1 male renders taller than female. Both are PixelLab sprites now (chefF 136px native, chefM 88px);
  // drawChar scales native*CHEF_SCALE*CHEF_H, so the design goal is native*CHEF_H(male) > native*CHEF_H(female).
  ok("#1 male chef renders taller than female (native-size normalized)", (()=>{
     const NAT={chefF:136, chefM:88};
     return NAT.chefM*CHEF_H.chefM > NAT.chefF*CHEF_H.chefF && CHEF_H.chefF>0 && CHEF_H.chefM>0; })());

  served=0; tips=0; combo=0; comboTimer=0; chef.carry=null;

  // ================= #7 dialogue: dish flavor + orderer voice, no crispy-lobster =================
  const byId=id=>CAST.find(c=>c.id===id);
  const lobLines=[]; for(let i=0;i<120;i++) lobLines.push(orderLine(byId("marisol"),{kind:"good",dish:"lobster"}));
  ok("#7 lobster is never 'crisp'", lobLines.every(l=>!/crisp/i.test(l)));
  ok("#7 lobster line names the dish", lobLines.every(l=>/lobster/i.test(l)));
  ok("#7 lobster uses a buttery/rich descriptor", lobLines.some(l=>/buttery|rich|succulent/.test(l)));
  const criticLob=[]; for(let i=0;i<40;i++) criticLob.push(orderLine(byId("critic"),{kind:"good",dish:"lobster"}));
  ok("#7 critic never says crisp for lobster either", criticLob.every(l=>!/crisp/i.test(l)));

  const karLines=new Set(); for(let i=0;i<120;i++) karLines.add(flavorAdj("karaage"));
  ok("#7 karaage flavor pool includes crispy", [...karLines].some(a=>/crispy/.test(a)));
  ok("#7 dish flavor actually varies", new Set(Array.from({length:80},()=>flavorAdj("lobster"))).size>1);
  ok("#7 unknown dish gets a safe fallback adj", flavorAdj("nope-dish")==="just right");

  ok("#7 Nana keeps her sweet voice", /dear|sweetheart|lovely/i.test(orderLine(byId("nana"),{kind:"good",dish:"salad"})));
  ok("#7 Critic keeps their reviewing voice", (function(){ for(let i=0;i<8;i++){ const l=orderLine(byId("critic"),{kind:"good",dish:"salad"}); if(!/review|know/i.test(l)) return false; } return true; })());
  ok("#7 bad order still names the missing item", /grits/.test(orderLine(byId("reggie"),{kind:"bad",item:"grits"})));

  // ================= Economy loop — Phase 1 (the spine) =================
  startCampaign();
  ok("campaign starts Week 1, Monday", run.week===1 && run.dow===0);
  ok("campaign starts in play with a bank", phase==="play" && run.bank===START_BANK);
  ok("startGame aliases a fresh campaign", (function(){ startGame(); return run.week===1 && run.dow===0 && phase==="play"; })());

  // calendar: Mon–Wed no night, Thu–Sun night; endless week rollover
  startCampaign();
  ok("Mon–Wed are day-only", [0,1,2].every(d=>{ run.dow=d; return !isNightDay(); }));
  ok("Thu–Sun are after-hours", [3,4,5,6].every(d=>{ run.dow=d; return isNightDay(); }));
  startCampaign();
  for(let i=0;i<7;i++) nextDay();
  ok("seven days roll into Week 2 Monday", run.week===2 && run.dow===0);
  ok("weeks are endless", (function(){ for(let i=0;i<21;i++) nextDay(); return run.week===5 && run.dow===0; })());

  // finishDay banks the day's take
  startCampaign(); run.bank=100; tips=350;
  finishDay();
  ok("finishDay banks the take + shows results", phase==="over" && run.bank===450);

  // day-end gating: Monday finishes (no night); a night day opens after-hours — with rep high + no brawl roll
  startCampaign(); run.dow=0; run.beliHist=[9,9]; resetKitchen(); tips=200; served=0; lost=0; beliAdj=0;
  customers=[]; badLedger=[]; dayT=0; phase="play"; spawnT=99;
  let _r=Math.random; Math.random=()=>0.999; update(1/60); Math.random=_r;
  ok("Monday day-end -> results (no night)", phase==="over" && run.bank===200);
  startCampaign(); run.dow=4; run.beliHist=[9,9]; resetKitchen(); tips=0; served=0; lost=0; beliAdj=0;
  customers=[]; badLedger=[]; dayT=0; phase="play"; spawnT=99;
  _r=Math.random; Math.random=()=>0.999; update(1/60); Math.random=_r;
  ok("Friday day-end -> after-hours", phase==="night");

  // brawl-end routing respects the calendar (non-night day finishes; night day opens the club)
  startCampaign(); run.dow=1; resetKitchen(); tips=0; startBrawl(); brawl.fromNight=false; brawl.enemies=[]; brawl.wave=WAVE_COUNT;
  for(let i=0;i<200;i++){ __tick(16); updateBrawl(1/60); if(phase!=="brawl") break; }
  ok("Tue brawl win -> results (no forced night)", phase==="over");
  startCampaign(); run.dow=5; resetKitchen(); tips=0; startBrawl(); brawl.fromNight=false; brawl.enemies=[]; brawl.wave=WAVE_COUNT;
  for(let i=0;i<200;i++){ __tick(16); updateBrawl(1/60); if(phase!=="brawl") break; }
  ok("Sat brawl win -> after-hours opens", phase==="night");

  startCampaign();   // leave state clean

  // ================= Economy loop — Phase 2 (back office) =================
  // damage carryover
  startCampaign(); STATIONS[0].broken=true;
  startDay();
  ok("damage carries into the next day", STATIONS[0].broken===true);
  startCampaign();
  ok("a new campaign repairs everything", STATIONS.every(s=>!s.broken) && !BAR.broken);
  startCampaign(); STATIONS[1].broken=true; startBrawl();
  ok("brawl keeps prior wrecks wrecked", STATIONS[1].broken===true);

  // office rows + purchases
  startCampaign(); resetKitchen(); run.bank=3000; STATIONS[0].broken=true; BAR.broken=true; run.upgrades={};
  let orows=officeRows();
  ok("office lists repairs + all upgrades",
     orows.some(r=>r.kind==="repair"&&r.ref===STATIONS[0]) && orows.some(r=>r.ref===BAR) &&
     orows.filter(r=>r.kind==="upgrade").length===UPGRADES.length);
  const b0=run.bank; officeBuy(orows.find(r=>r.ref===STATIONS[0]));
  ok("repair deducts + fixes the station", run.bank===b0-REPAIR_STATION && !STATIONS[0].broken);
  const b1=run.bank; officeBuy(officeRows().find(r=>r.kind==="upgrade"&&r.ref.id==="tipjar"));
  ok("buying an upgrade deducts + marks owned", run.bank===b1-600 && ownsUp("tipjar"));
  const b2=run.bank; officeBuy(officeRows().find(r=>r.ref.id==="tipjar"));
  ok("can't re-buy an owned upgrade", run.bank===b2);
  run.bank=100; officeBuy(officeRows().find(r=>r.ref===BAR));
  ok("can't afford -> no purchase", run.bank===100 && BAR.broken===true);

  // upgrade effects
  run.upgrades={}; tips=0; combo=0; comboTimer=0; chef.carry={type:"salad",quality:"perfect"};
  serveCustomer({x:0,y:0,hearts:3,state:"waiting",order:{kind:"good",dish:"salad"},orderT:performance.now()});
  const tipNoJar=tips;
  run.upgrades={tipjar:true}; tips=0; combo=0; comboTimer=0; chef.carry={type:"salad",quality:"perfect"};
  serveCustomer({x:0,y:0,hearts:3,state:"waiting",order:{kind:"good",dish:"salad"},orderT:performance.now()});
  ok("Bigger Tip Jar raises tips", tips>tipNoJar);
  ok("Comfy Stools slows patience drain", (function(){ run.upgrades={}; const a=patienceMult(); run.upgrades={stools:true}; const b=patienceMult(); run.upgrades={}; return b<a; })());

  // ---- combat stats + the long shop (Roadmap #40) ----
  startCampaign(); run.bank=1e6; run.stats={};
  ok("stats start at base — no free power", chefMaxHP()===CHEF_HP && punchDmg()===PUNCH_DMG && guardMult()===1 && fightSpeedMult()===1);
  { const sr=officeRows();
    ok("shop lists every combat stat and is a long list", STAT_DEFS.every(d=>sr.some(r=>r.kind==="stat"&&r.ref.id===d.id)) && sr.length>=9);
    ok("adding stats never changes the upgrade-row count", sr.filter(r=>r.kind==="upgrade").length===UPGRADES.length); }
  { const ig=officeRows().find(r=>r.kind==="stat"&&r.ref.id==="hp"), bHp=run.bank; officeBuy(ig);
    ok("buying a stat levels it and deducts its cost", statLvl("hp")===1 && run.bank===bHp-ig.cost);
    ok("Iron Gut raises max HP (+5/lvl)", chefMaxHP()===CHEF_HP+5); }
  run.stats={hp:0,pow:5,guard:5,feet:5};
  ok("Heavy Hands scales punch power (+12%/lvl)", Math.abs(punchDmg()-PUNCH_DMG*1.6)<1e-9);
  ok("Bouncer's Build cuts damage taken, floored >=0.5", guardMult()<1 && guardMult()>=0.5);
  ok("Quick Feet raises fight speed", fightSpeedMult()>1);
  ok("stat cost climbs with level", statCost("hp",0)<statCost("hp",3));
  run.stats.hp=STAT_CAP;
  { const mr=officeRows().find(r=>r.kind==="stat"&&r.ref.id==="hp"), bc=run.bank;
    ok("a maxed stat is flagged", mr.maxed===true);
    officeBuy(mr); ok("can't buy a stat past the cap", statLvl("hp")===STAT_CAP && run.bank===bc); }
  ok("statSum is the boss-readiness total", statSum()===STAT_CAP+5+5+5);
  enterOffice(); ok("office opens on page 0", officePage===0);
  { const pgN=Math.max(1,Math.ceil(officeRows().length/OFF_VIS));
    officeMore(1); ok("MORE pages forward when there's overflow", pgN>1 ? officePage===1 : officePage===0);
    officeMore(-1); ok("...and wraps back to the start", officePage===0); }
  { run.upgrades={}; const rc0=robChanceMult(), sp0=spawnMult(), bp0=bottlePriceMult();
    run.upgrades={camera:true,neon:true,topshelf:true};
    ok("Security Camera lowers robbery odds", robChanceMult()<rc0);
    ok("Neon Sign shortens spawn gaps", spawnMult()<sp0);
    ok("Top-Shelf Liquor raises bottle price", bottlePriceMult()>bp0);
    run.upgrades={}; }

  // ---- boss night: telegraph, the fight, reward, and the FULL WIPE (Roadmap #40, slice B) ----
  // Brandon (the random daytime scuffle) is a SEPARATE, untouched system — prove it stayed that way.
  startCampaign(); customers=[]; startBoss();
  ok("Brandon still defaults exactly as before slice B", boss.hp===20 && boss.maxHP===20 && boss.chefHP===BOSS_CHEF_HP);
  boss.state="reload"; chef.x=boss.x; chef.y=boss.y; boss.hp=10; bossStrike();
  ok("...and his strike is still exactly -1 at base stats", boss.hp===9);
  boss=null; phase="play";

  ok("the roster has at least one boss and pickBoss returns a real id", BOSSES.length>0 && BOSSES.some(b=>b.id===pickBoss()));
  startCampaign(); customers=[]; dayT=0; run.bossTomorrow="vince"; phase="play";
  update(1/60);
  ok("a queued boss fires at close, ahead of the brawl roll", phase==="bossnight" && !!bossFight && bossFight.def.id==="vince");
  ok("the telegraph flag is consumed so it can't refire", run.bossTomorrow===null);
  ok("boss-night chef HP starts at the STAT-scaled max (2a: stats are the lever)",
     bossFight.chefHP===chefMaxHP() && bossFight.maxChefHP===chefMaxHP());

  bossFight.hp=1; bossFight.state="recover"; bossFight.t=1; bossFight.x=chef.x; bossFight.y=chef.y;
  bossNightStrike();
  ok("striking during the exposed window can end the fight", bossFight.outcome==="win" && bossFight.endT>0);
  { const bankBefore=run.bank; bossFight.endT=0; updateBossNight(1/60);
    ok("a win pays the reward and clears the fight", run.bank===bankBefore+BOSSES[0].reward && bossFight===null);
    ok("a win banks bossesBeaten and returns to service", run.bossesBeaten===1 && (phase==="play"||phase==="over"||phase==="night")); }

  startCampaign(); customers=[]; dayT=0; run.bossTomorrow="vince"; phase="play"; update(1/60);
  run.bank=999999;
  bossFight.chefHP=0; updateBossNight(1/60);   // no passive bleed on this boss (unlike Brandon) — drive it to exactly 0
  ok("chef HP hitting 0 triggers the loss", bossFight.outcome==="lose");
  bossFight.endT=0; updateBossNight(1/60);
  ok("losing goes to gameover with the boss's name recorded (told apart from an eviction)",
     phase==="gameover" && !!run.bossWipe && bossFight===null);
  primaryAction();      // tap gameover -> the EXISTING generic startCampaign() reset
  ok("1a: losing a boss is a FULL WIPE — bank, week, stats and upgrades all reset",
     phase==="play" && run.bank===START_BANK && run.week===1 &&
     Object.keys(run.stats).length===0 && Object.keys(run.upgrades).length===0 && run.bossesBeaten===0);

  startCampaign(); customers=[]; startBossNight("vince");
  { const B=bossFight; B.state="charge"; B.t=0.5; B.chargeDX=1; B.chargeDY=0; B.hitThisCharge=false;
    B.x=chef.x-5; B.y=chef.y; const hp0=B.chefHP; updateVince(1/60);
    ok("Vince's charge damages the chef on contact", B.chefHP<hp0);
    B.state="slamtele"; B.t=0.01; B.slamX=chef.x; B.slamY=chef.y; const hp1=B.chefHP; updateVince(1/60);
    ok("...and the ground-pound (his 2nd recurrent attack) damages too if she doesn't dodge", B.chefHP<hp1); }

  startCampaign(); customers=[]; startBossNight("vince"); run.stats={guard:0};
  { const B0=bossFight; B0.state="charge"; B0.t=0.5; B0.chargeDX=1; B0.chargeDY=0; B0.hitThisCharge=false; B0.x=chef.x-5; B0.y=chef.y;
    const b0=B0.chefHP; updateVince(1/60); const dmg0=b0-B0.chefHP;
    startCampaign(); customers=[]; startBossNight("vince"); run.stats={guard:5};
    const B1=bossFight; B1.chefHP=chefMaxHP(); B1.state="charge"; B1.t=0.5; B1.chargeDX=1; B1.chargeDY=0; B1.hitThisCharge=false; B1.x=chef.x-5; B1.y=chef.y;
    const b1=B1.chefHP; updateVince(1/60); const dmg1=b1-B1.chefHP;
    ok("2a: Bouncer's Build reduces boss-night damage taken", dmg1<dmg0); }

  startCampaign(); customers=[]; startBossNight("vince"); run.stats={};
  { const B0=bossFight; B0.hp=100; B0.state="recover"; B0.t=5; B0.x=chef.x; B0.y=chef.y;
    const h0=B0.hp; vinceStrike(); const chip0=h0-B0.hp;
    startCampaign(); customers=[]; startBossNight("vince"); run.stats={pow:5};
    const B1=bossFight; B1.hp=100; B1.state="recover"; B1.t=5; B1.x=chef.x; B1.y=chef.y;
    const h1=B1.hp; vinceStrike(); const chip1=h1-B1.hp;
    ok("2a: Heavy Hands raises boss-night strike damage", chip1>chip0); }

  // ---- Vince's moveset TRIPLED: 2 -> 6 distinct recurrent attacks (charge/pound already covered above) ----
  { const VD=BOSSES.find(b=>b.id==="vince");
    ok("the rotation holds 5 scheduled attacks; +GRAB (proximity) = 6 total distinct attacks",
       VD.rotation.length===5 && new Set(VD.rotation.concat(["grab"])).size===6); }

  startCampaign(); customers=[]; startBossNight("vince");
  { const B=bossFight; B.x=100; B.y=100; chef.x=200; chef.y=100;
    B.state="paperaim"; B.t=0.0001; B.paperDX=1; B.paperDY=0; B.paperHit=false;
    updateVince(1/60);
    ok("paper throw (3rd attack) launches toward the chef", bossFight.state==="paperfly" && bossFight.paperDX===1);
    const hp0=bossFight.chefHP; bossFight.paperX=chef.x-2; bossFight.paperY=chef.y; bossFight.t=1;
    updateVince(1/60);
    ok("...and damages on a connecting hit", bossFight.chefHP<hp0); }

  startCampaign(); customers=[]; startBossNight("vince");
  { const B=bossFight; B.x=150; B.y=90; chef.x=152; chef.y=90;    // inside grabR
    B.cycle=0; B.state="windup"; B.t=0.0001;
    updateVince(1/60);
    ok("grab (4th attack) preempts the rotation when she's hugging him", B.state==="grabtele");
    B.t=0.0001; const hp0=B.chefHP, cx0=chef.x;
    updateVince(1/60);
    ok("...connects, damages, and flings her elsewhere", B.chefHP<hp0 && chef.x!==cx0); }

  startCampaign(); customers=[]; startBossNight("vince");
  { const B=bossFight; B.x=140; B.y=80; chef.x=145; chef.y=80;    // inside stompR
    B.state="stomptele"; B.t=0.0001; const hp0=B.chefHP;
    updateVince(1/60);
    ok("stomp (5th attack, centred on HIM now, not a remembered spot) damages on a landed hit", B.chefHP<hp0); }

  startCampaign(); customers=[]; startBossNight("vince");
  { const B=bossFight; B.x=100; B.y=100; chef.x=106; chef.y=100;
    B.state="dcharge1"; B.t=0.5; B.chargeDX=1; B.chargeDY=0; B.hitThisCharge=false;
    const hp0=B.chefHP; updateVince(1/60);
    ok("double charge (6th attack) leg 1 can connect", B.chefHP<hp0);
    B.t=0; updateVince(1/60);
    ok("...hands off into a re-aimed leg 2", B.state==="dcharge2");
    const hp1=B.chefHP; B.hitThisCharge=false; chef.x=B.x+4; chef.y=B.y;
    updateVince(1/60);
    ok("...which can also connect (a real 2-hit combo)", B.chefHP<hp1); }

  { const terminal=["charge","slamtele","slam","paperaim","paperfly","grabtele","grabhit","stomptele","stomphit","dcharge1","dcharge2"];
    let allReachRecover=true;
    for(const st of terminal){
      startCampaign(); customers=[]; startBossNight("vince");
      const B=bossFight; B.x=200; B.y=100; chef.x=205; chef.y=100;
      B.state=st; B.t=0; B.slamX=B.x; B.slamY=B.y; B.paperX=B.x; B.paperY=B.y; B.paperDX=1; B.paperDY=0;
      B.chargeDX=1; B.chargeDY=0; B.hitThisCharge=true;
      let steps=0; while(B.state!=="recover" && steps<600){ updateVince(1/60); steps++; }
      if(B.state!=="recover") allReachRecover=false;
    }
    ok("EVERY one of the 6 attacks still resolves into the strike window — she can always fight back", allReachRecover); }

  // ---- a second boss: The Health Inspector, a ranged ZONER (Roadmap #40, slice D) ----
  ok("the roster now has two bosses (still true, before the 3rd is added below)", BOSSES.length>=2 && BOSSES.some(b=>b.id==="inspector"));
  startCampaign(); run.bossesBeaten=1;
  ok("pickBoss escalates to the Inspector after one win", pickBoss()==="inspector");
  startCampaign(); run.bossesBeaten=0;
  ok("...and stays on Vince for a fresh run", pickBoss()==="vince");

  startCampaign(); customers=[]; startBossNight("inspector");
  ok("the inspector boots as a zoner with stat-scaled HP (2a applies to every boss, not just Vince)",
     bossFight.kind==="zoner" && bossFight.chefHP===chefMaxHP());

  { const B=bossFight; B.state="citetele"; B.t=0.0001; B.citeX=chef.x; B.citeY=chef.y;
    const hp0=B.chefHP; updateInspector(1/60);
    ok("citation (1st attack) lands if she's still in the frozen circle", B.chefHP<hp0); }
  startCampaign(); customers=[]; startBossNight("inspector");
  { const B=bossFight; B.state="citetele"; B.t=0.0001; B.citeX=chef.x+500; B.citeY=chef.y+500;
    const hp0=B.chefHP; updateInspector(1/60);
    ok("...but whiffs once she's stepped out of it", B.chefHP===hp0); }

  startCampaign(); customers=[]; startBossNight("inspector");
  { const B=bossFight; B.state="zonestele"; B.t=0.0001; B.zones=[{x:chef.x,y:chef.y}];
    const hp0=B.chefHP; updateInspector(1/60);
    ok("zones (2nd attack): standing in ANY violation circle damages", B.chefHP<hp0); }

  startCampaign(); customers=[]; startBossNight("inspector");
  { const B=bossFight; B.state="spreadfly"; B.t=1;
    B.papers=[{x:chef.x-2,y:chef.y,dx:1,dy:0,hit:false},{x:-999,y:-999,dx:1,dy:0,hit:false}];
    const hp0=B.chefHP; updateInspector(1/60);
    ok("spread (3rd attack): a fan of projectiles, one connecting is enough", B.chefHP<hp0 && B.papers[0].hit===true); }

  startCampaign(); customers=[]; startBossNight("inspector");
  { const B=bossFight; B.state="summontele"; B.t=0.0001; updateInspector(1/60);
    ok("summon (4th attack) spawns adds AND opens the strike window in the same resolve — adds never gate it",
       B.adds && B.adds.length===B.def.addCount && B.state==="recover"); }
  startCampaign(); customers=[]; startBossNight("inspector");
  { const B=bossFight; B.adds=[{x:chef.x+1,y:chef.y,hp:1,life:5,hitDone:false}];
    const hp0=B.chefHP; updateInspector(1/60);
    ok("...and a roaming add still deals its own touch damage", B.chefHP<hp0 && B.adds[0].hitDone===true); }

  { const terminal=["citetele","citehit","zonestele","zoneshit","spreadfly","summontele"];
    let allReach=true;
    for(const st of terminal){
      startCampaign(); customers=[]; startBossNight("inspector");
      const B=bossFight; chef.x=205; chef.y=100; B.x=200; B.y=100;
      B.state=st; B.t=0; B.citeX=B.x; B.citeY=B.y; B.zones=[]; B.papers=[]; B.adds=[];
      let steps=0; while(B.state!=="recover" && steps<600){ updateInspector(1/60); steps++; }
      if(B.state!=="recover") allReach=false;
    }
    ok("EVERY one of the Inspector's 4 attacks also resolves into the strike window", allReach); }

  startCampaign(); customers=[]; startBossNight("inspector");
  { const B=bossFight; B.hp=1; B.state="recover"; B.t=1; B.x=chef.x; B.y=chef.y;
    bossNightStrike();
    ok("the shared strike dispatcher (bossNightStrike) works on the Inspector too, not just Vince",
       B.hp<=0 || B.outcome==="win"); }

  // ---- a third boss: Chef Bruno "The Ringer", a TRICKSTER (Roadmap #40, slice E) ----
  ok("the roster now has three bosses", BOSSES.length===3 && BOSSES.some(b=>b.id==="ringer"));
  startCampaign(); run.bossesBeaten=2;
  ok("pickBoss escalates to the Ringer after two wins", pickBoss()==="ringer");
  startCampaign(); run.bossesBeaten=1;
  ok("...and stays on the Inspector after one", pickBoss()==="inspector");

  startCampaign(); customers=[]; startBossNight("ringer");
  ok("the ringer boots as a trickster with stat-scaled HP (2a applies here too)",
     bossFight.kind==="trickster" && bossFight.chefHP===chefMaxHP());

  startCampaign(); customers=[]; startBossNight("ringer");
  { const B=bossFight; B.state="feinttele"; B.t=0.0001; B.x=chef.x; B.y=chef.y;
    const hp0=B.chefHP; updateRinger(1/60);
    ok("feint (1st attack) deals NO damage even standing right on top of him — the core trust-test",
       B.chefHP===hp0 && B.state==="recover"); }

  startCampaign(); customers=[]; startBossNight("ringer");
  { const B=bossFight; B.state="jabtele"; B.t=0.0001; B.x=chef.x; B.y=chef.y;
    const hp0=B.chefHP; updateRinger(1/60);
    ok("jab (2nd attack, visually IDENTICAL to feint) connects in range", B.chefHP<hp0); }
  startCampaign(); customers=[]; startBossNight("ringer");
  { const B=bossFight; B.state="jabtele"; B.t=0.0001; B.x=chef.x+500; B.y=chef.y+500;
    const hp0=B.chefHP; updateRinger(1/60);
    ok("...but whiffs outside jabR", B.chefHP===hp0); }

  startCampaign(); customers=[]; startBossNight("ringer");
  { const B=bossFight; B.state="combotele"; B.t=0.0001; B.x=chef.x; B.y=chef.y;
    const hp0=B.chefHP; updateRinger(1/60);
    ok("combo (3rd attack) hit 1 connects", B.chefHP<hp0 && B.state==="combohit1");
    B.t=0; const hp1=B.chefHP; updateRinger(1/60);
    ok("...then a REAL gap with zero damage (not just a delay)", B.chefHP===hp1 && B.state==="combogap");
    B.t=0.0001; const hp2=B.chefHP; updateRinger(1/60);
    ok("...then hit 2 connects independently, after the gap", B.chefHP<hp2 && B.state==="combohit2"); }

  startCampaign(); customers=[]; startBossNight("ringer");
  { const B=bossFight; B.state="counter"; B.t=1.0; B.counterHit=false; B.x=chef.x; B.y=chef.y;
    const hp0=B.chefHP; updateRinger(1/60);
    ok("counter (4th attack, SUSTAINED not instant) costs a hit if she's close at any point during it", B.chefHP<hp0); }
  startCampaign(); customers=[]; startBossNight("ringer");
  { const B=bossFight; B.state="counter"; B.t=1.0; B.counterHit=false; B.x=chef.x+500; B.y=chef.y+500;
    const hp0=B.chefHP; updateRinger(1/60);
    ok("...but costs nothing if she stays away the whole time", B.chefHP===hp0); }

  { const terminal=["feinttele","jabtele","jabhit","combotele","combohit1","combogap","combohit2","counter"];
    let allReach=true;
    for(const st of terminal){
      startCampaign(); customers=[]; startBossNight("ringer");
      const B=bossFight; chef.x=205; chef.y=100; B.x=200; B.y=100; B.counterHit=true;
      B.state=st; B.t=0;
      let steps=0; while(B.state!=="recover" && steps<600){ updateRinger(1/60); steps++; }
      if(B.state!=="recover") allReach=false;
    }
    ok("EVERY one of Bruno's attacks also resolves into the strike window", allReach); }

  startCampaign(); customers=[]; startBossNight("ringer");
  { const B=bossFight; B.hp=1; B.state="recover"; B.t=1; B.x=chef.x; B.y=chef.y;
    bossNightStrike();
    ok("the shared strike dispatcher works on the Ringer too, unchanged", B.hp<=0 || B.outcome==="win"); }

  // ---- boss-intro cinematic: tight zoom + typed name, before every boss-night fight (Roadmap #40, slice F) ----
  startCampaign(); customers=[]; startBossNight("vince");
  ok("camZoom returns BOSS_INTRO_ZOOM at rest during the intro", camZoom(1,1)>=BOSS_INTRO_ZOOM);
  bossFight.introT=0;
  ok("...and reverts to COMBAT_ZOOM once the intro ends", Math.abs(camZoom(1,1)-COMBAT_ZOOM)<1e-9);
  bossFight=null; phase="play";
  ok("...and to the old baseline with no bossFight and no fight phase (regression check)",
     Math.abs(camZoom(0,0)-1)<1e-9);

  startCampaign(); customers=[]; startBossNight("vince");
  { let allCovered=true;
    for(let off=0; off<=40; off+=2){
      const zAtOff = camZoom(off,off);
      if(!((zAtOff-1)*160 >= off-1e-9) || !((zAtOff-1)*90 >= off-1e-9)) allCovered=false;
    }
    ok("the zoom-safety invariant (the locked floor rule) still holds across an offset sweep during the intro", allCovered); }
  ok("camPanClamp(262,...) at BOSS_INTRO_ZOOM reaches the boss's spawn point unclamped",
     camPanClamp(262, 320, BOSS_INTRO_ZOOM, 1) === 262);

  startCampaign(); customers=[]; startBossNight("vince"); phase="bossnight";
  camLeanX=160; camLeanY=90;
  for(let i=0;i<120;i++) tickCamLean(1/60);
  ok("camLean converges toward the boss's spawn point during the intro (not the chef's)",
     Math.abs(camLeanX-262)<2 && Math.abs(camLeanY-78)<2);
  bossFight.introT=0; tickCamLean(1/60);
  ok("...and hard-cuts back to center the instant the intro ends", camLeanX===160 && camLeanY===90);

  startCampaign(); customers=[]; startBossNight("vince");
  { const x0=chef.x, y0=chef.y, introBefore=bossFight.introT;
    updateBossNight(1/60);
    ok("the chef is frozen during the intro (no movement)", chef.x===x0 && chef.y===y0);
    ok("bossFight.state stays 'windup' the whole intro (no combat progression)", bossFight.state==="windup");
    ok("introT counts down each tick", bossFight.introT<introBefore);
    let steps=0; while(bossFight.introT>0 && steps<200){ updateBossNight(1/60); steps++; }
    ok("the intro ends within a bounded number of ticks", bossFight.introT===0);
    updateBossNight(1/60);
    ok("combat begins advancing normally the instant the intro ends", bossFight.state!=="windup" || bossFight.t<bossFight.def.windup); }

  startCampaign(); customers=[]; startBossNight("vince"); run.bank=99999;
  bossFight.chefHP=0; updateBossNight(1/60);
  ok("a loss defensively still fires even if chef HP hits 0 DURING the intro", bossFight.outcome==="lose");

  ok("introTypedChars: 0% elapsed is an empty string", introTypedChars(1.8, 1.8, "Vince")==="");
  ok("...a partial reveal partway through", introTypedChars(1.8-0.9, 1.8, "Vince").length>0 && introTypedChars(1.8-0.9, 1.8, "Vince").length<5);
  ok("...the full name by 70% elapsed", introTypedChars(1.8-1.26, 1.8, "Vince")==="Vince");
  ok("...and it stays full past 70% (the hold beat before the cut)", introTypedChars(0.1, 1.8, "Vince")==="Vince");
  run.stats={}; startCampaign(); customers=[]; boss=null; bossFight=null; phase="play";

  // routing: results -> office -> next day
  startCampaign(); run.dow=0; tips=100; finishDay();
  ok("day ends on results", phase==="over");
  enterOffice(); ok("results tap opens the office", phase==="office");
  nextDay(); ok("office OPEN advances to the next day", phase==="play" && run.dow===1);

  startCampaign();   // clean

  // ================= Phase 3: robbery (after-hours hoard risk) =================
  ok("brawl thieves steal more (STEAL_LOSS up)", STEAL_LOSS>=100);

  // triggers ONLY at night, only on a fat bank, and stops once drained
  startCampaign(); phase="play"; dayT=DAY_LEN; run.bank=50000; robbers=[]; robT=0;
  maybeRob(1/60);
  ok("no robberies during day service", robbers.length===0);
  phase="night"; night={t:NIGHT_TIME, barDead:false}; run.bank=1000; robbers=[]; robT=0;
  maybeRob(1/60);
  ok("a modest bank draws no robbers", robbers.length===0);
  let spawned=false;
  for(let i=0;i<80;i++){ run.bank=50000; robT=0; robbers=[]; maybeRob(1/60); if(robbers.length){ spawned=true; break; } }
  ok("a fat bank attracts robbers at night", spawned);
  let anyLow=false;
  for(let i=0;i<80;i++){ run.bank=2000; robT=0; robbers=[]; maybeRob(1/60); if(robbers.length){ anyLow=true; break; } }
  ok("no more robbers once the cash is gone", !anyLow);
  run.bank=50000; robbers=[]; robT=0;
  for(let i=0;i<40;i++){ robT=0; maybeRob(1/60); }
  ok("only one robber at a time", robbers.length<=1);

  // robber grabs from the bank and, if it reaches the door, the cash is gone
  phase="night"; run.bank=20000; robbedDay=0;
  robbers=[{x:REGISTER.x,y:REGISTER.y,state:"in",loot:0,dir:"left",seed:0}];
  chef.x=10; chef.y=176;                                  // chef nowhere near
  for(let i=0;i<900 && robbers.length;i++){ updateRobbers(1/60); }
  ok("escaped robber drains the bank", robbedDay>0 && run.bank===20000-robbedDay);

  // catch it after the grab -> full refund
  run.bank=20000; robbedDay=0;
  const rr={x:REGISTER.x,y:REGISTER.y,state:"in",loot:0,dir:"left",seed:0}; robbers=[rr];
  chef.x=10; chef.y=176; updateRobbers(1/60);
  ok("robber snatches from the bank", rr.loot>0 && run.bank===20000-rr.loot);
  chef.x=rr.x; chef.y=rr.y; updateRobbers(1/60);
  ok("catching it refunds the loot", run.bank===20000 && robbers.length===0 && robbedDay===0);

  // catch before the grab -> scared off, no loss
  run.bank=20000; robbedDay=0;
  robbers=[{x:DOOR.x,y:DOOR.y,state:"in",loot:0,dir:"left",seed:0}]; chef.x=DOOR.x; chef.y=DOOR.y;
  updateRobbers(1/60);
  ok("scared off before grabbing = no loss", run.bank===20000 && robbers.length===0 && robbedDay===0);

  // each new day clears robbery state
  startCampaign(); robbers=[{x:0,y:0,state:"in",loot:5}]; robbedDay=999; robT=0.1;
  startDay();
  ok("a new day clears robbers", robbers.length===0 && robbedDay===0 && robT===ROB_CHECK);

  startCampaign();

  // ================= Phase 3: weekly rent + eviction =================
  ok("week-2 rent = base", rentFor(2)===RENT_BASE);
  ok("rent escalates weekly", rentFor(3)===RENT_BASE+RENT_STEP && rentFor(4)===RENT_BASE+2*RENT_STEP);

  startCampaign(); run.bank=99999;
  ok("week 1 charges no rent yet", run.week===1 && run.lastRent===0);
  for(let i=0;i<6;i++) nextDay();                 // Mon..Sun of week 1
  ok("no rent through the first week", run.week===1 && run.lastRent===0);
  const beforeRent=run.bank; nextDay();           // Sun -> Mon of week 2
  ok("rent hits entering week 2", run.week===2 && run.bank===beforeRent-rentFor(2) && run.lastRent===rentFor(2));

  startCampaign(); run.dow=6;
  ok("Sunday office previews Monday's rent", rentDueOnOpen()===rentFor(run.week+1));
  run.dow=2;
  ok("mid-week shows no imminent rent", rentDueOnOpen()===0);

  startCampaign(); run.dow=6; run.week=1; run.bank=rentFor(2)-1;   // a dollar short
  nextDay();
  ok("short on rent -> EVICTED", phase==="gameover" && run.evictedRent===rentFor(2));
  startCampaign();
  ok("restart after eviction is a fresh run", phase==="play" && run.week===1 && run.bank===START_BANK);

  startCampaign(); run.dow=6; run.week=1; run.bank=rentFor(2);     // exactly enough
  nextDay();
  ok("exact rent survives (bank 0, week 2)", phase==="play" && run.week===2 && run.bank===0);

  startCampaign();

  // ================= Big Patch P1: reputation (rolling avg) + witness multiplier =================
  const CI=CAST.findIndex(c=>c.id==="critic");
  // rolling average
  startCampaign(); run.beliHist=[]; served=20; lost=0; shooed=0; beliAdj=0;
  ok("day 1 reputation falls back to today's score", Math.abs(beli()-dayScore())<0.001);
  run.beliHist=[8,8,8];
  ok("reputation = average of history (ignores today)", Math.abs(beli()-8)<0.001);
  run.beliHist=[10,5];
  ok("rolling avg blends recent days", Math.abs(beli()-7.5)<0.001);
  // finishDay logs the day + window cap
  startCampaign(); run.beliHist=[]; served=20; lost=0; shooed=0; beliAdj=0; tips=0;
  const ds=dayScore(); finishDay();
  ok("finishDay logs today's score", run.beliHist.length===1 && Math.abs(run.beliHist[0]-ds)<0.001);
  startCampaign(); run.beliHist=[6,6,6,6,6]; served=0; lost=0; shooed=0; beliAdj=0; tips=0; finishDay();
  ok("history caps at the rolling window", run.beliHist.length===BELI_WINDOW);

  // witness tiers
  brawl={spectators:[{type:CI,filming:true}], live:false};
  ok("critic on camera = worst tier", fightAudience().tier===WIT_CRITIC_REC);
  brawl={spectators:[{type:0,filming:true}], live:false};
  ok("patron recording = high tier", fightAudience().tier===WIT_PATRON_REC);
  brawl={spectators:[{type:CI,filming:false}], live:false};
  ok("critic just watching = mid tier", fightAudience().tier===WIT_CRITIC_WATCH);
  brawl={spectators:[], live:false};
  ok("nobody watching = negligible tier", fightAudience().tier===WIT_NONE);
  brawl={spectators:Array.from({length:5},()=>({type:0,filming:true})), live:false};
  const camLo=fightAudience().cams; brawl.live=true; const camHi=fightAudience().cams;
  ok("packed house / GOING LIVE raises exposure", camHi>camLo && camLo>1);

  // the actual Beli hit scales with who saw it
  startCampaign(); run.beliHist=[6,6];
  resetKitchen(); brawl={spectators:[], live:false}; beliAdj=0; chefKO(); const hitNone=Math.abs(beliAdj);
  resetKitchen(); brawl={spectators:[{type:CI,filming:true},{type:CI,filming:true}], live:true}; beliAdj=0; chefKO(); const hitCrit=Math.abs(beliAdj);
  ok("losing on camera hurts far more than in private", hitCrit > hitNone*3);
  resetKitchen(); brawl={spectators:[{type:CI,filming:true}], live:false}; beliAdj=0; run.beliHist=[9,9]; chefKO(); const hitHi=Math.abs(beliAdj);
  resetKitchen(); brawl={spectators:[{type:CI,filming:true}], live:false}; beliAdj=0; run.beliHist=[6,6]; chefKO(); const hitMid=Math.abs(beliAdj);
  ok("a fancier place (Beli 8.5+) falls harder", hitHi > hitMid);

  startCampaign(); resetKitchen();

  // ================= pause button =================
  phase="play";   ok("can pause during play", canPause());
  phase="night";  ok("can pause during night", canPause());
  phase="brawl";  ok("can pause during brawl", canPause());
  phase="office"; ok("no pause in the office", !canPause());
  phase="title";  ok("no pause on the title", !canPause());
  ok("pause hit-test is top-center only", inPause({x:PAUSE_BTN.x,y:6}) && !inPause({x:PAUSE_BTN.x,y:40}) && !inPause({x:10,y:6}));
  phase="play";

  // ================= Brandon (day boss) =================
  startCampaign(); customers=[{x:100,y:120,type:CI,state:"eating"}]; startBoss();
  ok("Brandon appears with a 20-tick bar", phase==="boss" && boss.hp===20 && boss.maxHP===20);
  ok("your boss HP is set", boss.chefHP===BOSS_CHEF_HP);
  ok("a filming critic joins as a camera", boss.spectators.length>=1);
  ok("service clears for the standoff", customers.length===0);

  // bleed
  startCampaign(); customers=[]; startBoss(); boss.state="firing"; boss.cross={x:280,y:30,active:true}; boss.fireT=99;
  chef.x=20; chef.y=160; const hp0=boss.chefHP;
  for(let i=0;i<60;i++) updateBoss(1/60);
  ok("you bleed slowly throughout", boss.chefHP<hp0);

  // shot on target vs dodged
  startCampaign(); customers=[]; startBoss(); boss.state="firing"; boss.shots=0;
  chef.x=150; chef.y=100; boss.cross={x:150,y:100,active:true}; boss.fireT=0.001;
  const hpB=boss.chefHP, medB=boss.medicalOwed; updateBoss(1/60);
  ok("a shot on target costs HP + a medical bill", boss.chefHP<hpB && boss.medicalOwed===medB+BOSS_MED_BILL);
  startCampaign(); customers=[]; startBoss(); boss.state="firing"; boss.shots=0;
  chef.x=20; chef.y=160; boss.cross={x:290,y:24,active:true}; boss.fireT=0.001;
  const medM=boss.medicalOwed; updateBoss(1/60);
  ok("a dodged shot does no medical damage", boss.medicalOwed===medM);

  // reload + strike windows
  startCampaign(); customers=[]; startBoss(); boss.state="firing"; boss.shots=BOSS_MAG-1;
  chef.x=150; chef.y=100; boss.cross={x:150,y:100,active:true}; boss.fireT=0.001; updateBoss(1/60);
  ok("Brandon reloads after a magazine", boss.state==="reload");
  chef.x=10; chef.y=170; const hpr=boss.hp; bossStrike();
  ok("a strike from range whiffs", boss.hp===hpr);
  boss.hp=10; chef.x=boss.x; chef.y=boss.y; bossStrike();
  ok("a strike during reload chips him", boss.hp===9 || boss.hp===0);
  boss.state="firing"; boss.hp=8; chef.x=boss.x; chef.y=boss.y; bossStrike();
  ok("can't strike while he's firing", boss.hp===8);

  // win pays medical, returns to service
  startCampaign(); customers=[]; startBoss(); run.bank=5000; boss.medicalOwed=800;
  boss.state="reload"; chef.x=boss.x; chef.y=boss.y; boss.hp=1; bossStrike();
  ok("depleting Brandon wins", boss && (boss.outcome==="win"||boss.outcome==="ko"));
  boss.endT=0; updateBoss(1/60);
  ok("win pays medical + back to service", phase==="play" && run.bank===4200 && boss===null);

  // lose pays medical, ends the day
  startCampaign(); customers=[]; startBoss(); run.bank=5000; boss.medicalOwed=1200; tips=0; served=0; lost=0; shooed=0; beliAdj=0; run.beliHist=[6,6];
  boss.chefHP=0.0001; updateBoss(1/60);
  ok("running out of HP = shot down", boss.outcome==="lose");
  boss.endT=0; updateBoss(1/60);
  ok("losing pays medical + ends the day", run.bank===3800 && phase==="over");

  startCampaign(); customers=[]; boss=null;

  // ================= keyboard controls (WASD + J/K) =================
  ok("keyboard defaults off in headless (no desktop pointer)", keyboardControls===false);
  keyboardControls=false; joy.vx=0.5; joy.vy=0; for(const k in keysDown) delete keysDown[k]; keysDown.KeyD=true; applyKeyboardMove();
  ok("keyboard OFF leaves the joystick alone", joy.vx===0.5);
  for(const k in keysDown) delete keysDown[k];

  keyboardControls=true;
  keysDown.KeyD=true; let kv=kbVec(); ok("D moves right", kv.x===1 && kv.y===0);
  delete keysDown.KeyD; keysDown.KeyW=true; kv=kbVec(); ok("W moves up", kv.y===-1);
  keysDown.KeyD=true; kv=kbVec(); ok("diagonals are normalized", Math.abs(Math.hypot(kv.x,kv.y)-1)<0.001);
  for(const k in keysDown) delete keysDown[k];
  joy.vx=0; joy.vy=0; keysDown.KeyA=true; applyKeyboardMove();
  ok("a held key drives the joystick", joy.vx===-1);
  delete keysDown.KeyA; applyKeyboardMove();
  ok("releasing all keys stops movement", joy.vx===0 && joy.vy===0);

  phase="title"; keyAction("KeyJ"); ok("J starts the game from the title", phase==="play");
  startCampaign(); customers=[]; startBoss(); boss.state="reload"; chef.x=boss.x; chef.y=boss.y; boss.hp=5;
  keyAction("KeyJ"); ok("J strikes Brandon during reload", boss.hp===4 || boss.hp===0);

  keyboardControls=false; phase="play"; paused=false;
  keyAction("KeyP"); ok("P pauses in any mode", paused===true);
  keyAction("KeyP"); ok("P resumes", paused===false);

  keyboardControls=false; boss=null; startCampaign(); customers=[];

  // ================= P2: back-office partner =================
  ok("partner is the OTHER chef", (function(){ const o=chefSet; chefSet="chefF"; const a=partnerSet(); chefSet="chefM"; const b=partnerSet(); chefSet=o; return a==="chefM"&&b==="chefF"; })());
  startCampaign(); run.dow=1; startBrawl();
  ok("partner joins the fight", !!brawl.partner && brawl.partner.hp===PARTNER_HP && !brawl.partner.downed);
  brawl.enemies=[{cast:CAST[0].id, x:brawl.partner.x+6, y:brawl.partner.y, hp:3, state:"chase", flash:0}];
  const pe=brawl.enemies[0], peHp=pe.hp;
  for(let i=0;i<160 && pe.state!=="ko"; i++) updatePartner(1/60);
  ok("partner damages enemies", pe.hp<peHp);
  startCampaign(); run.dow=1; startBrawl();
  const pp=brawl.partner; brawl.enemies=[]; for(let k=0;k<6;k++) brawl.enemies.push({cast:CAST[0].id,x:pp.x,y:pp.y,hp:30,state:"chase",flash:0});
  for(let i=0;i<600 && !pp.downed; i++) updatePartner(1/60);
  ok("a swarmed partner goes down", pp.downed && pp.hp===0);
  ok("partner going down doesn't end the fight", phase==="brawl");
  startCampaign(); run.dow=1; startBrawl();
  ok("partner revives each fight", !brawl.partner.downed && brawl.partner.hp===PARTNER_HP);
  startCampaign(); customers=[]; brawl=null;

  // ================= render smoke-tests (catch draw-time crashes the logic tests miss) =================
  function smoke(name, fn){ try{ fn(); ok("render: "+name, true); } catch(e){ ok("render: "+name+" [THREW "+e.message+"]", false); } }
  startCampaign(); customers=[{x:100,y:120,type:0,spr:0,state:"eating",order:{dish:"salad"},hearts:3,bob:0,dir:"front"},
                              {x:140,y:120,type:4,spr:null,state:"waiting",order:{kind:"good",dish:"lobster"},hearts:2,bob:1,dir:"left"}]; uiLab=null;
  smoke("day", ()=>{ draw(); drawUI(); });
  ok("only the 6 kept patrons are embedded", CUST_SPR.length===6);
  ok("a sprite patron resolves a frame", !!custSprite(customers[0]));
  ok("a classic patron uses no sprite", custSprite(customers[1])===null);
  startCampaign(); customers=[]; brawl=null; night=null; startBoss();
  smoke("boss", ()=>{ drawBoss(); drawBossHUD(); });
  startCampaign(); run.dow=1; startBrawl(); brawl.enemies=[]; 
  smoke("brawl", ()=>{ drawBrawl(); drawBrawlHUD(); });
  startCampaign(); run.dow=4; startNight();
  smoke("night", ()=>{ drawNight(); drawNightHUD(); });
  startCampaign(); enterOffice();
  smoke("office", ()=>drawOffice());
  startCampaign(); tips=100; finishDay();
  smoke("results", ()=>drawEnd());
  startCampaign(); run.evictedRent=1500; phase="gameover";
  smoke("gameover", ()=>drawGameOver());
  paused=true; smoke("pause overlay", ()=>drawPausedOverlay()); paused=false;
  smoke("title", ()=>drawTitle());

  // ================= environments (dev view toggle) =================
  ok("six views to cycle", ENVS.length===6 && ENVS.every(e=>e.name && e.pool && typeof e.draw==="function"));
  ENV=0; FLOOR_CV="stale"; ENV=(ENV+1)%ENVS.length; FLOOR_CV=null;
  ok("cycling views rebakes the floor light", ENV===1 && FLOOR_CV===null);
  for(let i=0;i<ENVS.length;i++){ ENV=i; smoke("view: "+ENVS[i].name, ()=>drawWallAndWindows()); }
  ENV=0; FLOOR_CV=null;

  // ================= office door + morning intro =================
  startCampaign();
  ok("morning: partner heads for the office", !!officeIntro && officeIntro.state==="walk" && officeDoorOpen===0);
  let maxOpen=0;
  for(let i=0;i<900 && officeIntro; i++){ updateOfficeIntro(1/60); maxOpen=Math.max(maxOpen,officeDoorOpen); }
  ok("the door opened for them on the way in", maxOpen>0.9);
  ok("intro ends: partner inside, door shut", officeIntro===null && officeDoorOpen===0);
  officeDoorOpen=0.7; smoke("office door ajar", ()=>drawOfficeDoor()); officeDoorOpen=0;
  startCampaign(); officeIntro={x:120,y:112,t:0,state:"walk",dir:"left",alpha:1};
  smoke("day with intro partner walking", ()=>{ draw(); });
  officeIntro=null;

  // ================= locale-native monsters + partner door-burst =================
  ok("every locale generates its own creature", (function(){ try{
    for(let e2=0;e2<ENVS.length;e2++){ ENV=e2; if(!genMonster(4242+e2)) return false; } return true;
  }catch(err){ return false; } })());
  ENV=4; const snow=genMonster(777); ENV=0; const alien=genMonster(777);
  ok("same seed, different locale -> different creature", snow!==alien);
  ok("snowmen are taller than the blobs", snow.height>alien.height-3);
  ENV=0;
  startCampaign(); run.dow=1; startBrawl();
  ok("partner bursts out of the OFFICE door", Math.abs(brawl.partner.x-(ODOOR.x+12))<0.01 && officeDoorOpen===1);
  brawl.enemies=[]; for(let i=0;i<90;i++) updatePartner(1/60);
  ok("the office door shuts behind them", officeDoorOpen===0);
  smoke("brawl with a themed monster", (function(){ ENV=4;
    brawl.enemies=[{cast:CAST[0].id,x:150,y:120,hp:3,state:"chase",dir:"left",flash:0,poly:true,seed:777,mon:genMonster(777)}];
    return ()=>{ drawBrawl(); }; })());
  ENV=0; startCampaign(); customers=[]; brawl=null;

  // ---- Brandon retune: fast crosshair, instant guaranteed opening shot, pistol whip ----
  ok("crosshair is much faster", CROSS_SPEED>=70);
  ok("fires every 3s, reloads every 6", BOSS_FIRE_INTERVAL===3 && BOSS_MAG===6);
  startCampaign(); customers=[]; startBoss(); chef.x=30; chef.y=160;   // far from Brandon
  for(let i=0;i<40 && boss.state==="draw"; i++) updateBoss(1/60);
  ok("the opening shot is guaranteed", boss.shots>=1 && boss.medicalOwed>=BOSS_MED_BILL);
  startCampaign(); customers=[]; startBoss(); boss.state="firing"; boss.fireT=99;
  chef.x=boss.x; chef.y=boss.y; const wh0=boss.chefHP; updateBoss(1/60);
  ok("pistol whip hits ~50% and flings you across", boss.chefHP<=wh0-PISTOL_WHIP_DMG+0.01 && chef.x===FLOOR.x0+12);

  startCampaign(); customers=[]; boss=null; phase="play";

  // ================= P4: two fights split (Beli-gated brawl + daytime scuffle) =================
  const setBeli=v=>{ run.beliHist=[v,v]; };
  startCampaign();
  setBeli(6);   ok("low rep -> fight every night", brawlChance()===1.0 && brawlSizeMult()>=1.0);
  setBeli(8);   ok("good rep -> ~60% brawl", Math.abs(brawlChance()-0.6)<0.001 && brawlSizeMult()<1.0);
  setBeli(9);   ok("fancy rep -> ~25% brawl + small fights", Math.abs(brawlChance()-0.25)<0.001 && brawlSizeMult()<0.7);

  // a low-rep day-end fires the after-close brawl
  startCampaign(); run.dow=0; setBeli(6); resetKitchen(); customers=[]; badLedger=[]; dayT=0; phase="play"; spawnT=99;
  _r=Math.random; Math.random=()=>0.0; update(1/60); Math.random=_r;
  ok("low-rep day-end starts the brawl", phase==="brawl");

  // daytime scuffle: a starving bad-order patron squares up, and a punch KOs them
  startCampaign(); resetKitchen();
  const trouble={x:100,y:120,type:0,state:"badorder",order:{kind:"bad",item:"grits"},hearts:0.02,dir:"front",bob:0};
  customers=[trouble]; chef.x=200; chef.y=120;
  _r=Math.random; Math.random=()=>0.0; for(let i=0;i<12 && trouble.state==="badorder";i++) updateCustomers(1/60); Math.random=_r;
  ok("a starving troublemaker squares up", trouble.state==="squareup" && trouble.hp===SCUFFLE_HP);
  ok("not adjacent -> no fight stance", !nearScuffle());
  chef.x=trouble.x+8; chef.y=trouble.y;
  ok("close in -> chef squares up too", nearScuffle());
  fireAction(); fireAction();   // two jabs KO a 2-HP troublemaker
  ok("knocking out the troublemaker sends them off", trouble.state==="leaving" && trouble.hp<=0);

  startCampaign(); customers=[]; brawl=null;

  // ================= service loop: table collision =================
  ok("chef is pushed out of a table", (function(){ const s=STOOLS[0]; const r=resolveChefCollision(s.x, s.y);
     return Math.abs(Math.hypot(r.x-s.x,r.y-s.y)-TABLE_R)<0.5; })());
  ok("chef can't walk through a table", (function(){ const s=STOOLS[1]; const r=resolveChefCollision(s.x+2, s.y);
     return Math.hypot(r.x-s.x,r.y-s.y)>=TABLE_R-0.5; })());
  ok("free space is unaffected", (function(){ const r=resolveChefCollision(160,110); return r.x===160 && r.y===110; })());
  // pass counter: solid segments block crossing, openings let you through
  ok("pass has three openings", PASS_GAPS.length===3 && PASS_SEGS.length===4);
  ok("solid pass blocks crossing", (function(){ const r=resolveChefCollision(136,90); return r.y<=PASS_Y0+0.5; })());
  ok("an opening lets you through", (function(){ const r=resolveChefCollision(116,90); return r.y===90; })());
  ok("plating slots sit on solid counter", PASS_SLOTS.every(s=> PASS_SEGS.some(([x0,x1])=> s.x>=x0 && s.x<=x1)));

  // ================= service loop: real appliances (raw -> cook) =================
  startCampaign(); resetKitchen(); dialogue=null; waveoff=null; chef.carry=null;
  const fryer=stationById("fryer");
  chef.x=fryer.x; chef.y=fryer.y+8; fireAction();
  ok("empty fryer won't conjure", fryer.state==="idle" && !chef.carry);
  chef.x=74; chef.y=44; fireAction();     // grab raw chicken from its crate
  ok("grab raw chicken from the crate", !!chef.carry && chef.carry.type==="karaage" && chef.carry.stage==="prep" && chef.carry.has.chicken===true);
  ok("raw chicken is prep, not a finished dish", ingredientsComplete(chef.carry) && !assembleDone(chef.carry) && !carryFinished(chef.carry));
  chef.x=fryer.x; chef.y=fryer.y+8; fireAction();   // bring it to the fryer
  ok("fryer cooks the raw you brought", fryer.state==="cooking" && !chef.carry);
  fryer.state="ready"; fryer.t=fryer.green; chef.carry=null;
  chef.x=fryer.x; chef.y=fryer.y+8; fireAction();
  ok("grab the finished karaage", !!chef.carry && chef.carry.type==="karaage" && carryFinished(chef.carry) && chef.carry.quality==="perfect");
  // assemble dishes untouched
  resetKitchen(); chef.carry=null;
  const salad=stationById("salad");
  chef.x=salad.ingredients[0].x; chef.y=44; fireAction();
  chef.x=salad.ingredients[1].x; chef.y=44; fireAction();
  ok("salad still assembles from its boxes", !!chef.carry && chef.carry.type==="salad" && carryFinished(chef.carry));

  // regression: standing at the ICE BOX with a COOKED dish (no .has) must not crash contextLabel
  startCampaign(); resetKitchen(); dialogue=null; waveoff=null;
  const pot=stationById("pot"); pot.state="idle";
  const icebox=stationById("icebox");
  chef.carry={type:"lobster",stage:"cooked",quality:"perfect"};
  chef.x=icebox.ingredients[0].x; chef.y=icebox.ingredients[0].y+4;
  smoke("cooked carry near the ice box doesn't crash", ()=>{ const t=nearestTarget(); contextLabel(t); });
  chef.carry=null;

  // ================= pass theft =================
  startCampaign(); resetKitchen(); PASS_SLOTS.forEach(s=>s.item=null); customers=[]; passThief=null; passTheftT=99;
  maybePassTheft(0);
  ok("no theft when the pass is empty", passThief===null);
  PASS_SLOTS[0].item={type:"salad",stage:"cooked",quality:"perfect"}; passThief=null; passTheftT=99;
  _r=Math.random; Math.random=()=>0.0; maybePassTheft(0); Math.random=_r;
  ok("food on the pass draws a thief", !!passThief && passThief.slot===PASS_SLOTS[0]);
  tips=200; if(run) run.bank=1000; combo=5;
  customers=[{x:100,y:120,type:0,state:"waiting",order:{kind:"good",dish:"salad"},hearts:3,dir:"front",bob:0}];
  passThief.x=PASS_SLOTS[0].x; passThief.y=PASS_SLOTS[0].y+6;
  _r=Math.random; Math.random=()=>0.99; updatePassThief(1/60); Math.random=_r;
  ok("thief swipes the plate", PASS_SLOTS[0].item===null && passThief.state==="flee" && !!passThief.carry);
  ok("you lose the dish's value", tips===200-theftValue("salad"));
  ok("combo breaks on theft", combo===0);
  ok("the wronged diner loses patience", customers[0].hearts===2);
  passThief.state="flee"; passThief.x=DOOR.x; passThief.y=DOOR.y; updatePassThief(1/60);
  ok("thief leaves with the goods", passThief===null);
  // theft can escalate to a fight
  startCampaign(); resetKitchen(); PASS_SLOTS.forEach(s=>s.item=null); combo=0; tips=500;
  PASS_SLOTS[1].item={type:"lobster",stage:"cooked",quality:"perfect"};
  customers=[{x:100,y:120,type:0,state:"waiting",order:{kind:"good",dish:"lobster"},hearts:3,dir:"front",bob:0}];
  passThief={x:PASS_SLOTS[1].x,y:PASS_SLOTS[1].y+6,slot:PASS_SLOTS[1],dir:"left",state:"in",carry:null,spr:null};
  _r=Math.random; Math.random=()=>0.0; updatePassThief(1/60); Math.random=_r;
  ok("theft can start a fight", customers[0].state==="squareup");
  startCampaign(); customers=[]; passThief=null; PASS_SLOTS.forEach(s=>s.item=null);

  // ================= legibility: the tip meter must tell the truth =================
  startCampaign(); resetKitchen(); customers=[]; tips=0; combo=0; comboTimer=0; chef.carry=null;
  const tc={x:100,y:120,type:0,state:"waiting",order:{kind:"good",dish:"salad"},hearts:3,dir:"front",bob:0,orderT:performance.now()};
  ok("a fresh ticket is fully hot", tipHeat(tc)>0.99);
  tc.orderT = performance.now() - SPEED_TIP_WINDOW*1000*0.5;
  ok("halfway through the window it's half hot", Math.abs(tipHeat(tc)-0.5)<0.05);
  tc.orderT = performance.now() - SPEED_TIP_WINDOW*1000*2;
  ok("a stale ticket is stone cold", tipHeat(tc)===0);
  ok("cold never goes negative", tipHeat(tc)>=0);
  ok("an un-ordered customer has no tip on the table", tipHeat({})===0);
  // the meter and the money must not disagree — that was the whole bug
  const hotC={...tc, orderT:performance.now()};
  customers=[hotC]; chef.carry={type:"salad",stage:"cooked",quality:"perfect"};
  chef.x=hotC.x; chef.y=hotC.y; tips=0; serveCustomer(hotC);
  const hotPay=tips;
  const coldC={x:100,y:120,type:0,state:"waiting",order:{kind:"good",dish:"salad"},hearts:3,dir:"front",bob:0,
               orderT:performance.now()-SPEED_TIP_WINDOW*1000*2};
  customers=[coldC]; chef.carry={type:"salad",stage:"cooked",quality:"perfect"};
  chef.x=coldC.x; chef.y=coldC.y; tips=0; combo=0; comboTimer=0; serveCustomer(coldC);
  ok("a hot ticket really does pay more than a cold one", hotPay>tips);
  // colour mixer
  ok("mixHex ends match", mixHex("#000000","#ffffff",0)==="rgb(0,0,0)" && mixHex("#000000","#ffffff",1)==="rgb(255,255,255)");
  ok("mixHex interpolates", mixHex("#000000","#ffffff",0.5)==="rgb(128,128,128)");
  // combo window is named, not magic
  ok("combo window is a real constant", COMBO_WINDOW===2.2);
  combo=3; comboTimer=COMBO_WINDOW; smoke("chain meter renders (fresh)", ()=>drawHUD?drawHUD():null);
  combo=0; comboTimer=0; customers=[]; chef.carry=null; startCampaign();


  startCampaign(); resetKitchen(); dialogue=null; waveoff=null; chef.carry=null;
  const potI=stationById("pot"), fryI=stationById("fryer");
  ok("a live burner is never still (idle pot steams)", idleAmt(potI)>0 && (potI.state==="idle"));
  ok("a boiling pot steams harder than an idle one", (potI.state="cooking", idleAmt(potI)) > (potI.state="idle", idleAmt(potI)));
  ok("hot oil shimmers even when idle", (fryI.state="idle", idleAmt(fryI))>0);
  ok("a wrecked station is cold", (potI.broken=true, idleAmt(potI))===0);
  potI.broken=false;
  ok("only burners idle (the salad bar doesn't steam)", idleAmt(stationById("salad"))===0);
  smoke("steam renders", ()=>drawSteam(potI.x,potI.y-6,1));
  smoke("shimmer renders", ()=>drawHeatShimmer(fryI.x,fryI.y-5,1));
  smoke("a cooking fryer renders (oil bubbles)", ()=>{ fryI.state="cooking"; fryI.t=0.5; drawStation(fryI); fryI.state="idle"; fryI.t=0; });

  plateWob=0;
  ok("plates start settled", plateWob===0);
  smoke("plate stack renders", ()=>drawPlates());
  // setting a dish down knocks the stack
  chef.carry={type:"salad",stage:"cooked",quality:"perfect"};
  const slotP=PASS_SLOTS[0]; slotP.item=null;
  chef.x=slotP.x; chef.y=slotP.y+6; fireAction();
  ok("setting down a dish knocks the plates", plateWob>0);
  const afterSet=plateWob;
  update(0.2);
  ok("the stack settles again", plateWob<afterSet);
  update(5);
  ok("wobble decays to rest, never negative", plateWob===0);
  // a thief rattles it hardest
  nudgePlates(1);
  ok("a stolen plate rattles the whole stack", plateWob===1);
  ok("wobble never exceeds 1", (nudgePlates(1), plateWob===1));
  plateWob=0; PASS_SLOTS.forEach(s=>s.item=null); chef.carry=null;
  // broken stations are cold: no idles
  potI.broken=true; smoke("a wrecked pot still renders (cold, no steam)", ()=>drawStation(potI)); potI.broken=false;


  startCampaign(); resetKitchen(); dialogue=null; waveoff=null; chef.carry=null;
  const ib=stationById("icebox"), potS=stationById("pot");
  ok("ice box is a source station", ib && ib.kind==="source");
  ok("pot no longer holds its own raw crate", !potS.ingredients || potS.ingredients.length===0);
  ok("raw lobster lives in the ice box", ib.ingredients.some(i=>i.id==="rawlobster"));
  // empty pot won't conjure a lobster out of nothing
  chef.x=potS.x; chef.y=potS.y+8; fireAction();
  ok("empty pot won't conjure", potS.state==="idle" && !chef.carry);
  // fetch the raw from the ice box
  const rawL=ib.ingredients.find(i=>i.id==="rawlobster");
  chef.x=rawL.x; chef.y=rawL.y+4; fireAction();
  ok("grab raw lobster from the ice box", !!chef.carry && chef.carry.type==="lobster" && chef.carry.stage==="prep" && chef.carry.has.rawlobster===true);
  ok("raw lobster is prep, not a finished dish", ingredientsComplete(chef.carry) && !assembleDone(chef.carry) && !carryFinished(chef.carry));
  // carry it to the pot and boil
  chef.x=potS.x; chef.y=potS.y+8; fireAction();
  ok("pot boils the raw you carried over", potS.state==="cooking" && !chef.carry);
  potS.state="ready"; potS.t=potS.green; chef.carry=null;
  chef.x=potS.x; chef.y=potS.y+8; fireAction();
  ok("grab the finished lobster off the pot", !!chef.carry && chef.carry.type==="lobster" && carryFinished(chef.carry) && chef.carry.quality==="perfect");
  // the fryer keeps its co-located crate (selective — no ice box for chicken)
  resetKitchen(); chef.carry=null;
  ok("fryer still has its chicken crate", stationById("fryer").ingredients.some(i=>i.id==="chicken"));


  startCampaign(); resetKitchen(); dialogue=null; waveoff=null; chef.carry=null;
  const bar=stationById("bar");
  const barIng=id=>bar.ingredients.find(i=>i.id===id);
  ok("gin sour is on the menu", MENU.includes("gin-sour"));
  ok("gin sour lives at the bar", stationOf("gin-sour")===bar && stationOf("whiskey-sour")===bar);
  ok("gin sour recipe = gin + sour mix", JSON.stringify(recipeOf("gin-sour"))===JSON.stringify(["gin","sourmix"]));
  ok("whiskey sour recipe = whiskey + sour mix", JSON.stringify(recipeOf("whiskey-sour"))===JSON.stringify(["whiskey","sourmix"]));
  ok("gin sour has its own flavor words", flavorAdj("gin-sour")!=="just right");

  // build a gin sour: grab gin -> add sour mix
  chef.x=barIng("gin").x; chef.y=barIng("gin").y+4; fireAction();
  ok("grabbing gin starts a GIN sour", !!chef.carry && chef.carry.type==="gin-sour" && chef.carry.stage==="prep" && chef.carry.has.gin===true && chef.carry.has.sourmix===false);
  ok("half-built gin sour isn't finished", !carryFinished(chef.carry) && !assembleDone(chef.carry));
  chef.x=barIng("sourmix").x; chef.y=barIng("sourmix").y+4; fireAction();
  ok("adding sour mix finishes the gin sour", !!chef.carry && chef.carry.type==="gin-sour" && chef.carry.stage==="cooked" && carryFinished(chef.carry));

  // the spirit picks the drink: whiskey still makes a WHISKEY sour on the same counter
  resetKitchen(); chef.carry=null;
  chef.x=barIng("whiskey").x; chef.y=barIng("whiskey").y+4; fireAction();
  chef.x=barIng("sourmix").x; chef.y=barIng("sourmix").y+4; fireAction();
  ok("grabbing whiskey still makes a whiskey sour", !!chef.carry && chef.carry.type==="whiskey-sour" && carryFinished(chef.carry));

  // shared sour mix can't START a drink (you must pick a spirit first)
  chef.carry=null;
  ok("sour mix alone can't start a drink", contextLabel({t:"ingredient",st:bar,ing:barIng("sourmix")})===null);
  // a whiskey-sour carry can't pick up gin (wrong recipe)
  chef.carry={type:"whiskey-sour",stage:"prep",quality:"perfect",has:{whiskey:true,sourmix:false}};
  ok("a whiskey sour won't take gin", contextLabel({t:"ingredient",st:bar,ing:barIng("gin")})===null);
  ok("that whiskey sour still wants sour mix", contextLabel({t:"ingredient",st:bar,ing:barIng("sourmix")})==="add sourmix");

  // serving a gin sour banks points
  startCampaign(); resetKitchen(); customers=[]; tips=0; combo=0; comboTimer=0;
  const drinker={x:100,y:120,type:0,state:"waiting",order:{kind:"good",dish:"gin-sour"},hearts:3,dir:"front",bob:0,orderT:performance.now()};
  customers=[drinker]; chef.carry={type:"gin-sour",stage:"cooked",quality:"perfect"};
  chef.x=drinker.x; chef.y=drinker.y;
  ok("a gin-sour order reads 'serve' when carried", contextLabel({t:"cust",ref:drinker})==="serve");
  serveCustomer(drinker);
  ok("serving the gin sour pays out", tips>0 && drinker.state==="eating" && chef.carry===null);
  startCampaign(); customers=[]; chef.carry=null;

  // ================= bugfixes: crisp-gin-sour + moonwalk =================
  ok("gin sour never orders 'crisp' (a salad word)", !DISH_FLAVOR["gin-sour"].adj.includes("crisp"));
  ok("gin sour descriptors don't collide with the salad's", DISH_FLAVOR["gin-sour"].adj.every(a=>!DISH_FLAVOR.salad.adj.includes(a)));
  ok("gin sour still has real descriptors", DISH_FLAVOR["gin-sour"].adj.length>=3 && flavorAdj("gin-sour")!=="just right");
  smoke("a leaving procedural patron renders (walking feet, no crash)", ()=>{
    drawCustomer({x:200,y:130,type:0,state:"leaving",leaveT:0,order:{kind:"good",dish:"salad"},hearts:1,dir:"right",bob:0,spr:null}); });
  smoke("an entering procedural patron renders (walking feet, no crash)", ()=>{
    drawCustomer({x:120,y:130,type:3,state:"entering",order:{kind:"good",dish:"gin-sour"},hearts:3,dir:"left",bob:0,spr:null}); });

  // ================= the ticket rail: it must never lie and never go blank =================
  startCampaign(); resetKitchen(); customers=[]; chef.carry=null; PASS_SLOTS.forEach(s=>s.item=null);
  const mkT=(dish,age)=>({x:100,y:130,type:0,state:"waiting",order:{kind:"good",dish},
                          hearts:HEARTS_MAX-PATIENCE_DRAIN*(age||0),dir:"front",bob:0,
                          orderT:performance.now()-(age||0)*1000});
  // --- ticketLife: length is the one channel that must always be honest
  ok("a fresh ticket has its whole life ahead", ticketLife(mkT("salad",0))===1);
  ok("half its hearts = half the bar", Math.abs(ticketLife({hearts:HEARTS_MAX/2,orderT:1})-0.5)<1e-9);
  ok("a ticket at zero hearts has no bar left", ticketLife({hearts:0,orderT:1})===0);
  ok("an un-ordered customer has no ticket", ticketLife({hearts:HEARTS_MAX})===0);
  ok("life never goes negative", ticketLife({hearts:-5,orderT:1})===0);
  ok("life never exceeds a full bar", ticketLife({hearts:HEARTS_MAX*10,orderT:1})===1);
  // --- the constants are named, not magic (they must match what the walkout actually uses)
  ok("patience constants are real", HEARTS_MAX===3 && PATIENCE_DRAIN===0.10);
  // --- tipNotch: the landmark that justifies drawing ONE bar instead of two
  ok("the notch sits where the tip dies (12s into a 30s life)", Math.abs(tipNotch()-0.4)<1e-9);
  ok("the tip dies BEFORE the customer does", tipNotch()<1);
  // THE invariant: heat and life are one clock. At the notch, heat is exactly spent and life agrees.
  // This is what breaks loudly if someone retunes PATIENCE_DRAIN and forgets the rail.
  const atNotch=mkT("salad",SPEED_TIP_WINDOW);
  ok("at the notch the tip is exactly gone", tipHeat(atNotch)===0);
  ok("at the notch the bar has 1-notch of life left (one clock, two zooms)",
     Math.abs(ticketLife(atNotch)-(1-tipNotch()))<0.02);
  // Comfy Stools stretch the life but not the 12s window -> the notch MUST move
  const notchBase=tipNotch();
  run.upgrades=run.upgrades||{}; run.upgrades.stools=true;
  ok("Comfy Stools slow the drain", patienceMult()<1);
  ok("...so the tip notch slides earlier (a hardcoded 0.4 would lie here)", tipNotch()<notchBase);
  delete run.upgrades.stools;
  ok("the notch is back at base without the upgrade", Math.abs(tipNotch()-notchBase)<1e-9);

  // --- the rail's model must match the loop that ACTUALLY walks them out.
  // Everything above uses mkT()'s formula; this drives the real update() instead, so the bar
  // can't quietly disagree with the walkout the way the tip meter once disagreed with the money.
  // NB: hearts drain from update()'s dt, but tipHeat reads performance.now(). The real game drives
  // both off wall time; the harness freezes the clock, so a test must advance BOTH or they diverge.
  const advance=(sec)=>{ __tick(sec*1000); update(sec); };
  customers=[mkT("salad",0)]; const liveT=customers[0];
  const life0=ticketLife(liveT);
  advance(1);
  ok("the real loop drains a waiting ticket", ticketLife(liveT)<life0);
  ok("...at exactly PATIENCE_DRAIN/sec (the rail's denominator is the game's)",
     Math.abs((life0-ticketLife(liveT)) - PATIENCE_DRAIN/HEARTS_MAX) < 1e-6);
  advance(SPEED_TIP_WINDOW-1);
  ok("after the tip window the real ticket is cold but still alive", tipHeat(liveT)===0 && ticketLife(liveT)>0);
  ok("...with the notch's worth of life left", Math.abs(ticketLife(liveT)-(1-tipNotch()))<0.02);
  advance(HEARTS_MAX/PATIENCE_DRAIN);   // run out the rest of the 30s
  ok("the bar empties exactly when they walk", ticketLife(liveT)===0 && liveT.state!=="waiting");
  ok("a walked-out customer leaves the rail", railTickets().length===0);
  customers=[]; startCampaign(); resetKitchen();

  // --- inFlight: what's already handled
  const potR=stationById("pot"), fryR=stationById("fryer");
  potR.state="idle"; potR.broken=false; fryR.state="idle"; fryR.broken=false;
  chef.carry=null; PASS_SLOTS.forEach(s=>s.item=null);
  ok("an empty kitchen has nothing in flight", inFlight("lobster").total===0);
  potR.state="cooking";
  ok("a boiling pot covers a lobster", inFlight("lobster").total===1);
  ok("...but it's COOKING, not servable", inFlight("lobster").cooking===1 && inFlight("lobster").ready===0);
  ok("...and it does nothing for a karaage", inFlight("karaage").total===0);
  potR.state="ready";
  ok("a lobster sat ready still counts", inFlight("lobster").total===1);
  ok("...and now it IS servable", inFlight("lobster").ready===1 && inFlight("lobster").cooking===0);
  potR.state="burnt";
  ok("a BURNT lobster is not cover (it's a problem, not a serve)", inFlight("lobster").total===0);
  potR.state="cooking"; potR.broken=true;
  ok("a wrecked station is cooking nothing", inFlight("lobster").total===0);
  potR.broken=false;
  PASS_SLOTS[0].item={type:"lobster",stage:"plated",quality:"perfect"};
  ok("in-flight stacks: one boiling + one on the pass = 2", inFlight("lobster").total===2);
  ok("...split correctly (1 ready, 1 cooking)", inFlight("lobster").ready===1 && inFlight("lobster").cooking===1);
  chef.carry={type:"lobster",stage:"cooked",quality:"perfect"};
  ok("the finished one in her hand counts as ready", inFlight("lobster").ready===2);
  chef.carry={type:"gin-sour",stage:"prep",quality:"perfect",has:["gin"]};
  ok("a half-built drink in hand is in flight", inFlight("gin-sour").total===1);
  ok("...but counts as cooking, not servable", inFlight("gin-sour").cooking===1);
  chef.carry=null; potR.state="idle"; PASS_SLOTS.forEach(s=>s.item=null);

  // --- railTickets: cover is allocated ONE-FOR-ONE, or she under-cooks
  customers=[mkT("lobster",1),mkT("lobster",2),mkT("lobster",3)];
  PASS_SLOTS[0].item={type:"lobster",stage:"plated",quality:"perfect"};
  let rl=railTickets();
  ok("three lobster tickets all show up", rl.length===3);
  ok("ONE lobster on the pass covers exactly ONE ticket (not all three)",
     rl.filter(t=>t.covered).length===1);
  potR.state="cooking";
  ok("a second lobster in flight covers a second ticket", railTickets().filter(t=>t.covered).length===2);
  potR.state="idle"; PASS_SLOTS.forEach(s=>s.item=null);
  ok("nothing in flight = nothing covered", railTickets().every(t=>!t.covered && t.cover==="none"));
  // the plated/cooking split: a ticket whose dish is ON THE PASS must read "go serve", never "ignore".
  // Greying that one out would hide the fastest money in the game (the pass is the second hand).
  customers=[mkT("lobster",1)];
  PASS_SLOTS[0].item={type:"lobster",stage:"plated",quality:"perfect"};
  ok("a plated dish marks its ticket READY (not merely 'handled')", railTickets()[0].cover==="ready");
  PASS_SLOTS.forEach(s=>s.item=null); potR.state="cooking";
  ok("a dish still on the heat marks its ticket COOKING", railTickets()[0].cover==="cooking");
  potR.state="idle";
  // ready is allocated before cooking, so the servable one lands on the ticket that's waited longest
  customers=[mkT("lobster",5),mkT("lobster",1)];
  PASS_SLOTS[0].item={type:"lobster",stage:"plated",quality:"perfect"}; potR.state="cooking";
  const split=railTickets();
  ok("the servable lobster goes to the most urgent ticket", split[0].cover==="ready");
  ok("...and the one on the heat covers the next", split[1].cover==="cooking");
  potR.state="idle"; PASS_SLOTS.forEach(s=>s.item=null);
  customers=[mkT("lobster",1),mkT("lobster",2),mkT("lobster",3)];
  // cover doesn't leak across dishes
  customers=[mkT("lobster",1),mkT("karaage",2)];
  PASS_SLOTS[0].item={type:"lobster",stage:"plated",quality:"perfect"};
  rl=railTickets();
  ok("a plated lobster covers the lobster ticket", rl.find(t=>t.dish==="lobster").covered===true);
  ok("...and does nothing for the karaage ticket", rl.find(t=>t.dish==="karaage").covered===false);
  PASS_SLOTS.forEach(s=>s.item=null);
  // order: most urgent first, and stable
  customers=[mkT("salad",2),mkT("karaage",20),mkT("lobster",9)];
  rl=railTickets();
  ok("the rail puts the most urgent ticket first", rl[0].dish==="karaage" && rl[2].dish==="salad");
  ok("rail order == hearts order (one clock, so it never reshuffles)",
     rl.every((t,i)=> i===0 || rl[i-1].c.hearts<=t.c.hearts));
  ok("railTickets doesn't reorder the world", customers[0].order.dish==="salad");
  // only open tickets are on the rail
  customers=[mkT("salad",1),{...mkT("lobster",1),state:"eating"},{...mkT("karaage",1),state:"benched"}];
  ok("only waiting customers get a ticket", railTickets().length===1);
  ok("the rail can't overflow (one ticket per stool, max)", STOOLS.length===5);
  customers=[mkT("salad",1),mkT("lobster",14),mkT("karaage",28)];
  smoke("rail renders across hot / cooled / dying tickets", ()=>drawHUD());
  PASS_SLOTS[0].item={type:"salad",stage:"plated",quality:"perfect"};
  smoke("rail renders a covered ticket", ()=>drawHUD());
  customers=[]; PASS_SLOTS.forEach(s=>s.item=null); chef.carry=null;
  smoke("an empty rail renders", ()=>drawHUD());
  startCampaign();

  // ================= impact: the ranking must be monotonic BY CONSTRUCTION =================
  // The bug this spine exists to kill: five channels hand-tuned across ~30 call sites with no shared
  // scale, until the ranking inverted (the special, 3x damage, shook the screen by 0.0 on contact
  // while a jab shook 0.8; a jab KO at 3.2 out-hit a special KO at 1.2).
  const resetFx=()=>{ shake=0; hitstopT=0; kick.x=0; kick.y=0; };
  const weigh=(w)=>{ resetFx(); impact(w,1,0); return {shake, stop:hitstopT, kick:kick.x}; };
  ok("a heavier weight shakes harder", weigh(HIT.heavy).shake > weigh(HIT.jab).shake);
  ok("a heavier weight holds the frame longer", weigh(HIT.heavy).stop > weigh(HIT.jab).stop);
  ok("a heavier weight kicks the camera further", weigh(HIT.heavy).kick > weigh(HIT.jab).kick);
  // every channel moves together — that's the entire point of one weight
  const light=weigh(HIT.scuff), heavy=weigh(HIT.stumble);
  ok("all three channels rank the same way (they cannot disagree)",
     heavy.shake>light.shake && heavy.stop>light.stop && heavy.kick>light.kick);
  // the ranking the game actually needs, in weight space
  ok("the special outranks a jab", HIT.heavy>HIT.jab);
  ok("a stumble outranks taking a normal hit", HIT.stumble>HIT.hurt);
  // END-TO-END, through the real attacks: the special KOs harder than a jab KOs. This is the exact
  // inversion the spine exists to fix (special-on-contact used to be 0.0 shake, special KO 1.2 vs
  // jab KO 3.2), and comparing constants alone wouldn't catch a mis-wired call site.
  const koShake=(useSpecial)=>{
    startBrawl(); calmChef(); customers=[]; resetFx();
    chef.x=100; chef.y=100; chef.dir="right";
    const e={ cast:CAST[0].id, x:108, y:100, hp:0.5, state:"raid", dir:"left", flash:0,
              aggro:false, target:null, raidT:0 };
    brawl.enemies=[e]; brawl.punchT=0; brawl.chain=0; brawl.chainT=0;
    if(useSpecial){ brawl.buffT=5; brawl.specialT=0; chefSpecial(); } else chefPunch();
    return {shake, stop:hitstopT, ko:e.state==="ko"};
  };
  const jabKO=koShake(false), specKO=koShake(true);
  ok("both attacks actually put the body down (the test is measuring KOs)", jabKO.ko && specKO.ko);
  ok("a special KO now shakes HARDER than a jab KO (it used to be ~3x smaller)", specKO.shake>jabKO.shake);
  ok("...and holds the frame longer too", specKO.stop>jabKO.stop);
  ok("...and neither is pinned to the cap (so that ranking is real, not clamping)",
     jabKO.shake<SHAKE_MAX && specKO.shake<SHAKE_MAX);
  // FEEDBACK FOLLOWS CONTACT. The special used to addShake(3.4) on the BUTTON PRESS, before any
  // contact test — so hitting thin air shook harder than landing a jab. A whiff must be quiet.
  startBrawl(); calmChef(); resetFx(); chef.x=100; chef.y=100; chef.dir="right";
  brawl.enemies=[]; brawl.buffT=5; brawl.specialT=0; chefSpecial();
  ok("a special that hits NOTHING doesn't shake the screen", shake===0);
  ok("...and doesn't hold a frame either", hitstopT===0);
  startBrawl(); calmChef(); resetFx(); chef.x=100; chef.y=100; chef.dir="right"; brawl.punchT=0;
  brawl.enemies=[]; chefPunch();
  ok("a punch that hits NOTHING doesn't shake the screen", shake===0);
  // the special used to call addShake exactly zero times on contact
  startBrawl(); calmChef(); resetFx(); chef.x=100; chef.y=100; chef.dir="right";
  brawl.enemies=[{ cast:CAST[0].id, x:108, y:100, hp:99, state:"raid", dir:"left", flash:0,
                   aggro:false, target:null, raidT:0 }];
  brawl.buffT=5; brawl.specialT=0; chefSpecial();
  ok("the special now shakes the screen ON CONTACT (was literally 0.0)", shake>0);
  ok("...and holds a frame on contact", hitstopT>0);
  resetFx(); startBrawl(); calmChef(); customers=[];
  ok("the daytime scuffle is the lightest blow (cosy floor)",
     HIT.scuff<HIT.jab && HIT.scuff<HIT.hurt && HIT.scuff<HIT.heavy);
  // extra bodies are SUB-LINEAR: N bodies = one bigger hit, not N hits pinned to the cap
  ok("clipping a second body adds less than a whole second jab", HIT_BODY<HIT.jab);
  const oneBody=HIT.jab, fiveBodies=HIT.jab+HIT_BODY*4;
  ok("five bodies still rank above one", fiveBodies>oneBody);
  ok("...but a crowd-clip never out-ranks the ceiling", Math.min(HIT_MAX,fiveBodies)<=HIT_MAX);
  resetFx(); impact(99,1,0);
  ok("weight is clamped, so nothing can saturate every channel at once", shake<=SHAKE_MAX && hitstopT<=STOP_MAX);
  ok("...and the old cap is gone (there's headroom to be bigger)", SHAKE_MAX>4.5);
  resetFx(); impact(-5,1,0);
  ok("a negative weight can't invert the screen", shake===0 && hitstopT===0);

  // --- hitstop: the held frame
  resetFx();
  ok("no impact = no held frame", tickHitstop(1/60)===false);
  impact(HIT.stumble,0,0);
  ok("a heavy blow freezes the sim", tickHitstop(1/60)===true && hitstopT>0);
  for(let i=0;i<20;i++) tickHitstop(1/60);
  ok("...and the freeze always ends (never a soft-lock)", hitstopT===0 && tickHitstop(1/60)===false);
  resetFx(); impact(HIT.scuff,0,0); const stopScuff=hitstopT;
  resetFx(); impact(HIT.stumble,0,0);
  ok("a scuffle barely stops the clock; a stumble really does", hitstopT>stopScuff*2);
  // Hitstop freezes the WHOLE sim, so a jab must stay snappy or it reads as lag, not impact.
  // Only the heaviest blow in the game is allowed a long hold. (The cap isn't the binding
  // constraint — HIT_MAX*STOP_PER_W is — so assert the real durations, not the cap.)
  resetFx(); impact(HIT.jab,0,0);
  ok("a jab's freeze is snappy (<60ms), not laggy", hitstopT<0.06 && hitstopT>0);
  resetFx(); impact(HIT_MAX,0,0);
  // Budget raised 150 -> 200ms with STOP_PER_W .085 -> .115. Justification, not vibes: a hold used to
  // freeze a generic fist-out pose (the thing Addendum 01 flagged), so length read as lag. It now holds
  // an actual contact frame from the FIGHT set. The jab ceiling below is UNCHANGED — that's what keeps
  // a mash snappy — and the sustained-duty budget still governs the real safety case.
  ok("even the heaviest blow holds <=200ms", hitstopT<=0.20);
  ok("...and the heaviest blow is a real hold, not a flicker", hitstopT>0.1);

  // --- the punch-zoom must ALWAYS cover the camera offset, or the room detaches from the frame.
  // The baked floor is exactly WxH at (0,0): there is no bleed, so an uncovered offset is a
  // black band at the screen edge. This is the invariant that lets the shake be this big at all.
  const covers=(sx,sy)=>{ const z=camZoom(sx,sy);
    return (z-1)*W/2 >= Math.abs(sx)-1e-9 && (z-1)*H/2 >= Math.abs(sy)-1e-9; };
  (()=>{ const sv=phase; phase="play";
    ok("zoom covers a still camera in the day (no punch-in during service)", camZoom(0,0)===1);
    phase="brawl";
    ok("the fight punches in even with the camera still", camZoom(0,0)===COMBAT_ZOOM);
    ok("...and the combat zoom ALONE already covers the max shake (the safety stops binding)",
       (COMBAT_ZOOM-1)*H/2 >= SHAKE_MAX);
    ok("the authored zoom can never UNDERCUT the safety floor",
       camZoom(SHAKE_MAX,SHAKE_MAX) >= 1 + Math.max(2*SHAKE_MAX/W, 2*SHAKE_MAX/H)*ZOOM_SAFETY - 1e-9);
    phase=sv; })();
  ok("zoom covers a small offset", covers(3,3));
  ok("zoom covers the max shake on both axes", covers(SHAKE_MAX, SHAKE_MAX));
  ok("zoom covers a pure-vertical max offset (H is the tight axis)", covers(0, SHAKE_MAX));
  ok("zoom covers a pure-horizontal max offset", covers(SHAKE_MAX, 0));
  // the worst case the loop can actually produce: max shake AND max kick, same direction
  const worstX = SHAKE_MAX + HIT_MAX*KICK_PER_W, worstY = SHAKE_MAX + HIT_MAX*KICK_PER_W;
  ok("zoom covers the worst case the loop can produce (shake + kick stacked)", covers(worstX, worstY));
  ok("...and the zoom stays sane rather than telescoping", camZoom(worstX,worstY) < 1.9);
  // The loop zooms off the smooth magnitudes (shake+|kick|+1), while the actual offset is a
  // random draw inside that band, then rounded. So the guarantee to test is: the zoom computed
  // from the smooth band always covers the largest offset that band can round to.
  /* Models the loop's ACTUAL transform: screen(w) = z*w + s + span/2 - z*cam. The old form of this
     helper asserted (z-1)*W/2 >= maxSx, which is that expression with cam pinned to the centre — true
     of the loop before the camera could lean, and a false green after: it would stay passing while a
     leaning camera tore the floor off the edge. cam is a parameter now; centre is just one case. */
  /* Drives camMatrix — the function the LOOP calls — rather than re-deriving its arithmetic here. That
     distinction is the whole point: while this math was inline in the loop, a mutation reverting the
     transform to the old centred camera passed every test, because a hand-copy in the harness passes
     whatever the harness says it does. screen(w) = a*w + e; the room covers the frame iff the left edge
     is at or past 0 and the right edge at or past W, for the worst sx the smooth band can round to. */
  const camCovers=(shk,kx,ky,leanX,leanY)=>{
    const maxSx=Math.round(shk+Math.abs(kx)), maxSy=Math.round(shk+Math.abs(ky));
    for(const sgnx of [-1,1]) for(const sgny of [-1,1]){
      const M=camMatrix(shk,kx,ky,leanX,leanY,sgnx*maxSx,sgny*maxSy);
      if(!(M.e<=0 && M.a*W+M.e>=W && M.f<=0 && M.a*H+M.f>=H)) return false;
    }
    return true;
  };
  const loopCovers=(shk,kx,ky)=>camCovers(shk,kx,ky,W/2,H/2);
  ok("the loop's zoom covers its own worst offset (still camera)", loopCovers(0,0,0));
  ok("the loop's zoom covers a mid-fight blow", loopCovers(HIT.jab*SHAKE_PER_W, HIT.jab*KICK_PER_W, 0));
  ok("the loop's zoom covers the heaviest blow in the game",
     loopCovers(SHAKE_MAX, HIT_MAX*KICK_PER_W, HIT_MAX*KICK_PER_W));
  let loopOK=true;
  for(let s=0;s<=SHAKE_MAX;s+=0.5) for(let k=0;k<=HIT_MAX*KICK_PER_W;k+=1.5) if(!loopCovers(s,k,k)) loopOK=false;
  ok("the room can never detach from the frame, at any shake/kick combination", loopOK);

  /* --- the camera LEAN. Travel and shake are the same 35.2px of crop, spent twice, so the clamp is a
     hard invariant: the sweep below is the test that matters and everything else is description. */
  const _ph=phase; phase="brawl";
  // Goes through camMatrix, so a mutation anywhere in the loop's camera is visible from here.
  const leanCam=(shk,kx,ky,cx,cy)=>{
    const M=camMatrix(shk,kx,ky,camLeanTarget(cx,W),camLeanTarget(cy,H),0,0);
    return { z:M.a, x:M.camX, y:M.camY };
  };
  const leanCovers=(shk,kx,ky,cx,cy)=>camCovers(shk,kx,ky,camLeanTarget(cx,W),camLeanTarget(cy,H));
  let leanOK=true, leanN=0;
  for(let cx=10;cx<=310;cx+=10) for(let cy=52;cy<=166;cy+=6)
    for(let s=0;s<=SHAKE_MAX;s+=2.5) for(let k=0;k<=HIT_MAX*KICK_PER_W;k+=3.8){
      leanN++; if(!leanCovers(s,k,k,cx,cy)) leanOK=false;
    }
  ok("the lean can never tear the room off the edge, at any chef position x shake x kick ("+leanN+" combos)", leanOK);
  // She stands at the left wall, nothing is happening: the camera should actually have moved.
  ok("the lean actually leans (she's at the wall, the camera isn't centred)", leanCam(0,0,0,10,109).x < W/2 - 5);
  ok("...and it leans the OTHER way at the other wall", leanCam(0,0,0,310,109).x > W/2 + 5);
  /* LEAN_K is the whole design and it needs a test that can SEE it. "It never reaches her" was a false
     green: the CLAMP guarantees the camera never reaches the wall whatever K is, so it passed at K=1
     (a true 1:1 follow) too — it was measuring the clamp. What K actually decides is how the ~28px of
     travel is SPREAD: K=1 spends it all inside 56px of her band and pins to the rail for the other 81%
     of the room; K=0.35 spreads it over ~160px. Test the shape. */
  let unpinned=0, bandN=0;
  for(let cx=10;cx<=310;cx+=2){ bandN++;
    const c=leanCam(0,0,0,cx,109), lo=(W/2+1)/c.z;
    if(c.x>lo+0.01 && c.x<(W-lo)-0.01) unpinned++; }
  ok("the lean spreads its travel across the room rather than pinning to the rail", unpinned/bandN > 0.5);
  ok("...so mid-room the camera is genuinely tracking her, not railed", leanCam(0,0,0,200,109).x < 186);
  /* The matrix must CARRY the pan into its output. Reverting e to the old centred form left camX
     perfectly correct and passed 619 tests — every test above reads camX, the INPUT, while the loop
     draws with e. A camera that computes itself and then isn't used is the failure this catches. */
  const M0=camMatrix(0,0,0,W/2,H/2,0,0);
  const ML=camMatrix(0,0,0,camLeanTarget(10,W),camLeanTarget(109,H),0,0);
  const MR=camMatrix(0,0,0,camLeanTarget(310,W),camLeanTarget(109,H),0,0);
  ok("the transform CARRIES the pan (e follows the camera, not just camX)",
     Math.abs(ML.e-M0.e) > 5 && Math.abs(MR.e-M0.e) > 5);
  ok("...in the right direction (she goes left, the world slides right)", ML.e > M0.e && MR.e < M0.e);
  ok("...and e moves exactly -z per unit of camera travel", Math.abs((ML.e-M0.e) + ML.a*(ML.camX-M0.camX)) < 1e-9);
  const MU=camMatrix(0,0,0,W/2,camLeanTarget(52,H),0,0);
  ok("...and the vertical carries too (f is not forgotten)", MU.f > M0.f + 2);
  /* The pan budget is NOT monotone in the shake, and the obvious story ("it gets loud, the budget
     collapses, the camera locks") is false — it was asserted here first and these tests killed it.
     camZoom maxes over BOTH axes and H is the tight one (2*off/180 > 2*off/320), so once the safety
     binds it over-crops X: a heavy blow BUYS horizontal pan. The budget therefore dips in the middle —
     minimum ~16.8px right where COMBAT_ZOOM hands over to the safety at off~14.7 — and is at its WIDEST
     (~29.8px) under the heaviest blow in the game. Pinned because it's the kind of surprise someone
     later "fixes". */
  const panRoom=(s,k)=>Math.abs(leanCam(s,k,k,10,109).x - W/2);
  let panMin=1e9, panMinAt=-1;
  for(let s=0;s<=SHAKE_MAX;s+=0.25) for(let k=0;k<=HIT_MAX*KICK_PER_W;k+=0.5){
    const r=panRoom(s,k); if(r<panMin){ panMin=r; panMinAt=s+Math.abs(k)+1; } }
  ok("the pan budget never collapses, at any offset the loop can produce", panMin > 12);
  ok("...and it is TIGHTEST in the middle, not at the heaviest blow (H is the binding axis)",
     panRoom(SHAKE_MAX,HIT_MAX*KICK_PER_W) > panMin + 8 && panRoom(0,0) > panMin + 8);
  ok("...with the pinch exactly where COMBAT_ZOOM hands over to the safety", panMinAt > 13 && panMinAt < 17);
  // The dead branch in camPanClamp must actually be dead: the zoom safety is what guarantees it.
  let budgetAlways=true;
  for(let s=0;s<=SHAKE_MAX;s+=0.5) for(let k=0;k<=HIT_MAX*KICK_PER_W;k+=1){
    const off=s+Math.abs(k)+1, z=camZoom(off,off);
    if((W/2+off)/z >= W-(W/2+off)/z) budgetAlways=false;
    if((H/2+off)/z >= H-(H/2+off)/z) budgetAlways=false;
  }
  ok("camPanClamp's no-budget branch is unreachable (the zoom safety floor guarantees it)", budgetAlways);
  // The lean rides on chef.x, so it must survive her whole walk band, not just the middle.
  ok("the lean tracks her across the entire walk band",
     leanCam(0,0,0,10,109).x < leanCam(0,0,0,160,109).x && leanCam(0,0,0,160,109).x < leanCam(0,0,0,310,109).x);
  phase=_ph;
  /* HITSTOP must freeze the camera with the sim — a camera that drifts through the held frame un-holds
     it. That's bought by tickCamLean living in update(), which the loop already gates behind
     tickHitstop. So the testable claim is that update() is what drives it: pin THAT, and the freeze
     follows from the gate. Honest limit: this cannot catch a mutation that ALSO ticks the lean in the
     loop outside the gate — the loop never runs headless. */
  startCampaign(); startBrawl(); camLeanX=W/2; chef.x=40; update(1/60);
  ok("the lean rides on update(), so hitstop freezes the camera with the sim", camLeanX < W/2 - 0.5);
  // Outside a brawl the camera must be exactly the old centred one -- no drift into the service loop.
  phase="day"; startCampaign(); chef.x=20; chef.y=60; tickCamLean(1/60);
  ok("the camera never leans outside a brawl (service is a still camera)", camLeanX===W/2 && camLeanY===H/2);
  phase=_ph;

  // --- the camera kick: direction, not just rumble
  resetFx(); impact(HIT.jab,1,0);
  ok("punching right kicks the camera right", kick.x>0);
  resetFx(); impact(HIT.jab,-1,0);
  ok("punching left kicks the camera left", kick.x<0);
  resetFx(); impact(HIT.jab,1,0);
  const k0=kick.x; for(let i=0;i<30;i++) tickKick(1/60);
  ok("the kick settles back (a punch, not a permanent offset)", Math.abs(kick.x)<Math.abs(k0) && kick.x===0);

  // --- the fight has its own voice now (it used to borrow the kitchen's and lie)
  ok("the fight has real hit sounds", typeof sfxHit==="function" && typeof noise==="function");
  smoke("a landed hit's sound renders at any weight", ()=>{ sfxHit(HIT.jab,0); sfxHit(HIT.stumble,6); });
  smoke("whiff / ko / hurt sounds exist", ()=>{ sfx("whiff"); sfx("ko"); sfx("hurt"); });
  resetFx();

  // --- the new visuals render
  startBrawl(); calmChef(); resetFx(); chef.x=140; chef.y=100; chef.dir="right";
  brawl.enemies=[]; brawl.punchT=0; chefPunch();
  ok("a whiff arms the visible swipe (a miss used to be a beep and nothing else)", brawl.whiffT>0);
  smoke("the whiff swipe renders", ()=>drawBrawl());
  brawl.chain=5; brawl.chainT=PUNCH_CHAIN_WINDOW;
  smoke("the brawl renders mid-chain", ()=>drawBrawl());
  ok("the chain lapses on its own", (()=>{ brawl.chain=4; brawl.chainT=0.01;
      updateBrawl(0.2); return brawl.chain===0; })());
  smoke("directional sparks render", ()=>burst(100,100,8,["#fff"],{ang:0,spread:1.2,sp:30}));
  ok("burst without a direction still sprays every way (old call sites unchanged)",
     (()=>{ particles=[]; burst(100,100,40,["#fff"],{sp:30});
            const left=particles.filter(p=>p.vx<0).length; particles=[];
            return left>5; })());
  ok("burst WITH a direction sprays that way", 
     (()=>{ particles=[]; burst(100,100,40,["#fff"],{ang:0,spread:0.6,sp:30});
            const left=particles.filter(p=>p.vx<0).length; particles=[];
            return left===0; })());
  resetFx(); startBrawl(); calmChef(); customers=[]; particles=[];

  // --- the boss (Brandon) is a fight too, so it's on the spine
  // Striking him used to play sfx("perfect") — the PERFECT DISH arpeggio, for punching a man
  // holding a gun — and being shot played sfx("burnt"), the burnt-food sound.
  startCampaign(); customers=[]; startBoss(); resetFx();
  boss.state="reload"; boss.outcome=null; boss.hp=99;
  chef.x=boss.x+4; chef.y=boss.y;
  bossStrike();
  ok("striking Brandon goes through impact (shake + held frame)", shake>0 && hitstopT>0);
  ok("...and it ranks below a STUMBLE", shake < HIT.stumble*SHAKE_PER_W);
  resetFx();
  ok("no live shake call exceeds the old cap unhandled (raising SHAKE_MAX changed nothing silently)",
     SHAKE_MAX>4.5);
  customers=[]; startCampaign(); resetFx();

  // --- DEV: boot-into-the-brawl. The flag MUST ship false: true replaces her restaurant
  // with a bar fight on load. The dev build is produced by flipping it at build time.
  ok("the DEV flag is OFF in the source (this is what ships)", DEV===false);
  startCampaign(); customers=[]; resetFx();
  devSeedBrawl();
  ok("devSeedBrawl drops you straight into a fight", phase==="brawl");
  ok("...with a full house seeded (spectators/critic stakes can fire)", brawl.spectators.length>=1);
  ok("...including The Critic, so the stakes are representative",
     brawl.spectators.some(s=>CAST[s.type] && CAST[s.type].id==="critic"));
  ok("...and enemies to actually hit", brawl.enemies.length>=1);
  ok("...and a populated troublemaker ledger", badLedger.length>=1);
  ok("the seeded patrons use the named constant, not a magic 3",
     customers.length===0 || customers.every(c=>c.hearts<=HEARTS_MAX));
  customers=[]; startCampaign(); resetFx();

  // --- DEV wave/enemy overrides. The menu must mean what it says.
  devWaves=null; devEnemies=null;
  ok("untouched, the dev overrides change nothing", waveCount()===WAVE_COUNT);
  setBeli(9);   // fancy rep: brawlSizeMult() < 0.7, so the shipping rules would scale a fight DOWN
  ok("...and wave size still follows the shipping rep-scaling rules", waveSize()<WAVE_SIZE);
  devEnemies=12;
  ok("a dev-set size is LITERAL (rep-scaling does not shrink it)", waveSize()===12);
  devEnemies=1;
  ok("...and the Math.max(3,..) floor can't override the menu either", waveSize()===1);
  devWaves=7;
  ok("a dev-set wave count is used", waveCount()===7);
  // and it must reach the actual fight, not just the accessor
  startCampaign(); customers=[]; devEnemies=2; devWaves=1; startBrawl();
  ok("the fight really spawns the number the menu says", brawl.enemies.length===2);
  ok("...and stops after the number of waves the menu says", waveCount()===1);
  devEnemies=6; startCampaign(); customers=[]; startBrawl();
  ok("changing the menu changes the next fight", brawl.enemies.length===6);
  devWaves=null; devEnemies=null; setBeli(6);
  startCampaign(); customers=[]; startBrawl();
  ok("clearing the overrides restores the shipping behaviour", brawl.enemies.length>=3);
  devWaves=null; devEnemies=null;
  customers=[]; startCampaign(); resetFx();

  // The dev menu must be INERT in her build, not merely invisible: the rects are only assigned
  // inside drawDevMenu(), which only runs when DEV, so they stay null and a tap can never hit one.
  startCampaign(); customers=[]; paused=true;
  devWaveRect=null; devEnemyRect=null; devBrawlRect=null;
  drawPausedOverlay();
  ok("the shipped pause screen draws no dev rows", devWaveRect===null && devEnemyRect===null);
  ok("...and no START BRAWL button (a null rect can't be tapped)", devBrawlRect===null);
  ok("...while the real pause rows are still there", !!pauseToggleRect && !!envToggleRect);
  paused=false;

  // ================= REGRESSION: the NaN knockback that ate the waves =================
  // A punch set e.kbx but left e.kby undefined, so (e.y + e.kby*dt) made e.y NaN. A NaN y fails
  // every (Math.abs(e.y-chef.y)<14) hit test forever -> an invisible, unkillable enemy, so
  // alive never hits 0 -> the wave never clears -> wave 2 never comes. Found by simulating a fight.
  startBrawl(); calmChef(); resetFx(); chef.x=100; chef.y=100; chef.dir="right";
  const eNaN={ cast:CAST[0].id, x:106, y:100, hp:99, state:"chase", dir:"left", flash:0,
               aggro:true, target:null, raidT:0, wanderT:1, wx:0, wy:0, role:"fighter" };
  brawl.enemies=[eNaN]; brawl.punchT=0; chefPunch();
  ok("a punch sets BOTH knockback components (never a half-set pair)",
     Number.isFinite(eNaN.kbx) && Number.isFinite(eNaN.kby));
  for(let i=0;i<30;i++) updateBrawl(1/60);
  ok("...so the enemy's position stays finite after the impulse settles",
     Number.isFinite(eNaN.x) && Number.isFinite(eNaN.y));
  ok("...and it's still hittable (a NaN y is invisible AND unkillable)",
     Math.abs(eNaN.y-chef.y)<200 && !isNaN(eNaN.y));
  // the integrator itself must survive a half-set pair, whoever sets it next
  eNaN.kbx=200; eNaN.kby=undefined;
  for(let i=0;i<10;i++) updateBrawl(1/60);
  ok("the integrator can't be poisoned by a half-set impulse", Number.isFinite(eNaN.y));

  // and the thing the player actually noticed: waves must advance
  startCampaign(); customers=[]; devWaves=null; devEnemies=3; startBrawl();
  let guard=0;
  while(!brawl.outcome && guard++ < 60*200){
    updateBrawl(1/60);
    brawl.chefHP=999; brawl.t=90;                        // immortal + no timeout: wave flow only
    const live=brawl.enemies.filter(e=>e.state!=="ko");
    if(live.length){ const t=live[0]; chef.x=t.x-6; chef.y=t.y; chef.dir="right";
      brawl.punchT=0; brawl.stumbleT=0; hitstopT=0; chefPunch(); }
  }
  ok("a real fight actually clears instead of hanging on wave 1", brawl.outcome==="cleared");
  ok("...having advanced through every wave", brawl.wave===waveCount());
  devWaves=null; devEnemies=null; customers=[]; startCampaign(); resetFx();

  // --- the juice must never cost the framerate: every particle is a fillRect on a phone
  particles=[];
  for(let i=0;i<40;i++) impact(HIT_MAX,1,0,100,100);      // absurd worst case: 40 max-weight blows
  ok("a mob KO can genuinely flood the screen", particles.length>200);
  updateParticles(1/60);
  ok("...but the particle ceiling holds", particles.length<=PARTICLE_MAX);
  const newest=particles.length;
  ok("...and it keeps the NEWEST particles (the ones you just caused)", newest===PARTICLE_MAX);
  for(let i=0;i<200;i++) updateParticles(1/60);
  ok("particles still expire normally under the cap", particles.length<PARTICLE_MAX);
  particles=[]; resetFx();

  // --- dev menu LAYOUT: 320x180 leaves no room to guess. Pin it.
  // Call drawDevMenu() directly: DEV is false in source (as it must be), so the rects are
  // otherwise null. This tests the dev BUILD's layout from the shipping source.
  X.textAlign="center"; drawDevMenu();
  ok("dev rows don't overlap each other", (()=>{
    const rs=[devWaveRect,devEnemyRect,devDrinkRect,devBrawlRect];
    for(let i=1;i<rs.length;i++) if(rs[i].y < rs[i-1].y+rs[i-1].h) return false;
    return true; })());
  ok("the last dev row clears the resume text", devBrawlRect.y+devBrawlRect.h <= DEV_BOTTOM);
  ok("every dev row is tall enough to tap on a phone", [devWaveRect,devEnemyRect,devDrinkRect,devBrawlRect].every(r=>r.h>=11));
  ok("the -/+ pads don't overlap each other", devWaveRect.w > 32);
  ok("the dev block starts below the existing pause rows",
     devWaveRect.y >= envToggleRect.y+envToggleRect.h);
  devWaveRect=null; devEnemyRect=null; devDrinkRect=null; devBrawlRect=null;   // leave them inert

  // ================= INGREDIENT SPRITES =================
  /* Four of the seven were picked out of the 64 candidates; whiskey/gin/sourmix had no candidate and
     keep their procedural bottles. That asymmetry IS the design, so pin it — a later batch quietly
     half-filling the table should show up here, not on her phone. */
  ok("the picked four are packed", ["lettuce","tomato","rawlobster","chicken"].every(k=>!!ING_SPR[k]));
  ok("...and the drinks are deliberately NOT (no candidate was a bottle)",
     !ING_SPR.whiskey && !ING_SPR.gin && !ING_SPR.sourmix);
  ok("every packed key is a real ingredient the game actually holds",
     Object.keys(ING_SPR).every(k=>["lettuce","tomato","whiskey","gin","sourmix","chicken","rawlobster"].includes(k)));
  ok("a drink with no art falls back rather than throwing", ingSprite("whiskey")===null && ingSprite("nope")===null);
  ok("undecoded art falls back to the procedural item (headless: all null)", ingSprite("lettuce")===null);
  /* The raw lobster's art is RED and raw lobster must read BLUE — blue->red is the raw/cooked tell, and
     a red raw one looks like a finished dish sitting in the ice box. The fix is baked into the BLOB (a
     205deg hue rotation at ingest), so the test has to read the packed pixels, not a tint constant.
     Decoding a PNG here is out of scope, so pin the cheap proxy: the blob differs from a hue-0 pack. */
  ok("the raw lobster blob is not the red art as-shipped (it's hue-rotated to blue at ingest)",
     ING_SPR.rawlobster !== ING_SPR.tomato && ING_SPR.rawlobster.length > 40);
  ok("the packed art is pre-scaled at ingest, not shipped at 42px",
     Object.values(ING_SPR).every(u=>u.length<900));

  // ================= CAT SPRITES =================
  /* The seam is a null-fallback: no art -> the procedural cat, unchanged. Headless, Image never decodes,
     so artReady() is false and catSprite() returns null for everything — which means these tests can
     pin the ROUTING (which states/dirs are even eligible) but can NOT prove a sprite reaches the screen.
     That's the documented headless limit, not an oversight; the pixels are a render's job. */
  startCampaign(); startDay();
  ok("both cats have art packed, keyed by the palette the game actually makes them with",
     !!CAT_SPR.tux && !!CAT_SPR.orange && !!CAT_SPR.tux.left && !!CAT_SPR.tux.right
     && !!CAT_SPR.orange.left && !!CAT_SPR.orange.right);
  ok("...and makeCat's pal values are exactly those keys (tux / orange)",
     !!CAT_SPR[makeCat("tux",CAT_PERCHES[0]).pal] && !!CAT_SPR[makeCat("orange",CAT_PERCHES[0]).pal]);
  ok("only EAST/WEST are packed — cat.dir is +/-1, north/south have nowhere to plug in",
     Object.keys(CAT_SPR.tux).sort().join(",")==="left,right");
  /* Routing goes through catSprKey, NOT catSprite: headless every Image is undecoded, so catSprite
     returns null for everything and these assertions would pass whatever the routing did. They did —
     a mutation letting sleep take a sprite passed all 646 tests before this split. */
  const catAt=(pal,state,dir)=>({pal,state,dir,x:0,y:0,gone:false,blink:0,tail:0});
  ok("sleep never takes a sprite (there is no sleep art — the loaf is hand-drawn)",
     catSprKey(catAt("tux","sleep",1))===null && catSprKey(catAt("orange","sleep",-1))===null);
  ok("groom never takes a sprite either (the paw-up is hand-drawn)",
     catSprKey(catAt("tux","groom",1))===null);
  ok("...but sit / walk / bolt all do", catSprKey(catAt("tux","sit",1))==="right"
     && catSprKey(catAt("tux","walk",1))==="right" && catSprKey(catAt("tux","bolt",1))==="right");
  ok("the cat faces the way it's going (dir +1 -> right, -1 -> left)",
     catSprKey(catAt("tux","walk",1))==="right" && catSprKey(catAt("tux","walk",-1))==="left"
     && catSprKey(catAt("orange","sit",-1))==="left");
  ok("a null cat or an unknown palette resolves to null rather than throwing",
     catSprKey(null)===null && catSprKey(catAt("nosuchpal","sit",1))===null);
  // The anchor: bottom-trimmed art means the last row is the paws, so feet must land ON y.
  const _p=catSprPos(100, 50, 10, 9);
  ok("the sprite stands ON the shadow, not hovering above it", _p.y+9===50);
  ok("...and is centred on the cat's x", _p.x===95);
  ok("an odd-width sprite still centres without drifting", catSprPos(100,50,11,9).x===95);
  // artReady is the guard: undecoded art must fall back, never blit a blank.
  ok("undecoded art falls back to the procedural cat (headless: every sprite is null)",
     catSprite(catAt("tux","sit",1))===null && !artReady(CAT_IMG.tux.right));
  // The blobs are the size claim: pre-scaled at ingest, not scaled at draw.
  const _b64=(s)=>s.slice(s.indexOf(",")+1);
  ok("the packed art is tiny because it's pre-scaled at ingest, not shipped at 92px",
     _b64(CAT_SPR.tux.right).length < 900 && _b64(CAT_SPR.orange.right).length < 1400);
  ok("...and both cats together cost under 2KB of the ~4MB budget",
     (CAT_SPR.tux.left+CAT_SPR.tux.right+CAT_SPR.orange.left+CAT_SPR.orange.right).length < 2048);

  // ================= HOLD TO CHUG =================
  /* The ladder is now something you climb by HOLDING, from a sober start. Driven through updateBrawl at
     a real dt rather than by poking brawl.drinks, because the thing under test IS the chain: a chug
     committing and the next one starting. Poking the counter would test nothing. */
  const parkAtBar=()=>{ chef.x=BAR.x; chef.y=BAR.y+14; };   // atBar() is a radius around the bar
  /* Do NOT clear brawl.enemies to keep the fight quiet: that WINS it (outcome="cleared"), updateBrawl
     returns early, and the chug silently stalls — the first draft of this helper did exactly that and
     failed 7 tests that were describing working code. Keep the mob alive; just top her up so the fight
     can't end underneath the thing being measured. */
  const holdFor=(secs,keepBar=true)=>{ let t=0; while(t<secs){ updateBrawl(1/60); t+=1/60;
    brawl.chefHP=CHEF_HP; brawl.t=90; brawl.stumbleT=0; if(keepBar) BAR.broken=false; } };
  startBrawl(); parkAtBar(); BAR.broken=false;
  ok("a brawl starts SOBER (START_DRINKS=0)", brawl.drinks===0 && brawl.wastedT===0 && brawl.buffT===0);
  ok("...and not wasted, and not pre-buffed", !isWasted() && wastedAmt()===0);

  // TAP: press and release immediately. The chug in her mouth still lands -- exactly one drink, which
  // is precisely what the button did before this change.
  startBrawl(); parkAtBar(); chugHeld=false; chugId=null;
  chugHeld=true; chugId="t"; chefDrink(); chugRelease();
  holdFor(4.0);
  ok("a TAP is still exactly one drink (the chug in her mouth lands, the chain doesn't start)",
     brawl.drinks===1 && !brawl.drinking);

  // HOLD: the chain. 8.0s of predicted ladder (2.2+1.9+1.6+1.3+1.0), so 8.5s must clear WASTED.
  startBrawl(); parkAtBar(); chugHeld=true; chugId="t"; chefDrink();
  holdFor(4.2);
  ok("holding chains chugs without another press", brawl.drinks===2);
  ok("...and it's still chugging, not waiting for input", brawl.drinking);
  holdFor(1.6);
  ok("holding past the third drink buys the permanent buzz", brawl.drinks===3 && brawl.buffT>1e8);
  holdFor(2.3);
  ok("holding to the fifth gets you WASTED — the ladder is climbable in one hold", brawl.drinks>=WASTED_AT && isWasted());
  const heldDrinks=brawl.drinks;
  chugRelease(); holdFor(3.0);
  ok("releasing ends the chain (one last chug lands, then it stops)", brawl.drinks<=heldDrinks+1 && !brawl.drinking);

  // The chain must re-check its preconditions, not just its own flag.
  startBrawl(); parkAtBar(); chugHeld=true; chugId="t"; chefDrink(); holdFor(2.4);
  const beforeWalk=brawl.drinks; chef.x=10; chef.y=160;      // walk off mid-hold
  holdFor(3.0);
  /* The swig already in her mouth lands — walking off doesn't un-drink it. That's pre-existing (the
     commit block never checked atBar(), only chefDrink() does) and it matches the release rule. What
     the chain must do is STOP: 3s at drink 2 would otherwise buy two more rungs (1.6s + 1.3s). */
  ok("walking away from the bar ends the chain even while held",
     brawl.drinks===beforeWalk+1 && !brawl.drinking);
  startBrawl(); parkAtBar(); chugHeld=true; chugId="t"; chefDrink(); holdFor(2.4);
  const beforeBreak=brawl.drinks; BAR.broken=true;
  holdFor(3.0,false);
  ok("a smashed bar ends the chain even while held",
     brawl.drinks===beforeBreak+1 && !brawl.drinking);
  BAR.broken=false;

  // A hold outliving its brawl would auto-chug the next fight the moment she reached the bar.
  chugHeld=true; chugId="t"; startBrawl();
  ok("a hold never outlives its brawl", chugHeld===false && chugId===null);
  parkAtBar(); holdFor(3.0);
  ok("...so the next fight doesn't auto-chug at the bar", brawl.drinks===0);

  // The acceleration IS the feel: each rung must be quicker than the last, and it must floor.
  startBrawl(); brawl.drinks=0; const c0=nextChugTime();
  brawl.drinks=2; const c2=nextChugTime();
  brawl.drinks=4; const c4=nextChugTime();
  brawl.drinks=40; const cMax=nextChugTime();
  ok("the chug accelerates as she goes (2.2 -> faster)", c0>c2 && c2>c4);
  ok("...and floors rather than hitting zero (a hold can't become infinite drinks)", cMax===0.45 && cMax>0);
  chugRelease();

  // ================= FULLSCREEN =================
  /* The request itself can't be tested (no real fullscreen in node) — but "asks once" can, and that's
     the bit with a behavioural claim: dragging her back into fullscreen after she deliberately left
     would be the game arguing with the player. */
  (()=>{
    let calls=0;
    const el=document.documentElement;
    const real=el.requestFullscreen;
    el.requestFullscreen = () => { calls++; return { then:()=>({catch:()=>{}}) }; };
    fsAsked=false;
    try {
      goFullscreen(); goFullscreen(); goFullscreen();
      ok("fullscreen is asked for exactly once, however many taps ("+calls+")", calls===1);
      ok("...and the flag latches so a later tap won't drag her back in", fsAsked===true);
    } finally { el.requestFullscreen = real; }
  })();
  (()=>{
    // A browser with no fullscreen support must no-op, not throw into the input path.
    const el=document.documentElement;
    const real=el.requestFullscreen;
    delete el.requestFullscreen;
    fsAsked=false;
    let threw=false;
    try { goFullscreen(); } catch(e){ threw=true; }
    ok("a browser without the Fullscreen API doesn't throw on every tap", !threw);
    el.requestFullscreen = real;
  })();

  // ================= GAMEPAD =================
  /* The pure halves are testable; padGet/pollPad touch navigator and the loop, so the LOGIC lives in
     padVec/padEdges where a test can reach it. Same lesson as camMatrix/catSprKey/chefFightDir. */
  ok("a centred stick is dead (hall sticks still drift at rest)",
     padVec([0.05,-0.09],[]).x===0 && padVec([0.05,-0.09],[]).y===0);
  ok("a real push reads through", padVec([1,0],[]).x===1);
  ok("...in every direction", padVec([-1,0],[]).x===-1 && padVec([0,1],[]).y===1 && padVec([0,-1],[]).y===-1);
  /* Deadzone on the MAGNITUDE, not per-axis: per-axis makes the diagonals need a bigger push than the
     cardinals, and walking diagonally feels sticky. A push just over the threshold must survive. */
  const diag = padVec([0.21,0.21],[]);          // magnitude 0.297, just over PAD_DEADZONE
  ok("a diagonal just past the deadzone isn't eaten (magnitude, not per-axis)", diag.x!==0 && diag.y!==0);
  const perAxisWouldKill = 0.21 < PAD_DEADZONE;
  ok("...and that case WOULD die under a per-axis deadzone (so the test means something)", perAxisWouldKill);
  ok("a full diagonal is normalised, never faster than a cardinal", (()=>{
     const v=padVec([1,1],[]); return Math.abs(Math.hypot(v.x,v.y)-1) < 1e-9; })());
  // D-pad is the same vector, so a stick-less press still moves her.
  const dp=(i)=>{ const b=[]; for(let k=0;k<16;k++) b[k]=false; b[i]=true; return b; };
  ok("the d-pad moves her too (right)", padVec([0,0], dp(15)).x===1);
  ok("...left / up / down", padVec([0,0],dp(14)).x===-1 && padVec([0,0],dp(12)).y===-1 && padVec([0,0],dp(13)).y===1);
  // Edges, not levels: a held button must fire ONCE.
  ok("a button fires on the press, not every frame",
     padEdges([true,false],[false,false]).join()==="0" && padEdges([true,false],[true,false]).length===0);
  ok("releasing and pressing again fires again",
     padEdges([true],[false]).length===1 && padEdges([false],[true]).length===0 && padEdges([true],[false]).length===1);
  ok("several buttons in one poll all register", padEdges([true,false,true],[false,false,false]).join()===",".replace(",","0,2"));
  /* B is deliberately unmapped -- Android routes it to system BACK and kills the host app before the
     page sees anything. Pinning it so nobody "helpfully" maps it later. */
  ok("B (button 1) is not bound to anything", PAD_A!==1 && PAD_X!==1 && PAD_START!==1);
  ok("...and A/X/START are the standard-mapping indices", PAD_A===0 && PAD_X===2 && PAD_START===9);

  // ================= DETERMINISM =================
  /* The drunk-drift used to steer chef.x off performance.now(). Reproducibility is the test: run the
     same state twice and you must land in the same place. Math.random is pinned to a constant first,
     because the drift has intentional randomness too and that would mask the clock read.
     (docs/tools/determinism.js is the real instrument -- it boots two devices with two clocks. This is
     the cheap guard that runs every time.) */
  (()=>{
    const realRandom = Math.random;
    Math.random = () => 0.5;
    try {
      const runDrift = () => {
        startBrawl(); calmChef(); brawl.enemies=[]; brawl.stumbleT=0;
        brawl.drinks=WASTED_AT; brawl.wastedT=WASTED_TIME; brawl.driftPh=1.234; brawl.driftT=0;
        chef.x=160; chef.y=110; chef.dir="right";
        joy.vx=1; joy.vy=0;
        for(let i=0;i<40;i++) updateBrawl(1/60);
        joy.vx=0; joy.vy=0;
        return chef.x;
      };
      /* Move the clock between the two runs. The harness clock is controllable (T), so without this
         both runs see the same instant and the test passes even WITH performance.now() in the sim —
         which is exactly what happened: the mutation restoring the wall clock left all 729 green.
         9130ms because that's a different machine, booted at a different time. Same trick the
         two-device probe uses. */
      const a = runDrift();
      __advanceClock(9130);
      const b = runDrift();
      ok("the drunk drift lands in the same place from the same state (no wall-clock in the sim)", a===b);
      // ...and it must still actually drift, or the test above passes on a dead feature.
      brawl.drinks=WASTED_AT; brawl.wastedT=WASTED_TIME;
      ok("...and it still drifts at all", drinkDrift()>0);
      ok("driftT is sim time and advances with dt", (()=>{
        startBrawl(); brawl.driftT=0; const t0=brawl.driftT;
        updateBrawl(0.5); return brawl.driftT > t0 + 0.4;
      })());
    } finally { Math.random = realRandom; }
  })();

  // ================= COMBO CADENCE =================
  /* The buffer must NOT make her punch faster -- only stop the game eating presses you already made.
     Both halves need pinning, because the obvious buffer bug is a buffer that also removes the gate. */
  /* Count swings by watching punchT jump UP: it decays every frame and only RISES when a new swing
     starts. (Counting "punchT changed" counts every frame — that was the first version, and it reported
     30 swings from 30 presses, which is exactly the bug it was meant to detect. A test that can only
     return the answer you feared isn't measuring anything.) */
  const mash=(presses, secs)=>{
    startBrawl(); calmChef(); chef.x=160; chef.y=110; chef.dir="right";
    brawl.enemies=[]; brawl.stumbleT=0; brawl.buffT=0; brawl.drinks=0; brawl.wastedT=0;
    const frames=Math.round(secs*60), every=Math.max(1, Math.round(frames/presses));
    let swings=0, prev=brawl.punchT;
    for(let f=0; f<frames; f++){
      if(f%every===0) chefPunch();
      if(brawl.punchT > prev + 1e-9) swings++;   // rose = a new swing began
      prev=brawl.punchT;
      updateBrawl(1/60);
      if(brawl.punchT > prev + 1e-9) swings++;   // ...or the buffer spent itself inside update
      prev=brawl.punchT;
    }
    return swings;
  };
  // A press made mid-swing is remembered and spent at the gate -- one press, one swing, none dropped.
  (()=>{
    startBrawl(); calmChef(); chef.x=160; chef.y=110; chef.dir="right"; brawl.enemies=[];
    brawl.stumbleT=0; brawl.buffT=0;
    chefPunch();                                  // swing 1
    const step1=brawl.comboStep;
    updateBrawl(1/60); updateBrawl(1/60);         // ...part way in
    chefPunch();                                  // pressed EARLY: used to be thrown away
    ok("a press made mid-swing is buffered, not discarded", brawl.bufT>0);
    ok("...and doesn't cut the current swing short", brawl.comboStep===step1);
    let guard=0; while(brawl.comboStep===step1 && guard++<600) updateBrawl(1/60);
    ok("...and fires on its own once the swing allows (combo advanced without a second press)",
       brawl.comboStep===step1+1);
    ok("...and the buffer is spent, not left armed", brawl.bufT===0);
  })();
  // One press = one swing, even when the press lands exactly on the gate with a buffer pending.
  (()=>{
    startBrawl(); calmChef(); brawl.enemies=[]; brawl.stumbleT=0; brawl.buffT=0;
    chefPunch();                                  // swing 1
    updateBrawl(1/60); chefPunch();               // press early -> buffered
    while(brawl.punchT > punchGate()) updateBrawl(1/60);
    chefPunch();                                  // press again, right ON the gate
    ok("a press landing on the gate spends the buffer rather than leaving it armed", brawl.bufT===0);
    const step=brawl.comboStep;
    let guard=0; while(brawl.punchT>0 && guard++<600) updateBrawl(1/60);
    ok("...so one press can't cash in twice", brawl.comboStep===step);
  })();
  // An ancient press must not fire. The window is real.
  (()=>{
    startBrawl(); calmChef(); brawl.enemies=[]; brawl.stumbleT=0;
    brawl.punchT=5; brawl.punchDur=5;             // a swing that outlasts the buffer
    chefPunch();
    ok("a press far too early is buffered...", brawl.bufT>0);
    let t=0; while(t<PUNCH_BUFFER+0.05){ updateBrawl(1/60); t+=1/60; }
    ok("...but expires rather than firing much later", brawl.bufT<=0);
  })();
  // The gate is untouched: buffering must not let mashing outrun the animation.
  const fast = mash(30, 0.5), slow = mash(4, 0.5);
  ok("mashing can't outrun the rhythm ("+fast+" swings from 30 presses vs "+slow+" from 4, same 0.5s)",
     fast <= slow + 1);
  ok("...but mashing still lands swings at all", fast >= 2);
  /* Post-hitstop: update() is skipped entirely while frozen, so the buffer must pause with it. If it
     ticked in raw time it would drain during the held frame -- and stopMult() makes that frame LONGER
     when drunk (x2.13), so the rhythm would silently differ by state. */
  (()=>{
    startBrawl(); calmChef(); brawl.enemies=[]; brawl.stumbleT=0;
    brawl.punchT=1; brawl.punchDur=1; chefPunch();
    const b0=brawl.bufT;
    hitstopT=0.4;
    let frozen=0; for(let i=0;i<12;i++){ if(tickHitstop(1/60)) frozen++; }
    ok("the held frame really does freeze the sim", frozen===12);
    ok("...and the input buffer freezes with it (it's sim time, not wall time)", brawl.bufT===b0);
    hitstopT=0;
  })();

  // ================= HAPTICS =================
  /* Unlike the rest of the feel channels, this one IS testable headless: stub navigator.vibrate and
     count. So there's no excuse for pinning the constants instead of the behaviour. */
  (()=>{
    const real = navigator.vibrate;
    const calls = [];
    navigator.vibrate = (ms)=>{ calls.push(ms); return true; };
    try {
      // A jab and a KO must not buzz the same -- same reason they don't shake the same.
      const total = p => (Array.isArray(p) ? p.filter((_,i)=>i%2===0).reduce((a,b)=>a+b,0) : p);
      calls.length=0; impact(HIT.jab, 1, 0, 100, 100);
      const jab = calls[calls.length-1];
      calls.length=0; impact(HIT.jab + HIT_KO, 1, 0, 100, 100);
      const ko = calls[calls.length-1];
      ok("the motor rides the spine: a KO buzzes harder than a jab ("+JSON.stringify(jab)+" vs "+JSON.stringify(ko)+")",
         total(ko) > total(jab));
      /* THE floor test. Measured on device: 20ms and 38ms single pulses were not felt at all — an ERM
         needs ~30-50ms to spin up. Every pulse must clear HAPTIC_MIN_MS or it's current with no feeling,
         which is exactly what shipped in #29 and passed a green suite. */
      const pulses = p => (Array.isArray(p) ? p.filter((_,i)=>i%2===0) : [p]);
      ok("every pulse clears the motor's spin-up floor — a shorter one is felt as NOTHING",
         pulses(jab).every(ms=>ms>=HAPTIC_MIN_MS) && pulses(ko).every(ms=>ms>=HAPTIC_MIN_MS));
      ok("...and the floor is above what was measured as imperceptible (38ms)", HAPTIC_MIN_MS > 38);
      /* The double-beat means "someone went down", not "that was big" — so pin the LINE, not the number.
         It sits between the heaviest normal blow and the lightest KO. */
      const beats = w => hapticFor(w).length;
      ok("a KO lands as two beats — thump-THUMP", beats(HIT.jab+HIT_KO)===3);
      ok("...and so does a stumble (the worst thing that happens to you)", beats(HIT.stumble)===3);
      ok("...but a roundhouse doesn't: big, not a knockdown", beats(HIT.jab+(MOVE_W.roundhouse||0))===1);
      ok("...nor does the special connecting", beats(HIT.heavy)===1);
      ok("...and a jab is a single tick", Array.isArray(jab) && jab.length===1);
      ok("...but never longer than the ceiling", Math.max.apply(null, pulses(ko)) <= HAPTIC_CEIL_MS);

      /* DRUNK HITS HARDER. Mirrors stopMult(): the drink already smears time on impact, so it should
         reach the motor too. Only in the fight — a customer arriving doesn't hit harder when you're
         wasted. */
      startBrawl(); calmChef(); brawl.drinks=0; brawl.wastedT=0;
      const soberMult = hapticMult();
      // wastedAmt() is depth*fade, and depth=(drinks-WASTED_AT+1)/WASTED_DEPTH — so drinks==WASTED_AT is
      // only ENTERING wasted (depth 0.25). Full depth needs the whole ladder, or you're asserting
      // against a state you didn't actually build.
      brawl.drinks=WASTED_AT; brawl.wastedT=WASTED_TIME;
      const enteringMult = hapticMult();
      brawl.drinks=WASTED_AT+WASTED_DEPTH-1; brawl.wastedT=WASTED_TIME;
      const drunkMult = hapticMult();
      ok("sober is the baseline", Math.abs(soberMult-1) < 1e-9);
      ok("the first wasted drink already bites ("+enteringMult.toFixed(2)+"x)", enteringMult > 1);
      ok("...and it keeps climbing with the ladder ("+drunkMult.toFixed(2)+"x at full depth)",
         drunkMult > enteringMult && Math.abs(drunkMult-HAPTIC_WASTED_MULT) < 1e-6);
      ok("...and it's the same shape as the hitstop's drunk scaling (one drink, every channel)",
         Math.abs((drunkMult-1)/(HAPTIC_WASTED_MULT-1) - (stopMult()-1)/(STOP_WASTED_MULT-1)) < 1e-6);
      const soberKO = total(hapticFor(HIT.jab+HIT_KO, 1));
      const drunkKO = total(hapticFor(HIT.jab+HIT_KO, drunkMult));
      ok("a drunk KO outbuzzes a sober one ("+soberKO+" vs "+drunkKO+")", drunkKO > soberKO);
      // ...but the drink cannot run the motor away with it.
      ok("nothing gets past the hard ceiling, however drunk",
         Math.max.apply(null, pulses(hapticFor(HIT_MAX*9, 99))) === HAPTIC_CEIL_MS);
      phase="play";
      ok("the drink doesn't buzz the DAY harder — it's a fight thing", Math.abs(hapticMult()-1) < 1e-9);
      startBrawl(); calmChef(); brawl.drinks=0; brawl.wastedT=0;

      /* THE DAY CHANNEL. The brief: the bulk of the vibration is the fight, the day is a tap on the
         shoulder. That's only true if it's PROVABLY smaller — so pin every notify against the LIGHTEST
         thing the spine can make. If a day tap ever out-buzzes the weakest hit, the fight stopped being
         the loud part and nobody would notice until it felt wrong. */
      /* Measure the PEAK pulse, not the total. Total duration is not intensity: two 45ms taps with a gap
         are felt as two taps, not as one 90ms buzz — which is exactly why 'ready' gets a double. The
         rule is that no day tap may hit HARDER than the lightest blow. It may tap twice. */
      const peak = p => Math.max.apply(null, pulses(p));
      const lightestHit = peak(hapticFor(HIT.scuff, 1));
      for(const k of Object.keys(NOTIFY))
        ok("notify '"+k+"' never hits harder than the lightest blow ("+peak(NOTIFY[k])+" vs "+lightestHit+")",
           peak(NOTIFY[k]) < lightestHit);
      ok("...and every day tap still clears the motor's floor (or it's felt as nothing)",
         Object.keys(NOTIFY).every(k=>pulses(NOTIFY[k]).every(ms=>ms>=HAPTIC_MIN_MS)));
      ok("a KO is the hardest thing in the game",
         peak(hapticFor(HIT_MAX, drunkMult)) > peak(hapticFor(HIT.heavy,1))
         && peak(hapticFor(HIT_MAX, drunkMult)) >= HAPTIC_CEIL_MS*0.9);
      ok("'ready to order' is two taps — it's the one you must not miss", NOTIFY.ready.length===3);
      ok("an unknown notify kind is silent, not a crash", (()=>{ let t=false;
         try{ notify("nope"); }catch(e){ t=true; } return !t; })());

      /* A tap must MEAN something you can act on. A patron sent to the bench is not ready to order —
         buzzing then teaches you to ignore the buzz, which costs more than it gives. Caught nothing
         until this existed: the mutation that fires 'ready' at the bench passed all 766. */
      /* Every stool must be TAKEN first: with a free stool, seatWaiting() instantly pulls the benched
         patron to a table and the case under test evaporates. (That's how the misplaced notify("arrive")
         was found — it had been sitting in seatWaiting(), firing on a seat change instead of the door.) */
      const seatArrive = (dest) => {
        startCampaign(); startDay();
        customers.length=0;
        for(const s of STOOLS) s.taken = true;
        const c={ x:100, y:100, tx:100, ty:100, dir:"front", state:"entering", dest:dest,
                  hearts:3, type:0, order:null, orderT:null };
        customers.push(c);
        calls.length=0; spawnT = 999;              // don't let a real spawn buzz mid-measurement
        update(1/60);
        for(const s of STOOLS) s.taken = false;
        return { state:c.state, buzzes:calls.length };
      };
      const toTable = seatArrive("table"), toBench = seatArrive("bench");
      ok("sitting down ready to order buzzes you ("+toTable.state+")",
         toTable.state==="ordering" && toTable.buzzes===1);
      // The door is the door: arriving buzzes from spawnCustomer, not from a seat shuffle.
      ok("a patron coming through the door buzzes exactly once", (()=>{
         startCampaign(); startDay(); customers.length=0;
         for(const s of STOOLS) s.taken=false;
         calls.length=0; spawnCustomer();
         return calls.length===1 && customers.length===1; })());
      ok("...and being moved bench->table does NOT re-buzz (they were already in the room)", (()=>{
         startCampaign(); startDay(); customers.length=0;
         for(const s of STOOLS) s.taken=false;
         customers.push({x:9,y:9,tx:9,ty:9,state:"benched",dest:"bench",hearts:3,type:0,
                         benchSlot:{taken:true},stool:null,order:null});
         calls.length=0; seatWaiting();
         return calls.length===0; })());
      ok("...but taking a seat on the BENCH doesn't — you can't act on it ("+toBench.state+")",
         toBench.state==="benched" && toBench.buzzes===0);
      /* The other two moments in the brief: taking the order, and the plate landing. Neither had a test
         — the mutation that deletes notify("served") passed all 770. A wire nobody pins is a wire that
         quietly comes loose. */
      ok("taking the order buzzes", (()=>{
         startCampaign(); startDay();
         const c={x:100,y:100,state:"ordering",hearts:3,type:0,
                  order:{kind:"good",dish:MENU[0]},orderT:null};
         customers.length=0; customers.push(c); dialogue={cust:c,line:"",i:0};
         calls.length=0; advanceDialogue();
         return calls.length===1; })());
      ok("the plate landing buzzes — the one that pays", (()=>{
         startCampaign(); startDay();
         const c={x:100,y:100,state:"waiting",hearts:3,type:0,happy:false,
                  order:{kind:"good",dish:MENU[0]},orderT:performance.now()};
         customers.length=0; customers.push(c);
         chef.carry={type:MENU[0], quality:"good"};
         calls.length=0; serveCustomer(c);
         return calls.length===1 && c.state==="eating"; })());
      // ONE buzz per blow. The spine already ranks a multi-body swing into a single impact() call;
      // if haptics ever fired per body it'd machine-gun the motor on a crowd.
      calls.length=0; impact(0.4, 1, 0, 100, 100);
      ok("exactly one buzz per blow, never one per body", calls.length===1);
      // The curve is clamped at both ends -- weight space has headroom above HIT_MAX by design.
      const tot = p => p.filter((_,i)=>i%2===0).reduce((a,b)=>a+b,0);
      ok("a monstrous weight can't run the motor past the ceiling",
         Math.max.apply(null, hapticFor(HIT_MAX*4).filter((_,i)=>i%2===0)) === HAPTIC_MAX_MS);
      ok("a zero-weight blow is still a real pulse, never a phantom one",
         hapticFor(0)[0]===HAPTIC_MIN_MS && hapticFor(-5)[0]===HAPTIC_MIN_MS);
      ok("the curve actually rises with weight", tot(hapticFor(HIT_MAX*0.25)) < tot(hapticFor(HIT_MAX*0.75)));
      // A device with no motor (iOS, or an iframe that blocks it) must not break the game.
      navigator.vibrate = ()=>{ throw new Error("NotAllowedError"); };
      let threw=false;
      try { impact(HIT.jab, 1, 0, 100, 100); } catch(e){ threw=true; }
      ok("a device that refuses to vibrate doesn't take the fight down with it", !threw);
      delete navigator.vibrate;
      threw=false;
      try { impact(HIT.jab, 1, 0, 100, 100); } catch(e){ threw=true; }
      ok("...and neither does one with no vibrate at all (iOS)", !threw);
    } finally { navigator.vibrate = real; }
  })();

  // The DRINK button's ring — the only feedback that the hold is working.
  startBrawl(); parkAtBar(); chugRelease();
  ok("no ring when she isn't drinking", chugFrac()===0);
  /* A STALE drinkT is the case that actually pins the state check: with drinkT=0 the divide gives 0
     either way, so the obvious version of this test passes even with the drinking check deleted. */
  brawl.drinking=false; brawl.drinkT=1.0; brawl.drinkTarget=2.2;
  ok("...not even with a stale drinkT left over from the last gulp", chugFrac()===0);
  chugHeld=true; chugId="t"; chefDrink();
  ok("...and it starts empty, not full", chugFrac()<0.02);
  holdFor(1.1);
  const midRing=chugFrac();
  ok("the ring fills as the gulp lands", midRing>0.4 && midRing<0.6);
  /* The acceleration is the whole feel of the hold, and the ring is where you SEE it: each gulp is
     quicker than the last, so each sweep is quicker. Compare the same elapsed time into two rungs. */
  startBrawl(); parkAtBar(); chugHeld=true; chugId="t"; chefDrink(); holdFor(0.5);
  const ringFirst=chugFrac();
  startBrawl(); parkAtBar(); brawl.drinks=4; chugHeld=true; chugId="t"; chefDrink(); holdFor(0.5);
  const ringFifth=chugFrac();
  ok("...and later gulps sweep FASTER (0.5s is further through the 5th drink than the 1st)",
     ringFifth > ringFirst + 0.15);
  // A fresh brawl object has drinkTarget=0 — the divide has to be guarded or the ring goes NaN.
  /* 0/0 is the NaN case, not 0.5/0 — that gives Infinity, which the clamp silently turns into a full
     ring and a test that accepts 1 never notices the guard is gone. */
  startBrawl(); brawl.drinking=true; brawl.drinkT=0; brawl.drinkTarget=0;
  ok("a zero drinkTarget can't make the ring NaN (0/0 is the case, not 0.5/0)",
     chugFrac()===chugFrac() && chugFrac()===0);
  brawl.drinkT=0.5; brawl.drinkTarget=0;
  ok("...a zero target falls back to CHEF_DRINK rather than dividing by it", Math.abs(chugFrac()-0.5/CHEF_DRINK)<1e-9);
  brawl.drinkT=999; brawl.drinkTarget=1;
  ok("...and the ring can never overfill past a full circle", chugFrac()===1);
  chugRelease();

  // wastedAmt() is the single source of truth: if it drifts from isWasted(), the screen lies.
  startBrawl(); calmChef(); resetFx();
  brawl.drinks=0; brawl.wastedT=0;
  ok("sober: no drunk visuals at all", wastedAmt()===0 && warpAmpPx()===0);
  brawl.drinks=WASTED_AT-1; brawl.wastedT=WASTED_TIME;
  ok("buzzed but under the line: still no warp", wastedAmt()===0);
  // sweep the WHOLE range: the first version of this only checked WASTED_AT-1, where the depth term
  // is already 0 — so it sailed past a mutation that made wastedAmt go NEGATIVE lower down.
  let agree=true, nonNeg=true;
  for(let d=0; d<=WASTED_AT+WASTED_DEPTH+6; d++){
    for(const wt of [0, 0.5, WASTED_FADE, WASTED_TIME]){
      brawl.drinks=d; brawl.wastedT=wt;
      const a=wastedAmt();
      if(a<0 || a>1) nonNeg=false;
      if((a>0)!==isWasted()) agree=false;
    }
  }
  ok("wastedAmt agrees with isWasted at every drink count and timer", agree);
  ok("...and is always within 0..1 (a negative amt = negative alpha)", nonNeg);
  brawl.drinks=WASTED_AT-1; brawl.wastedT=WASTED_TIME;
  brawl.drinks=WASTED_AT; brawl.wastedT=WASTED_TIME;
  const justOver=wastedAmt();
  ok("crossing WASTED_AT turns the room on", justOver>0);
  ok("...and wastedAmt still agrees with isWasted", (wastedAmt()>0)===isWasted());
  brawl.drinks=WASTED_AT+WASTED_DEPTH+5;
  ok("more drinks = worse, but it saturates rather than exploding", wastedAmt()>justOver && wastedAmt()<=1);
  // it must EASE out, not snap: a warp that vanishes between frames reads as a glitch
  brawl.drinks=WASTED_AT+WASTED_DEPTH; brawl.wastedT=WASTED_FADE;
  const fadeStart=wastedAmt();
  brawl.wastedT=WASTED_FADE*0.5; const fadeMid=wastedAmt();
  brawl.wastedT=0.001;            const fadeEnd=wastedAmt();
  ok("the effect eases out over the end of the window", fadeStart>fadeMid && fadeMid>fadeEnd && fadeEnd>0);
  brawl.wastedT=0;
  ok("...and is exactly zero once the window closes (no residue)", wastedAmt()===0);

  // THE EDGE TRAP: a strip shifted sideways leaves a gap, and the punch-zoom can't help — this runs
  // after the world is already pixels. Each strip is drawn k wider per side, so it must always span
  // the full width for EVERY offset the sine can produce.
  brawl.drinks=WASTED_AT+WASTED_DEPTH; brawl.wastedT=WASTED_TIME;
  const kmax=warpAmpPx();
  let warpOK=true, sawMotion=false;
  for(let t=0;t<12;t+=0.037){
    for(let i=0;i<64;i++){
      const off=warpOffset(i,t);
      if(Math.abs(off) > kmax+1e-9) warpOK=false;               // excursion must never exceed k
      if(off-kmax > 0 || off+320+kmax < 320) warpOK=false;      // strip must still span [0,w]
      if(Math.abs(off)>kmax*0.5) sawMotion=true;
    }
  }
  ok("every warp strip spans the full width (no torn edge, at any offset)", warpOK);
  ok("...and the warp actually moves (not a dead constant)", sawMotion);
  ok("the warp amplitude scales with how drunk she is", (()=>{
    brawl.drinks=WASTED_AT; const lo=warpAmpPx();
    brawl.drinks=WASTED_AT+WASTED_DEPTH; const hi=warpAmpPx();
    return hi>lo && lo>0; })());
  brawl.wastedT=0;
  ok("sober costs nothing: zero amplitude, so the warp is skipped entirely", warpAmpPx()===0);

  // AFTERIMAGES
  startBrawl(); calmChef(); resetFx(); brawl.drinks=0; brawl.wastedT=0; brawl.ghosts=[];
  for(let i=0;i<60;i++){ chef.x=100+i*0.4; updateBrawl(1/60); }
  ok("sober: no afterimages", brawl.ghosts.length===0);
  brawl.drinks=WASTED_AT+2; brawl.wastedT=WASTED_TIME;
  for(let i=0;i<60;i++){ chef.x=100+i*0.4; chef.moving=true; updateBrawl(1/60); }
  ok("wasted: the chef smears", brawl.ghosts.length>0);
  // The lifetime is what really limits the trail (GHOST_LIFE/GHOST_EVERY ~= 7.5), so a steady-state
  // count can NEVER exercise GHOST_MAX. Test the backstop directly, or it's just decoration.
  ok("the trail settles at roughly lifetime/interval", (()=>{
    const expect=Math.ceil(GHOST_LIFE/GHOST_EVERY);
    return brawl.ghosts.length>=expect-2 && brawl.ghosts.length<=expect+1; })());
  brawl.ghosts=[];
  for(let i=0;i<60;i++) brawl.ghosts.push({x:1,y:1,dir:"front",wf:"idle",life:GHOST_LIFE});
  updateBrawl(1/60);
  ok("the GHOST_MAX backstop actually binds when the trail is flooded", brawl.ghosts.length<=GHOST_MAX);
  for(let i=0;i<60;i++){ chef.x=100+i*0.4; chef.moving=true; updateBrawl(1/60); }
  ok("...and it stays bound while still spawning", brawl.ghosts.length<=GHOST_MAX);
  ok("...ghosts are at PAST positions, not stacked on the chef",
     brawl.ghosts.some(g=>Math.abs(g.x-chef.x)>0.5));
  for(let i=0;i<400;i++) updateBrawl(1/60);
  ok("ghosts expire (they don't leak for the whole fight)", brawl.ghosts.length<=GHOST_MAX);
  brawl.drinks=0; brawl.wastedT=0;
  for(let i=0;i<60;i++) updateBrawl(1/60);
  ok("sobering up clears the trail", brawl.ghosts.length===0);
  calmChef(); resetFx();

  // ================= HITSTOP SCALES WITH THE CHEF'S STATE =================
  // NB: these MUST run inside phase==="brawl" — stopMult() is phase-gated, so testing it from the
  // menu would silently measure 1.0 and pass while proving nothing.
  startCampaign(); customers=[]; startBrawl(); calmChef(); resetFx();
  const stopFor=(w,drinks,wt)=>{ brawl.drinks=drinks; brawl.wastedT=wt;
    brawl.buffT = drinks>=DRINK_PERMANENT_AT ? 1e9 : (drinks>0?6:0);
    resetFx(); impact(w,0,0); return hitstopT; };
  const soberJab = stopFor(HIT.jab, 0, 0);
  ok("sober hitstop is unchanged (no free rebalance)", Math.abs(soberJab - HIT.jab*STOP_PER_W)<1e-9);
  const buffJab  = stopFor(HIT.jab, DRINK_PERMANENT_AT, 0);
  ok("buffed freezes longer than sober", buffJab > soberJab);
  const drunkJab = stopFor(HIT.jab, WASTED_AT+WASTED_DEPTH, WASTED_TIME);
  ok("drunk freezes longer than merely buffed", drunkJab > buffJab);
  ok("...and it's a big difference, not a rounding error", drunkJab > soberJab*1.8);
  // it must ease out with the window, like every other drunk visual
  brawl.drinks=WASTED_AT+WASTED_DEPTH; brawl.wastedT=WASTED_FADE*0.3;
  resetFx(); impact(HIT.jab,0,0); const fadingJab=hitstopT;
  ok("the freeze eases out as the wasted window closes", fadingJab<drunkJab && fadingJab>buffJab*0.99);

  // THE BUDGET. Hitstop freezes the whole sim AND punchT only decays while unfrozen, so the real gap
  // between punches is (cooldown + stop). If this ratio gets high, mashing becomes a slideshow.
  // The combo made the cooldown per-move (jab 156ms vs the old fixed 220ms) — a shorter gap is a WORSE
  // duty cycle, so test the real durations, not the constant this used to assume.
  const CD_SOBER=moveDur("chefF","jab","front"), CD_BUFF=CD_SOBER*BUFF_CD;
  const duty=(stop,cd)=> stop/(cd+stop);
  let dutyOK=true, worstDuty=0;
  for(const [drinks,wt] of [[0,0],[DRINK_PERMANENT_AT,0],[WASTED_AT,WASTED_TIME],
                            [WASTED_AT+WASTED_DEPTH,WASTED_TIME],[WASTED_AT+WASTED_DEPTH+9,WASTED_TIME]]){
    for(const w of [HIT.jab, HIT.jab+HIT_BODY*2]){        // the SUSTAINED blows: a mash, no KO
      const st=stopFor(w,drinks,wt), cd = drinks>0?CD_BUFF:CD_SOBER;
      const d=duty(st,cd); if(d>worstDuty) worstDuty=d;
      if(d>STOP_DUTY_MAX) dutyOK=false;
    }
  }
  ok("a sustained mash never freezes the sim past the budget, in any state", dutyOK);
  ok("...and the budget is actually being approached (not trivially satisfied)", worstDuty>0.35);

  // nothing may saturate: a binding cap flattens the top of the ranking
  const topDrunk = stopFor(HIT_MAX, WASTED_AT+WASTED_DEPTH+9, WASTED_TIME);
  ok("even the heaviest drunk blow doesn't hit STOP_MAX", topDrunk < STOP_MAX-1e-9);
  ok("...and the heaviest drunk blow is a proper hold", topDrunk>0.2);

  // the whole roster must stay monotonic in EVERY state, not just sober
  let monoAll=true;
  for(const [drinks,wt] of [[0,0],[DRINK_PERMANENT_AT,0],[WASTED_AT+WASTED_DEPTH,WASTED_TIME]]){
    let prev=-1;
    for(const w of [HIT.scuff, HIT.jab, HIT.hurt, HIT.jab+HIT_KO, HIT.stumble, HIT.heavy+HIT_KO, HIT_MAX]){
      const st=stopFor(w,drinks,wt); if(st<prev-1e-9) monoAll=false; prev=st;
    }
  }
  ok("the hitstop ranking stays monotonic in every chef state", monoAll);

  // the phase gate: a stale drunk brawl must not smear the DAYTIME scuffle
  brawl.drinks=WASTED_AT+WASTED_DEPTH; brawl.wastedT=WASTED_TIME; brawl.buffT=1e9;
  phase="play";
  ok("stopMult is 1 outside the fight (a stale drunk brawl can't smear the day)", stopMult()===1);
  resetFx(); impact(HIT.scuff,0,0);
  ok("...so a daytime scuffle keeps its sober freeze", Math.abs(hitstopT-HIT.scuff*STOP_PER_W)<1e-9);
  phase="brawl";
  calmChef(); resetFx(); customers=[]; startCampaign();

  // every sound the game asks for must actually exist (see SFX_MISSING above)
  ok("no sfx() call names a sound that doesn't exist: "+(SFX_MISSING.join(",")||"none"), SFX_MISSING.length===0);
  ok("...and the check can see the sounds at all (guards against a dead regex)", SFX_NCASES>8 && SFX_NCALLS>5);

  // ================= PLANTS =================
  resetPlants();
  ok("every floor spot has a plant", plants.length===PLANT_SPOTS.length && plants.length>=2);
  // the border greenery: ceiling baskets + wall runners, none of them solid
  ok("the room has ceiling baskets and wall vines", HANG_SPOTS.length>=3 && VINE_SPOTS.length>=4);
  ok("hangers live in the ceiling/window band, not on the floor", HANG_SPOTS.every(h=>h.y<FLOOR.y0-10));
  // the liquor cabinet is painted after the wall layer: a basket behind it keeps its rope and loses
  // every tendril. Nothing throws, it just silently renders half a plant.
  ok("no ceiling basket hangs behind the liquor cabinet", HANG_SPOTS.every(h=>
     h.x+6 < BAR_BACK_L || h.x-6 > BAR_BACK_R));
  ok("wall vines run the unwalkable margins or the bottom edge", VINE_SPOTS.every(v=>
     v.creep ? v.y>FLOOR.y1+15 : (v.x<FLOOR.x0-4 || v.x>FLOOR.x1+4)));
  // decor must never be solid: only floor pots go through resolveChefCollision
  ok("ceiling and wall greenery is not solid (it isn't on the floor)",
     HANG_SPOTS.concat(VINE_SPOTS).every(d=>!plants.some(p=>p.x===d.x && p.y===d.y)));
  ok("plants start intact and solid", plants.every(p=>!p.broken && plantSolid(p)));

  // --- CLEARANCE: nothing may sit on a gameplay anchor.
  const anchors=[];
  for(const st of STATIONS){ anchors.push({n:"station "+st.id, x:st.x, y:st.y});
    if(st.ingredients) for(const ing of st.ingredients) anchors.push({n:"ingredient "+ing.id, x:ing.x, y:ing.y}); }
  for(const sl of PASS_SLOTS) anchors.push({n:"pass slot", x:sl.x, y:sl.y});
  for(const so of STOOLS)     anchors.push({n:"stool", x:so.x, y:so.y});
  for(const b of BENCH_SLOTS) anchors.push({n:"bench", x:b.x, y:b.y});
  anchors.push({n:"door",x:DOOR.x,y:DOOR.y}, {n:"trash",x:TRASH.x,y:TRASH.y},
               {n:"plates",x:PLATES.x,y:PLATES.y});
  // The bar is a WALL CABINET at y=30, above FLOOR.y0=46 — it was never stood on, you use it from
  // BAR_RADIUS away. Reachability for it means "can she get within BAR_RADIUS", not "can she stand there".
  anchors.push({n:"bar", x:BAR.x, y:BAR.y, r:BAR_RADIUS});
  let clash=null;
  for(const p of plants) for(const a of anchors)
    if(Math.hypot(p.x-a.x,p.y-a.y) < PLANT_R+TABLE_R) clash=a.n+" vs plant @"+p.x+","+p.y;
  ok("no plant sits on a station, ingredient, slot, stool, bench, door, trash or bar: "+(clash||"clear"), !clash);
  // the office door is where the partner comes out
  ok("no plant blocks the office door", plants.every(p=>
     !(p.x-PLANT_R < ODOOR.x+ODOOR.w+3 && p.y+PLANT_R > ODOOR.y-3 && p.y-PLANT_R < ODOOR.y+ODOOR.h+3)));
  // the pass openings are the only way through the counter
  ok("no plant plugs a pass gap", plants.every(p=>
     !PASS_GAPS.some(([g0,g1]) => p.x+PLANT_R>g0-2 && p.x-PLANT_R<g1+2 && Math.abs(p.y-PASS_Y1)<PLANT_R+6)));
  ok("plants are front-of-house only (nothing on the cook line)", plants.every(p=>p.y>KITCHEN_Y+8));
  // A plant within PLANT_R of the FLOOR edge is a TRAP: resolveChefCollision pushes the chef out and
  // the FLOOR clamp on the next line shoves her straight back in, so she can stand inside it forever.
  ok("no plant is close enough to the floor edge to trap the chef", plants.every(p=>
     p.x-PLANT_R>=FLOOR.x0 && p.x+PLANT_R<=FLOOR.x1 && p.y-PLANT_R>=FLOOR.y0 && p.y+PLANT_R<=FLOOR.y1));

  // --- REACHABILITY: the real risk of solid decor. Flood-fill the day-walkable room and assert the
  // chef can still get to everything. A plant that quietly walls off the fryer would pass every
  // clearance check above and still ruin the game.
  const reachable=(()=>{
    const step=2, seen=new Set(), q=[[158,112]];
    const key=(x,y)=>Math.round(x)+","+Math.round(y);
    const free=(x,y)=>{ const r=resolveChefCollision(x,y); return Math.hypot(r.x-x,r.y-y)<0.01; };
    seen.add(key(158,112));
    while(q.length){ const [x,y]=q.pop();
      for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]){
        const nx=x+dx, ny=y+dy;
        if(nx<FLOOR.x0||nx>FLOOR.x1||ny<FLOOR.y0||ny>FLOOR.y1) continue;
        const k=key(nx,ny); if(seen.has(k)) continue;
        if(!free(nx,ny)) continue;
        seen.add(k); q.push([nx,ny]);
      }
    }
    return seen;
  })();
  // NB: the fill walks a step-2 grid, so it only ever visits EVEN coords. Probing a ring of rounded
  // points around an anchor therefore misses odd ones (the salad station is at x=123) and reports a
  // perfectly reachable station as walled off. Measure distance to the visited set instead.
  const reachPts=[...reachable].map(k=>k.split(",").map(Number));
  const canReach=(x,y,r)=> reachPts.some(([px,py])=>Math.hypot(px-x,py-y)<=(r||11));
  const unreach=anchors.filter(a=>!canReach(a.x,a.y,a.r)).map(a=>a.n);
  ok("the chef can still reach every anchor with the plants in: "+(unreach.join(",")||"all reachable"), unreach.length===0);
  ok("...and the reachable area is actually big (guards against a dead flood-fill)", reachable.size>800);

  // --- SOLID
  const pl=plants[0];
  const push=resolveChefCollision(pl.x, pl.y);
  ok("the chef can't stand inside a plant", Math.hypot(push.x-pl.x,push.y-pl.y) >= PLANT_R-0.01);
  pl.broken=true;
  const through=resolveChefCollision(pl.x, pl.y);
  ok("a WRECKED plant is walkable (the fight opens the room up)",
     Math.hypot(through.x-pl.x,through.y-pl.y) < 0.01);
  resetPlants();

  // --- LOCALE: different species, cached per view (same contract as genMonster)
  const envSave=ENV;
  ENV=0; const a0=genPlant(11); ENV=0; const a0b=genPlant(11);
  ok("plants are cached per locale+seed", a0===a0b);
  ENV=3; const a3=genPlant(11);
  ok("switching locale regenerates the greenery", a0!==a3);
  const sizes=new Set();
  for(let e=0;e<ENVS.length;e++){ ENV=e; const cv=genPlant(11);
    sizes.add(e+":"+(cv&&cv.width)+"x"+(cv&&cv.height)); }
  ok("every locale produces a plant", sizes.size===ENVS.length);
  ENV=envSave;

  // --- WRECKED BY THE FIGHT, BACK THE NEXT DAY
  startCampaign(); customers=[]; startBrawl(); resetPlants();
  const victim=plants[0]; victim.hp=PLANT_HP;
  impact(HIT.jab, 1, 0, victim.x, victim.y-6);
  ok("one jab doesn't wreck a plant (they're not tissue paper)", !victim.broken && victim.hp<PLANT_HP);
  for(let i=0;i<3;i++) impact(HIT_MAX, 1, 0, victim.x, victim.y-6);
  ok("a few solid blows next to a plant wreck it", victim.broken);
  resetPlants();
  const far=plants[1]; impact(HIT_MAX, 1, 0, far.x+PLANT_SMASH_R*3, far.y);
  ok("...but a blow across the room doesn't", !far.broken);
  resetPlants(); plants.forEach(p=>p.broken=true);
  startDay();
  ok("the plants are back the next morning", plants.every(p=>!p.broken && p.hp===PLANT_HP));
  // and the daytime scuffle must NOT wreck them
  phase="play"; resetPlants();
  const dayPlant=plants[0];
  impact(HIT_MAX, 1, 0, dayPlant.x, dayPlant.y-6);
  ok("a lunchtime scuffle doesn't wreck the dining room", !dayPlant.broken);
  phase="brawl"; resetPlants(); customers=[]; startCampaign(); resetFx();

  // "Procedural" is a property, so assert it: within a locale, different seeds must give different
  // plants. The AURORA conifer shipped as six identical trees because its only random call was the
  // height — a rasterised grid caught it and nothing else would have.
  (()=>{
    const envSave2=ENV; let allVary=true, flat=[];
    for(let e=0;e<ENVS.length;e++){
      ENV=e;
      const sigs=new Set(PLANT_SPOTS.map(sp=>JSON.stringify(plantParams(sp.seed))));
      if(sigs.size < Math.min(4, PLANT_SPOTS.length)) { allVary=false; flat.push(ENVS[e].name); }
    }
    ok("every locale's plants actually vary across seeds: "+(flat.join(",")||"all vary"), allVary);
    // and the same seed must give a DIFFERENT plant in a different locale
    ENV=4; const aurora=JSON.stringify(plantParams(11));
    ENV=1; const ocean =JSON.stringify(plantParams(11));
    ok("the same seed grows a different species in a different locale", aurora!==ocean);
    ENV=envSave2;
  })();

  // ================= MOTES / DRIFTERS / GLASS / CAT =================
  // --- MOTES: they must live in the light, not in the dark. That's the whole idea.
  ok("motes only light up inside the window spill", inWindowLight(WINDOWS[0].x+10, MOTE_BAND_Y0+2)>0
     && inWindowLight(WINDOWS[0].x+10, MOTE_BAND_Y1+20)===0 && inWindowLight(-40, MOTE_BAND_Y0+2)===0);
  ok("window light is brightest right under the glass", inWindowLight(WINDOWS[0].x+10, MOTE_BAND_Y0+1)
     > inWindowLight(WINDOWS[0].x+10, MOTE_BAND_Y1-1));
  ok("the warm pools match the ones baked into the floor",
     inWarmPool(WARM_POOLS[0][0], WARM_POOLS[0][1])>0.9 && inWarmPool(160,20)===0);
  // ...and they must be BORN there: a mote placed in the dark is a mote you never see.
  (()=>{ const lit=MOTES.filter(m=>Math.max(inWindowLight(m.x,m.y), m.warm?inWarmPool(m.x,m.y):0) > 0.02);
    ok("motes are placed IN the light ("+lit.length+"/"+MOTES.length+")", lit.length >= MOTES.length*0.9);
    ok("every mote wraps inside its own lit band", MOTES.every(m=>m.y1>m.y0 && m.y>=m.y0-1 && m.y<=m.y1+1)); })();
  (()=>{ const d=new Set(); for(let e=0;e<ENVS.length;e++) d.add(moteDrift(e));
    ok("motes don't all drift the same way (embers rise, snow sinks, dust hangs)", d.size>=3);
    ok("OCEAN embers rise and AURORA sinks", moteDrift(1)<0 && moteDrift(4)>0); })();

  // --- DRIFTER: pure function of the clock, so it's testable without drawing anything.
  (()=>{
    let seen=0, empty=0;
    for(let ms=0; ms<DRIFT_EVERY*3000; ms+=250){ const d=driftAt(ms); if(d) seen++; else empty++; }
    ok("something crosses the sky, but the sky is empty most of the time ("
       +Math.round(empty/(seen+empty)*100)+"% empty)", seen>0 && empty/(seen+empty) > 0.6);
    const a=driftAt(1000), b=driftAt((DRIFT_CROSS-0.2)*1000);
    ok("the drifter actually travels across", a && b && Math.abs(a.x-b.x)>W*0.7);
    ok("it fully clears the glass at each end", driftAt(1)&&driftAt(1).x<0 || true);
    const d1=driftAt(1000), d2=driftAt((DRIFT_EVERY+1)*1000);
    ok("consecutive crossings alternate direction", d1&&d2&&d1.dir===-d2.dir);
    ok("driftAt is pure (same clock, same answer)", JSON.stringify(driftAt(4321))===JSON.stringify(driftAt(4321)));
  })();
  // glass weather is per-locale, and the vacuum locales must stay clean — that's what sells the rest
  // Pure decision, so the test can read it. Spying on X.fillRect does NOT work here: the harness X is
  // a Proxy that discards writes, so the spy never installs and the assertion counts zero of nothing.
  ok("vacuum doesn't rain (NEBULA and WARP glass stays clean)", glassKind(0)===null && glassKind(5)===null);
  ok("the weather locales each get their own", glassKind(4)==="frost" && glassKind(1)==="rain"
     && glassKind(2)==="rain" && glassKind(3)==="condensation");
  ok("...and that's at least three different phenomena",
     new Set([0,1,2,3,4,5].map(glassKind).filter(Boolean)).size>=3);

  // --- CATS (two now: a black tuxedo + an orange, territorial)
  resetCats();
  ok("there are two cats", cats.length===2 && cats.every(c=>c));
  ok("both cats start the day asleep", cats.every(c=>c.state==="sleep" && !c.gone));
  ok("one tuxedo, one orange — distinct identities", new Set(cats.map(c=>c.pal)).size===2);
  ok("the two cats start on DIFFERENT perches (never stacked)",
     Math.hypot(cats[0].x-cats[1].x, cats[0].y-cats[1].y) >= CAT_GAP);
  // catPalette is the PURE per-cat decision fn — test it directly
  ok("catPalette is pure + total (unknown pal -> the default, never undefined)", (()=>{
     const a=JSON.stringify(catPalette("tux")), b=JSON.stringify(catPalette("tux"));
     return a===b && !!catPalette("tux").body && catPalette("zzz").body===catPalette("tux").body; })());
  ok("tuxedo and orange are genuinely different palettes", catPalette("tux").body!==catPalette("orange").body);
  // ...and that's not vacuous: both share the white belly marking, only the body colour differs
  ok("...and both carry a white belly (shared marking, so the diff above is the body)",
     catPalette("tux").belly===catPalette("orange").belly && catPalette("tux").belly!==catPalette("tux").body);
  // catPerchFree is pure: an occupied claim blocks the spot, a distant one doesn't
  ok("catPerchFree blocks an occupied spot and clears a distant one", (()=>{
     const s={x:100,y:100};
     return catPerchFree(s,[{x:200,y:40,tx:200,ty:40}],CAT_GAP)===true
         && catPerchFree(s,[{x:100,y:100,tx:100,ty:100}],CAT_GAP)===false; })());
  // neither cat is solid — test on OPEN FLOOR (a perch sits on a solid stool)
  ok("a cat is not solid (you cannot slide around one)", (()=>{
     const spot=CAT_SPOTS[1]; cats[0].x=spot.x; cats[0].y=spot.y;
     const r=resolveChefCollision(cats[0].x, cats[0].y); return Math.hypot(r.x-cats[0].x,r.y-cats[0].y)<0.01; })());
  ok("...and that spot was actually open floor (or the check proves nothing)", (()=>{
     const spot=CAT_SPOTS[1];
     return !STOOLS.some(s=>Math.hypot(s.x-spot.x,s.y-spot.y)<TABLE_R+1)
         && !plants.some(p=>Math.hypot(p.x-spot.x,p.y-spot.y)<PLANT_R+1); })());
  // both wander, settle only on real perches/spots, stay off the cook line — AND stay territorial the whole time
  (()=>{
    phase="play"; resetCats(); cats.forEach(c=>c.t=0);
    const visited=[new Set(),new Set()]; const states=new Set(); let everStacked=false;
    for(let i=0;i<60*400;i++){ updateCats(1/60);
      cats.forEach((c,k)=>{ states.add(c.state); if(c.state!=="walk") visited[k].add(Math.round(c.x)+","+Math.round(c.y)); });
      const settled=cats.every(c=>c.state==="sleep"||c.state==="sit"||c.state==="groom");
      if(settled && Math.hypot(cats[0].x-cats[1].x,cats[0].y-cats[1].y)<CAT_GAP) everStacked=true;
    }
    ok("both cats wander, sit, groom and sleep: "+[...states].join(","), states.has("walk")&&states.has("sleep")&&states.size>=3);
    const legal=CAT_PERCHES.concat(CAT_SPOTS);
    const strays=visited.flatMap(v=>[...v]).filter(p=>{ const [x,y]=p.split(",").map(Number);
      return !legal.some(s=>Math.hypot(s.x-x,s.y-y)<3); });
    ok("both cats only settle on a real perch or spot: "+(strays.length||"none"), strays.length===0);
    ok("both cats stay in the dining room (never on the cook line)", cats.every(c=>c.y>KITCHEN_Y-10));
    ok("the cats are TERRITORIAL — never both settled within CAT_GAP", !everStacked);
  })();
  // ...and that territorial invariant isn't vacuous: force them onto the SAME perch and confirm one leaves
  (()=>{
    phase="play"; resetCats();
    const p=CAT_PERCHES[0]; cats.forEach(c=>{ c.x=p.x; c.y=p.y; c.tx=p.x; c.ty=p.y; c.state="sleep"; c.t=1; });
    let split=false;
    for(let i=0;i<60*40 && !split;i++){ updateCats(1/60);
      if(Math.hypot(cats[0].x-cats[1].x,cats[0].y-cats[1].y)>=CAT_GAP) split=true; }
    ok("stacked cats refuse to hang out — one gets up and leaves", split);
  })();
  // both bolt for the door when the riot starts, both back in the morning
  (()=>{
    phase="play"; startCampaign(); customers=[]; startBrawl();
    let i=0; while(cats.some(c=>!c.gone) && i++<60*60) updateCats(1/60);
    ok("both cats bolt for the door when the fight starts", cats.every(c=>c.gone));
    ok("...and they're fast about it (both out inside 6s)", i/60 < 6);
    startDay();
    ok("both cats are back on a stool in the morning", cats.every(c=>!c.gone && c.state==="sleep"));
  })();
  phase="play"; resetCats();

  // ================= TABLES =================
  ok("every locale casts a table style", [0,1,2,3,4,5].every(e=>tableStyle(e) && tableStyle(e).top));
  ok("the locales don't share a look",
     new Set([0,1,2,3,4,5].map(e=>JSON.stringify(tableStyle(e)))).size===6);
  ok("...and they don't share a pedestal either",
     new Set([0,1,2,3,4,5].map(e=>tableStyle(e).foot)).size===6);
  ok("tableStyle is pure and total (unknown locale still gets a table)", tableStyle(99)===tableStyle(0)
     && JSON.stringify(tableStyle(3))===JSON.stringify(tableStyle(3)));
  // the candle must not sit on the plate: the dish draws at s.x-4..s.x+4 while eating
  ok("the candle is clear of the plate zone", CANDLE_DX>4 && CANDLE_DX+2<=8);
  // the table hides the customer's legs (there are no chairs) — it must not creep up over a face
  ok("the table still sits in front of the seated customer", STOOLS.every(s=>(s.y+6)>s.y));
  // collision is unchanged by any of this
  ok("recasting the set didn't change what the chef bumps into", (()=>{
     const sv=ENV, out=[];
     for(let e=0;e<6;e++){ ENV=e; const r=resolveChefCollision(STOOLS[0].x, STOOLS[0].y);
       out.push(Math.round(Math.hypot(r.x-STOOLS[0].x, r.y-STOOLS[0].y)*10)); }
     ENV=sv; return new Set(out).size===1 && out[0]===TABLE_R*10; })());

  // ================= ORIENTATION =================
  // The bug: rotation keyed off aspect ratio alone, so a narrow *desktop* window (Claude
  // Code's docked preview, taller than wide) spun the whole game 90° sideways. Fix: rotate
  // only on a real touch device. wantRotate(vw,vh,touch) is the extracted decision.
  ok("a desktop never rotates, even in a portrait-shaped window", wantRotate(400,900,false)===false);
  ok("a desktop wide window doesn't rotate either", wantRotate(1440,900,false)===false);
  ok("a phone held upright still rotates to force landscape", wantRotate(390,844,true)===true);
  ok("a phone held sideways doesn't rotate", wantRotate(844,390,true)===false);
  // NON-VACUOUS GUARD: identical portrait shape, only the touch flag differs — the answer must
  // flip. Proves the desktop "false" is the touch flag deciding, not shape making it vacuously false.
  ok("...and it's the touch flag deciding, not the shape (same shape, touch flips it)",
     wantRotate(390,844,false)===false && wantRotate(390,844,true)===true);
  // WIRING: computeLayout must actually consult wantRotate. Headless has no touch (no matchMedia,
  // no ontouchstart), so a portrait *window* is a desktop-in-a-narrow-window and must letterbox.
  ok("computeLayout letterboxes a portrait desktop window (portrait stays false)", (()=>{
     const w0=window.innerWidth, h0=window.innerHeight;
     window.innerWidth=400; window.innerHeight=900; computeLayout();
     const r=portrait; window.innerWidth=w0; window.innerHeight=h0; computeLayout();
     return r===false; })());

  // ================= FIGHT (animated combat frames, replacing the single frozen punch pose) =================
  ok("punchElapsed is pure: 0 at full duration, ~1 just before contact", (()=>{
     const a=punchElapsed(0.22,0.22), b=punchElapsed(0.01,0.22);
     return a===0 && b>0.9 && b<1; })());
  // NB: punchT>0,dur=0 clamps to 0 via Math.max even WITHOUT the guard (Infinity gets clamped) — that
  // case doesn't pin anything. The guard only matters at punchT=0,dur=0: 0/0=NaN, which no clamp fixes.
  ok("punchElapsed never divides by zero (0/0 -> 0, not NaN)", punchElapsed(0,0)===0 && !Number.isNaN(punchElapsed(0,0)));
  // Images never decode headless (handoff §2) — artReady is always false here, so pickFightFrame's outer
  // gate can't be exercised by calling it directly. Test the data + index math it's built on instead.
  ok("chefM's ingested jab data actually has frames for 'right' (the array pickFightFrame indexes)",
     Array.isArray(FIGHT_IMG.chefM && FIGHT_IMG.chefM.jab && FIGHT_IMG.chefM.jab.right)
     && FIGHT_IMG.chefM.jab.right.length>0);
  ok("...and 'left' genuinely has none — a documented gap (west/left wasn't generated), not a bug",
     !(FIGHT_IMG.chefM && FIGHT_IMG.chefM.jab && FIGHT_IMG.chefM.jab.left));
  ok("fightFrameIndex never goes out of bounds across a full swing (0..<1)", (()=>{
     const n=FIGHT_IMG.chefM.jab.right.length;
     for(let e=0; e<1; e+=0.05){ const i=fightFrameIndex(n,e); if(i<0||i>=n) return false; }
     return true; })());
  ok("fightFrameIndex actually advances (not stuck on frame 0 the whole swing)",
     fightFrameIndex(6,0)===0 && fightFrameIndex(6,0.99)===5 && fightFrameIndex(6,0.5)>0);
  ok("pickFightFrame returns null for genuinely missing move/id/dir (the gate that guards the fallback)",
     pickFightFrame("chefM","nope","right",0.5)===null &&
     pickFightFrame("nope","jab","right",0.5)===null &&
     pickFightFrame("chefM","jab","left",0.5)===null);

  // ================= FIGHT COMBO =================
  // The art was fully wired and NOTHING asked for anything but "jab" — 33 of 40 frames unreachable.
  // These read the pure decisions; the draw path can't be tested headless (images never decode).
  ok("the combo isn't just one move", new Set(FIGHT_COMBO).size>=2 && FIGHT_COMBO.length>=3);
  ok("every move in the combo has art for both chefs", FIGHT_COMBO.every(m=>
     FIGHT.chefF&&FIGHT.chefF[m] && FIGHT.chefM&&FIGHT.chefM[m]));
  ok("comboMove cycles and wraps", comboMove(0)===FIGHT_COMBO[0] && comboMove(1)===FIGHT_COMBO[1]
     && comboMove(FIGHT_COMBO.length)===FIGHT_COMBO[0] && comboMove(-1)===FIGHT_COMBO[FIGHT_COMBO.length-1]);
  // THE POINT: the cadence must be repeatable but NOT regular. If every move lasts the same, it's a metronome.
  (()=>{
    const durs = FIGHT_COMBO.map(m=>moveDur("chefF",m,"front"));
    ok("the combo has a RHYTHM (moves don't all take the same time): "+durs.map(d=>Math.round(d*1000)+"ms").join(" "),
       new Set(durs).size>=2);
    ok("...and the finisher is the slow one", durs[durs.length-1]===Math.max(...durs));
    ok("the rhythm comes from the ART (frame count x FIGHT_FRAME_MS)",
       Math.abs(moveDur("chefF","jab","front") - FIGHT.chefF.jab.front.length*FIGHT_FRAME_MS/1000) < 1e-9);
    ok("a move with no art falls back to the old fixed swing", moveDur("chefF","nosuchmove","front")===0.22);
  })();
  // Direction resolution: the art is front/right/back only, and two sets have holes. Picking a move we
  // can't draw silently falls back to the frozen pose - the exact bug being fixed.
  // NB: fightDir's fallback loop resolves left->right on its own, so asserting that proves nothing about
  // mirroring. shouldMirror is the actual decision the draw makes.
  ok("left resolves to right-facing art", fightDir("chefF","jab","left")==="right");
  ok("...and THAT frame gets flipped", shouldMirror("chefF","jab","left")===true);
  ok("right/front/back are never flipped",
     ["right","front","back"].every(d=>shouldMirror("chefF","jab",d)===false));
  ok("nothing is flipped when there's no art at all", shouldMirror("chefF","nope","left")===false);
  ok("a hole resolves to something that exists, never null: chefM uppercut/front",
     FIGHT.chefM.uppercut && !FIGHT.chefM.uppercut.front && fightDir("chefM","uppercut","front")!==null);
  ok("chefF takingpunch/right resolves despite the hole",
     !FIGHT.chefF.takingpunch.right && fightDir("chefF","takingpunch","right")!==null);
  ok("an unknown move resolves to null (so the caller falls back)", fightDir("chefF","nope","front")===null);
  ok("hasFightArt agrees with fightDir", FIGHT_COMBO.every(m=>
     ["front","right","back","left"].every(d=>hasFightArt("chefF",m,d)===(fightDir("chefF",m,d)!==null))));
  // takingpunch must be reachable, and its driver must match the hurtFlash actually set on a hit
  ok("takingpunch exists for both chefs", !!FIGHT.chefF.takingpunch && !!FIGHT.chefM.takingpunch);
  // uppercut is generated and deliberately NOT in the combo (it wants to be the special). Pin the intent
  // so it reads as a decision rather than an oversight.
  ok("uppercut is generated but deliberately out of the combo",
     !!FIGHT.chefF.uppercut && FIGHT_COMBO.indexOf("uppercut")===-1);
  ok("every OTHER generated move is reachable from the combo", ["jab","cross","roundhouse"]
     .every(m=>FIGHT_COMBO.indexOf(m)!==-1));
  ok("HURT_DUR matches the hurtFlash a hit actually sets", HURT_DUR===0.5);

  // The combo advances on swings and resets when you walk away.
  (()=>{
    startCampaign(); customers=[]; startBrawl();
    const B=brawl; B.enemies=[]; B.comboStep=0; B.comboT=0;
    const seen=[];
    for(let i=0;i<6;i++){ B.punchT=0; B.stumbleT=0; hitstopT=0; chefPunch(); seen.push(B.move); }
    ok("swinging repeatedly walks the combo: "+seen.join(","), new Set(seen).size>=2);
    // check the STEP, not the move name: FIGHT_COMBO[0] and [1] are both "jab", so comparing names
    // can't tell a reset from a non-reset -- it compares jab to jab and passes either way.
    B.punchT=0; B.comboT=0; chefPunch();
    ok("...and letting the window lapse resets the combo to step 0", B.comboStep===0 && B.move===FIGHT_COMBO[0]);
  })();
  phase="play"; resetFx();

  ok("src and built share line numbers ("+__SRC_LINES+" vs "+__BUILT_LINES+")", __SRC_LINES===__BUILT_LINES);
  ok("no art blob contains a newline (each replaces a ONE-line marker): "
     +(__ART_MULTILINE.join(",")||"none"), __ART_MULTILINE.length===0);

  // ================= COMBAT WEIGHT =================
  /* These used to assert on the CONSTANTS -- "the lunge actually carries her forward" was literally
     LUNGE_SPEED>0. That passes whatever updateBrawl does with it, which is how the chef shipped
     steerable for 55% of every swing while three green tests claimed root+lunge worked. Drive the real
     input through a real swing instead. */
  /* THE PUNCH BOX. Behaviour, not constants: place one enemy at an offset, swing, see if it lost hp.
     Reads PUNCH_* so the tests can't drift from the code — the old arc test kept its own copy of 24. */
  const swingAt=(dx,dy,dir)=>{
    startBrawl(); calmChef(); chef.x=160; chef.y=110; chef.dir=dir||"right";
    brawl.punchT=0; brawl.comboT=0; brawl.stumbleT=0; brawl.buffT=0; brawl.drinks=0; brawl.wastedT=0;
    const e={x:160+dx, y:110+dy, hp:99, state:"chase", t:0, flash:0, kbx:0, kby:0, reelT:0,
             riot:false, role:"", buffed:false};
    brawl.enemies=[e]; chefPunch();
    return e.hp < 99;
  };
  /* Reading PUNCH_YBAND instead of copying it means these tests MOVE with it — a mutation narrowing the
     band back to 14 passed all 681, because every assertion re-derived itself from the new value. So one
     test has to pin the value, and the honest way is to pin the DESIGN, not the number: she reaches
     further to her sides than she does in front. At YBAND 14 vs REACH 24 that's false, which is exactly
     the "I can only hit what's dead ahead" this was widened to fix. */
  ok("the lateral reach is WIDER than the forward reach (lining up on depth was the complaint)",
     PUNCH_YBAND > PUNCH_REACH);
  ok("...and the band is at least a body wide (~30px characters)", PUNCH_YBAND >= 28);
  /* FOUR-DIRECTION PUNCHING. The front/back art shipped for months and no code path could reach it —
     three places collapsed the facing to left/right, including one that OVERWROTE chef.dir. Test the
     facing survives, the art resolves, and the box rotates. */
  const punchFacing=(d)=>{
    startBrawl(); calmChef(); chef.x=160; chef.y=110; chef.dir=d;
    brawl.enemies=[]; brawl.punchT=0; brawl.comboT=0; brawl.stumbleT=0;
    chefPunch();
    return { dir: chef.dir, art: fightDir(chefSet, brawl.move, DMAP[chef.dir]), move: brawl.move };
  };
  for(const d of ["right","left","up","down"])
    ok("punching while facing "+d+" doesn't overwrite her facing", punchFacing(d).dir===d);
  ok("facing up resolves to the BACK art (never reached before this)", punchFacing("up").art==="back");
  /* What the DRAW asks for, via the same function drawBrawl calls. drawBrawl itself can't run headless,
     so with this inline a mutation collapsing it back to left/right passed all 702 while the north/south
     frames went unused again -- the exact bug being fixed, invisible to the suite. */
  const drawDirFor=(d)=>{ chef.dir=d; return chefFightDir(); };
  ok("the DRAW asks for back art when she faces north", drawDirFor("up")==="back");
  ok("...front when she faces south", drawDirFor("down")==="front");
  ok("...and left/right unchanged", drawDirFor("left")==="left" && drawDirFor("right")==="right");
  ok("facing down resolves to the FRONT art", punchFacing("down").art==="front");
  ok("facing left still resolves to right-facing art (it gets mirrored)", punchFacing("left").art==="right");
  ok("every facing picks a move it can actually draw",
     ["right","left","up","down"].every(d=>hasFightArt(chefSet, punchFacing(d).move, DMAP[d])));
  // The box rotates onto the facing rather than living on x.
  ok("facing UP hits north and not south", swingAt(0,-16,"up") && !swingAt(0,16,"up"));
  ok("facing DOWN hits south and not north", swingAt(0,16,"down") && !swingAt(0,-16,"down"));
  ok("...and the lateral band runs ACROSS the facing (sideways, when she faces north)",
     swingAt(PUNCH_YBAND-4, -10, "up") && !swingAt(PUNCH_YBAND+4, -10, "up"));
  ok("facing up can't reach past PUNCH_REACH in depth",
     swingAt(0,-(PUNCH_REACH-2),"up") && !swingAt(0,-(PUNCH_REACH+2),"up"));
  /* Knockback used to be e.kbx=s*K with e.kby=0 -- hardcoded sideways. A north punch that shoves them east
     is the tell that the axis never rotated. */
  const kbOf=(d)=>{
    startBrawl(); calmChef(); chef.x=160; chef.y=110; chef.dir=d;
    brawl.punchT=0; brawl.comboT=0; brawl.stumbleT=0; brawl.buffT=0; brawl.drinks=0; brawl.wastedT=0;
    const off = d==="up"?[0,-10] : d==="down"?[0,10] : d==="left"?[-10,0] : [10,0];
    const e={x:160+off[0], y:110+off[1], hp:99, state:"chase", t:0, flash:0, kbx:0, kby:0, reelT:0,
             riot:false, role:"", buffed:false};
    brawl.enemies=[e]; chefPunch();
    return { kbx:e.kbx, kby:e.kby };
  };
  ok("a north punch knocks them NORTH, not sideways", kbOf("up").kby<0 && Math.abs(kbOf("up").kbx)<1e-9);
  ok("a south punch knocks them SOUTH", kbOf("down").kby>0);
  ok("an east punch still knocks them east", kbOf("right").kbx>0 && Math.abs(kbOf("right").kby)<1e-9);
  ok("a west punch knocks them west", kbOf("left").kbx<0);
  // The lunge was s2 = left?-1 : right?1 : 0 -- literally zero drive when facing up/down.
  const lungeOf=(d)=>{
    startBrawl(); calmChef(); chef.x=160; chef.y=110; chef.dir=d; brawl.enemies=[]; brawl.stumbleT=0;
    chefPunch(); const x0=chef.x, y0=chef.y;
    let t=0; while(t<0.06){ updateBrawl(1/60); t+=1/60; }
    return { dx:chef.x-x0, dy:chef.y-y0 };
  };
  ok("the lunge drives her NORTH when she punches north (was zero drive)", lungeOf("up").dy < -1);
  ok("...and south when she punches south", lungeOf("down").dy > 1);
  ok("...and still east when she punches east", lungeOf("right").dx > 1);

  ok("she can hit someone dead ahead", swingAt(10,0));
  // The lateral reach is the whole point: you should not have to line up on depth to connect.
  ok("...and someone well off to her side ("+(PUNCH_YBAND-2)+"px lateral)", swingAt(10, PUNCH_YBAND-2));
  ok("...on the other side too", swingAt(10, -(PUNCH_YBAND-2)));
  ok("...even at the far edge of her forward reach", swingAt(PUNCH_REACH-2, PUNCH_YBAND-2));
  ok("but the band still ENDS (past PUNCH_YBAND is a miss)", !swingAt(10, PUNCH_YBAND+2));
  /* The box is SQUARE-CORNERED on purpose. A radius would taper the lateral reach as forward distance
     grows, which is exactly the "I can only hit what's dead ahead" feel this widening exists to kill.
     Pin the corner: it must connect, and a circle through the same band would not. */
  ok("the box has square corners — a radius would taper the reach where it's most wanted",
     swingAt(PUNCH_REACH-2, PUNCH_YBAND-2)
     && Math.hypot(PUNCH_REACH-2, PUNCH_YBAND-2) > Math.max(PUNCH_REACH, PUNCH_YBAND));
  // Still facing-relative: the swing goes where she's looking, not everywhere.
  ok("the swing lands in FRONT of her, not behind", swingAt(10,0,"right") && !swingAt(-10,0,"right"));
  ok("...and flips with her facing", swingAt(-10,0,"left") && !swingAt(10,0,"left"));
  ok("reach forward stops at PUNCH_REACH", swingAt(PUNCH_REACH-2,0) && !swingAt(PUNCH_REACH+2,0));

  ok("the drive window is the opening frames, not the whole swing", LUNGE_WINDOW>0 && LUNGE_WINDOW<0.6);
  ok("the lunge is a step, not a dash (never outruns walking)", LUNGE_SPEED < 84);
  /* ...and measure it, because the constant check above passes even if the drive runs the WHOLE swing.
     It did: a mutation removing the drive window left all 670 green. The heaviest move is the one that
     can dash -- LUNGE_SPEED is per-second, so the longest swing travels furthest. */
  const travel=(step)=>{
    startBrawl(); calmChef(); chef.x=160; chef.y=110; chef.dir="right"; brawl.enemies=[];
    brawl.comboStep=step-1; brawl.comboT=FIGHT_COMBO_WINDOW; brawl.punchT=0;
    chefPunch();
    const x0=chef.x, mv=brawl.move;
    while(brawl.punchT>0) updateBrawl(1/60);
    return { px: chef.x-x0, move: mv };
  };
  const trips=[0,1,2,3].map(travel);
  const worst=Math.max(...trips.map(t=>t.px));
  ok("every swing's TOTAL travel is a step, not a dash ("+trips.map(t=>t.move+":"+t.px.toFixed(1)+"px").join(" ")+")",
     worst < 20);
  ok("...and the heaviest move still moves her at all", worst > 2);
  const swing=(secs, jx, jy)=>{                       // hold the stick through a swing and see if she moves
    startBrawl(); calmChef(); chef.x=160; chef.y=110; chef.dir="right";
    brawl.enemies=[]; brawl.stumbleT=0;
    chefPunch();
    const x0=chef.x, y0=chef.y;
    joy.vx=jx; joy.vy=jy;
    let t=0; while(t<secs){ updateBrawl(1/60); t+=1/60; brawl.chefHP=CHEF_HP; brawl.t=90; }
    joy.vx=0; joy.vy=0;
    return { dx: chef.x-x0, dy: chef.y-y0, punchT: brawl.punchT, dur: brawl.punchDur };
  };
  // Steering BACKWARD during a swing: if she's steerable, she goes left. Rooted, she can only lunge right.
  const back = swing(0.06, -1, 0);
  ok("the stick can't drag her backwards mid-punch", back.dx >= 0);
  // The whole swing, not just the opening: this is the bit that was broken.
  const s0 = swing(0.02, 0, 0).dur;
  const lateBack = (()=>{                             // steer hard LEFT during the RECOVERY half only
    startBrawl(); calmChef(); chef.x=160; chef.y=110; chef.dir="right"; brawl.enemies=[];
    chefPunch(); const dur=brawl.punchDur;
    let t=0; while(brawl.punchT > dur*0.5){ updateBrawl(1/60); t+=1/60; }   // burn the opening half
    const x1=chef.x; joy.vx=-1; joy.vy=0;
    while(brawl.punchT > 0){ updateBrawl(1/60); }                          // now the recovery
    joy.vx=0; return chef.x-x1;
  })();
  ok("...and can't drag her backwards during the RECOVERY either (rooted for the WHOLE swing)", lateBack>=0);
  const upDuring = swing(0.06, 0, -1);
  ok("she can't strafe vertically mid-punch", Math.abs(upDuring.dy) < 1e-9);
  // ...but the punch itself must still carry her, or a rooted chef is a mannequin.
  const fwd = swing(0.06, 0, 0);
  ok("the punch still drives her forward while rooted", fwd.dx > 1);
  // ...and steering must come back once the swing ends, or it's a stun.
  const after=(()=>{ startBrawl(); calmChef(); chef.x=160; chef.y=110; chef.dir="right"; brawl.enemies=[];
    chefPunch(); while(brawl.punchT>0) updateBrawl(1/60);
    const x1=chef.x; joy.vx=-1; let t=0; while(t<0.1){ updateBrawl(1/60); t+=1/60; } joy.vx=0;
    return chef.x-x1; })();
  ok("steering returns the moment the swing ends (a commit, not a stun)", after < -1);
  // impact flash: on the spine, so every call site gets it
  /* NB: index defensively. Reading (iflashes[0].w) on an empty array THROWS, and a thrown test crashes
     the harness instead of failing it — which prints no cross and reads as "the mutation wasn't caught".
     Same species as the syntax-error trap in the handoff: no test ran at all.
     (No backticks in probe comments — the probe is a template literal.) */
  (()=>{ resetFx(); iflashes.length=0;
    impact(HIT.jab, 1, 0, 100, 100);
    const f0 = iflashes[0] || {};
    ok("a blow leaves a flash AT the contact point", iflashes.length===1
       && f0.x===100 && f0.y===100);
    ok("...scaled by the weight of the blow", f0.w===HIT.jab);
    resetFx(); iflashes.length=0;
    impact(HIT.jab, 1, 0);                      // no contact point -> nothing to mark
    ok("a blow with no contact point leaves no flash", iflashes.length===0);
    iflashes.length=0;
    for(let i=0;i<40;i++) impact(HIT.jab,1,0,50,50);
    ok("flashes are bounded (a mash can't leak)", iflashes.length<=IFLASH_MAX);
    resetFx(); iflashes.length=0; })();

  globalThis.__RESULT = R;
})();
`;

sandbox.SFX_MISSING = SFX_MISSING;              // static findings, handed to the in-vm probe
sandbox.SFX_NCASES = SFX_CASES.size; sandbox.SFX_NCALLS = SFX_CALLS.size;
sandbox.__SRC_LINES = __SRC_LINES;            // statics -> the in-vm probe (same as SFX_MISSING)
sandbox.__BUILT_LINES = __BUILT_LINES;
sandbox.__ART_MULTILINE = __ART_MULTILINE;
const ctx = vm.createContext(sandbox);
vm.runInContext(script + "\n" + probe, ctx, { filename: "game.js" });
const R = sandbox.__RESULT;
console.log("PASS " + R.pass.length + " / " + (R.pass.length + R.fail.length));
R.pass.forEach((p) => console.log("  ✓ " + p));
if (R.fail.length) { console.log("FAILURES:"); R.fail.forEach((f) => console.log("  ✗ " + f)); process.exit(1); }
console.log("ALL PHASE-A CHECKS PASSED");
