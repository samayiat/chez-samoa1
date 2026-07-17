// Seeded, deterministic RNG (mulberry32). The sim must never touch Math.random
// or a wall clock — that's the locked rule from the 2D game that keeps lockstep
// co-op possible (docs/DECISIONS.md: "No wall-clock in the sim, ever").
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const range = (rng, lo, hi) => lo + (hi - lo) * rng();
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
