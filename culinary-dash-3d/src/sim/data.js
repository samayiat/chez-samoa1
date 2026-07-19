// Game data + tunables, ported from the 2D Culinary Dash source
// (culinary-dash/culinary-dash_src.html). Values are kept faithful to the
// original so the feel carries over; only the coordinate space is remapped.
//
// The 2D game lives in a 320x180 pixel room. We map that to a 3D floor on the
// XZ plane, 1 world unit = 10 px, centred on the origin:
//     x3 = (x2 - 160) / PX,   z3 = (y2 - 90) / PX
// so the floor spans x:[-16,16], z:[-9,9]. Y is up.

export const PX = 10;
// 2.5D lifts the old 320x180 ceiling — the diner floor can breathe now, with room
// for a real prep line (chopping) and more tables.
export const WORLD = { w: 400, h: 240 };

export const to3 = (x2, y2) => ({ x: (x2 - WORLD.w / 2) / PX, z: (y2 - WORLD.h / 2) / PX });
export const len2 = (x2) => x2 / PX; // scalar length px -> units

// --- Dishes (ported from DISHES, src line 137) -----------------------------
// make: "assemble" (combine ingredients), "timing" (cook with a green window),
// "source" (fetch a raw ingredient that `starts` another dish).
export const DISHES = {
  // salad is a multi-step dish now: chop the veg at the cutting board, carry the
  // chopped veg to the salad bar, then plate. (make:'prep' = needs a prepped ingredient.)
  salad:          { label: 'garden salad', make: 'prep', station: 'salad', prepAt: 'cutboard', pts: { perfect: 14 }, recipe: ['lettuce', 'tomato'] },
  karaage:        { label: 'karaage',      make: 'timing',   station: 'fryer', pts: { perfect: 20, burnt: 8 }, recipe: ['chicken'] },
  lobster:        { label: 'lobster',      make: 'timing',   station: 'pot',   pts: { perfect: 24, burnt: 10 }, recipe: ['rawlobster'] },
  'whiskey-sour': { label: 'whiskey sour', make: 'assemble', station: 'bar',   pts: { perfect: 16 }, recipe: ['whiskey', 'sourmix'] },
  'gin-sour':     { label: 'gin sour',     make: 'assemble', station: 'bar',   pts: { perfect: 16 }, recipe: ['gin', 'sourmix'] },
};
export const MENU = Object.keys(DISHES);

// --- Stations (ported from STATIONS, src line 218) -------------------------
// Positions are original 2D px; render maps them to 3D via to3().
// Stations run along the back counter (y=52). The prep line: cutboard (chop) sits
// beside the salad bar; the ice box sits beside the pot (raw lobster -> boil).
export const STATIONS = [
  { id: 'fryer',    x: 64,  y: 52, kind: 'timing',   dish: 'karaage', verb: 'fry',  cook: 2.6, green: 1.6 },
  { id: 'cutboard', x: 128, y: 52, kind: 'prep',     dish: 'salad',   verb: 'chop', cut: 1.4 },
  { id: 'salad',    x: 184, y: 52, kind: 'assemble', dish: 'salad' },
  { id: 'icebox',   x: 248, y: 52, kind: 'source',   starts: 'lobster' },
  { id: 'pot',      x: 300, y: 52, kind: 'timing',   dish: 'lobster', verb: 'boil', cook: 3.4, green: 1.9 },
  { id: 'bar',      x: 352, y: 52, kind: 'assemble', dishes: ['whiskey-sour', 'gin-sour'] },
];

// The pass: where plated dishes wait to be served.
export const PASS = { x: 200, y: 120 };

// Dining tables — a roomier six-top floor now that 2.5D lifts the size limit.
export const TABLES = [
  { id: 't0', x: 96,  y: 160 },
  { id: 't1', x: 180, y: 182 },
  { id: 't2', x: 264, y: 160 },
  { id: 't3', x: 330, y: 156 },
  { id: 't4', x: 136, y: 206 },
  { id: 't5', x: 256, y: 206 },
];
export const TABLE_R = 8;   // solid radius, px (src line 578)

// --- Chef movement ---------------------------------------------------------
export const CHEF = {
  r: 6,               // collision radius, px
  speed: 78,          // px/s walk (the 2D game wants "brisk"; roadmap #2)
};

// --- Service timing (ported: src lines 1348-1354) --------------------------
export const HEARTS_MAX = 3;
export const PATIENCE_DRAIN = 0.10;      // hearts/sec
export const SPEED_TIP_MAX = 0.5;        // +50% tip for an instant serve
export const SPEED_TIP_WINDOW = 12;      // decays over 12s
export const ORDER_INTERVAL = [3.0, 6.0]; // seconds between new arrivals (slice)

// --- Combat / impact spine (ported: src lines 835-2321) --------------------
export const COMBAT = {
  // impact weights, ordered scuff < jab < hurt < heavy < stumble
  W: { scuff: 0.35, jab: 0.6, hurt: 1.0, heavy: 1.7, stumble: 2.4 },
  HIT_KO: 0.50,          // added on a knockdown
  HIT_BODY: 0.16,        // per extra body the swing clips (sub-linear)

  SHAKE_PER_W: 5.5, SHAKE_MAX: 15.0, SHAKE_DECAY: 22,
  STOP_PER_W: 0.11, STOP_MAX: 0.42,    // hitstop seconds

  FIGHT_FRAME_MS: 90,    // jab 270ms, cross 540ms, roundhouse 630ms
  PUNCH_BUFFER: 0.16,    // input buffered, not accelerated

  // punch hitbox: a square-cornered box in front of the chef (px)
  PUNCH_REACH: 24,       // forward along facing
  PUNCH_BACK: 5,         // behind
  PUNCH_YBAND: 30,       // lateral half-width (must stay > forward, locked)

  // knockback: KNOCKBACK*12 settles ~5px; per-move multiplier (src 2282-2294)
  KNOCKBACK: 5,
  get BRAWL_KNOCK() { return this.KNOCKBACK * 12; },
  BRAWL_REEL: 0.1,
  MOVE_KNOCK: { jab: 1, cross: 1.8, roundhouse: 3.4, uppercut: 3.0 },

  ATK_REACH: 13,         // enemy radial reach (px)
  ENEMY_HP: 3,
  CHEF_HP: 5,
  BRAWL_TRIGGER: 4,      // >4 bad orders in a day starts the brawl
};

// Three-hit combo (jab-jab-hook style). frames feed FIGHT_FRAME_MS cadence.
export const COMBO = [
  { move: 'jab',        frames: 3, weight: 'jab' },
  { move: 'cross',      frames: 6, weight: 'hurt' },
  { move: 'roundhouse', frames: 7, weight: 'heavy' },
];
