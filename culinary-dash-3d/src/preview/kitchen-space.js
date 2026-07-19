// Maps the service sim's 2D pixel space (320x180, see sim/data.js) into the 2.5D
// kitchen's world coordinates, so the visuals sit exactly where the sim's logic
// thinks the stations, tables and chef are. Render scale keeps the floor a
// comfortable diorama size instead of the sim's raw 32x18 units.
import { PX } from '../sim/data.js';

export const RS = 0.5;                                  // px -> world render scale
export const rpos = (x, y) => ({ x: (x - 160) / PX * RS, z: (y - 90) / PX * RS });
export const rlen = (px) => (px / PX) * RS;
