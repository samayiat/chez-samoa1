// Kitchen SFX — the 2D game's beep-synth palette (culinary-dash_src sfx()),
// ported note-for-note so both halves of the hybrid share one voice. Pure
// WebAudio, no assets; tolerant of a missing or suspended AudioContext (call
// initSfx() from a user gesture to unlock it).
let ac = null;

export function initSfx() {
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac && ac.state === 'suspended') ac.resume();
  } catch (e) { ac = null; }
}

function beep(freq, dur, type = 'square', gain = 0.1, slideTo) {
  if (!ac) return;
  try {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
  } catch (e) { /* keep cooking */ }
}

function arp(notes, stepMs, dur, type, gain) {
  notes.forEach((f, i) => setTimeout(() => beep(f, dur, type, gain), i * stepMs));
}

// the palette — names match the sim's sound cues (state.sounds)
export function sfx(name) {
  switch (name) {
    case 'grab':    beep(720, 0.06, 'square', 0.12, 940); break;                                  // snatched off the ice
    case 'plate':   beep(520, 0.07, 'square', 0.10); break;                                       // dish onto the plate (2D "take")
    case 'cook':    beep(170, 0.14, 'sawtooth', 0.07, 110); break;                                // burner catches
    case 'serve':   beep(660, 0.08, 'square', 0.13, 880); setTimeout(() => beep(990, 0.09, 'square', 0.11), 55); break;
    case 'perfect': arp([660, 880, 1175, 1568], 60, 0.1, 'square', 0.13); break;
    case 'order':   beep(440, 0.06, 'triangle', 0.08); break;                                     // menu goes down (2D "seat")
    case 'walkout': beep(320, 0.22, 'square', 0.11, 150); break;
    case 'burnt':   beep(120, 0.28, 'sawtooth', 0.12, 60); break;
    case 'dayend':  arp([523, 659, 784, 1047, 1319], 110, 0.16, 'square', 0.12); break;           // closing-time fanfare
  }
}
