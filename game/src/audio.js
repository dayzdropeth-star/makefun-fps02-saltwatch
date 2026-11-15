// All sound is synthesized WebAudio — no audio files. One AudioContext, reused nodes,
// short envelopes; nothing allocated per frame (buffers are built once).
export function createAudio() {
  let ctx = null, master = null, noiseBuf = null, muted = false;
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      const len = ctx.sampleRate * 1;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
    return !!ctx;
  }
  function noise(dur, filterType, freq, gainVal, when = 0) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }
  function tone(type, f0, f1, dur, gainVal, when = 0) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  const SHOTS = {
    pistol: () => { noise(0.09, 'highpass', 900, 0.5); tone('square', 220, 70, 0.08, 0.25); },
    shotgun: () => { noise(0.22, 'lowpass', 1400, 0.8); tone('sine', 120, 40, 0.22, 0.6); },
    smg: () => { noise(0.07, 'bandpass', 1800, 0.42); tone('square', 300, 90, 0.05, 0.18); },
    rifle: () => { noise(0.12, 'bandpass', 1200, 0.6); tone('square', 180, 60, 0.1, 0.3); },
    sniper: () => { noise(0.3, 'lowpass', 900, 0.85); tone('sine', 90, 30, 0.3, 0.7); },
  };
  return {
    unlock() { ensure(); },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    get muted() { return muted; },
    shot(kind) { (SHOTS[kind] || SHOTS.rifle)(); },
    dry() { tone('square', 1400, 1400, 0.03, 0.12); },
    reload() { tone('square', 500, 300, 0.05, 0.15); tone('square', 700, 500, 0.05, 0.15, 0.18); },
    step() { noise(0.05, 'lowpass', 500, 0.1); },
    hit() { tone('sine', 1200, 1200, 0.05, 0.2); },
    kill() { tone('sine', 880, 880, 0.09, 0.22); tone('sine', 1320, 1320, 0.12, 0.22, 0.09); },
    plantBeep(fast) { tone('sine', fast ? 1500 : 1000, fast ? 1500 : 1000, 0.07, 0.2); },
    boom() {
      noise(1.4, 'lowpass', 300, 1.0); tone('sine', 70, 28, 1.2, 0.9);
      noise(0.4, 'highpass', 2000, 0.4, 0.02);
    },
    sting(win) {
      const seq = win ? [523, 659, 784, 1046] : [392, 330, 262, 196];
      seq.forEach((f, i) => tone('triangle', f, f, 0.22, 0.25, i * 0.13));
    },
    buy() { tone('sine', 660, 660, 0.06, 0.2); tone('sine', 990, 990, 0.09, 0.2, 0.07); },
    click() { tone('square', 900, 900, 0.03, 0.12); },
    hurt() { tone('sawtooth', 160, 60, 0.18, 0.25); },
    flash() { noise(0.5, 'highpass', 3000, 0.25); },
  };
}
