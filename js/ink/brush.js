// little ink brush for canvas. soft wet body + a bunch of bristles that each
// carry their own ink, so dry ones skip and you get the flying white look

export const INK = [27, 23, 21];
export const PLUM = [196, 58, 86];
export const OCHRE = [205, 158, 70];
export const SEAL = [184, 50, 42];

export function rng(seed = 1) {
  let a = (seed * 2654435761) >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const bump = (t, c, w) => Math.exp(-((t - c) * (t - c)) / (2 * w * w));

export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const h = (n) => { const s = Math.sin((n + seed * 131.7) * 127.1) * 43758.5453; return s - Math.floor(s); };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}

const spriteCache = new Map();
function softSprite(rgb, hardness = 0.35) {
  const key = rgb.join(',') + '|' + hardness;
  let c = spriteCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  const [r, gg, b] = rgb;
  grd.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  grd.addColorStop(hardness, `rgba(${r},${gg},${b},0.85)`);
  grd.addColorStop(0.75, `rgba(${r},${gg},${b},0.25)`);
  grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  spriteCache.set(key, c);
  return c;
}

export function stamp(ctx, x, y, r, rgb, alpha, hardness) {
  if (alpha <= 0.002 || r <= 0.2) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(softSprite(rgb, hardness), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

// catmull-rom through the points, then resampled every ~spacing px
export function samplePath(ctrl, spacing = 1.5) {
  if (ctrl.length < 2) return ctrl.map(([x, y]) => ({ x, y, t: 0 }));
  const pts = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  const dense = [];
  for (let i = 1; i < pts.length - 2; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1], [x3, y3] = pts[i + 2];
    const segLen = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(2, Math.ceil(segLen / (spacing * 0.5)));
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      dense.push([
        0.5 * (2 * x1 + (-x0 + x2) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (-x0 + 3 * x1 - 3 * x2 + x3) * t3),
        0.5 * (2 * y1 + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (-y0 + 3 * y1 - 3 * y2 + y3) * t3),
      ]);
    }
  }
  dense.push(ctrl[ctrl.length - 1]);
  // even arc length
  const out = [{ x: dense[0][0], y: dense[0][1], s: 0 }];
  let acc = 0, total = 0;
  for (let i = 1; i < dense.length; i++) {
    const d = Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
    acc += d; total += d;
    if (acc >= spacing) { out.push({ x: dense[i][0], y: dense[i][1], s: total }); acc = 0; }
  }
  const last = dense[dense.length - 1];
  if (out.length < 2 || Math.hypot(out[out.length - 1].x - last[0], out[out.length - 1].y - last[1]) > 0.3) out.push({ x: last[0], y: last[1], s: total });
  for (const p of out) p.t = total > 0 ? p.s / total : 0;
  for (let i = 0; i < out.length; i++) {
    const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)];
    let dx = b.x - a.x, dy = b.y - a.y; const l = Math.hypot(dx, dy) || 1;
    out[i].nx = -dy / l; out[i].ny = dx / l;
  }
  out.length_ = total;
  return out;
}

// width along the stroke, t is 0..1
export const PROFILE = {
  stroke: (t) => smooth(0, 0.08, t) * (1 - 0.85 * smooth(0.82, 1, t)) * (0.85 + 0.15 * Math.sin(t * Math.PI)),
  // bamboo joint, pressed at both ends
  segment: (t) => 0.86 + 0.28 * Math.exp(-t * 16) + 0.24 * Math.exp(-(1 - t) * 16),
  leaf: (t) => Math.pow(Math.sin(Math.PI * Math.pow(clamp(t), 0.62)), 0.95) * (t < 0.04 ? 0.5 + t * 12 : 1),
  // orchid leaf: fat belly, twist, smaller swell, fine tip
  orchid: (t) => clamp(0.18 + 0.82 * bump(t, 0.3, 0.14) + 0.45 * bump(t, 0.68, 0.09) + 0.12) * (1 - smooth(0.8, 1, t) * 0.97) * smooth(0, 0.05, t),
  petal: (t) => Math.pow(Math.sin(Math.PI * clamp(t)), 0.7),
  twig: (t) => (1 - 0.8 * t) * smooth(0, 0.04, t),
  flat: () => 1,
};

// yields every chunk of samples so the painter can animate it
export function* strokeGen(ctx, spec) {
  const {
    pts, width = 10, profile = PROFILE.stroke, tone = 0.9, rgb = INK,
    dry = 0.3, bleed = 0.3, side = 1, spread = 0.35, seed = 1, alpha = 1,
    body = 1, chunk = 6, spacing,
  } = spec;
  const S = samplePath(pts, spacing ?? Math.max(0.8, Math.min(2.2, width / 10)));
  if (S.length < 2) return;
  const rand = rng(seed);
  const nb = spec.bristles ?? Math.round(clamp(width / 1.3, 6, 46));
  const L = S.length_ || 1;
  const aspect = L / Math.max(1, width);
  const bristles = [];
  for (let j = 0; j < nb; j++) {
    const o = (nb === 1 ? 0 : (j / (nb - 1)) * 2 - 1) + (rand() - 0.5) * (1.6 / nb);
    const edge = Math.abs(o);
    bristles.push({
      o,
      ink: 1 + rand() * 0.4 - edge * 0.25 * dry,
      // ink lost over the whole stroke
      rate: dry * (1.2 + 0.03 * aspect) * (0.55 + rand() * 0.9) * (1 + 0.9 * edge),
      tone: 1 - spread * clamp((o * side + 1) / 2),
      jit: rand() * 1000,
      wf: 0.55 + rand() * rand() * 2.2,
      px: null, py: null,
    });
  }
  const sprite = softSprite(rgb, 0.3);
  const [r, g, b] = rgb;
  const bodyAlpha = tone * alpha * body * (0.07 + 0.17 * (1 - dry));
  const bleedAlpha = tone * alpha * bleed * 0.03;

  // wet blot where the brush lands
  const w0 = width * Math.max(0.35, profile(0.03));
  stamp(ctx, S[0].x, S[0].y, w0 * (0.6 + bleed * 0.5), rgb, tone * alpha * (0.12 + bleed * 0.1));

  for (let i0 = 0; i0 < S.length; i0 += chunk) {
    const i1 = Math.min(S.length - 1, i0 + chunk);
    // chunks share their last sample, only draw it once
    const bEnd = i1 === S.length - 1 ? i1 : i1 - 1;
    for (let i = i0; i <= bEnd; i++) {
      const p = S[i];
      const w = width * profile(p.t);
      if (w < 0.3) continue;
      if (bodyAlpha > 0) {
        ctx.globalAlpha = Math.min(1, bodyAlpha * (0.7 + 0.3 * rand()));
        const rr = w * 0.56;
        ctx.drawImage(sprite, p.x - rr, p.y - rr, rr * 2, rr * 2);
      }
      if (bleedAlpha > 0 && i % 3 === 0) {
        ctx.globalAlpha = bleedAlpha * (0.5 + rand());
        const rr = w * (0.75 + bleed * 0.5) + 1.5;
        ctx.drawImage(sprite, p.x - rr + (rand() - 0.5) * 2, p.y - rr + (rand() - 0.5) * 2, rr * 2, rr * 2);
      }
    }
    ctx.globalAlpha = 1;
    // butt caps, round ones double up where chunks meet
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    const wMid = width * profile(S[Math.min(S.length - 1, (i0 + i1) >> 1)].t);
    const lw = Math.max(0.45, (wMid / nb) * 2.4);
    const thin = 0.5 + 0.5 * Math.min(1, wMid / (width * 0.6));
    for (const br of bristles) {
      let pen = false, any = false;
      ctx.beginPath();
      for (let i = i0; i <= i1; i++) {
        const p = S[i];
        const w = width * profile(p.t);
        const wob = (noise1(p.s * 0.08 + br.jit, 3) - 0.5) * 0.18;
        const x = p.x + p.nx * (br.o + wob) * w * 0.5;
        const y = p.y + p.ny * (br.o + wob) * w * 0.5;
        const skip = br.ink < 0.35 && noise1(p.s * 0.35 + br.jit, 7) > br.ink * 2.4;
        if (br.px !== null && !skip && w > 0.25) {
          if (!pen) { ctx.moveTo(br.px, br.py); pen = true; }
          ctx.lineTo(x, y);
          any = true;
        } else pen = false;
        br.px = x; br.py = y;
        if (i > 0) br.ink -= br.rate / S.length;
      }
      if (any) {
        const a = clamp(br.ink * 1.6) * br.tone;
        ctx.lineWidth = lw * br.wf;
        ctx.strokeStyle = `rgba(${r},${g},${b},${(tone * alpha * a * thin).toFixed(3)})`;
        ctx.stroke();
      }
    }
    yield i1 - i0 + 1;
    if (i1 >= S.length - 1) break;
  }
}

export function stroke(ctx, spec) {
  const it = strokeGen(ctx, spec);
  while (!it.next().done);
}

// moss dots, orchid hearts etc
export function* dotGen(ctx, x, y, r, { tone = 0.95, rgb = INK, seed = 1, angle = 0 } = {}) {
  const rand = rng(seed);
  const pts = [];
  const len = r * (1.2 + rand() * 0.8);
  const a = angle + (rand() - 0.5) * 0.8;
  pts.push([x - Math.cos(a) * len * 0.35, y - Math.sin(a) * len * 0.35]);
  pts.push([x + Math.cos(a) * len * 0.35, y + Math.sin(a) * len * 0.35]);
  stamp(ctx, x, y, r * 1.2, rgb, tone * 0.35, 0.5);
  yield* strokeGen(ctx, { pts, width: r * 1.9, profile: (t) => Math.pow(Math.sin(Math.PI * clamp(t * 0.9 + 0.05)), 0.5), tone, rgb, dry: 0.05, bleed: 0.5, seed, bristles: 8, chunk: 50, spacing: 0.6 });
}

// watercolour blob, pigment pools at the rim
export function wash(ctx, x, y, r, { rgb = PLUM, alpha = 0.35, seed = 1, wobble = 0.22, rim = 0.6, sx = 1, sy = 1, rot = 0 } = {}) {
  const rand = rng(seed);
  const n = 28;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 - wobble / 2 + wobble * noise1(i * 0.7 + seed, 5) + (rand() - 0.5) * 0.05);
    const px = Math.cos(a) * rr * sx, py = Math.sin(a) * rr * sy;
    pts.push([x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot)]);
  }
  const [cr, cg, cb] = rgb;
  ctx.save();
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  const grd = ctx.createRadialGradient(x, y, 0, x, y, r * Math.max(sx, sy));
  grd.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha * 0.55})`);
  grd.addColorStop(0.7, `rgba(${cr},${cg},${cb},${alpha * 0.8})`);
  grd.addColorStop(1, `rgba(${cr},${cg},${cb},${alpha})`);
  ctx.fillStyle = grd;
  ctx.shadowColor = `rgba(${cr},${cg},${cb},${alpha * 0.5})`;
  ctx.shadowBlur = r * 0.35;
  ctx.fill();
  ctx.shadowBlur = 0;
  if (rim > 0) {
    ctx.lineWidth = Math.max(0.6, r * 0.08);
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha * rim})`;
    ctx.stroke();
  }
  ctx.restore();
}

export function* blossomGen(ctx, x, y, r, { seed = 1, rgb = PLUM, open = 1, rot, alpha = 1 } = {}) {
  const rand = rng(seed);
  const a0 = rot ?? rand() * Math.PI * 2;
  const petals = open > 0.6 ? 5 : 3;
  const tilt = 0.55 + rand() * 0.45; // foreshortening
  const ca = Math.cos(a0), sa = Math.sin(a0);
  const P = (px, py) => [x + (px * ca - py * tilt * sa), y + (px * sa + py * tilt * ca)];
  for (let k = 0; k < petals; k++) {
    const ang = (k / 5) * Math.PI * 2 + (petals === 3 ? -Math.PI / 2 - 0.9 : 0) + (rand() - 0.5) * 0.25;
    const d = r * (0.52 + rand() * 0.08) * open;
    const [px, py] = P(Math.cos(ang) * d, Math.sin(ang) * d);
    wash(ctx, px, py, r * (0.52 + rand() * 0.08), { rgb, alpha: (0.28 + rand() * 0.14) * alpha, seed: seed * 7 + k, wobble: 0.18, rim: 0.9, sy: tilt * 0.9 + 0.1, rot: a0 });
    yield 4;
  }
  // heart and stamens
  stamp(ctx, x, y, r * 0.3, [224, 170, 70], 0.55 * alpha, 0.4);
  stamp(ctx, x, y, r * 0.18, [150, 40, 50], 0.5 * alpha, 0.4);
  const ns = 6 + Math.floor(rand() * 4);
  for (let k = 0; k < ns; k++) {
    const ang = rand() * Math.PI * 2;
    const len = r * (0.45 + rand() * 0.35) * open;
    const [ex, ey] = P(Math.cos(ang) * len, Math.sin(ang) * len);
    ctx.strokeStyle = `rgba(40,28,24,${0.55 * alpha})`;
    ctx.lineWidth = Math.max(0.5, r * 0.035);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + ex) / 2 + (rand() - 0.5) * r * 0.1, (y + ey) / 2 + (rand() - 0.5) * r * 0.1, ex, ey);
    ctx.stroke();
    stamp(ctx, ex, ey, Math.max(0.8, r * 0.07), INK, 0.8 * alpha, 0.6);
  }
  yield 4;
}

export function bud(ctx, x, y, r, seed = 1) {
  wash(ctx, x, y, r, { rgb: PLUM, alpha: 0.55, seed, wobble: 0.15, rim: 1, sx: 0.8, sy: 1 });
  stamp(ctx, x, y + r * 0.9, r * 0.45, INK, 0.7, 0.6);
}

// red seal, 1 to 4 characters
export function sealStamp(ctx, x, y, size, chars = '美花', { seed = 5, rot = 0, font = '"Noto Serif KR", serif', alpha = 0.92, white = true } = {}) {
  const rand = rng(seed);
  const n = chars.length;
  const cols = n > 2 ? 2 : 1;
  const rows = Math.ceil(n / cols);
  const w = size * (cols === 1 ? 0.62 : 1), h = size * (rows === 1 ? 0.62 : 1);
  const c = document.createElement('canvas');
  const pad = 4;
  c.width = Math.ceil(w + pad * 2); c.height = Math.ceil(h + pad * 2);
  const g = c.getContext('2d');
  const [sr, sg, sb] = SEAL;
  g.fillStyle = `rgb(${sr},${sg},${sb})`;
  g.beginPath();
  const rr = size * 0.06;
  g.roundRect ? g.roundRect(pad, pad, w, h, rr) : g.rect(pad, pad, w, h);
  g.fill();
  // white means the characters are carved out of the red
  g.globalCompositeOperation = white ? 'destination-out' : 'source-over';
  g.fillStyle = white ? '#000' : `rgb(${sr},${sg},${sb})`;
  const cell = Math.min(w / cols, h / rows);
  g.font = `900 ${cell * 0.78}px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // right column first, top to bottom
  for (let i = 0; i < n; i++) {
    const col = cols - 1 - Math.floor(i / rows);
    const row = i % rows;
    g.fillText(chars[i], pad + (col + 0.5) * (w / cols), pad + (row + 0.54) * (h / rows));
  }
  g.lineWidth = Math.max(1, size * 0.03);
  g.strokeRect(pad + size * 0.05, pad + size * 0.05, w - size * 0.1, h - size * 0.1);
  // wear it down: speckles, then ragged edges
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < size * 1.4; i++) {
    g.globalAlpha = 0.3 + rand() * 0.7;
    g.beginPath();
    g.arc(pad + rand() * w, pad + rand() * h, rand() * size * 0.018 + 0.3, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 60; i++) {
    const t = rand();
    const e = Math.floor(rand() * 4);
    const px = e < 2 ? pad + t * w : (e === 2 ? pad : pad + w);
    const py = e >= 2 ? pad + t * h : (e === 0 ? pad : pad + h);
    g.globalAlpha = 0.5 + rand() * 0.5;
    g.beginPath();
    g.arc(px, py, rand() * size * 0.025 + 0.4, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(c, -c.width / 2, -c.height / 2);
  ctx.restore();
}

// runs queued generators a bit each frame
export class Painter {
  constructor(ctx, { speed = 60 } = {}) {
    this.ctx = ctx;
    this.queue = [];
    this.speed = speed;
    this.current = null;
    this.running = false;
    this.token = 0;
  }
  add(genOrFn) { this.queue.push(genOrFn); return this; }
  pause(frames) { const self = this; this.queue.push(function* () { for (let i = 0; i < frames; i++) yield self.speed; }); return this; }
  clear() { this.queue = []; this.current = null; this.token++; }
  // false once the queue is empty
  step(budget = this.speed) {
    let spent = 0;
    while (spent < budget) {
      if (!this.current) {
        const next = this.queue.shift();
        if (!next) return false;
        this.current = typeof next === 'function' ? next() : next;
        if (!this.current || typeof this.current.next !== 'function') { this.current = null; continue; }
      }
      const r = this.current.next();
      if (r.done) { this.current = null; continue; }
      spent += r.value || 1;
    }
    return true;
  }
  run(onDone) {
    const token = ++this.token;
    this.running = true;
    const tick = () => {
      if (token !== this.token) return;
      if (this.step()) requestAnimationFrame(tick);
      else { this.running = false; onDone && onDone(); }
    };
    requestAnimationFrame(tick);
  }
  finish() { while (this.step(1e6)); }
}
