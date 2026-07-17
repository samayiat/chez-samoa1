// Procedural sound — no audio files, all synthesized with Web Audio (the same
// approach the 2D game used). Punches read the impact spine's weight so a jab
// and a KO don't sound alike; service cues are short and friendly. The context
// starts suspended and must be resumed from a user gesture (browser policy).

export function createAudio() {
  let ctx = null;
  let master = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    return ctx;
  }

  function resume() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); }

  // a single enveloped oscillator
  function tone(freq, dur, { type = 'sine', gain = 0.3, sweep = 0, delay = 0 } = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + sweep), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  // short filtered noise burst (impacts)
  function noise(dur, { gain = 0.3, freq = 900, delay = 0 } = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t0);
  }

  const api = {
    resume,
    // impact spine hook: weight 0.3..~3 -> thud + noise, lower/louder with weight
    hit(w) {
      if (!ensure()) return;
      const k = Math.min(1.4, w);
      tone(150 - k * 55, 0.14 + k * 0.05, { type: 'sine', gain: 0.18 + k * 0.14, sweep: -60 });
      noise(0.09 + k * 0.04, { gain: 0.12 + k * 0.12, freq: 500 + w * 200 });
      if (w >= 1.0) tone(70, 0.22, { type: 'triangle', gain: 0.2, sweep: -30 }); // heavy body thump
    },
    cook()   { if (ensure()) tone(520, 0.09, { type: 'square', gain: 0.12, sweep: 120 }); },
    plate()  { if (ensure()) { tone(880, 0.12, { type: 'sine', gain: 0.16 }); tone(1320, 0.14, { type: 'sine', gain: 0.1, delay: 0.04 }); } },
    serve()  { if (ensure()) { tone(660, 0.1, { type: 'sine', gain: 0.16 }); tone(990, 0.12, { type: 'sine', gain: 0.14, delay: 0.06 }); tone(1320, 0.16, { type: 'sine', gain: 0.12, delay: 0.12 }); } },
    walkout(){ if (ensure()) tone(300, 0.3, { type: 'sawtooth', gain: 0.18, sweep: -180 }); },
    grab()   { if (ensure()) tone(240, 0.07, { type: 'triangle', gain: 0.12, sweep: 80 }); },
  };
  return api;
}
