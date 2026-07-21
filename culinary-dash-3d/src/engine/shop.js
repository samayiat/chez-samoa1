// The back office — the 2D game's between-days shop (UPGRADES + STAT_DEFS),
// ported and re-priced for this economy (dishes pay $14-24, rent starts at $40).
// One-shot upgrades tune the service day; leveled combat stats are the lever
// that wins fights. Everything is neutral at zero — an empty run plays exactly
// like the game before the shop existed.

export const UPGRADES = [
  { id: 'tipjar', name: 'Bigger Tip Jar', desc: '+15% tips',                cost: 60 },
  { id: 'stools', name: 'Comfy Stools',   desc: 'patience drains slower',   cost: 50 },
  { id: 'neon',   name: 'Neon Sign',      desc: 'busier house, more money', cost: 80 },
];

export const STATS = [
  { id: 'hp',   name: 'Iron Gut',    desc: '+1 heart in every fight', base: 45, cap: 2 },
  { id: 'pow',  name: 'Heavy Hands', desc: '+1 punch damage',         base: 70, cap: 2 },
  { id: 'feet', name: 'Quick Feet',  desc: '+8% move speed',          base: 40, cap: 3 },
];

export const statCost = (id, lvl) => {
  const d = STATS.find((s) => s.id === id);
  return d ? d.base * (lvl + 1) : 0;      // each level costs more (2D statCost)
};

// Collapse a run's purchases into the multipliers/bonuses the sim consumes.
// The 2D mapping: tipjar 1.15x tips, stools 0.78x patience drain, neon 0.8x
// spawn gaps; hp/pow are flat fight bonuses, feet a speed multiplier.
export function modsFor(run) {
  const up = (run && run.upgrades) || {};
  const st = (run && run.stats) || {};
  return {
    tip: up.tipjar ? 1.15 : 1,
    patience: up.stools ? 0.78 : 1,
    spawn: up.neon ? 0.8 : 1,
    hp: st.hp || 0,
    pow: st.pow || 0,
    speed: 1 + 0.08 * (st.feet || 0),
  };
}

export const NEUTRAL_MODS = modsFor(null);
