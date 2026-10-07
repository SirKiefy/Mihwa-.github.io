// ─────────────────────────────────────────────────────────────────────────────
//  A gayageum-ish pluck (Karplus–Strong) with 농현 — the gentle pitch vibrato
//  a player presses into the string after plucking. Off until the visitor asks.
// ─────────────────────────────────────────────────────────────────────────────

// 평조 pentatonic: sol · la · do · re · mi
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
  // a slightly bright, finger-plucked excitation
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

/** Play a note. `i` indexes the pentatonic scale (wraps). */
export function pluck(i = Math.floor(Math.random() * SCALE.length), { gain = 0.22, pan = 0 } = {}) {
  if (!enabled || !ctx) return;
  const freq = SCALE[((i % SCALE.length) + SCALE.length) % SCALE.length];
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = pluckBuffer(freq);
  // 농현: settle, then a slow, widening vibrato
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

/** A short rising phrase. */
export function phrase(start = 2) {
  [0, 1, 2, 4].forEach((d, k) => setTimeout(() => pluck(start + d, { gain: 0.16 }), k * 140));
}

/** A soft mechanical shutter: two short, filtered clicks. */
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
