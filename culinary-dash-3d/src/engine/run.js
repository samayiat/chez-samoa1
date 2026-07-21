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
