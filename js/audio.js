// gayageum-ish pluck (karplus-strong) and some little sound effects. silent until sound is switched on

// pentatonic, sol la do re mi, in Hz
const SCALE = [196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

let ctx = null;
let master = null;
let enabled = false;
const buffers = new Map();

function impulse(seconds = 2.4) {
  const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  return buf;
}

function init() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  const verb = ctx.createConvolver();
  verb.buffer = impulse();
  const wet = ctx.createGain(); wet.gain.value = 0.32;
  const dry = ctx.createGain(); dry.gain.value = 0.85;
  master.connect(dry).connect(ctx.destination);
  master.connect(verb).connect(wet).connect(ctx.destination);
}

function pluckBuffer(freq) {
  const key = Math.round(freq);
  if (buffers.has(key)) return buffers.get(key);
  const rate = ctx.sampleRate, N = Math.floor(rate * 3.2);
  const buf = ctx.createBuffer(1, N, rate);
  const out = buf.getChannelData(0);
  const period = Math.max(2, Math.round(rate / freq));
  const ring = new Float32Array(period);
  // brighter in the middle, a bit like a finger pluck
  for (let i = 0; i < period; i++) ring[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin((Math.PI * i) / period));
  let idx = 0;
  const decay = 0.9965;
  for (let i = 0; i < N; i++) {
    const a = ring[idx], b = ring[(idx + 1) % period];
    ring[idx] = decay * (0.52 * a + 0.48 * b);
    out[i] = a;
    idx = (idx + 1) % period;
  }
  buffers.set(key, buf);
  return buf;
}

export function setSound(on) {
  enabled = on;
  if (on) {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
}

export function soundOn() { return enabled; }

// i is an index into SCALE, wraps around
export function pluck(i = Math.floor(Math.random() * SCALE.length), { gain = 0.22, pan = 0 } = {}) {
  if (!enabled || !ctx) return;
  const freq = SCALE[((i % SCALE.length) + SCALE.length) % SCALE.length];
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = pluckBuffer(freq);
  // nonghyeon: let it settle, then a slow vibrato that gets wider
  const rate = src.playbackRate;
  rate.setValueAtTime(1.0, now);
  const vib = new Float32Array(64);
  for (let k = 0; k < 64; k++) { const t = k / 63; vib[k] = 1 + Math.sin(t * Math.PI * 7) * 0.012 * t; }
  rate.setValueCurveAtTime(vib, now + 0.35, 1.8);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(3800, now);
  lp.frequency.exponentialRampToValueAtTime(900, now + 2.2);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gain, now + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0008, now + 3);
  let node = src.connect(lp).connect(g);
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
  node.connect(master);
  src.start(now);
  src.stop(now + 3.1);
}

export function phrase(start = 2) {
  [0, 1, 2, 4].forEach((d, k) => setTimeout(() => pluck(start + d, { gain: 0.16 }), k * 140));
}

export function shutter({ gain = 0.35 } = {}) {
  if (!enabled || !ctx) return;
  const now = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * 0.03);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
  [0, 0.075].forEach((off, k) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = k ? 2600 : 1700;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.value = gain * (k ? 0.7 : 1);
    src.connect(bp).connect(g).connect(master);
    src.start(now + off);
  });
}

function noiseBuffer(seconds, shape = 4) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, shape);
  return buf;
}

// crack, thump, then the echo rolling off the hills
export function shot({ gain = 0.5, pan = 0 } = {}) {
  if (!enabled || !ctx) return;
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = gain;
  let node = out;
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; out.connect(p); node = p; }
  node.connect(master);
  const crack = ctx.createBufferSource();
  crack.buffer = noiseBuffer(0.12, 7);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
  const cg = ctx.createGain(); cg.gain.value = 0.9;
  crack.connect(hp).connect(cg).connect(out);
  crack.start(now);
  const thump = ctx.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(110, now);
  thump.frequency.exponentialRampToValueAtTime(38, now + 0.25);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.9, now);
  tg.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  thump.connect(tg).connect(out);
  thump.start(now); thump.stop(now + 0.4);
  const roll = ctx.createBufferSource();
  roll.buffer = noiseBuffer(1.6, 2.2);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
  const rg = ctx.createGain();
  rg.gain.setValueAtTime(0.0001, now);
  rg.gain.exponentialRampToValueAtTime(0.5, now + 0.09);
  rg.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
  roll.connect(lp).connect(rg).connect(out);
  roll.start(now + 0.03);
}

// bullet ringing a steel plate somewhere far off
export function ping({ gain = 0.22, delay = 0 } = {}) {
  if (!enabled || !ctx) return;
  const now = ctx.currentTime + delay;
  [1, 2.76, 5.4].forEach((m, k) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 820 * m;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain / (k + 1), now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4 / (k + 1));
    o.connect(g).connect(master);
    o.start(now); o.stop(now + 1.5);
  });
}

export function glass({ gain = 0.25, delay = 0 } = {}) {
  if (!enabled || !ctx) return;
  const now = ctx.currentTime + delay;
  for (let k = 0; k < 7; k++) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.05 + Math.random() * 0.08, 5);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600 + Math.random() * 4200;
    bp.Q.value = 8;
    const g = ctx.createGain();
    g.gain.value = gain * (0.5 + Math.random() * 0.5);
    src.connect(bp).connect(g).connect(master);
    src.start(now + k * 0.018 + Math.random() * 0.03);
  }
}

// purr: low rumble pulsing ~25 times a second
export function purr({ gain = 0.22, seconds = 1.4 } = {}) {
  if (!enabled || !ctx) return;
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(seconds, 0.4);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
  const am = ctx.createGain(); am.gain.value = 0;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 25;
  const depth = ctx.createGain(); depth.gain.value = 0.5;
  const bias = ctx.createConstantSource ? ctx.createConstantSource() : null;
  lfo.connect(depth).connect(am.gain);
  if (bias) { bias.offset.value = 0.5; bias.connect(am.gain); bias.start(now); bias.stop(now + seconds); }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.25);
  g.gain.setValueAtTime(gain, now + seconds - 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  src.connect(lp).connect(am).connect(g).connect(master);
  lfo.start(now); lfo.stop(now + seconds);
  src.start(now);
}

export function meow({ gain = 0.16 } = {}) {
  if (!enabled || !ctx) return;
  const now = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(520, now);
  o.frequency.linearRampToValueAtTime(820, now + 0.18);
  o.frequency.linearRampToValueAtTime(600, now + 0.42);
  o.frequency.linearRampToValueAtTime(430, now + 0.62);
  const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 6;
  f1.frequency.setValueAtTime(900, now);
  f1.frequency.linearRampToValueAtTime(1500, now + 0.2);
  f1.frequency.linearRampToValueAtTime(800, now + 0.6);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.06);
  g.gain.setValueAtTime(gain * 0.8, now + 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.68);
  o.connect(f1).connect(g).connect(master);
  o.start(now); o.stop(now + 0.7);
}
