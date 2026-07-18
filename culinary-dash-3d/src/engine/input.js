// Input: keyboard + gamepad, unified into one intent object per frame.
// Mirrors the 2D game's "gamepad is a first-class input" rule — deadzone on the
// stick MAGNITUDE (not per-axis, which makes diagonals sticky), and edge-detected
// action presses so a held button fires once.

import { getTouch } from './touch.js';

const keys = new Set();
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  KeyE: 'primary', Space: 'primary', Enter: 'primary',
  KeyJ: 'secondary', ShiftLeft: 'secondary',
};

export function initInput(target = window) {
  target.addEventListener('keydown', (e) => {
    if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); e.preventDefault(); }
  });
  target.addEventListener('keyup', (e) => {
    if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]);
  });
  // release everything if focus is lost, so a held key can't stick
  target.addEventListener('blur', () => keys.clear());
}

// edge state for action buttons (both sources folded together)
const prev = { primary: false, secondary: false };
const DEAD = 0.22;

function readPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) if (p) return p;
  return null;
}

// Returns { move:{x,y}, primary, secondary, primaryDown, secondaryDown }.
// move.y is -1 for "up the room" (toward the back counter).
export function pollInput() {
  let x = 0, y = 0;
  if (keys.has('left')) x -= 1;
  if (keys.has('right')) x += 1;
  if (keys.has('up')) y -= 1;
  if (keys.has('down')) y += 1;

  let primary = keys.has('primary');
  let secondary = keys.has('secondary');

  // on-screen touch stick + button
  const t = getTouch();
  if (Math.hypot(t.x, t.y) > 0.01) { x += t.x; y += t.y; }
  if (t.primary) primary = true;
  if (t.secondary) secondary = true;

  const pad = readPad();
  if (pad) {
    let ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    if (Math.hypot(ax, ay) > DEAD) { x += ax; y += ay; }
    // dpad (standard mapping buttons 12-15)
    if (pad.buttons[12]?.pressed) y -= 1;
    if (pad.buttons[13]?.pressed) y += 1;
    if (pad.buttons[14]?.pressed) x -= 1;
    if (pad.buttons[15]?.pressed) x += 1;
    if (pad.buttons[0]?.pressed) primary = true;   // A
    if (pad.buttons[2]?.pressed) secondary = true; // X
  }

  const mag = Math.hypot(x, y);
  if (mag > 1) { x /= mag; y /= mag; }

  const out = {
    move: { x, y },
    primary, secondary,
    primaryDown: primary && !prev.primary,
    secondaryDown: secondary && !prev.secondary,
  };
  prev.primary = primary;
  prev.secondary = secondary;
  return out;
}
