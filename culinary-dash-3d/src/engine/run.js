// The RUN — the state that survives the page hop between the kitchen
// (/kitchen/) and the fight (/vince/): day number, banked money, total plates
// served. Stored in localStorage (both pages share the origin), with an
// in-memory fallback so headless runs and tests never throw.
const KEY = 'chez.run.v1';
let mem = null;

export const freshRun = () => ({ day: 1, money: 0, served: 0 });

export function loadRun() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    if (r && r.day >= 1) return { ...freshRun(), ...r };
  } catch (e) { /* no storage (headless) -> memory */ }
  return mem ? { ...mem } : freshRun();
}

export function saveRun(r) {
  mem = { ...r };
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* memory only */ }
  return mem;
}

export function clearRun() {
  mem = null;
  try { localStorage.removeItem(KEY); } catch (e) { /* fine */ }
}

// Chef choice ('f' | 'm') — separate from the run so it survives an eviction.
const CHEF_KEY = 'chez.chef';
let chefMem = 'f';
export function loadChef() {
  try { const v = localStorage.getItem(CHEF_KEY); if (v === 'f' || v === 'm') return v; } catch (e) {}
  return chefMem;
}
export function saveChef(v) { chefMem = v; try { localStorage.setItem(CHEF_KEY, v); } catch (e) {} }
