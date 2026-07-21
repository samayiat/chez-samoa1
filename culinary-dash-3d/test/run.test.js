import { describe, it, expect } from 'vitest';
import { loadRun, saveRun, clearRun, freshRun } from '../src/engine/run.js';

// node has no localStorage — the module's in-memory fallback carries these
describe('the run (day/money persistence)', () => {
  it('starts fresh at day 1 with nothing banked', () => {
    clearRun();
    expect(loadRun()).toEqual(freshRun());
  });
  it('round-trips a banked day and advances', () => {
    clearRun();
    const r = loadRun();
    saveRun({ ...r, money: 120, served: 6 });
    const after = loadRun();
    expect(after.money).toBe(120);
    saveRun({ ...after, day: after.day + 1 });
    expect(loadRun().day).toBe(2);
    clearRun();
    expect(loadRun().day).toBe(1);
  });
});
