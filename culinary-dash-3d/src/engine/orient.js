// Forced landscape. In portrait the page CSS rotates <body> 90° (see the game
// HTML), so the game always RENDERS landscape — no "rotate your device" gate.
// These helpers give the effective landscape viewport size and map raw screen
// coordinates/vectors into the rotated frame for pointer input.
//
// The CSS is `rotate(90deg) translate(0,-100%)` from the top-left, under which a
// screen point (sx, sy) lands at rotated-frame (sy, innerWidth - sx), and a
// screen vector (dx, dy) becomes (dy, -dx).
export const isPortrait = () => innerHeight > innerWidth;
export const vw = () => (isPortrait() ? innerHeight : innerWidth);
export const vh = () => (isPortrait() ? innerWidth : innerHeight);
export const mapPoint = (x, y) => (isPortrait() ? { x: y, y: innerWidth - x } : { x, y });
export const mapVec = (dx, dy) => (isPortrait() ? { x: dy, y: -dx } : { x: dx, y: dy });
