// On-screen touch controls: a floating virtual stick (left) and an action
// button (right), so the game is playable on a phone with no keyboard or pad.
// The UI stays hidden until the screen is actually touched, so keyboard/gamepad
// players never see it. Uses Pointer Events, so the stick and button can be held
// at the same time (distinct pointerIds).

const stickState = { x: 0, y: 0, primary: false, secondary: false };
let shown = false;

export function getTouch() { return stickState; }

export function initTouch(opts = {}) {
  if (!('ontouchstart' in window) && !(navigator.maxTouchPoints > 0)) return;
  const primaryLabel = opts.primaryLabel || 'PUNCH';
  const showDodge = opts.dodge !== false;

  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;z-index:6;pointer-events:none;opacity:0;transition:opacity .3s;font-family:system-ui,sans-serif';

  const base = document.createElement('div');
  base.style.cssText = 'position:absolute;width:120px;height:120px;border-radius:50%;border:2px solid rgba(255,233,199,.35);background:rgba(20,16,26,.35);display:none;transform:translate(-50%,-50%)';
  const knob = document.createElement('div');
  knob.style.cssText = 'position:absolute;left:50%;top:50%;width:52px;height:52px;border-radius:50%;background:rgba(255,217,138,.8);transform:translate(-50%,-50%)';
  base.appendChild(knob);

  const btn = document.createElement('div');
  btn.textContent = primaryLabel;
  btn.style.cssText = 'position:absolute;right:24px;bottom:40px;width:92px;height:92px;border-radius:50%;pointer-events:auto;text-align:center;padding:0 6px;'
    + 'background:radial-gradient(circle at 50% 40%,#ffd98a,#f0a83a);color:#1a1018;font-weight:800;font-size:14px;letter-spacing:.02em;line-height:1.1;'
    + 'display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(240,168,58,.35);user-select:none;touch-action:none';

  let dodge = null;
  if (showDodge) {
    dodge = document.createElement('div');
    dodge.textContent = 'DODGE';
    dodge.style.cssText = 'position:absolute;right:132px;bottom:34px;width:74px;height:74px;border-radius:50%;pointer-events:auto;'
      + 'background:radial-gradient(circle at 50% 40%,#7fc7ff,#3f7fd0);color:#08131f;font-weight:800;font-size:13px;letter-spacing:.02em;'
      + 'display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(63,127,208,.35);user-select:none;touch-action:none';
  }

  root.append(base, btn);
  if (dodge) root.append(dodge);
  document.body.appendChild(root);

  function reveal() { if (!shown) { shown = true; root.style.opacity = '1'; } }
  window.addEventListener('touchstart', reveal, { once: true });

  const RADIUS = 55;
  let moveId = null, ox = 0, oy = 0;

  window.addEventListener('pointerdown', (e) => {
    reveal();
    if (e.target === btn || e.target === dodge) return;   // the buttons handle themselves
    if (moveId !== null) return;                // one movement pointer at a time
    moveId = e.pointerId; ox = e.clientX; oy = e.clientY;
    base.style.display = 'block';
    base.style.left = ox + 'px'; base.style.top = oy + 'px';
    knob.style.transform = 'translate(-50%,-50%)';
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerId !== moveId) return;
    let dx = e.clientX - ox, dy = e.clientY - oy;
    const d = Math.hypot(dx, dy) || 1;
    const cl = Math.min(d, RADIUS);
    const nx = (dx / d), ny = (dy / d);
    stickState.x = nx * (cl / RADIUS);
    stickState.y = ny * (cl / RADIUS);
    knob.style.transform = `translate(calc(-50% + ${nx * cl}px), calc(-50% + ${ny * cl}px))`;
  });
  function endMove(e) {
    if (e.pointerId !== moveId) return;
    moveId = null; stickState.x = 0; stickState.y = 0;
    base.style.display = 'none';
  }
  window.addEventListener('pointerup', endMove);
  window.addEventListener('pointercancel', endMove);

  const press = (key, v) => (e) => { e.preventDefault(); stickState[key] = v; };
  btn.addEventListener('pointerdown', press('primary', true));
  btn.addEventListener('pointerup', press('primary', false));
  btn.addEventListener('pointercancel', press('primary', false));
  btn.addEventListener('pointerleave', press('primary', false));
  if (dodge) {
    dodge.addEventListener('pointerdown', press('secondary', true));
    dodge.addEventListener('pointerup', press('secondary', false));
    dodge.addEventListener('pointercancel', press('secondary', false));
    dodge.addEventListener('pointerleave', press('secondary', false));
  }
}
