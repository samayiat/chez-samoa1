// Quality tier detection. The single biggest cost on device is fragment/
// fill-rate: rendering at a high device-pixel-ratio with MSAA. We pick a tier
// once at startup and let the renderer + mesh builders scale down on weaker
// hardware. An adaptive step (in main.js) lowers resolution further under load.

const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
const denseDpr = (window.devicePixelRatio || 1) > 2;

// low tier = anything that looks like a phone/handheld (touch, coarse pointer,
// or a high-density display). Desktops with a mouse stay on the high tier.
export const LOW = coarse || touch || denseDpr;
export const TIER = LOW ? 'low' : 'high';

// Renderer pixel-ratio cap. Native retina (2x+) with MSAA buys almost nothing
// for these flat shapes and costs 4x the fragments.
export const PIXEL_CAP = LOW ? 1.0 : 1.5;
export const ANTIALIAS = !LOW;
export const OUTLINES = !LOW;   // inverted-hull outlines only on the high tier
export const RIM_LIGHT = !LOW;  // second directional light only on the high tier
