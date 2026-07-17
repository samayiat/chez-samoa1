// Fixed-step game loop with render interpolation.
// The simulation advances in fixed 1/60s ticks (deterministic; the 2D game's
// locked rule — "the loop is on a fixed step, not dt=(now-last)"). Rendering
// runs every animation frame and interpolates between the last two sim states
// so motion stays smooth even when the display refresh doesn't match 60Hz.

export const STEP = 1 / 60;
const MAX_CATCHUP = 5; // avoid spiral-of-death after a tab-stall

export function startLoop({ tick, render }) {
  let last = performance.now();
  let acc = 0;
  let raf = 0;

  function frame(now) {
    acc += Math.min((now - last) / 1000, MAX_CATCHUP * STEP);
    last = now;

    let steps = 0;
    while (acc >= STEP && steps < MAX_CATCHUP) {
      tick(STEP);
      acc -= STEP;
      steps++;
    }
    // alpha = how far we are into the next pending step, for interpolation
    render(acc / STEP, now);
    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
