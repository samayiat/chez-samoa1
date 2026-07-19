// Maps the service sim's 2D pixel space (see sim/data.js WORLD) into the 2.5D
// kitchen's world coordinates, centred on the room, so the visuals sit exactly
// where the sim's logic thinks the stations, tables and chef are.
import { PX, WORLD } from '../sim/data.js';

export const RS = 0.42;                                            // px -> world render scale
export const rpos = (x, y) => ({ x: (x - WORLD.w / 2) / PX * RS, z: (y - WORLD.h / 2) / PX * RS });
export const rlen = (px) => (px / PX) * RS;
