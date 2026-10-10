// sharpshooter mini game. the valley is painted once onto a big offscreen sheet,
// and the scope follows the pointer and shows it at 4-6x through a mil-dot reticle
import { rng, noise1, smooth, stroke, dotGen, sealStamp, PROFILE } from '../ink/brush.js?v=13fb58fc16';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;

const INK = [22, 17, 15];
const INKB = [27, 23, 21];
const PAPER = [245, 239, 228];
const PAPER_L = [250, 247, 240];
const SEAL = [184, 50, 42];
const SEAL_D = [142, 35, 28];
const EARTH = [111, 101, 93];
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(a, 0, 1).toFixed(3)})`;

// ballistics, all angles in mils
const ZERO = 200; // zeroed at 200 m
const dropMil = (d) => (d <= ZERO ? 0 : 0.001714 * Math.pow(d - ZERO, 1.2));
// w is wind in m/s, positive blows to the right
const driftMil = (d, w) => 0.032 * Math.pow(d / 100, 1.45) * w;
const flightTime = (d) => d / 850;
const CYCLE = 1.05; // seconds to work the bolt

// hit boxes in mils, a bit generous
const TARGETS = [
  { id: 'bottle', d: 200, w: 0.56, h: 1.5 },
  { id: 'can', d: 350, w: 0.74, h: 0.94 },
  { id: 'paper', d: 500, w: 1.2, h: 1.2 },
  { id: 'balloon', d: 700, w: 0.86, h: 1.02 },
  { id: 'gong', d: 900, w: 1.12, h: 1.12 },
];
const TOL = 0.14;

// layouts, as fractions of the sheet
const LAYOUTS = {
  wide: {
    sun: [0.705, 0.16, 0.048],
    far1: [0.33, 0.06], far2: [0.39, 0.038], tree: [0.448, 0.015],
    tower: 0.13, mast: 0.83,
    meadow: [0.455, 0.55], hedge: [0.0, 0.56, 0.552],
    stand: [0.075, 0.532],
    gong: [0.6, 0.482], balloon: [0.31, 0.512], fenceFar: [0.16, 0.47, 0.506, 0.518],
    forest: [0.655, 1.05, 0.553], grove: [-0.03, 0.17, 0.528],
    shack: [0.8, 0.572],
    field: [0.585, 0.69], log: [0.47, 0.632],
    bales: [[0.575, 0.598, 1.6], [0.612, 0.603, 1.5], [0.385, 0.574, 1.2]],
    fenceNear: [[-0.04, 0.752], [0.44, 0.69]], bottle: 0.205,
    track: [[0.55, 1.03], [0.6, 0.84], [0.7, 0.68], [0.772, 0.584]],
    fore: 0.79, bigBirch: 0.968,
  },
  tall: {
    sun: [0.72, 0.13, 0.05],
    far1: [0.298, 0.05], far2: [0.348, 0.034], tree: [0.4, 0.013],
    tower: 0.17, mast: 0.86,
    meadow: [0.405, 0.51], hedge: null,
    stand: [0.085, 0.502],
    gong: [0.73, 0.436], balloon: [0.3, 0.482], fenceFar: [0.12, 0.52, 0.476, 0.488],
    forest: [0.5, 1.07, 0.532], grove: null,
    shack: [0.7, 0.552],
    field: [0.56, 0.675], log: [0.33, 0.618],
    bales: [[0.12, 0.585, 1.5], [0.9, 0.6, 1.6]],
    fenceNear: [[0.34, 0.742], [1.06, 0.69]], bottle: 0.64,
    track: [[0.18, 1.03], [0.26, 0.84], [0.48, 0.67], [0.67, 0.565]],
    fore: 0.8, bigBirch: null,
  },
};

// --- painting helpers (world units) ---
function blob(g, x, y, rx, ry, c, a) {
  if (rx <= 0 || ry <= 0) return;
  g.save();
  g.translate(x, y);
  g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, rgba(c, a));
  gr.addColorStop(0.5, rgba(c, a * 0.62));
  gr.addColorStop(1, rgba(c, 0));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, rx, 0, TAU);
  g.fill();
  g.restore();
}

function poly(g, pts, c, a) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fillStyle = rgba(c, a);
  g.fill();
}

// soft bled edges: draw off the sheet so only the blurred shadow lands (offset and blur in sheet px)
function softFill(g, S, build, fill, blur, c = INK) {
  const off = S.Ww + 80;
  g.save();
  g.translate(-off, 0);
  g.shadowColor = rgba(c, 1);
  g.shadowBlur = blur * S.R;
  g.shadowOffsetX = off * S.R;
  g.beginPath();
  build();
  g.fillStyle = fill;
  g.fill();
  g.restore();
}

function softPoly(g, pts, fill, blur, S, c = INK) {
  softFill(g, S, () => {
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  }, fill, blur, c);
}

function line(g, pts, w, c, a) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = w;
  g.strokeStyle = rgba(c, a);
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
}

function wire(g, x0, y0, x1, y1, sag, w, a) {
  g.lineWidth = w;
  g.strokeStyle = rgba(INK, a);
  g.beginPath();
  g.moveTo(x0, y0);
  g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag, x1, y1);
  g.stroke();
}

function brush(g, pts, width, tone, o = {}) {
  stroke(g, {
    pts, width, tone,
    dry: o.dry ?? 0.5, bleed: o.bleed ?? 0.15, seed: o.seed ?? 1,
    profile: o.profile ?? PROFILE.stroke, rgb: o.rgb ?? INKB,
    bristles: o.bristles, spread: o.spread ?? 0.35, alpha: o.alpha ?? 1,
  });
}

function moss(g, x, y, r, tone, seed) {
  const it = dotGen(g, x, y, r, { tone, seed, angle: -0.2 });
  while (!it.next().done);
}

// watercolour disc, pigment pools at the rim
function washDisc(g, x, y, r, c, a, R, seed = 1) {
  const rand = rng(seed);
  g.save();
  g.beginPath();
  for (let i = 0; i <= 48; i++) {
    const t = (i / 48) * TAU;
    const rr = r * (0.95 + 0.08 * noise1(i * 0.4 + seed, 5) + (rand() - 0.5) * 0.015);
    const px = x + Math.cos(t) * rr, py = y + Math.sin(t) * rr;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath();
  const gr = g.createRadialGradient(x - r * 0.25, y - r * 0.3, 0, x, y, r);
  gr.addColorStop(0, rgba(c, a * 0.7));
  gr.addColorStop(0.8, rgba(c, a * 0.88));
  gr.addColorStop(1, rgba(c, a));
  g.fillStyle = gr;
  g.shadowColor = rgba(c, a * 0.6);
  g.shadowBlur = r * 0.18 * R;
  g.fill();
  g.shadowBlur = 0;
  g.lineWidth = Math.max(0.3, r * 0.035);
  g.strokeStyle = rgba(c, a * 0.45);
  g.stroke();
  g.restore();
}

function ridgePts(Ww, y0, amp, seed, step = 3) {
  const pts = [];
  for (let x = -14; x <= Ww + 14; x += step) {
    const n = (noise1(x / (Ww * 0.3) + seed, 1) - 0.5) * 1.55
      + (noise1(x / (Ww * 0.08) + seed * 2.3, 2) - 0.5) * 0.55
      + (noise1(x / 7 + seed * 5.1, 3) - 0.5) * 0.05;
    pts.push([x, y0 + amp * n]);
  }
  return pts;
}

function arcPts(cx, cy, r, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n);
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

const ridgeAt = (pts, x) => {
  const step = pts[1][0] - pts[0][0];
  const i = clamp(Math.floor((x - pts[0][0]) / step), 0, pts.length - 2);
  const k = clamp((x - pts[i][0]) / step, 0, 1);
  return lerp(pts[i][1], pts[i + 1][1], k);
};

// one soft wash per range, darkest under the crest, fading into mist
function rangeBody(g, pts, depth, tone, seed, S, blur = 2.2) {
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
  const x0 = pts[0][0], x1 = pts[pts.length - 1][0];
  const gr = g.createLinearGradient(0, minY, 0, maxY + depth);
  gr.addColorStop(0, rgba(INK, tone * 0.8));
  gr.addColorStop(0.28, rgba(INK, tone * 0.45));
  gr.addColorStop(0.65, rgba(INK, tone * 0.12));
  gr.addColorStop(1, rgba(INK, 0));
  softPoly(g, [...pts, [x1, maxY + depth], [x0, maxY + depth]], gr, blur, S);
  const band = pts.slice();
  for (let i = pts.length - 1; i >= 0; i--) {
    const [x, y] = pts[i];
    band.push([x, y + depth * (0.08 + 0.2 * noise1(x * 0.012 + seed, 4))]);
  }
  softPoly(g, band, rgba(INK, tone * 0.42), blur * 1.8, S);
}

function crest(g, pts, Ww, width, tone, seed) {
  const rand = rng(seed);
  let x = -10;
  let n = 0;
  while (x < Ww) {
    const len = Ww * (0.18 + rand() * 0.2);
    const ctrl = [];
    for (let xx = x; xx <= Math.min(Ww + 12, x + len); xx += 14) ctrl.push([xx, ridgeAt(pts, xx) + 0.4]);
    if (ctrl.length > 1) brush(g, ctrl, width * (0.8 + rand() * 0.5), tone * (0.75 + rand() * 0.3), { dry: 0.75, bleed: 0.25, seed: seed + n * 13, spread: 0.5 });
    x += len * (0.82 + rand() * 0.12);
    n++;
  }
}

function mist(g, S, y0, y1, a, rand) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, rgba(PAPER, 0));
  gr.addColorStop(0.55, rgba(PAPER, a));
  gr.addColorStop(1, rgba(PAPER, 0));
  g.fillStyle = gr;
  g.fillRect(-20, y0, S.Ww + 40, y1 - y0);
  if (rand) for (let i = 0; i < 4; i++) blob(g, rand() * S.Ww, lerp(y0, y1, 0.35 + rand() * 0.4), S.Ww * (0.1 + rand() * 0.12), (y1 - y0) * 0.22, PAPER, a * 0.7);
}

function farPine(g, x, yb, h, a, rand) {
  g.beginPath();
  pinePath(g, x, yb, h, rand);
  g.fillStyle = rgba(INK, a);
  g.fill();
}

// grouped by tone so each group is one blurred wash
function pineWash(g, S, items, blur = 0.35) {
  const buckets = new Map();
  for (const it of items) {
    const k = Math.round(it.a * 20) / 20;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(it);
  }
  for (const [a, list] of buckets) {
    const rand = rng(Math.round(a * 1000) + list.length);
    softFill(g, S, () => { for (const it of list) pinePath(g, it.x, it.yb, it.h, rand); }, rgba(INK, a), blur);
  }
}

function pinePath(g, x, yb, h, rand) {
  const w = h * (0.3 + rand() * 0.12);
  const n = clamp(Math.round(h / 3.2), 3, 9);
  const L = [], Rt = [];
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    const y = yb - h + h * 0.93 * f;
    const ww = (w / 2) * Math.pow(f, 0.9);
    Rt.push([x + ww * (0.85 + rand() * 0.35), y], [x + ww * 0.42, y + h * 0.035]);
    L.push([x - ww * (0.85 + rand() * 0.35), y], [x - ww * 0.42, y + h * 0.035]);
  }
  g.moveTo(x + (rand() - 0.5) * h * 0.04, yb - h);
  Rt.forEach((p) => g.lineTo(p[0], p[1]));
  g.lineTo(x + w * 0.05, yb + h * 0.06);
  g.lineTo(x - w * 0.05, yb + h * 0.06);
  for (let i = L.length - 1; i >= 0; i--) g.lineTo(L[i][0], L[i][1]);
  g.closePath();
}

// the brush engine counts in pixels and the sheet is drawn R times bigger
const bristlesFor = (w, R) => clamp(Math.round((w * R) / 1.4), 5, 24);

// pale silhouette, thin trunk, then tiers of side dabs that dry out toward the tips
function spruce(g, x, yb, h, tone, rand, S) {
  const seed = (rand() * 1e5) | 0;
  const lean = (rand() - 0.5) * 0.04;
  const R = S.R;
  softFill(g, S, () => pinePath(g, x, yb, h * 0.98, rand), rgba(INK, tone * 0.13), Math.max(0.5, h * 0.014));
  farPine(g, x + lean * h * 0.3, yb - h * 0.02, h * 0.88, tone * 0.09, rand);
  brush(g, [[x, yb + h * 0.03], [x + lean * h * 0.5, yb - h * 0.5], [x + lean * h, yb - h * 0.99]], Math.max(0.45, h * 0.012), tone * 0.92,
    { profile: PROFILE.twig, dry: 0.3, seed, bristles: bristlesFor(h * 0.012, R) });
  const n = clamp(Math.round(h / 3), 8, 32);
  let f = 0.03, i = 0;
  while (f < 0.94) {
    const ty = yb - h * f, tx = x + lean * h * f;
    const half = h * 0.21 * Math.pow(1 - f, 0.95) + h * 0.016;
    for (const side of [-1, 1]) {
      if (f < 0.85 && rand() < 0.07) continue;
      const len = half * (0.6 + rand() * 0.6);
      const droop = len * ((0.14 + rand() * 0.24) * (1.45 - f) - (f > 0.75 ? 0.2 : 0));
      const k = len > h * 0.1 ? 3 : len > h * 0.05 ? 2 : 1;
      const yo = (rand() - 0.5) * h * 0.012;
      for (let j = 0; j < k; j++) {
        const a0 = (j / k) * 0.85, a1 = Math.min(1, (j + 1.35) / k);
        const P = (a) => [tx + side * len * a, ty + yo + droop * a * a + (rand() - 0.5) * h * 0.004];
        const w = Math.min(h * (0.024 - 0.008 * f) * (1.1 - 0.45 * a0) * (0.75 + rand() * 0.5), len * (a1 - a0) * 0.42);
        const tn = tone * (0.95 - 0.5 * a0) * (0.65 + rand() * 0.4) * (1 - 0.35 * smooth(0.7, 0.95, f));
        brush(g, [P(a0), P((a0 + a1) / 2), P(a1)], w, tn,
          { profile: PROFILE.leaf, dry: 0.4 + 0.4 * a0, bleed: 0.22, seed: seed + i * 11 + j * 3 + (side > 0 ? 1 : 0), spread: 0.5, bristles: bristlesFor(w, R) });
      }
    }
    f += (0.95 / n) * (0.55 + rand() * 0.9);
    i++;
  }
}

function quadAt(p0, p1, p2, t) {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
}

function birch(g, x, yb, h, tone, rand, lean = 0) {
  const seed = (rand() * 1e5) | 0;
  const tw = Math.max(1, h * 0.028);
  const p0 = [x, yb], p2 = [x + lean * h, yb - h], p1 = [x + lean * h * 0.4 + (rand() - 0.5) * h * 0.05, yb - h * 0.5];
  const leafR = clamp(h * 0.0085, 0.45, 1.7);
  const nb = h > 200 ? 12 : 7;
  const clusters = [];
  for (let i = 0; i < nb; i++) {
    const f = 0.4 + (i / nb) * 0.55 + rand() * 0.05;
    const [bx, by] = quadAt(p0, p1, p2, f);
    const side = i % 2 ? -1 : 1;
    const len = h * (0.07 + rand() * 0.1) * (1.15 - f * 0.5);
    const end = [bx + side * len, by - len * 0.05 + len * 0.35 * rand()];
    brush(g, [[bx, by], [bx + side * len * 0.5, by - len * 0.32], end], Math.max(0.35, tw * 0.09), tone * 0.7, { profile: PROFILE.twig, dry: 0.7, seed: seed + i, bristles: 3 });
    for (let k = 0; k < 2; k++) {
      const q = quadAt([bx, by], [bx + side * len * 0.5, by - len * 0.32], end, 0.45 + k * 0.3);
      line(g, [q, [q[0] + side * len * 0.12, q[1] + len * 0.18], [q[0] + side * len * 0.16, q[1] + len * 0.32]], Math.max(0.2, tw * 0.03), INK, tone * 0.45);
    }
    clusters.push([bx + side * len * 0.55, by - len * 0.12, len * 0.6], [end[0], end[1] + len * 0.1, len * 0.45]);
  }
  clusters.push([p2[0], p2[1] + h * 0.06, h * 0.08]);
  for (const [cx, cy, cr] of clusters) blob(g, cx, cy + cr * 0.15, cr * 1.1, cr * 0.75, INK, tone * 0.07);
  for (const [cx, cy, cr] of clusters) {
    const n = Math.round(clamp(cr / leafR, 4, 26) * 3.6);
    for (let k = 0; k < n; k++) {
      const a = rand() * TAU, d = Math.sqrt(rand()) * cr;
      const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * 0.7 + d * 0.2;
      const r = leafR * (0.6 + rand() * 0.7);
      g.fillStyle = rgba(INK, tone * (0.14 + rand() * 0.34));
      g.beginPath();
      g.ellipse(px, py, r, r * 0.55, (rand() - 0.5) * 1.4 + 0.5, 0, TAU);
      g.fill();
    }
  }
  const N = 24, left = [], right = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const [px, py] = quadAt(p0, p1, p2, t);
    const [qx, qy] = quadAt(p0, p1, p2, Math.min(1, t + 0.01));
    let nx = -(qy - py), ny = qx - px;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;
    const w = (tw / 2) * (1 - 0.7 * t);
    left.push([px + nx * w, py + ny * w]);
    right.push([px - nx * w, py - ny * w]);
  }
  poly(g, [...left, ...right.slice().reverse()], PAPER_L, 0.97);
  brush(g, left.filter((_, i) => i % 3 === 0), Math.max(0.45, tw * 0.22), tone * 0.8, { dry: 0.8, bleed: 0.05, seed, profile: PROFILE.flat, bristles: 4 });
  line(g, right, Math.max(0.2, tw * 0.07), INK, tone * 0.35);
  // lenticels (the dark marks on birch bark)
  const marks = Math.round(h / 4);
  for (let i = 0; i < marks; i++) {
    const tt = rand() * 0.86;
    const [px, py] = quadAt(p0, p1, p2, tt);
    const w = (tw / 2) * (1 - 0.7 * tt);
    const ww = w * (0.5 + rand() * 1.1), hh = Math.max(0.25, tw * (0.06 + rand() * 0.1));
    const cx = px - w + ww * 0.5 + rand() * w * 0.25;
    g.fillStyle = rgba(INK, tone * (0.7 + rand() * 0.3));
    g.beginPath();
    g.moveTo(cx - ww / 2, py);
    g.quadraticCurveTo(cx, py - hh * 1.4, cx + ww / 2, py + hh * 0.2);
    g.quadraticCurveTo(cx, py + hh, cx - ww / 2, py);
    g.fill();
  }
}

function grassBlade(g, x, y, len, lean, w, a) {
  const tx = x + lean * len, ty = y - len;
  const cx = x + lean * len * 0.25, cy = y - len * 0.62;
  g.beginPath();
  g.moveTo(x - w / 2, y);
  g.quadraticCurveTo(cx - w * 0.3, cy, tx, ty);
  g.quadraticCurveTo(cx + w * 0.3, cy, x + w / 2, y);
  g.closePath();
  g.fillStyle = rgba(INK, a);
  g.fill();
}

function tuft(g, x, y, size, a, rand, lean = 0.2) {
  const n = 4 + ((rand() * 6) | 0);
  for (let i = 0; i < n; i++) grassBlade(g, x + (rand() - 0.5) * size * 0.5, y, size * (0.5 + rand() * 0.6), lean + (rand() - 0.5) * 0.9, size * 0.07, a * (0.5 + rand() * 0.5));
}

function haystack(g, x, yb, r, seed, S) {
  const rand = rng(seed);
  const h = r * 1.75;
  const yAt = (u) => yb - h * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 2.4)), 0.7);
  blob(g, x + r * 0.35, yb + r * 0.04, r * 1.8, r * 0.25, INK, 0.3);
  const shape = [];
  for (let i = 0; i <= 32; i++) { const u = (i / 32) * 2 - 1; shape.push([x + u * r, yAt(u)]); }
  const gr = g.createLinearGradient(0, yb - h, 0, yb);
  gr.addColorStop(0, rgba(INK, 0.12));
  gr.addColorStop(0.6, rgba(INK, 0.22));
  gr.addColorStop(1, rgba(INK, 0.42));
  softPoly(g, shape, gr, 0.7, S);
  for (let i = 0; i < 18; i++) {
    const u = ((i + rand() * 0.6) / 18) * 2 - 1;
    const pts = [];
    for (let k = 0; k <= 4; k++) {
      const v = lerp(u * 0.12, u * 0.97, k / 4);
      pts.push([x + v * r, yAt(v) + h * 0.03 + (k / 4) * h * 0.02]);
    }
    brush(g, pts, Math.max(0.35, r * 0.07), 0.5 + rand() * 0.4, { dry: 0.85, seed: seed + i, bristles: 4, profile: PROFILE.twig });
  }
  brush(g, shape.slice(2, 31), Math.max(0.4, r * 0.07), 0.7, { dry: 0.75, seed: seed + 40, spread: 0.6 });
  line(g, [[x + r * 0.02, yb - h * 0.96], [x + r * 0.06, yb - h * 1.3]], Math.max(0.3, r * 0.06), INK, 0.8);
  tuft(g, x - r * 0.85, yb + 0.5, r * 0.6, 0.5, rand);
  tuft(g, x + r * 0.75, yb + 0.5, r * 0.5, 0.5, rand);
}

// --- the painting ---
function* paintValley(g, S) {
  const { Ww, Hw, P, L, R, seed } = S;
  const rand = rng(seed);
  const X = (f) => f * Ww, Y = (f) => f * Hw;
  const upm = (d) => (1000 / d) * P;

  g.fillStyle = rgba(PAPER, 1);
  g.fillRect(0, 0, Ww, Hw);
  for (let i = 0; i < 16; i++) blob(g, rand() * Ww, rand() * Hw, (0.08 + rand() * 0.22) * Ww, (0.05 + rand() * 0.12) * Hw, [226, 214, 194], 0.1 + rand() * 0.08);
  const fibres = Math.round((Ww * Hw) / 110);
  g.lineCap = 'round';
  for (let i = 0; i < fibres; i++) {
    const x = rand() * Ww, y = rand() * Hw, l = 1.5 + rand() * 6, a = rand() * TAU;
    g.strokeStyle = rand() < 0.6 ? `rgba(150,128,100,${(0.05 + rand() * 0.08).toFixed(3)})` : `rgba(255,253,247,${(0.3 + rand() * 0.4).toFixed(3)})`;
    g.lineWidth = 0.12 + rand() * 0.22;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (rand() - 0.5) * 2, y + Math.sin(a) * l * 0.5 + (rand() - 0.5) * 2, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
    if (i % 2000 === 1999) yield;
  }
  yield;

  // sky and the red sun
  const sky = g.createLinearGradient(0, 0, 0, Y(0.42));
  sky.addColorStop(0, 'rgba(40,51,77,0.08)');
  sky.addColorStop(1, 'rgba(40,51,77,0)');
  g.fillStyle = sky;
  g.fillRect(0, 0, Ww, Y(0.42));
  const [sxF, syF, srF] = L.sun;
  const sx = X(sxF), sy = Y(syF), sr = Y(srF);
  blob(g, sx, sy, sr * 4.5, sr * 3.2, SEAL, 0.07);
  washDisc(g, sx, sy, sr, SEAL, 0.72, R, seed + 3);
  for (let i = 0; i < 2; i++) {
    const yy = sy + sr * (0.28 + i * 0.3), len = sr * (3.4 + rand() * 1.2), xx = sx + sr * (0.15 - i * 0.3);
    brush(g, [[xx - len / 2, yy + 0.5], [xx, yy], [xx + len / 2, yy - 0.4]], sr * (0.06 + i * 0.03), 0.85, { rgb: PAPER_L, dry: 0.6, bleed: 0.3, seed: seed + 30 + i, spread: 0.4 });
  }
  yield;

  // far hills
  const far1 = ridgePts(Ww, Y(L.far1[0]), Y(L.far1[1]), seed * 0.37 + 1.3);
  S.skyline = far1;
  rangeBody(g, far1, Y(0.1), 0.3, seed + 1, S, 2.4);
  crest(g, far1, Ww, 1.8, 0.28, seed + 5);
  yield;
  {
    const items = [];
    for (let x = far1[0][0]; x < Ww + 10; x += 1.4 + rand() * 2.2) {
      const n = noise1(x * 0.02 + seed, 6);
      if (n < 0.42) continue;
      items.push({ x, yb: ridgeAt(far1, x) + 1.5, h: 2.5 + rand() * 4.5 * n, a: 0.12 + rand() * 0.12 });
    }
    pineWash(g, S, items, 0.3);
  }
  yield;
  {
    const mx = X(L.mast), mb = ridgeAt(far1, mx) + 3, mh = Y(0.19);
    const top = mb - mh;
    for (const s of [-1, 1]) {
      line(g, [[mx, mb - mh * 0.62], [mx + s * mh * 0.36, mb + 3]], 0.18, INK, 0.16);
      line(g, [[mx, mb - mh * 0.32], [mx + s * mh * 0.22, mb + 2]], 0.18, INK, 0.14);
    }
    const w0 = mh * 0.045, w1 = mh * 0.008;
    line(g, [[mx - w0, mb], [mx - w1, top]], 0.55, INK, 0.55);
    line(g, [[mx + w0, mb], [mx + w1, top]], 0.55, INK, 0.55);
    const zz = [];
    for (let i = 0; i <= 18; i++) {
      const f = i / 18, w = lerp(w0, w1, f) * (i % 2 ? -1 : 1);
      zz.push([mx + w, mb - mh * f]);
    }
    line(g, zz, 0.28, INK, 0.4);
    for (let b = 0; b < 4; b++) {
      const f0 = 0.62 + b * 0.1, f1 = f0 + 0.05;
      poly(g, [[mx - lerp(w0, w1, f0), mb - mh * f0], [mx + lerp(w0, w1, f0), mb - mh * f0], [mx + lerp(w0, w1, f1), mb - mh * f1], [mx - lerp(w0, w1, f1), mb - mh * f1]], SEAL, 0.7);
    }
    line(g, [[mx, top], [mx, top - mh * 0.08]], 0.35, INK, 0.6);
    blob(g, mx, top - mh * 0.08, 1.6, 1.6, SEAL, 0.85);
  }
  mist(g, S, Y(L.far1[0] - 0.01), Y(L.far2[0] + 0.035), 0.6, rand);
  yield;

  const far2 = ridgePts(Ww, Y(L.far2[0]), Y(L.far2[1]), seed * 0.61 + 4.1);
  rangeBody(g, far2, Y(0.09), 0.42, seed + 2, S, 2.2);
  crest(g, far2, Ww, 2.2, 0.4, seed + 6);
  {
    const items = [];
    for (let x = far2[0][0]; x < Ww + 10; x += 1.2 + rand() * 2) {
      const n = noise1(x * 0.016 + seed + 7, 6);
      if (n < 0.38) continue;
      items.push({ x, yb: ridgeAt(far2, x) + 1.8, h: 3 + rand() * 6 * n, a: 0.16 + rand() * 0.16 });
    }
    pineWash(g, S, items, 0.35);
  }
  {
    const tx = X(L.tower), tb = ridgeAt(far2, tx) + Y(0.012), th = Y(0.075);
    for (let i = 0; i < 4; i++) {
      const rx = tx + (i - 1.2) * th * 0.5 + rand() * th * 0.25 + th * 0.5, ry = ridgeAt(far2, rx) + Y(0.018) + rand() * 3;
      const rw = th * (0.22 + rand() * 0.12);
      poly(g, [[rx - rw, ry], [rx - rw * 0.55, ry - rw * 0.45], [rx + rw * 0.55, ry - rw * 0.45], [rx + rw, ry]], INK, 0.36);
      poly(g, [[rx - rw * 0.8, ry], [rx + rw * 0.8, ry], [rx + rw * 0.8, ry + rw * 0.45], [rx - rw * 0.8, ry + rw * 0.45]], INK, 0.12);
    }
    for (const s of [-1, 1]) line(g, [[tx + s * th * 0.2, tb], [tx + s * th * 0.11, tb - th * 0.6]], 0.5, INK, 0.42);
    line(g, [[tx - th * 0.18, tb - th * 0.08], [tx + th * 0.13, tb - th * 0.45]], 0.28, INK, 0.28);
    line(g, [[tx + th * 0.18, tb - th * 0.08], [tx - th * 0.13, tb - th * 0.45]], 0.28, INK, 0.28);
    poly(g, [[tx - th * 0.17, tb - th * 0.6], [tx + th * 0.17, tb - th * 0.6], [tx + th * 0.17, tb - th * 0.86], [tx - th * 0.17, tb - th * 0.86]], INK, 0.34);
    poly(g, [[tx - th * 0.19, tb - th * 0.86], [tx, tb - th], [tx + th * 0.19, tb - th * 0.86]], INK, 0.46);
    line(g, [[tx - th * 0.17, tb - th * 0.73], [tx + th * 0.17, tb - th * 0.73]], 0.25, PAPER_L, 0.5);
  }
  mist(g, S, Y(L.far2[0] - 0.005), Y(L.tree[0] + 0.025), 0.55, rand);
  yield;

  // treeline, about 1 km out
  const tree = ridgePts(Ww, Y(L.tree[0]), Y(L.tree[1]), seed * 0.83 + 7.7, 2);
  rangeBody(g, tree, Y(0.07), 0.55, seed + 3, S, 1.6);
  {
    const items = [];
    for (let x = -6; x < Ww + 6; x += 1.1 + rand() * 1.9) {
      const n = noise1(x * 0.025 + seed + 3, 7);
      const h = Y(0.016) + Y(0.03) * n * (0.6 + rand() * 0.6);
      items.push({ x, yb: ridgeAt(tree, x) + h * 0.25, h, a: 0.18 + rand() * 0.22 });
    }
    items.sort((p, q) => p.a - q.a);
    pineWash(g, S, items.filter((it) => it.a < 0.3), 0.6);
    pineWash(g, S, items.filter((it) => it.a >= 0.3), 0.35);
    for (const it of items) if (it.a > 0.33 && rand() < 0.5) line(g, [[it.x, it.yb + it.h * 0.05], [it.x, it.yb - it.h * 0.85]], Math.max(0.25, it.h * 0.03), INK, 0.35);
    yield;
    for (let i = 0; i < Ww / 14; i++) {
      const x = rand() * Ww, yb = ridgeAt(tree, x) + Y(0.012), h = Y(0.018) + rand() * Y(0.02);
      line(g, [[x, yb], [x + (rand() - 0.5) * 1.2, yb - h]], 0.5 + rand() * 0.4, PAPER_L, 0.6);
    }
    for (let x = rand() * 30; x < Ww; x += 18 + rand() * 40) moss(g, x, ridgeAt(tree, x) + Y(0.006) + rand() * 3, 0.9 + rand() * 0.9, 0.7, seed + 50 + (x | 0));
  }
  mist(g, S, Y(L.tree[0] + 0.004), Y(L.meadow[0] + 0.03), 0.48, rand);
  yield;

  // meadow, 700-900 m
  {
    const [m0, m1] = L.meadow;
    const mg = g.createLinearGradient(0, Y(m0), 0, Y(m1 + 0.02));
    mg.addColorStop(0, 'rgba(22,17,15,0)');
    mg.addColorStop(0.5, 'rgba(22,17,15,0.05)');
    mg.addColorStop(1, 'rgba(22,17,15,0)');
    g.fillStyle = mg;
    g.fillRect(0, Y(m0), Ww, Y(m1 - m0 + 0.02));
    for (let i = 0; i < 18; i++) {
      const y = Y(m0 + 0.012 + rand() * (m1 - m0 - 0.012)), x = rand() * Ww, len = Ww * (0.08 + rand() * 0.18);
      brush(g, [[x - len / 2, y + rand()], [x, y], [x + len / 2, y + rand() * 1.5]], 0.9 + rand() * 1.6, 0.16 + rand() * 0.12, { dry: 0.9, bleed: 0.2, seed: seed + 100 + i, spread: 0.6 });
    }
  }
  yield;

  // gong frame, 900 m
  {
    const u = P, [gx, gy] = L.gong;
    const x = X(gx), ground = Y(gy);
    const plateY = ground - 1.05 * u, bar = plateY - 1.05 * u, half = 1.45 * u;
    S.gong = { x, y: plateY, r: 0.56 * u, bar, chain: 0.34 * u };
    blob(g, x, ground + 0.6, half * 1.6, 0.35 * u, INK, 0.12);
    brush(g, [[x - half, ground + 0.5], [x - half * 0.93, bar - 0.2 * u]], 0.17 * u, 0.88, { dry: 0.35, seed: seed + 201, profile: PROFILE.segment });
    brush(g, [[x + half, ground + 0.5], [x + half * 0.93, bar - 0.2 * u]], 0.17 * u, 0.88, { dry: 0.35, seed: seed + 202, profile: PROFILE.segment });
    brush(g, [[x - half * 1.12, bar + 0.04 * u], [x + half * 1.12, bar - 0.02 * u]], 0.15 * u, 0.92, { dry: 0.35, seed: seed + 203, profile: PROFILE.segment });
    tuft(g, x - half, ground + 0.8, 0.9 * u, 0.45, rand);
    tuft(g, x + half, ground + 0.8, 0.8 * u, 0.45, rand);
  }
  // far fence at 700 m, the balloon is tied to one post
  {
    const u7 = upm(700), [f0, f1, y0, y1] = L.fenceFar;
    const ph = 1.3 * u7;
    const posts = [];
    for (let x = X(f0); x <= X(f1); x += 3.4 * u7 * (0.9 + rand() * 0.2)) posts.push(x);
    const bx = X(L.balloon[0]);
    let bi = 0;
    posts.forEach((p, i) => { if (Math.abs(p - bx) < Math.abs(posts[bi] - bx)) bi = i; });
    posts[bi] = bx;
    const yAt = (x) => lerp(Y(y0), Y(y1), (x - X(f0)) / Math.max(1, X(f1) - X(f0)));
    posts.forEach((x, i) => {
      const yb = yAt(x);
      brush(g, [[x, yb + 0.6], [x + (rand() - 0.5) * 0.6, yb - ph]], Math.max(0.9, 0.13 * u7), 0.8, { dry: 0.4, seed: seed + 300 + i, profile: PROFILE.segment });
      if (i) {
        const xp = posts[i - 1], ypb = yAt(xp);
        wire(g, xp, ypb - ph * 0.82, x, yb - ph * 0.82, 0.6, 0.28, 0.5);
        wire(g, xp, ypb - ph * 0.45, x, yb - ph * 0.45, 0.5, 0.28, 0.45);
      }
      tuft(g, x, yb + 1, ph * 0.5, 0.35, rand);
    });
    S.balloon = { post: [bx, yAt(bx) - ph] };
  }
  yield;

  // grove, then the hunting stand
  if (L.grove) {
    const [g0, g1, gy] = L.grove;
    for (let i = 0; i < 6; i++) blob(g, X(g0) + rand() * X(g1 - g0), Y(gy) - Y(0.01), Y(0.05), Y(0.015), INK, 0.12);
    for (let i = 0; i < 9; i++) {
      const x = X(g0) + rand() * X(g1 - g0), h = Y(0.07) + rand() * Y(0.06);
      if (i % 2) spruce(g, x, Y(gy) + rand() * 3, h * 1.1, 0.6, rand, S);
      else birch(g, x, Y(gy) + rand() * 3, h, 0.8, rand, (rand() - 0.5) * 0.08);
      if (i % 2) yield;
    }
    yield;
  }
  {
    const u6 = upm(600), [sxF2, syF2] = L.stand;
    const x = X(sxF2), yb = Y(syF2);
    const H = 6.4 * u6, cw = 1.7 * u6, ch = 1.45 * u6, foot = 2.9 * u6;
    const cabB = yb - H + ch;
    const sd = seed + 400;
    blob(g, x, yb + 0.5, foot * 0.9, 0.4 * u6, INK, 0.16);
    brush(g, [[x - foot * 0.32, yb - 0.3 * u6], [x - cw * 0.3, cabB]], 0.12 * u6, 0.5, { dry: 0.5, seed: sd, profile: PROFILE.segment });
    brush(g, [[x + foot * 0.32, yb - 0.3 * u6], [x + cw * 0.3, cabB]], 0.12 * u6, 0.5, { dry: 0.5, seed: sd + 1, profile: PROFILE.segment });
    for (const f of [0.28, 0.62]) {
      const ya = lerp(yb, cabB, f), yc = lerp(yb, cabB, f + 0.26);
      const xa = lerp(foot / 2, cw * 0.42, f), xc = lerp(foot / 2, cw * 0.42, f + 0.26);
      line(g, [[x - xa, ya], [x + xc, yc]], 0.07 * u6, INK, 0.55);
      line(g, [[x + xa, ya], [x - xc, yc]], 0.07 * u6, INK, 0.55);
    }
    brush(g, [[x - foot / 2, yb + 0.4], [x - cw * 0.44, cabB + 0.2 * u6]], 0.16 * u6, 0.92, { dry: 0.45, seed: sd + 2, profile: PROFILE.segment });
    brush(g, [[x + foot / 2, yb + 0.4], [x + cw * 0.44, cabB + 0.2 * u6]], 0.16 * u6, 0.92, { dry: 0.45, seed: sd + 3, profile: PROFILE.segment });
    const lx0 = x + foot * 0.05, lx1 = x + cw * 0.05, lw = 0.45 * u6;
    line(g, [[lx0 - lw / 2, yb + 0.6], [lx1 - lw / 2, cabB]], 0.07 * u6, INK, 0.78);
    line(g, [[lx0 + lw / 2, yb + 0.6], [lx1 + lw / 2, cabB]], 0.07 * u6, INK, 0.78);
    for (let f = 0.08; f < 0.98; f += 0.075) line(g, [[lerp(lx0, lx1, f) - lw / 2, lerp(yb, cabB, f)], [lerp(lx0, lx1, f) + lw / 2, lerp(yb, cabB, f)]], 0.05 * u6, INK, 0.62);
    poly(g, [[x - cw / 2, cabB], [x + cw / 2, cabB], [x + cw / 2, cabB - ch], [x - cw / 2, cabB - ch]], [90, 58, 36], 0.36);
    for (let i = 1; i < 5; i++) line(g, [[x - cw / 2, cabB - (ch * i) / 5], [x + cw / 2, cabB - (ch * i) / 5]], 0.04 * u6, INK, 0.3);
    poly(g, [[x - cw * 0.38, cabB - ch * 0.62], [x + cw * 0.38, cabB - ch * 0.62], [x + cw * 0.38, cabB - ch * 0.84], [x - cw * 0.38, cabB - ch * 0.84]], INK, 0.88);
    brush(g, [[x - cw * 0.5, cabB], [x - cw * 0.5, cabB - ch]], 0.09 * u6, 0.82, { dry: 0.5, seed: sd + 5, profile: PROFILE.segment });
    brush(g, [[x + cw * 0.5, cabB], [x + cw * 0.5, cabB - ch]], 0.09 * u6, 0.82, { dry: 0.5, seed: sd + 6, profile: PROFILE.segment });
    brush(g, [[x - cw * 0.66, cabB - ch - 0.05 * u6], [x + cw * 0.66, cabB - ch + 0.22 * u6]], 0.24 * u6, 0.96, { dry: 0.4, seed: sd + 7, profile: PROFILE.segment });
    tuft(g, x - foot / 2, yb + 1, 1.1 * u6, 0.5, rand);
    tuft(g, x + foot / 2, yb + 1, 1.1 * u6, 0.5, rand);
  }
  mist(g, S, Y(L.meadow[1] - 0.045), Y(L.meadow[1] + 0.015), 0.32, rand);
  yield;

  // forest edge on the right
  {
    const [f0, f1, fy] = L.forest;
    const items = [];
    for (let x = X(f0); x < X(f1); x += Y(0.022) + rand() * Y(0.03)) {
      const isBirch = rand() < 0.36;
      items.push({ x, isBirch, h: (isBirch ? Y(0.13) : Y(0.15)) * (0.7 + rand() * 0.6), yb: Y(fy) - rand() * Y(0.012) });
    }
    // smaller paler back row so it reads as a forest
    let nb = 0;
    for (let x = X(f0) + Y(0.02); x < X(f1); x += Y(0.012) + rand() * Y(0.016)) {
      const h = Y(0.07) + rand() * Y(0.06);
      if (rand() < 0.3) birch(g, x, Y(fy) - Y(0.012), h, 0.5, rand, (rand() - 0.5) * 0.06);
      else spruce(g, x, Y(fy) - Y(0.01), h, 0.4, rand, S);
      if (++nb % 3 === 0) yield;
    }
    for (let x = X(f0); x < X(f1); x += Y(0.03)) blob(g, x + rand() * 10, Y(fy) - Y(0.004), Y(0.045), Y(0.012), INK, 0.12);
    mist(g, S, Y(fy - 0.06), Y(fy + 0.004), 0.3);
    yield;
    for (const pass of [0, 1]) {
      for (const it of items) {
        if ((it.isBirch ? 1 : 0) !== pass) continue;
        if (it.isBirch) birch(g, it.x, it.yb, it.h, 0.85, rand, (rand() - 0.5) * 0.06);
        else spruce(g, it.x, it.yb - Y(0.004), it.h, 0.78, rand, S);
        yield;
      }
    }
    mist(g, S, Y(fy - 0.035), Y(fy + 0.01), 0.26);
  }

  // shack at 500 m, the paper target goes on its wall
  {
    const u5 = upm(500), [shx, shy] = L.shack;
    const x = X(shx), yb = Y(shy);
    const w = 4.4 * u5, wh = 2.5 * u5, rh = 1.15 * u5, oh = 0.32 * u5;
    const sd = seed + 500;
    const bris = (bw) => bristlesFor(bw, R);
    const ry = yb - wh;
    const eaveL = x - w / 2 - oh, eaveR = x + w / 2 + oh, eaveY = ry + 0.15 * u5;
    const ridgeL = x - w / 2 + w * 0.1, ridgeR = x + w / 2 - w * 0.1, ridgeY = ry - rh;
    const roof = [[eaveL, eaveY], [ridgeL, ridgeY], [ridgeR, ridgeY], [eaveR, eaveY]];
    const wall = [[x - w / 2, yb], [x + w / 2, yb], [x + w / 2, ry], [x - w / 2, ry]];
    // shadow, then paper so the forest doesn't show through
    blob(g, x + w * 0.06, yb + 0.4, w * 0.82, 0.55 * u5, INK, 0.2);
    poly(g, wall, PAPER_L, 1);
    poly(g, roof, PAPER_L, 1);
    for (let i = 0; i < 9; i++) {
      const k = i / 8;
      blob(g, x + w * 0.28 + k * k * w * 0.55 + Math.sin(k * 5) * u5 * 0.25, ridgeY - rh * 0.28 - k * rh * 1.6, u5 * (0.18 + k * 0.6), u5 * (0.14 + k * 0.32), INK, 0.1 * (1 - k * 0.7));
    }
    const wg = g.createLinearGradient(0, ry, 0, yb);
    wg.addColorStop(0, rgba([90, 58, 36], 0.24));
    wg.addColorStop(1, rgba([70, 45, 28], 0.4));
    softPoly(g, wall, wg, 0.6, S, [90, 58, 36]);
    blob(g, x - w * 0.05, ry + wh * 0.16, w * 0.6, wh * 0.22, INK, 0.12);
    for (let px = x - w / 2 + 0.3 * u5, i = 0; px < x + w / 2 - 0.1 * u5; px += 0.3 * u5 * (0.85 + rand() * 0.3), i++) {
      const bw = 0.04 * u5 * (0.7 + rand() * 0.6);
      const y0 = ry + (0.1 + rand() * 0.25) * u5, y1 = yb - (0.05 + rand() * 0.4) * u5;
      line(g, [[px, y0], [px + (rand() - 0.5) * 0.08 * u5, (y0 + y1) / 2], [px + (rand() - 0.5) * 0.1 * u5, y1]], bw, INK, 0.16 + rand() * 0.14);
    }
    const dl = x + w * 0.16, dr = x + w * 0.38, dt = yb - wh * 0.8;
    softPoly(g, [[dl, yb], [dr, yb], [dr, dt], [dl, dt]], rgba(INK, 0.6), 0.5, S);
    brush(g, [[dl, yb], [dl, dt]], 0.09 * u5, 0.85, { dry: 0.55, seed: sd + 8, profile: PROFILE.segment, bristles: bris(0.09 * u5) });
    brush(g, [[dl - 0.05 * u5, dt], [dr + 0.08 * u5, dt + 0.02 * u5]], 0.09 * u5, 0.85, { dry: 0.6, seed: sd + 9, profile: PROFILE.segment, bristles: bris(0.09 * u5) });
    brush(g, [[x - w / 2, yb + 0.5], [x - w / 2 + 0.02 * u5, ry]], 0.13 * u5, 0.9, { dry: 0.5, seed: sd, profile: PROFILE.segment, bristles: bris(0.13 * u5) });
    brush(g, [[x + w / 2, yb + 0.5], [x + w / 2 - 0.02 * u5, ry]], 0.13 * u5, 0.9, { dry: 0.5, seed: sd + 1, profile: PROFILE.segment, bristles: bris(0.13 * u5) });
    brush(g, [[x - w / 2 - 0.12 * u5, yb + 0.25], [x, yb + 0.1], [x + w / 2 + 0.12 * u5, yb]], 0.09 * u5, 0.7, { dry: 0.7, seed: sd + 2, bristles: bris(0.09 * u5) });
    const rg = g.createLinearGradient(0, ridgeY, 0, eaveY);
    rg.addColorStop(0, rgba(INK, 0.22));
    rg.addColorStop(1, rgba(INK, 0.5));
    softPoly(g, roof, rg, 0.5, S);
    for (let i = 0; i < 11; i++) {
      const f = (i + 0.3 + rand() * 0.4) / 11;
      const bx0 = lerp(ridgeL, ridgeR, f), bx1 = lerp(eaveL, eaveR, f);
      const bw = 0.05 * u5 * (0.7 + rand() * 0.6);
      const k0 = 0.12 + rand() * 0.3, k1 = 0.75 + rand() * 0.25;
      brush(g, [[lerp(bx0, bx1, k0), lerp(ridgeY, eaveY, k0)], [lerp(bx0, bx1, (k0 + k1) / 2), lerp(ridgeY, eaveY, (k0 + k1) / 2)], [lerp(bx0, bx1, k1), lerp(ridgeY, eaveY, k1) - 0.05 * u5]], bw, 0.14 + rand() * 0.16,
        { dry: 0.45, bleed: 0.1, seed: sd + 60 + i, profile: PROFILE.stroke, bristles: bris(bw) });
    }
    brush(g, [[eaveL - 0.1 * u5, eaveY + 0.03 * u5], [x, eaveY + 0.06 * u5], [eaveR + 0.1 * u5, eaveY - 0.02 * u5]], 0.12 * u5, 0.92, { dry: 0.45, bleed: 0.2, seed: sd + 3, profile: PROFILE.segment, bristles: bris(0.12 * u5) });
    brush(g, [[ridgeL - 0.05 * u5, ridgeY + 0.02 * u5], [ridgeR + 0.05 * u5, ridgeY - 0.02 * u5]], 0.1 * u5, 0.9, { dry: 0.55, seed: sd + 4, profile: PROFILE.segment, bristles: bris(0.1 * u5) });
    brush(g, [[eaveL, eaveY], [ridgeL, ridgeY]], 0.07 * u5, 0.75, { dry: 0.6, seed: sd + 5, bristles: bris(0.07 * u5) });
    brush(g, [[eaveR, eaveY], [ridgeR, ridgeY]], 0.07 * u5, 0.75, { dry: 0.6, seed: sd + 6, bristles: bris(0.07 * u5) });
    brush(g, [[x + w * 0.28, ridgeY + rh * 0.45], [x + w * 0.28, ridgeY - rh * 0.28]], 0.16 * u5, 0.85, { dry: 0.4, seed: sd + 7, profile: PROFILE.segment, bristles: bris(0.16 * u5) });
    for (let i = 0; i < 6; i++) tuft(g, x - w / 2 + rand() * w * 1.05, yb + 1, 0.9 * u5 * (0.6 + rand() * 0.6), 0.55, rand);
    for (let i = 0; i < 4; i++) moss(g, x - w * 0.7 + rand() * w * 1.4, yb + 1 + rand() * 2, 0.6 + rand() * 0.6, 0.75, sd + 20 + i);
    S.paper = { x: x - w * 0.18, y: yb - wh * 0.5 };
  }
  yield;

  // field, 350 m
  {
    const [f0, f1] = L.field;
    const fg = g.createLinearGradient(0, Y(f0 - 0.03), 0, Y(f1 + 0.04));
    fg.addColorStop(0, 'rgba(90,58,36,0)');
    fg.addColorStop(0.45, 'rgba(90,58,36,0.06)');
    fg.addColorStop(1, 'rgba(90,58,36,0)');
    g.fillStyle = fg;
    g.fillRect(0, Y(f0 - 0.03), Ww, Y(f1 - f0 + 0.07));
    const swell = [];
    for (let x = -10; x <= Ww + 10; x += 6) swell.push([x, Y(f0 + 0.005) + Y(0.02) * (noise1(x * 0.006 + seed, 11) - 0.5) - Y(0.012) * Math.sin((x / Ww) * Math.PI)]);
    rangeBody(g, swell, Y(0.07), 0.12, seed + 612, S, 2.5);
    crest(g, swell, Ww, 1.2, 0.2, seed + 613);
    for (let i = 0; i < 12; i++) {
      const f = i / 11;
      const y = Y(lerp(f0 + 0.015, f1, Math.pow(f, 1.3))), len = Ww * (0.3 + rand() * 0.5), x = rand() * Ww;
      brush(g, [[x - len / 2, y + (rand() - 0.5) * 2], [x, y], [x + len / 2, y + (rand() - 0.5) * 2]], 0.8 + f * 2, 0.1 + f * 0.1, { dry: 0.95, bleed: 0.15, seed: seed + 600 + i, spread: 0.6 });
      if (i % 4 === 3) yield;
    }
    yield;
    for (const [bxF, byF, m] of L.bales) haystack(g, X(bxF), Y(byF), m * 0.75 * upm(450 + (0.6 - byF) * 2000), seed + 640 + (bxF * 100 | 0), S);
    const tr = L.track.map(([a, b]) => [X(a), Y(b)]);
    const widen = (k) => lerp(Ww * 0.045, Ww * 0.005, k);
    const lt = [], rt = [];
    for (let i = 0; i < tr.length; i++) { const k = i / (tr.length - 1); lt.push([tr[i][0] - widen(k), tr[i][1]]); rt.push([tr[i][0] + widen(k), tr[i][1]]); }
    softPoly(g, [...lt, ...rt.slice().reverse()], rgba(EARTH, 0.05), 2.5, S, EARTH);
    brush(g, lt, 1.8, 0.5, { dry: 0.85, seed: seed + 650, spread: 0.6 });
    brush(g, rt, 1.6, 0.46, { dry: 0.88, seed: seed + 651, spread: 0.6 });
    for (let i = 1; i < 9; i++) {
      const k = i / 9, j = Math.min(tr.length - 2, Math.floor(k * (tr.length - 1)));
      const kk = k * (tr.length - 1) - j;
      tuft(g, lerp(tr[j][0], tr[j + 1][0], kk), lerp(tr[j][1], tr[j + 1][1], kk) + 1, lerp(Y(0.02), Y(0.006), k), 0.35, rand);
    }
    yield;
    // the log the can sits on
    const u3 = upm(350), [lxF, lyF] = L.log;
    const x = X(lxF), y = Y(lyF);
    const len = 2.5 * u3, th = 0.46 * u3;
    blob(g, x, y + th * 0.55, len * 0.62, th * 0.35, INK, 0.22);
    brush(g, [[x - len / 2, y], [x, y - th * 0.06], [x + len / 2, y - th * 0.12]], th, 0.78, { dry: 0.55, bleed: 0.2, seed: seed + 700, profile: PROFILE.segment, spread: 0.55 });
    for (let i = 0; i < 4; i++) line(g, [[x - len * 0.35 + i * len * 0.18, y - th * 0.2], [x - len * 0.2 + i * len * 0.18, y - th * 0.22]], 0.05 * u3, PAPER_L, 0.45);
    blob(g, x - len / 2, y, th * 0.32, th * 0.5, PAPER_L, 0.95);
    g.lineWidth = 0.05 * u3;
    for (const r of [0.15, 0.3, 0.45]) { g.strokeStyle = rgba(INK, 0.45); g.beginPath(); g.ellipse(x - len / 2, y, th * r * 0.7, th * r, 0, 0, TAU); g.stroke(); }
    brush(g, [[x + len * 0.18, y - th * 0.4], [x + len * 0.24, y - th * 1.05]], 0.12 * u3, 0.8, { profile: PROFILE.twig, dry: 0.4, seed: seed + 701 });
    for (let i = 0; i < 4; i++) tuft(g, x - len / 2 + rand() * len, y + th * 0.5, 0.7 * u3, 0.5, rand);
    for (let i = 0; i < 3; i++) moss(g, x - len * 0.6 + rand() * len * 1.2, y + th * 0.55 + rand() * 2, 0.7 + rand() * 0.6, 0.8, seed + 720 + i);
    S.can = { x: x + len * 0.06, y: y - th * 0.5 + 0.08 * u3 };
  }
  yield;

  // near fence at 200 m, the bottle sits on one post
  {
    const [[a0, b0], [a1, b1]] = L.fenceNear;
    const x0 = X(a0), y0 = Y(b0), x1 = X(a1), y1 = Y(b1);
    const bx = X(L.bottle);
    const yAt = (x) => lerp(y0, y1, (x - x0) / (x1 - x0));
    const near = upm(170), far = upm(260);
    const posts = [];
    for (let x = x0; x <= x1;) {
      const k = (x - x0) / (x1 - x0);
      posts.push(x);
      x += 2.6 * lerp(near, far, k) * (0.92 + rand() * 0.16);
    }
    let bi = 0;
    posts.forEach((p, i) => { if (Math.abs(p - bx) < Math.abs(posts[bi] - bx)) bi = i; });
    posts[bi] = bx;
    const ph = (x) => 1.25 * lerp(near, far, (x - x0) / (x1 - x0));
    for (let i = 0; i < posts.length; i++) {
      const x = posts[i], yb = yAt(x), h = i === bi ? 1.25 * upm(200) : ph(x);
      const pw = Math.max(1.2, h * 0.1);
      blob(g, x, yb + 1, pw * 2.5, pw * 0.6, INK, 0.2);
      brush(g, [[x, yb + 1], [x + (rand() - 0.5) * 0.8, yb - h]], pw, 0.92, { dry: 0.45, bleed: 0.2, seed: seed + 800 + i, profile: PROFILE.segment });
      if (i) {
        const xp = posts[i - 1], hp = i - 1 === bi ? 1.25 * upm(200) : ph(xp), yp = yAt(xp);
        wire(g, xp, yp - hp * 0.78, x, yb - h * 0.78, 2.4, 0.45, 0.62);
        wire(g, xp, yp - hp * 0.42, x, yb - h * 0.42, 2, 0.45, 0.58);
      }
      tuft(g, x, yb + 2, h * 0.55, 0.6, rand);
      if (rand() < 0.5) moss(g, x + (rand() - 0.5) * pw * 4, yb + 1.5, 0.8 + rand() * 0.8, 0.8, seed + 860 + i);
    }
    S.bottle = { x: bx, y: yAt(bx) - 1.25 * upm(200), postW: Math.max(1.2, 1.25 * upm(200) * 0.1) };
  }
  yield;

  // foreground
  {
    const fy = Y(L.fore);
    const fg = g.createLinearGradient(0, fy - Y(0.05), 0, Hw);
    fg.addColorStop(0, 'rgba(22,17,15,0)');
    fg.addColorStop(0.35, 'rgba(22,17,15,0.1)');
    fg.addColorStop(1, 'rgba(22,17,15,0.3)');
    g.fillStyle = fg;
    g.fillRect(0, fy - Y(0.05), Ww, Hw - fy + Y(0.05));
    for (let i = 0; i < 3; i++) {
      const x = X(0.1 + rand() * 0.8), y = Y(0.86 + rand() * 0.08), r = Y(0.025 + rand() * 0.02);
      const shape = [[x - r * 1.3, y + r * 0.3], [x - r * 1.0, y - r * 0.15], [x - r * 0.35, y - r * 0.42], [x + r * 0.2, y - r * 0.5], [x + r * 0.75, y - r * 0.2], [x + r * 1.2, y + r * 0.3]];
      blob(g, x, y + r * 0.32, r * 1.8, r * 0.4, INK, 0.24);
      softPoly(g, shape, rgba(INK, 0.16), 1, S);
      brush(g, shape.slice(0, 5), 1.3, 0.7, { dry: 0.8, seed: seed + 900 + i });
      brush(g, [[x - r * 0.1, y - r * 0.45], [x + r * 0.05, y - r * 0.05], [x - r * 0.05, y + r * 0.25]], 0.9, 0.5, { dry: 0.85, seed: seed + 905 + i, profile: PROFILE.twig });
      moss(g, x - r * 1.25, y + r * 0.28, 1, 0.85, seed + 910 + i);
      moss(g, x + r * 1.1, y + r * 0.3, 0.8, 0.8, seed + 915 + i);
    }
    yield;
    const blades = Math.round(Ww * 1.1);
    for (let i = 0; i < blades; i++) {
      const x = rand() * Ww;
      const k = rand();
      const y = fy + Y(0.01) + k * (Hw - fy);
      const len = Y(0.03) + Y(0.09) * k * (0.4 + rand() * 0.8);
      grassBlade(g, x, y + 2, len, 0.25 + (rand() - 0.5) * 0.9, 0.5 + k * 1.6, 0.12 + 0.48 * k * rand());
      if (i % 600 === 599) yield;
    }
    if (L.bigBirch != null) birch(g, X(L.bigBirch), Hw + 10, Hw * 1.15, 0.92, rand, -0.03);
  }
  yield;
}

// --- the game ---
export function createScope(root, { t = (k) => k, reduceMotion = false, mobile = false, sound = {} } = {}) {
  const $ = (s) => root.querySelector(s);
  const stage = $('.scope-stage');
  const view = $('.scope-view');
  const canvas = $('.scope-canvas');
  const grab = $('.scope-grab');
  const tbody = $('.scope-table tbody');
  const cardEl = $('.scope-card');
  const overlays = { dirty: true, list: [] };
  const windEl = $('.scope-wind');
  const windVal = $('.scope-wind-val');
  const pennant = $('.scope-pennant');
  const toastEl = $('.scope-toast');
  const doneEl = $('.scope-done');
  const sealCanvas = $('.scope-seal');
  const btnFire = $('.scope-fire');
  const btnBreath = $('.scope-breath');
  const btnAgain = $('.scope-again');
  const breathFill = $('.scope-breath-meter i');
  const pips = [...root.querySelectorAll('.scope-pips i')];
  const tallyNum = $('.scope-tally-num');
  const tallySr = $('.scope-tally-sr');
  const helpEl = $('.scope-help');
  const g = canvas.getContext('2d');
  const snd = {
    shot: () => { try { sound.shot && sound.shot(); } catch (e) { /* sound is optional */ } },
    ping: (o) => { try { sound.ping && sound.ping(o); } catch (e) {} },
    glass: (o) => { try { sound.glass && sound.glass(o); } catch (e) {} },
  };
  const rand = rng(77);

  let W = 0, H = 0, dpr = 1;
  let s = 1, ox = 0, oy = 0; // sheet to stage
  let Rs = 160, Z = 5, small = false;
  let world = null;
  let painter = null, painted = false, paintStarted = false;
  const base = document.createElement('canvas');
  const soft = document.createElement('canvas');
  let baseDirty = true, baseAt = 0;

  let active = false, raf = 0, last = 0, T = 0, destroyed = false;
  let lastInput = -10, hover = false, focused = false;
  const C = { x: 0, y: 0 }, Ct = { x: 0, y: 0 };
  let placed = false;
  const keys = new Set();
  let keyHeld = 0;
  const hold = new Set();
  let breath = 1, exhausted = false, outWarned = false;
  let amp = 0.55, trem = 0, breathAmp = 0.3;
  let wind = 1.8, windTarget = 1.8, windNext = 9, windDir = 1;
  let recoilAt = -10, recoilSide = 0, nextFireAt = 0;
  let drag = null, tap = null;
  let shots = [], fx = [];
  let targets = [];
  let doneAt = -1, celebrated = false;
  let toastTimer = 0;
  let cardCache = '', windCache = '', breathCache = -1, grabCache = '';

  const lang = { dec: '.' };

  function resetTargets() {
    targets = TARGETS.map((d, i) => ({ ...d, i, hit: false, gone: false, at: -10, holes: [], marks: [], side: 1, impact: null }));
  }
  resetTargets();

  // target centre on the sheet, the balloon drifts with the wind
  function centre(tg) {
    const u = world.P;
    if (tg.id === 'bottle') return { x: world.bottle.x, y: world.bottle.y - 0.75 * u };
    if (tg.id === 'can') return { x: world.can.x, y: world.can.y - 0.47 * u };
    if (tg.id === 'paper') return { x: world.paper.x, y: world.paper.y };
    if (tg.id === 'balloon') {
      const [px, py] = world.balloon.post;
      const lean = clamp(wind / 4, -1, 1);
      return { x: px + lean * 0.42 * u + Math.sin(T * 1.1) * 0.06 * u, y: py - 2.05 * u + Math.abs(lean) * 0.18 * u + Math.sin(T * 1.7) * 0.04 * u };
    }
    return { x: world.gong.x, y: world.gong.y };
  }
  const hittable = (tg) => !tg.gone;

  function newWorld() {
    const a = clamp(W / Math.max(1, H), 0.5, 2.6);
    const tall = a < 1.15;
    const Hw = 600, Ww = Math.round(Hw * a);
    const P = clamp(Math.min(Ww / 150, Hw / 85), 4.6, 7.2);
    const L = tall ? LAYOUTS.tall : LAYOUTS.wide;
    const sEst = W / Ww;
    const want = 6 * Math.min(2, dpr) * sEst;
    const budget = mobile || small ? 7e6 : 15e6;
    const R = clamp(Math.min(want, Math.sqrt(budget / (Ww * Hw)), 8192 / Math.max(Ww, Hw)), 1.2, 12);
    const c = document.createElement('canvas');
    c.width = Math.round(Ww * R);
    c.height = Math.round(Hw * R);
    const wg = c.getContext('2d');
    wg.setTransform(R, 0, 0, R, 0, 0);
    world = { canvas: c, g: wg, Ww, Hw, P, L, R, aspect: a, tall, seed: 11, skyline: null };
    // rough spots until the painter gets there
    world.bottle = { x: L.bottle * Ww, y: lerp(L.fenceNear[0][1], L.fenceNear[1][1], (L.bottle - L.fenceNear[0][0]) / (L.fenceNear[1][0] - L.fenceNear[0][0])) * Hw - 1.25 * (1000 / 200) * P, postW: 4 };
    world.can = { x: L.log[0] * Ww + 0.15 * (1000 / 350) * P, y: L.log[1] * Hw - 0.15 * (1000 / 350) * P };
    world.paper = { x: L.shack[0] * Ww - 4.4 * (1000 / 500) * P * 0.18, y: L.shack[1] * Hw - 2.5 * (1000 / 500) * P * 0.5 };
    world.balloon = { post: [L.balloon[0] * Ww, L.balloon[1] * Hw - 1.3 * (1000 / 700) * P] };
    world.gong = { x: L.gong[0] * Ww, y: L.gong[1] * Hw - 1.05 * P, r: 0.56 * P, bar: L.gong[1] * Hw - 2.1 * P, chain: 0.34 * P };
    painter = paintValley(wg, world);
    painted = false;
    paintStarted = false;
    baseDirty = true;
  }

  function paintSlice(budgetMs) {
    if (!painter) return;
    paintStarted = true;
    const t0 = performance.now();
    while (performance.now() - t0 < budgetMs) {
      const r = painter.next();
      if (r.done) {
        painter = null;
        painted = true;
        baseDirty = true;
        onPainted();
        return;
      }
    }
    baseDirty = true;
  }

  function onPainted() {
    if (!celebrated && !shots.length) toast(t('scope.start'), 4200);
  }

  function resize() {
    const w = Math.max(1, Math.round(view.clientWidth)), h = Math.max(1, Math.round(view.clientHeight));
    const d = Math.min(2, window.devicePixelRatio || 1);
    if (w === W && h === H && d === dpr && world) return;
    const first = !world;
    const oldW = W, oldH = H;
    W = w; H = h; dpr = d;
    small = W < 620;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (W < 40 || H < 40) return;
    const a = W / H;
    if (!world || Math.abs(Math.log(a / world.aspect)) > 0.2) newWorld();
    layoutView();
    if (first || !placed) aimHome(true);
    else if (oldW && oldH) { C.x = Ct.x = (C.x / oldW) * W; C.y = Ct.y = (C.y / oldH) * H; }
    baseDirty = true;
    overlays.dirty = true;
    root.classList.toggle('is-small', small);
    poke();
  }

  // start aimed at the treeline and the gong, not an empty field
  function aimHome(snap) {
    const [fx, fy] = world.tall ? [0.7, 0.425] : [0.585, 0.462];
    Ct.x = clamp(ox + fx * world.Ww * s, Rs * 0.6, W - Rs * 0.6);
    Ct.y = clamp(oy + fy * world.Hw * s, Rs * 0.6, H - Rs * 0.6);
    if (snap || reduceMotion) { C.x = Ct.x; C.y = Ct.y; }
  }

  function layoutView() {
    s = Math.max(W / world.Ww, H / world.Hw);
    ox = (W - world.Ww * s) / 2;
    oy = (H - world.Hw * s) / 2;
    Rs = small ? clamp(Math.min(W * 0.4, H * 0.29), 92, 170) : clamp(Math.min(W * 0.2, H * 0.33), 120, 225);
    Z = clamp(Rs / (5.6 * world.P * s), 4, 6);
  }

  function buildBase() {
    if (!world) return;
    const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
    if (base.width !== bw || base.height !== bh) { base.width = bw; base.height = bh; }
    const f = 0.8;
    const sw = Math.max(1, Math.round(bw * f)), sh = Math.max(1, Math.round(bh * f));
    if (soft.width !== sw || soft.height !== sh) { soft.width = sw; soft.height = sh; }
    const sg = soft.getContext('2d');
    sg.imageSmoothingEnabled = true;
    sg.imageSmoothingQuality = 'high';
    sg.fillStyle = rgba(PAPER, 1);
    sg.fillRect(0, 0, sw, sh);
    sg.drawImage(world.canvas, 0, 0, world.canvas.width, world.canvas.height, ox * dpr * f, oy * dpr * f, world.Ww * s * dpr * f, world.Hw * s * dpr * f);
    const bg = base.getContext('2d');
    bg.imageSmoothingEnabled = true;
    bg.imageSmoothingQuality = 'high';
    bg.drawImage(soft, 0, 0, bw, bh);
    // a bit paler outside the scope
    bg.fillStyle = 'rgba(245,239,228,0.1)';
    bg.fillRect(0, 0, bw, bh);
    baseDirty = false;
    baseAt = T;
  }

  const toSheet = (x, y) => ({ x: (x - ox) / s, y: (y - oy) / s });

  function sway() {
    if (reduceMotion) return { x: 0, y: 0 };
    let x = amp * ((noise1(T * 0.42, 11) - 0.5) * 2.1 + 0.3 * Math.sin(T * 1.6));
    let y = amp * ((noise1(T * 0.37, 23) - 0.5) * 2.1 + 0.25 * Math.sin(T * 1.3 + 1)) + breathAmp * Math.sin((T * TAU) / 4.2);
    if (trem > 0.001) {
      x += trem * (noise1(T * 9, 5) - 0.5) * 2;
      y += trem * (noise1(T * 8.3, 9) - 0.5) * 2;
    }
    return { x, y };
  }

  function recoil() {
    const k = T - recoilAt;
    if (k < 0 || k > 1.2) return 0;
    const tau = 0.065;
    return reduceMotion ? 0 : 3.1 * (k / tau) * Math.exp(1 - k / tau);
  }

  function aimPoint(withKick = true) {
    const p = toSheet(C.x, C.y);
    const sw = sway();
    let x = p.x + sw.x * world.P, y = p.y + sw.y * world.P;
    if (withKick) {
      const r = recoil();
      y -= r * world.P;
      x += r * recoilSide * world.P;
    }
    return { x, y };
  }

  // rough distance to the ground here, -1 means sky
  function rangeAt(x, y) {
    const L = world.L, Hw = world.Hw;
    if (world.skyline && y < ridgeAt(world.skyline, x)) return -1;
    const pts = [
      [L.tree[0] * Hw, 1300], [L.gong[1] * Hw, 900], [L.balloon[1] * Hw, 700], [L.shack[1] * Hw, 500],
      [L.log[1] * Hw, 350], [L.fenceNear[1][1] * Hw, 220], [L.fore * Hw, 150], [Hw, 60],
    ];
    if (y <= pts[0][0]) return 1600;
    for (let i = 0; i < pts.length - 1; i++) {
      if (y <= pts[i + 1][0]) return lerp(pts[i][1], pts[i + 1][1], (y - pts[i][0]) / Math.max(1, pts[i + 1][0] - pts[i][0]));
    }
    return 60;
  }

  // shooting
  function fire() {
    if (!world || T < nextFireAt) return;
    nextFireAt = T + CYCLE;
    lastInput = T;
    const A = aimPoint(false);
    recoilAt = T;
    recoilSide = (rand() - 0.5) * 0.5;
    snd.shot();
    btnFire.classList.remove('is-cycling');
    void btnFire.offsetWidth;
    btnFire.classList.add('is-cycling');
    const P = world.P;
    let shot = null;
    const order = targets.slice().sort((a, b) => a.d - b.d);
    for (const tg of order) {
      if (!hittable(tg)) continue;
      const c = centre(tg);
      const ix = A.x + driftMil(tg.d, wind) * P, iy = A.y + dropMil(tg.d) * P;
      const dx = (ix - c.x) / P, dy = (iy - c.y) / P;
      const round = tg.id === 'balloon' || tg.id === 'gong';
      const rx = tg.w / 2 + TOL, ry = tg.h / 2 + TOL;
      const inside = round ? (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1 : Math.abs(dx) <= rx && Math.abs(dy) <= ry;
      if (inside) { shot = { tg, x: ix, y: iy, dx, dy, d: tg.d }; break; }
    }
    if (!shot) {
      // closest target decides the miss hint
      let best = null;
      for (const tg of order) {
        if (!hittable(tg)) continue;
        const c = centre(tg);
        const ix = A.x + driftMil(tg.d, wind) * P, iy = A.y + dropMil(tg.d) * P;
        const dx = (ix - c.x) / P, dy = (iy - c.y) / P;
        const m = Math.hypot(dx, dy);
        if (!best || m < best.m) best = { tg, x: ix, y: iy, dx, dy, m, d: tg.d };
      }
      if (best && best.m < 4.5) shot = { miss: true, ...best };
      else {
        const d = rangeAt(A.x, A.y);
        if (d < 0) shot = { miss: true, wide: true, sky: true, d: 900, x: A.x, y: A.y };
        else shot = { miss: true, wide: true, d, x: A.x + driftMil(d, wind) * P, y: A.y + dropMil(d) * P };
      }
    }
    shot.at = T + flightTime(shot.d);
    shot.from = A;
    shot.t0 = T;
    shots.push(shot);
    poke();
  }

  function land(sh) {
    const P = world.P;
    const tg = sh.tg;
    const delay = sh.d / 1800;
    if (!sh.miss && tg) {
      const first = !tg.hit;
      tg.hit = true;
      tg.at = T;
      const c = centre(tg);
      let msg = t('scope.hit.' + tg.id);
      if (tg.id === 'bottle') {
        tg.gone = true;
        const shards = [];
        for (let i = 0; i < 14; i++) {
          const a = -Math.PI / 2 + (rand() - 0.5) * 2.6;
          const sp = (2 + rand() * 5) * P;
          shards.push({ vx: Math.cos(a) * sp + (sh.dx > 0 ? -1 : 1) * P * 0.8, vy: Math.sin(a) * sp, w: (0.08 + rand() * 0.16) * P, rot: rand() * TAU, om: (rand() - 0.5) * 24, x: c.x + (rand() - 0.5) * 0.3 * P, y: c.y + (rand() - 0.2) * 0.6 * P });
        }
        fx.push({ type: 'shards', t0: T, shards, x: c.x, y: c.y });
        snd.glass({ delay });
      } else if (tg.id === 'can') {
        tg.gone = true;
        tg.side = sh.dx > 0 ? -1 : 1;
        fx.push({ type: 'can', t0: T, x: c.x, y: world.can.y, side: tg.side });
        snd.ping({ gain: 0.08, delay });
      } else if (tg.id === 'paper') {
        tg.holes.push({ x: sh.x - c.x, y: sh.y - c.y });
        if (Math.hypot(sh.dx, sh.dy) < 0.16) msg = t('scope.hit.bull');
        fx.push({ type: 'puff', t0: T, x: sh.x, y: sh.y, light: true });
      } else if (tg.id === 'balloon') {
        tg.gone = true;
        const drops = [];
        for (let i = 0; i < 18; i++) drops.push({ a: rand() * TAU, sp: (1.2 + rand() * 2.2) * P, r: (0.05 + rand() * 0.12) * P });
        fx.push({ type: 'splash', t0: T, x: c.x, y: c.y, drops });
      } else if (tg.id === 'gong') {
        tg.marks.push({ x: (sh.x - c.x) / P, y: (sh.y - c.y) / P });
        if (tg.marks.length > 6) tg.marks.shift();
        tg.side = sh.dx > 0 ? 1 : -1;
        fx.push({ type: 'ring', t0: T, x: c.x, y: c.y });
        snd.ping({ delay });
      }
      fx.push({ type: 'spark', t0: T, x: sh.x, y: sh.y });
      const n = targets.filter((x) => x.hit).length;
      toast(msg, 2600, t('scope.tally').replace('{n}', n));
      if (first) updateTally();
      if (first && n === targets.length && !celebrated) doneAt = T + (reduceMotion ? 0.3 : 1.1);
    } else {
      if (!sh.sky) fx.push({ type: 'dust', t0: T, x: sh.x, y: sh.y, seed: (rand() * 1000) | 0 });
      if (sh.wide) toast(t('scope.miss.wide'));
      else {
        const dir = Math.abs(sh.dy) >= Math.abs(sh.dx) ? (sh.dy < 0 ? 'high' : 'low') : (sh.dx < 0 ? 'left' : 'right');
        toast(t('scope.miss.' + dir));
      }
    }
  }

  const fmt = (v) => (Math.round(Math.abs(v) * 10) / 10).toFixed(1).replace('.', lang.dec);
  // french says 1,8 mil but 2,4 mils, so the singular covers anything under 2
  const few = (v) => Math.round(Math.abs(v) * 10) / 10 < 2;
  const milWord = (v) => t(few(v) ? 'scope.mil' : 'scope.mils');

  function buildCard() {
    tbody.textContent = '';
    for (const tg of targets) {
      const tr = document.createElement('tr');
      tr.dataset.id = tg.id;
      tr.innerHTML = '<th scope="row"><span class="scope-num"></span><span class="scope-name"></span></th><td class="scope-rng"></td><td class="scope-elev"></td><td class="scope-wnd"></td>';
      tbody.appendChild(tr);
    }
    cardCache = '';
  }

  function updateCard(force) {
    const wr = Math.round(wind * 10) / 10;
    const key = wr + '|' + targets.map((x) => +x.hit).join('') + '|' + lang.dec;
    if (!force && key === cardCache) return;
    cardCache = key;
    const rows = tbody.children;
    targets.forEach((tg, i) => {
      const tr = rows[i];
      if (!tr) return;
      tr.classList.toggle('is-hit', tg.hit);
      tr.querySelector('.scope-num').textContent = String(i + 1);
      tr.querySelector('.scope-name').textContent = t('scope.t.' + tg.id);
      tr.querySelector('.scope-rng').textContent = t('scope.m').replace('{n}', tg.d);
      tr.querySelector('.scope-elev').innerHTML = `<span aria-hidden="true">↑</span>${fmt(dropMil(tg.d))}<span class="scope-sr"> ${milWord(dropMil(tg.d))} ${t('scope.up')}</span>`;
      const dr = driftMil(tg.d, wr);
      const arrow = Math.abs(dr) < 0.05 ? '' : dr > 0 ? '←' : '→';
      const word = Math.abs(dr) < 0.05 ? '' : dr > 0 ? t('scope.left') : t('scope.right');
      tr.querySelector('.scope-wnd').innerHTML = `<span aria-hidden="true">${arrow || '·'}</span>${fmt(dr)}<span class="scope-sr"> ${milWord(dr)} ${word}</span>`;
    });
  }

  function updateWind(force) {
    const wr = Math.round(wind * 10) / 10;
    const key = wr + lang.dec;
    if (!force && key === windCache) return;
    windCache = key;
    const v = Math.abs(wr);
    windVal.textContent = (wr > 0.04 ? '→ ' : wr < -0.04 ? '← ' : '') + fmt(v);
    windEl.setAttribute('aria-label', t(few(v) ? 'scope.wind.aria.one' : 'scope.wind.aria').replace('{v}', fmt(v)).replace('{dir}', t(wr >= 0 ? 'scope.wind.toRight' : 'scope.wind.toLeft')));
    // pennant streams out in the wind, droops when calm
    const k = clamp(v / 4, 0, 1);
    windEl.style.setProperty('--wk', k.toFixed(2));
    windEl.style.setProperty('--wdir', wr >= 0 ? '1' : '-1');
    if (pennant) {
      const len = 9 + 15 * k, droop = (1 - k) * 13;
      const f = (v) => v.toFixed(1);
      pennant.setAttribute('d', `M0 0 C${f(len * 0.4)} ${f(droop * 0.15)} ${f(len * 0.72)} ${f(1.5 + droop * 0.55)} ${f(len)} ${f(3 + droop)} L${f(len * 0.9)} ${f(5.5 + droop)} C${f(len * 0.6)} ${f(7 + droop * 0.65)} ${f(len * 0.32)} ${f(8 + droop * 0.25)} 0 9 Z`);
    }
  }

  function updateTally() {
    const n = targets.filter((x) => x.hit).length;
    tallyNum.textContent = `${n} / ${targets.length}`;
    pips.forEach((p, i) => p.classList.toggle('is-hit', !!targets[i] && targets[i].hit));
    if (tallySr) tallySr.textContent = t('scope.tally').replace('{n}', n);
    updateCard(true);
  }

  function updateBreathUI() {
    const b = Math.round(breath * 100);
    if (b === breathCache) return;
    breathCache = b;
    breathFill.style.transform = `scaleX(${(b / 100).toFixed(2)})`;
    btnBreath.classList.toggle('is-out', exhausted);
  }

  // quiet = screen reader only, no pill
  function toast(msg, ms = 2600, sr = '', quiet = false) {
    toastEl.textContent = msg;
    if (sr) {
      const span = document.createElement('span');
      span.className = 'scope-sr';
      span.textContent = ' ' + sr;
      toastEl.appendChild(span);
    }
    clearTimeout(toastTimer);
    toastEl.classList.toggle('is-on', !quiet);
    if (quiet) return;
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), ms);
  }

  let stampToken = 0;
  async function celebrate() {
    const token = ++stampToken;
    celebrated = true;
    // lower the rifle so the whole valley and the note show
    if (!drag && !keys.size) { Ct.y = H + Rs + 60; placed = true; poke(); }
    doneEl.classList.add('is-on');
    doneEl.setAttribute('aria-hidden', 'false');
    root.classList.add('is-done');
    toast(`${t('scope.done.title')} ${t('scope.done.line')} ${t('scope.done.love')}`, 0, '', true);
    try {
      if (document.fonts && document.fonts.load) await Promise.race([document.fonts.load('900 60px "Noto Serif KR"', '名射手印'), new Promise((r) => setTimeout(r, 900))]);
    } catch (e) { /* fallback font is fine */ }
    if (token !== stampToken || !celebrated || destroyed) return;
    const size = 86;
    const d = Math.min(2, window.devicePixelRatio || 1);
    sealCanvas.width = Math.round((size + 16) * d);
    sealCanvas.height = Math.round((size + 16) * d);
    const sg = sealCanvas.getContext('2d');
    sg.clearRect(0, 0, sealCanvas.width, sealCanvas.height);
    sealStamp(sg, sealCanvas.width / 2, sealCanvas.height / 2, size * d, '名射手印', { seed: 23, rot: -0.06 });
    doneEl.classList.add('is-stamped');
  }

  function reset() {
    stampToken++;
    resetTargets();
    shots = [];
    fx = [];
    doneAt = -1;
    celebrated = false;
    doneEl.classList.remove('is-on', 'is-stamped');
    doneEl.setAttribute('aria-hidden', 'true');
    root.classList.remove('is-done');
    if (C.y > H || Ct.y > H) aimHome(false);
    updateTally();
    toast(t('scope.reset'));
    poke();
  }

  // --- live drawing ---
  // px = sheet units per css px
  function drawLive(px, inScope) {
    const P = world.P;
    const minW = (w) => Math.max(w, px * 0.9);
    // ribbon on the bottle post so you can see the wind
    {
      const b = world.bottle;
      const x0 = b.x + b.postW * 0.45, y0 = b.y + 0.55 * P;
      const k = clamp(Math.abs(wind) / 4, 0, 1), dir = wind >= 0 ? 1 : -1;
      const len = 1.5 * P;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      for (let i = 0; i <= 10; i++) {
        const f = i / 10;
        const flap = reduceMotion ? 0 : Math.sin(T * (6 + 6 * k) - f * 5) * 0.09 * P * f * (0.3 + k);
        const x = x0 + dir * f * len * (0.25 + 0.75 * k) - (1 - k) * f * 0.12 * P * dir;
        const y = y0 + f * f * len * (1 - k) * 0.85 + flap + f * 0.08 * P;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.lineWidth = minW(0.13 * P);
      g.strokeStyle = rgba(SEAL, 0.85);
      g.stroke();
    }
    // far to near
    for (let i = targets.length - 1; i >= 0; i--) drawTarget(targets[i], px, inScope);
    for (const e of fx) drawFx(e, px, inScope);
  }

  function drawTarget(tg, px, inScope) {
    const P = world.P;
    const minW = (w) => Math.max(w, px * 0.75);
    const c = centre(tg);
    const age = T - tg.at;
    if (tg.id === 'gong') {
      const G = world.gong;
      let th = 0;
      if (tg.hit && !reduceMotion && age < 5) th = 0.3 * tg.side * Math.exp(-age / 1.3) * Math.sin(age * 6.5);
      g.save();
      g.translate(G.x, G.bar);
      g.rotate(th);
      const dy = G.y - G.bar;
      g.lineWidth = minW(0.045 * P);
      g.strokeStyle = rgba(INK, 0.75);
      g.beginPath();
      g.moveTo(-0.3 * P, 0); g.lineTo(-0.28 * P, dy - G.r * 0.92);
      g.moveTo(0.3 * P, 0); g.lineTo(0.28 * P, dy - G.r * 0.92);
      g.stroke();
      drawSprite('gong', px, 0, dy);
      for (const m of tg.marks) {
        g.fillStyle = rgba([90, 84, 80], 0.7);
        g.beginPath(); g.arc(m.x * P, dy + m.y * P, 0.09 * P, 0, TAU); g.fill();
        g.fillStyle = rgba([60, 56, 54], 0.35);
        for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + m.x; g.beginPath(); g.arc(m.x * P + Math.cos(a) * 0.15 * P, dy + m.y * P + Math.sin(a) * 0.15 * P, 0.03 * P, 0, TAU); g.fill(); }
      }
      g.restore();
      return;
    }
    if (tg.id === 'balloon') {
      const [bx, by] = world.balloon.post;
      g.lineWidth = minW(0.03 * P);
      g.strokeStyle = rgba(INK, 0.6);
      g.beginPath();
      if (tg.gone) {
        const fall = reduceMotion ? 1 : clamp(age / 0.9, 0, 1);
        const ex = lerp(c.x, bx + 0.25 * P, fall), ey = lerp(c.y + 0.5 * P, by + 1.1 * P, fall);
        g.moveTo(bx, by);
        g.quadraticCurveTo(bx + 0.35 * P, lerp(by - 1.2 * P, by + 0.5 * P, fall), ex, ey);
        g.stroke();
        g.fillStyle = rgba(SEAL, 0.85);
        g.beginPath(); g.ellipse(ex, ey + 0.06 * P, 0.07 * P, 0.1 * P, 0.4, 0, TAU); g.fill();
        return;
      }
      g.moveTo(bx, by);
      g.quadraticCurveTo(lerp(bx, c.x, 0.2) + 0.12 * P, (by + c.y) / 2, c.x, c.y + 0.52 * P);
      g.stroke();
      g.save();
      g.translate(c.x, c.y);
      g.rotate(clamp(wind / 4, -1, 1) * 0.18);
      drawSprite('balloon', px, 0, 0);
      g.restore();
      return;
    }
    if (tg.id === 'paper') {
      let rot = -0.035;
      if (tg.hit && !reduceMotion && age < 1.5) rot += 0.1 * Math.exp(-age / 0.35) * Math.sin(age * 22);
      const sz = 1.2 * P;
      g.save();
      g.translate(c.x, c.y - sz / 2);
      g.rotate(rot);
      g.translate(0, sz / 2);
      g.fillStyle = rgba(INK, 0.22);
      g.fillRect(-sz / 2 + 0.06 * P, -sz / 2 + 0.07 * P, sz, sz);
      g.fillStyle = rgba(PAPER_L, 1);
      g.fillRect(-sz / 2, -sz / 2, sz, sz);
      g.lineWidth = minW(0.03 * P);
      g.strokeStyle = rgba(INK, 0.35);
      g.strokeRect(-sz / 2, -sz / 2, sz, sz);
      for (const [r, a] of [[0.46, 0.8], [0.34, 0.75], [0.22, 0.7]]) {
        g.lineWidth = minW(0.035 * P);
        g.strokeStyle = rgba(INK, a);
        g.beginPath(); g.arc(0, 0, r * P, 0, TAU); g.stroke();
      }
      g.fillStyle = rgba(SEAL, 0.95);
      g.beginPath(); g.arc(0, 0, 0.11 * P, 0, TAU); g.fill();
      g.fillStyle = rgba(INK, 0.85);
      for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * sz * 0.4, -sz * 0.42, 0.035 * P, 0, TAU); g.fill(); }
      for (const h of tg.holes) {
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.beginPath(); g.arc(h.x, h.y, 0.075 * P, 0, TAU); g.fill();
        g.fillStyle = rgba(INK, 0.95);
        g.beginPath(); g.arc(h.x, h.y, 0.045 * P, 0, TAU); g.fill();
      }
      g.restore();
      return;
    }
    if (tg.id === 'can') {
      if (tg.gone) return; // the fx draws it while it flies
      drawCan(c.x, world.can.y, 0, 1, px);
      return;
    }
    if (tg.id === 'bottle') {
      const b = world.bottle;
      if (tg.gone) {
        g.fillStyle = rgba(INK, 0.5);
        g.beginPath();
        g.moveTo(b.x - 0.26 * P, b.y);
        g.lineTo(b.x - 0.26 * P, b.y - 0.22 * P);
        g.lineTo(b.x - 0.12 * P, b.y - 0.36 * P);
        g.lineTo(b.x - 0.02 * P, b.y - 0.2 * P);
        g.lineTo(b.x + 0.1 * P, b.y - 0.42 * P);
        g.lineTo(b.x + 0.26 * P, b.y - 0.18 * P);
        g.lineTo(b.x + 0.26 * P, b.y);
        g.closePath();
        g.fill();
        return;
      }
      drawBottle(b.x, b.y, px);
    }
  }

  // targets get brush painted into sprites once per zoom level, the brush needs real pixels
  const sprites = new Map();
  // pts are in sheet units around the sprite anchor
  function pull(sg, k, ox, oy, pts, w, tone, o = {}) {
    const wpx = Math.max(0.9, w * k);
    stroke(sg, {
      pts: pts.map(([x, y]) => [ox + x * k, oy + y * k]), width: wpx, tone,
      dry: o.dry ?? 0.5, bleed: o.bleed ?? 0.1, seed: o.seed ?? 1, rgb: o.rgb ?? INKB,
      profile: o.profile ?? PROFILE.segment, spread: o.spread ?? 0.35, bristles: clamp(Math.round(wpx / 1.1), 4, 16),
    });
  }
  const PAINT = {
    gong(sg, k, P) {
      const r = world.gong.r, R = r * k, o = r * 1.4 * k;
      sg.fillStyle = rgba(INK, 0.14);
      sg.beginPath(); sg.arc(o + 0.07 * P * k, o + 0.09 * P * k, R * 1.04, 0, TAU); sg.fill();
      const gr = sg.createRadialGradient(o - R * 0.35, o - R * 0.4, R * 0.05, o, o, R);
      gr.addColorStop(0, rgba(PAPER_L, 1));
      gr.addColorStop(0.7, 'rgba(228,221,208,1)');
      gr.addColorStop(1, 'rgba(176,167,156,1)');
      sg.fillStyle = gr;
      sg.beginPath(); sg.arc(o, o, R, 0, TAU); sg.fill();
      sg.save();
      sg.clip();
      blob(sg, o + R * 0.35, o + R * 0.42, R * 0.9, R * 0.62, INK, 0.16);
      stroke(sg, { pts: arcPts(o, o, R * 0.62, 0.6, 0.6 + TAU * 0.55, 18), width: Math.max(0.8, R * 0.05), tone: 0.18, dry: 0.8, bleed: 0, seed: 41, rgb: INKB, bristles: 4 });
      sg.restore();
      const rw = Math.max(1.2, 0.075 * P * k);
      stroke(sg, { pts: arcPts(o, o, R * 0.985, -2.3, -2.3 + TAU * 0.9, 40), width: rw, tone: 0.9, dry: 0.55, bleed: 0.15, seed: 17, rgb: INKB, profile: PROFILE.stroke, bristles: clamp(Math.round(rw / 1.2), 5, 16) });
      stroke(sg, { pts: arcPts(o, o, R * 0.995, 0.2, 0.2 + TAU * 0.45, 24), width: rw * 0.8, tone: 0.7, dry: 0.7, bleed: 0.1, seed: 23, rgb: INKB, profile: PROFILE.stroke, bristles: clamp(Math.round(rw / 1.4), 4, 14) });
      blob(sg, o - R * 0.42, o - R * 0.46, R * 0.2, R * 0.13, [255, 253, 248], 0.8);
      return { w: r * 2.8, h: r * 2.8, ax: r * 1.4, ay: r * 1.4 };
    },
    bottle(sg, k, P) {
      const bw = 0.52 * P, bh = 0.92 * P, nh = 0.42 * P, nw = 0.17 * P, sh = 0.24 * P;
      const W = 0.9 * P, H = 1.85 * P, ox = (W / 2) * k, oy = (H - 0.1 * P) * k;
      const path = () => {
        sg.beginPath();
        sg.moveTo(ox - (bw / 2) * k, oy);
        sg.lineTo(ox - (bw / 2) * k, oy - bh * k);
        sg.quadraticCurveTo(ox - (bw / 2) * k, oy - (bh + 0.18 * P) * k, ox - (nw / 2) * k, oy - (bh + sh) * k);
        sg.lineTo(ox - (nw / 2) * k, oy - (bh + sh + nh) * k);
        sg.lineTo(ox + (nw / 2) * k, oy - (bh + sh + nh) * k);
        sg.lineTo(ox + (nw / 2) * k, oy - (bh + sh) * k);
        sg.quadraticCurveTo(ox + (bw / 2) * k, oy - (bh + 0.18 * P) * k, ox + (bw / 2) * k, oy - bh * k);
        sg.lineTo(ox + (bw / 2) * k, oy);
        sg.closePath();
      };
      const gr = sg.createLinearGradient(ox - (bw / 2) * k, 0, ox + (bw / 2) * k, 0);
      gr.addColorStop(0, 'rgba(44,54,46,0.82)');
      gr.addColorStop(0.32, 'rgba(104,122,106,0.55)');
      gr.addColorStop(1, 'rgba(30,36,32,0.88)');
      path();
      sg.fillStyle = gr;
      sg.shadowColor = 'rgba(40,50,42,0.5)';
      sg.shadowBlur = Math.max(1, 0.05 * P * k);
      sg.fill();
      sg.shadowBlur = 0;
      sg.save();
      path();
      sg.clip();
      blob(sg, ox + 0.08 * P * k, oy - 0.08 * P * k, 0.34 * P * k, 0.2 * P * k, INK, 0.35);
      sg.fillStyle = rgba(PAPER_L, 0.62);
      sg.fillRect(ox - (bw / 2) * k, oy - bh * 0.64 * k, bw * k, bh * 0.3 * k);
      sg.fillStyle = rgba(SEAL, 0.8);
      sg.fillRect(ox - 0.06 * P * k, oy - bh * 0.56 * k, 0.12 * P * k, bh * 0.14 * k);
      sg.restore();
      pull(sg, k, ox, oy, [[-bw * 0.24, -0.1 * P], [-bw * 0.24, -bh * 0.4], [-bw * 0.22, -bh + 0.04 * P]], 0.06 * P, 0.85, { rgb: PAPER_L, dry: 0.45, seed: 61, profile: PROFILE.stroke });
      pull(sg, k, ox, oy, [[-nw * 0.18, -(bh + sh + 0.04 * P)], [-nw * 0.18, -(bh + sh + nh - 0.06 * P)]], 0.035 * P, 0.7, { rgb: PAPER_L, dry: 0.5, seed: 62, profile: PROFILE.stroke });
      pull(sg, k, ox, oy, [[-bw / 2, 0.02 * P], [-bw / 2, -bh * 0.5], [-bw / 2, -bh], [-nw / 2 - 0.03 * P, -(bh + sh - 0.02 * P)], [-nw / 2, -(bh + sh + nh)]], 0.05 * P, 0.85, { seed: 63, dry: 0.55 });
      pull(sg, k, ox, oy, [[bw / 2, 0.02 * P], [bw / 2, -bh * 0.5], [bw / 2, -bh], [nw / 2 + 0.03 * P, -(bh + sh - 0.02 * P)], [nw / 2, -(bh + sh + nh)]], 0.055 * P, 0.9, { seed: 64, dry: 0.5 });
      pull(sg, k, ox, oy, [[-nw / 2 - 0.02 * P, -(bh + sh + nh)], [nw / 2 + 0.02 * P, -(bh + sh + nh)]], 0.06 * P, 0.9, { seed: 65, dry: 0.3 });
      return { w: W, h: H, ax: W / 2, ay: H - 0.1 * P };
    },
    can(sg, k, P) {
      const cw = 0.72 * P, ch = 0.92 * P, ey = 0.1 * P;
      const W = 1.0 * P, H = 1.25 * P, ox = (W / 2) * k, oy = (H / 2) * k;
      const body = () => {
        sg.beginPath();
        sg.moveTo(ox - (cw / 2) * k, oy - (ch / 2) * k);
        sg.lineTo(ox - (cw / 2) * k, oy + (ch / 2) * k);
        sg.ellipse(ox, oy + (ch / 2) * k, (cw / 2) * k, ey * k, 0, Math.PI, 0, true);
        sg.lineTo(ox + (cw / 2) * k, oy - (ch / 2) * k);
        sg.closePath();
      };
      const gr = sg.createLinearGradient(ox - (cw / 2) * k, 0, ox + (cw / 2) * k, 0);
      gr.addColorStop(0, 'rgba(70,62,56,0.92)');
      gr.addColorStop(0.28, 'rgba(214,207,195,0.95)');
      gr.addColorStop(0.6, 'rgba(136,128,118,0.94)');
      gr.addColorStop(1, 'rgba(46,40,36,0.95)');
      body();
      sg.fillStyle = gr;
      sg.shadowColor = 'rgba(40,34,30,0.45)';
      sg.shadowBlur = Math.max(1, 0.04 * P * k);
      sg.fill();
      sg.shadowBlur = 0;
      sg.save();
      body();
      sg.clip();
      const lg = sg.createLinearGradient(ox - (cw / 2) * k, 0, ox + (cw / 2) * k, 0);
      lg.addColorStop(0, rgba(SEAL_D, 0.92));
      lg.addColorStop(0.3, rgba(SEAL, 0.8));
      lg.addColorStop(1, rgba(SEAL_D, 0.95));
      sg.fillStyle = lg;
      sg.beginPath();
      sg.ellipse(ox, oy - ch * 0.08 * k, (cw / 2 + 0.02 * P) * k, ey * k, 0, Math.PI, 0, true);
      sg.ellipse(ox, oy + ch * 0.24 * k, (cw / 2 + 0.02 * P) * k, ey * k, 0, 0, Math.PI, false);
      sg.closePath();
      sg.fill();
      sg.fillStyle = rgba(PAPER_L, 0.7);
      sg.fillRect(ox - cw * 0.1 * k, oy + ch * 0.04 * k, cw * 0.2 * k, ch * 0.05 * k);
      sg.restore();
      pull(sg, k, ox, oy, [[-cw * 0.2, ch * 0.42], [-cw * 0.2, -ch * 0.4]], 0.05 * P, 0.75, { rgb: PAPER_L, dry: 0.5, seed: 71, profile: PROFILE.stroke });
      sg.fillStyle = 'rgba(222,216,206,1)';
      sg.beginPath(); sg.ellipse(ox, oy - (ch / 2) * k, (cw / 2) * k, ey * k, 0, 0, TAU); sg.fill();
      stroke(sg, { pts: arcPts(0, 0, 1, -2.6, -2.6 + TAU * 0.95, 28).map(([x, y]) => [ox + x * (cw / 2) * k, oy - (ch / 2) * k + y * ey * k]), width: Math.max(0.9, 0.04 * P * k), tone: 0.85, dry: 0.45, seed: 72, rgb: INKB, bristles: 5 });
      pull(sg, k, ox, oy, [[-cw / 2, -ch / 2], [-cw / 2, ch / 2 + 0.01 * P]], 0.05 * P, 0.85, { seed: 73, dry: 0.5 });
      pull(sg, k, ox, oy, [[cw / 2, -ch / 2], [cw / 2, ch / 2 + 0.01 * P]], 0.055 * P, 0.9, { seed: 74, dry: 0.45 });
      stroke(sg, { pts: arcPts(0, 0, 1, Math.PI, 0, 16).map(([x, y]) => [ox + x * (cw / 2) * k, oy + (ch / 2) * k - y * ey * k]), width: Math.max(0.9, 0.045 * P * k), tone: 0.8, dry: 0.55, seed: 75, rgb: INKB, bristles: 5 });
      return { w: W, h: H, ax: W / 2, ay: H / 2 };
    },
    balloon(sg, k, P) {
      const rx = 0.42 * P, ry = 0.5 * P;
      const W = 1.1 * P, H = 1.3 * P, ox = (W / 2) * k, oy = 0.6 * P * k;
      sg.save();
      sg.translate(ox, oy);
      sg.scale(1, ry / rx);
      washDisc(sg, 0, 0, rx * k, SEAL, 0.86, 1, 5);
      sg.restore();
      sg.save();
      sg.beginPath(); sg.ellipse(ox, oy, rx * k, ry * k, 0, 0, TAU); sg.clip();
      blob(sg, ox + rx * 0.3 * k, oy + ry * 0.4 * k, rx * 0.9 * k, ry * 0.6 * k, SEAL_D, 0.35);
      sg.restore();
      pull(sg, k, ox, oy, [[-rx * 0.62, -ry * 0.18], [-rx * 0.5, -ry * 0.55], [-rx * 0.18, -ry * 0.78]], 0.07 * P, 0.75, { rgb: PAPER_L, dry: 0.4, seed: 81, profile: PROFILE.stroke });
      sg.fillStyle = rgba(SEAL_D, 0.95);
      sg.beginPath(); sg.moveTo(ox - 0.08 * P * k, oy + (ry + 0.08 * P) * k); sg.lineTo(ox + 0.08 * P * k, oy + (ry + 0.08 * P) * k); sg.lineTo(ox, oy + (ry - 0.03 * P) * k); sg.closePath(); sg.fill();
      return { w: W, h: H, ax: W / 2, ay: 0.6 * P };
    },
  };
  function drawSprite(name, px, x, y) {
    const k = clamp(Math.round((dpr / px) * 2) / 2, 1, 24);
    const key = name + '|' + k + '|' + world.P;
    let spr = sprites.get(key);
    if (!spr) {
      if (sprites.size > 24) sprites.clear();
      const P = world.P;
      const c = document.createElement('canvas');
      const sz = { gong: [world.gong.r * 2.8, world.gong.r * 2.8], bottle: [0.9 * P, 1.85 * P], can: [1.0 * P, 1.25 * P], balloon: [1.1 * P, 1.3 * P] }[name];
      c.width = Math.ceil(sz[0] * k);
      c.height = Math.ceil(sz[1] * k);
      const box = PAINT[name](c.getContext('2d'), k, P);
      spr = { c, ...box };
      sprites.set(key, spr);
    }
    g.drawImage(spr.c, x - spr.ax, y - spr.ay, spr.w, spr.h);
  }

  function drawBottle(x, y, px) {
    drawSprite('bottle', px, x, y);
  }

  function drawCan(x, yb, rot, alpha, px) {
    const ch = 0.92 * world.P;
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, yb - ch / 2);
    g.rotate(rot);
    drawSprite('can', px, 0, 0);
    g.restore();
  }

  function drawFx(e, px, inScope) {
    const P = world.P;
    const k = T - e.t0;
    if (e.type === 'dust') {
      const life = 1.5;
      if (k > life) return;
      const f = k / life;
      const r = rng(e.seed);
      for (let i = 0; i < 6; i++) {
        const dx = (r() - 0.5) * 0.9 * P, rise = (0.3 + r() * 0.6) * P * Math.sqrt(f);
        const rad = (0.25 + r() * 0.3) * P * (0.5 + 1.6 * Math.sqrt(f));
        g.fillStyle = rgba(EARTH, (1 - f) * 0.5 * (0.6 + r() * 0.4));
        g.beginPath(); g.ellipse(e.x + dx * (0.4 + f), e.y - rise, rad, rad * 0.8, 0, 0, TAU); g.fill();
      }
      for (let i = 0; i < 7; i++) {
        const vx = (r() - 0.5) * 3 * P, vy = -(2 + r() * 3) * P, kk = Math.min(k, 0.8);
        const x = e.x + vx * kk, y = e.y + vy * kk + 7 * P * kk * kk;
        if (y > e.y + 0.1 * P) continue;
        g.fillStyle = rgba(INK, 0.6 * (1 - f));
        g.beginPath(); g.arc(x, y, Math.max(0.05 * P, px * 0.6), 0, TAU); g.fill();
      }
      return;
    }
    if (e.type === 'puff') {
      if (k > 0.8) return;
      const f = k / 0.8;
      g.fillStyle = `rgba(250,247,240,${(0.7 * (1 - f)).toFixed(3)})`;
      g.beginPath(); g.arc(e.x, e.y, (0.1 + 0.4 * f) * P, 0, TAU); g.fill();
      return;
    }
    if (e.type === 'spark') {
      if (k > 0.14 || reduceMotion) return;
      const f = k / 0.14;
      g.strokeStyle = `rgba(255,252,240,${(1 - f).toFixed(3)})`;
      g.lineWidth = Math.max(0.05 * P, px);
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.3;
        g.moveTo(e.x + Math.cos(a) * 0.08 * P, e.y + Math.sin(a) * 0.08 * P);
        g.lineTo(e.x + Math.cos(a) * (0.2 + 0.3 * f) * P, e.y + Math.sin(a) * (0.2 + 0.3 * f) * P);
      }
      g.stroke();
      return;
    }
    if (e.type === 'shards') {
      const life = 1.4;
      if (k > life) return;
      const kk = reduceMotion ? 0.35 : k;
      const a = reduceMotion ? 0.7 * (1 - k / life) : 1 - k / life;
      g.fillStyle = `rgba(250,247,240,${(0.55 * Math.max(0, 1 - k / 0.4)).toFixed(3)})`;
      g.beginPath(); g.arc(e.x, e.y, (0.3 + 0.9 * Math.min(1, k / 0.4)) * P, 0, TAU); g.fill();
      for (const s of e.shards) {
        const x = s.x + s.vx * kk, y = s.y + s.vy * kk + 9 * P * kk * kk;
        g.save();
        g.translate(x, y);
        g.rotate(s.rot + s.om * kk);
        g.fillStyle = rgba([40, 46, 40], 0.85 * a);
        g.beginPath(); g.moveTo(-s.w, -s.w * 0.4); g.lineTo(s.w * 0.9, -s.w * 0.7); g.lineTo(s.w * 0.2, s.w * 0.9); g.closePath(); g.fill();
        g.fillStyle = `rgba(255,252,244,${(0.6 * a).toFixed(3)})`;
        g.fillRect(-s.w * 0.3, -s.w * 0.3, s.w * 0.4, s.w * 0.12);
        g.restore();
      }
      return;
    }
    if (e.type === 'can') {
      const life = 1.5;
      if (k > life) return;
      const kk = reduceMotion ? 0.5 : k;
      const x = e.x + e.side * 1.8 * P * kk;
      const y = e.y - 7 * P * kk + 13 * P * kk * kk;
      const a = k < 0.9 ? 1 : 1 - (k - 0.9) / 0.6;
      drawCan(x, y, e.side * 13 * kk, a, px);
      return;
    }
    if (e.type === 'splash') {
      const life = 2.2;
      if (k > life) return;
      const f = k / life;
      const a = 1 - f;
      const grow = reduceMotion ? 1 : 1 - Math.exp(-k * 6);
      g.fillStyle = rgba(SEAL, 0.25 * a);
      g.beginPath(); g.arc(e.x, e.y, (0.4 + 1.1 * grow) * P, 0, TAU); g.fill();
      for (const d of e.drops) {
        const dist = d.sp * (reduceMotion ? 0.25 : (1 - Math.exp(-k * 5)) / 5);
        const x = e.x + Math.cos(d.a) * dist, y = e.y + Math.sin(d.a) * dist + (reduceMotion ? 0 : 0.6 * P * k * k);
        g.fillStyle = rgba(SEAL, 0.9 * a);
        g.beginPath(); g.ellipse(x, y, d.r, d.r * 1.25, d.a, 0, TAU); g.fill();
      }
      return;
    }
    if (e.type === 'ring') {
      if (k > 0.9 || reduceMotion) return;
      const f = k / 0.9;
      g.lineWidth = Math.max(0.04 * P, px * 0.8);
      for (let i = 0; i < 3; i++) {
        const ff = f - i * 0.15;
        if (ff <= 0) continue;
        g.strokeStyle = `rgba(250,247,240,${(0.8 * (1 - ff)).toFixed(3)})`;
        g.beginPath(); g.arc(e.x, e.y, (0.7 + 1.6 * ff) * P, -0.9, 0.9); g.stroke();
        g.beginPath(); g.arc(e.x, e.y, (0.7 + 1.6 * ff) * P, Math.PI - 0.9, Math.PI + 0.9); g.stroke();
      }
    }
  }

  // --- render ---
  function render() {
    if (!world) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    if (baseDirty && (painted || T - baseAt > 0.12)) buildBase();
    g.drawImage(base, 0, 0);
    g.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    drawLive(1 / s, false);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMarkers();
    drawScope();
  }

  function drawMarkers() {
    g.save();
    g.font = `italic ${small ? 12 : 13}px "Instrument Serif", "Cormorant Garamond", serif`;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    targets.forEach((tg, i) => {
      const c = centre(tg);
      const x = ox + c.x * s, y = oy + (c.y - tg.h * 0.5 * world.P) * s;
      if (tg.hit) {
        g.fillStyle = rgba(SEAL, 0.8);
        g.beginPath(); g.arc(x, y - 9, 2.6, 0, TAU); g.fill();
        return;
      }
      g.strokeStyle = rgba(INK, 0.35);
      g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x, y - 9); g.stroke();
      g.fillStyle = rgba(INK, 0.7);
      g.fillText(String(i + 1), x, y - 12);
    });
    g.restore();
  }

  // lens overlay is cached and only redrawn when the size changes
  const lensSprite = document.createElement('canvas');
  let lensKey = '';
  const ringW = () => (small ? 9 : 12);
  const lensExt = () => Rs + ringW() + 46;
  function lensOverlay() {
    const mil = world.P * s * Z;
    const key = [Rs, mil, dpr, small].join('|');
    if (key === lensKey) return;
    lensKey = key;
    const ext = lensExt(), ring = ringW();
    const size = Math.ceil(ext * 2 * dpr);
    lensSprite.width = lensSprite.height = size;
    const c = lensSprite.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, (size / 2), (size / 2));
    const sh = c.createRadialGradient(0, 0, Rs, 0, 0, ext);
    sh.addColorStop(0, 'rgba(22,17,15,0.24)');
    sh.addColorStop(1, 'rgba(22,17,15,0)');
    c.fillStyle = sh;
    c.beginPath(); c.arc(0, 0, ext, 0, TAU); c.arc(0, 0, Rs, 0, TAU, true); c.fill();
    c.save();
    c.beginPath(); c.arc(0, 0, Rs, 0, TAU); c.clip();
    const vg = c.createRadialGradient(0, 0, Rs * 0.62, 0, 0, Rs);
    vg.addColorStop(0, 'rgba(22,17,15,0)');
    vg.addColorStop(0.75, 'rgba(22,17,15,0.12)');
    vg.addColorStop(1, 'rgba(22,17,15,0.62)');
    c.fillStyle = vg;
    c.fillRect(-Rs, -Rs, Rs * 2, Rs * 2);
    const gl = c.createRadialGradient(-Rs * 0.42, -Rs * 0.48, 0, -Rs * 0.42, -Rs * 0.48, Rs * 0.7);
    gl.addColorStop(0, 'rgba(255,255,255,0.16)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gl;
    c.fillRect(-Rs, -Rs, Rs * 2, Rs * 2);
    reticle(c, 0, 0, mil);
    c.restore();
    c.lineWidth = ring;
    const tube = c.createRadialGradient(0, 0, Rs, 0, 0, Rs + ring);
    tube.addColorStop(0, '#0d0a09');
    tube.addColorStop(0.55, '#2a2420');
    tube.addColorStop(1, '#16110f');
    c.strokeStyle = tube;
    c.beginPath(); c.arc(0, 0, Rs + ring / 2, 0, TAU); c.stroke();
    c.lineWidth = 1.2;
    c.strokeStyle = 'rgba(248,244,236,0.28)';
    c.beginPath(); c.arc(0, 0, Rs + ring - 1.5, Math.PI * 1.08, Math.PI * 1.42); c.stroke();
    c.strokeStyle = 'rgba(248,244,236,0.12)';
    c.beginPath(); c.arc(0, 0, Rs + 1, Math.PI * 0.15, Math.PI * 0.4); c.stroke();
  }

  function drawScope() {
    if (C.y - Rs - 70 > H) return; // rifle lowered
    const k = s * Z;
    const rk = recoil();
    // snap to device pixels or the reticle goes blurry
    const cx = Math.round((C.x + (reduceMotion ? 0 : rk * recoilSide * 3)) * dpr) / dpr;
    const cy = Math.round((C.y - (reduceMotion ? 0 : rk * 5)) * dpr) / dpr;
    const A = aimPoint(true);
    const R = world.R;
    lensOverlay();
    g.save();
    g.beginPath(); g.arc(cx, cy, Rs, 0, TAU); g.clip();
    g.fillStyle = rgba(PAPER, 1);
    g.fillRect(cx - Rs, cy - Rs, Rs * 2, Rs * 2);
    {
      const wx0 = A.x - Rs / k, wy0 = A.y - Rs / k, wx1 = A.x + Rs / k, wy1 = A.y + Rs / k;
      const cx0 = clamp(wx0, 0, world.Ww), cy0 = clamp(wy0, 0, world.Hw), cx1 = clamp(wx1, 0, world.Ww), cy1 = clamp(wy1, 0, world.Hw);
      if (cx1 > cx0 && cy1 > cy0) {
        g.drawImage(world.canvas, cx0 * R, cy0 * R, (cx1 - cx0) * R, (cy1 - cy0) * R,
          cx + (cx0 - A.x) * k, cy + (cy0 - A.y) * k, (cx1 - cx0) * k, (cy1 - cy0) * k);
      }
    }
    g.setTransform(dpr * k, 0, 0, dpr * k, dpr * (cx - A.x * k), dpr * (cy - A.y * k));
    drawTrace(1 / k);
    drawLive(1 / k, true);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fk = T - recoilAt;
    if (fk >= 0 && fk < 0.16 && !reduceMotion) {
      g.fillStyle = `rgba(252,249,242,${(0.85 * (1 - fk / 0.16)).toFixed(3)})`;
      g.fillRect(cx - Rs, cy - Rs, Rs * 2, Rs * 2);
    }
    g.restore();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(lensSprite, Math.round(cx * dpr - lensSprite.width / 2), Math.round(cy * dpr - lensSprite.height / 2));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (breath < 0.995 || hold.size) {
      const rr = Rs + ringW() + 6;
      g.lineCap = 'round';
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(248,244,236,0.5)';
      g.beginPath(); g.arc(cx, cy, rr, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9); g.stroke();
      g.strokeStyle = exhausted && hold.size ? rgba(INK, 0.75) : rgba(SEAL, 0.92);
      g.beginPath(); g.arc(cx, cy, rr, -Math.PI / 2 - 0.9, -Math.PI / 2 - 0.9 + 1.8 * clamp(breath, 0.001, 1)); g.stroke();
    }
  }

  function drawTrace(px) {
    if (reduceMotion) return;
    const P = world.P;
    for (const sh of shots) {
      const f = (T - sh.t0) / Math.max(0.05, sh.at - sh.t0);
      if (f < 0.08 || f > 1) continue;
      for (let i = 0; i < 4; i++) {
        const ff = Math.max(0, f - i * 0.05);
        const x = lerp(sh.from.x, sh.x, ff), y = lerp(sh.from.y, sh.y, ff) - Math.sin(Math.PI * ff) * 0.6 * P;
        g.fillStyle = `rgba(248,244,236,${(0.3 * (1 - i / 4) * (1 - f * 0.5)).toFixed(3)})`;
        g.beginPath(); g.arc(x, y, Math.max(0.12 * P * (1 - ff * 0.6), px * 1.5), 0, TAU); g.fill();
      }
    }
  }

  function reticle(c, cx, cy, mil) {
    const ink = 'rgba(16,12,10,0.92)';
    const halo = 'rgba(248,244,236,0.35)';
    const post = Math.min(Rs * 0.8, 5.5 * mil);
    c.lineCap = 'butt';
    // pale halo so the thin lines still show over dark trees
    for (const pass of [0, 1]) {
      c.strokeStyle = pass ? ink : halo;
      c.lineWidth = pass ? 1.1 : 2.6;
      c.beginPath();
      c.moveTo(cx - post, cy); c.lineTo(cx + post, cy);
      c.moveTo(cx, cy - post); c.lineTo(cx, cy + post);
      c.stroke();
    }
    c.fillStyle = ink;
    const pw = small ? 3.2 : 4.2;
    const posts = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of posts) {
      const a = post, b = Rs + 2;
      c.beginPath();
      if (dx) {
        c.moveTo(cx + dx * a, cy - 0.5);
        c.lineTo(cx + dx * (a + 8), cy - pw / 2);
        c.lineTo(cx + dx * b, cy - pw / 2);
        c.lineTo(cx + dx * b, cy + pw / 2);
        c.lineTo(cx + dx * (a + 8), cy + pw / 2);
        c.lineTo(cx + dx * a, cy + 0.5);
      } else {
        c.moveTo(cx - 0.5, cy + dy * a);
        c.lineTo(cx - pw / 2, cy + dy * (a + 8));
        c.lineTo(cx - pw / 2, cy + dy * b);
        c.lineTo(cx + pw / 2, cy + dy * b);
        c.lineTo(cx + pw / 2, cy + dy * (a + 8));
        c.lineTo(cx + 0.5, cy + dy * a);
      }
      c.closePath();
      c.fill();
    }
    // mil dots and half-mil hashes
    const n = Math.floor(post / mil + 0.02);
    const dot = small ? 1.7 : 2.1;
    for (let i = 1; i <= n; i++) {
      for (const [dx, dy] of posts) {
        const x = cx + dx * i * mil, y = cy + dy * i * mil;
        c.fillStyle = halo;
        c.beginPath(); c.arc(x, y, dot + 0.9, 0, TAU); c.fill();
        c.fillStyle = ink;
        c.beginPath(); c.arc(x, y, dot, 0, TAU); c.fill();
      }
    }
    c.strokeStyle = ink;
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 0.5; i < n; i += 1) {
      for (const [dx, dy] of posts) {
        const x = cx + dx * i * mil, y = cy + dy * i * mil;
        if (dx) { c.moveTo(x, y - 3); c.lineTo(x, y + 3); } else { c.moveTo(x - 3, y); c.lineTo(x + 3, y); }
      }
    }
    c.stroke();
    c.font = `${small ? 9 : 10}px "Cormorant Garamond", Georgia, serif`;
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    for (let i = 2; i <= n; i += 2) {
      c.fillStyle = halo;
      c.fillText(String(i), cx + 6.5, cy + i * mil + 0.5);
      c.fillStyle = ink;
      c.fillText(String(i), cx + 6, cy + i * mil);
      c.textAlign = 'center';
      c.fillText(String(i), cx + i * mil, cy + 10);
      c.fillText(String(i), cx - i * mil, cy + 10);
      c.textAlign = 'left';
    }
    c.fillStyle = 'rgba(248,244,236,0.7)';
    c.beginPath(); c.arc(cx, cy, 3.4, 0, TAU); c.fill();
    c.fillStyle = rgba(SEAL, 1);
    c.beginPath(); c.arc(cx, cy, 2.2, 0, TAU); c.fill();
  }

  function update(dt) {
    T += dt;
    if (keys.size) {
      keyHeld += dt;
      let vx = 0, vy = 0;
      if (keys.has('ArrowLeft')) vx -= 1;
      if (keys.has('ArrowRight')) vx += 1;
      if (keys.has('ArrowUp')) vy -= 1;
      if (keys.has('ArrowDown')) vy += 1;
      const sp = (hold.size ? 60 : 240) * Math.min(1, 0.3 + keyHeld * 1.4);
      Ct.x = clamp(Ct.x + vx * sp * dt, 0, W);
      Ct.y = clamp(Ct.y + vy * sp * dt, 0, H);
      lastInput = T;
    } else keyHeld = 0;
    // touch: the scope floats above the finger so it stays visible
    if (drag) {
      const lk = Math.min(1, (T - drag.t0) / 0.18);
      const offX = lerp(drag.offX, 0, lk), offY = lerp(drag.offY, -(Rs * 0.82 + 30), lk);
      Ct.x = clamp(drag.x + offX, 0, W);
      Ct.y = clamp(drag.y + offY, 0, H);
      if (!drag.long && T - drag.still > 0.45) { drag.long = true; setHold('touch', true); }
      lastInput = T;
    }
    const a = reduceMotion ? 1 : 1 - Math.exp(-dt * (drag ? 22 : 15));
    C.x += (Ct.x - C.x) * a;
    C.y += (Ct.y - C.y) * a;
    const holding = hold.size > 0;
    if (holding && breath > 0) {
      breath = Math.max(0, breath - dt / 4);
      if (breath === 0) { exhausted = true; if (!outWarned) { outWarned = true; toast(t('scope.breath.out')); } }
    } else if (!holding) {
      breath = Math.min(1, breath + dt / 2.6);
      if (breath > 0.3) exhausted = false;
      outWarned = false;
    }
    const steady = holding && breath > 0;
    const shaking = holding && breath <= 0;
    const ampT = steady ? 0.05 : shaking ? 1.25 : exhausted ? 0.85 : 0.5;
    const tremT = shaking ? 0.35 : 0;
    const brT = steady || shaking ? 0 : exhausted ? 0.5 : 0.28;
    const ka = 1 - Math.exp(-dt * (steady ? 5 : 2.2));
    amp += (ampT - amp) * ka;
    trem += (tremT - trem) * ka;
    breathAmp += (brT - breathAmp) * ka;
    windNext -= dt;
    if (windNext <= 0) {
      windNext = 7 + rand() * 9;
      if (rand() < 0.3) windDir *= -1;
      windTarget = windDir * (0.5 + rand() * 3.1);
    }
    wind += (windTarget - wind) * (1 - Math.exp(-dt / 3.5));
    if (shots.length) {
      const due = shots.filter((sh) => T >= sh.at);
      if (due.length) {
        shots = shots.filter((sh) => T < sh.at);
        due.forEach(land);
      }
    }
    if (fx.length) fx = fx.filter((e) => T - e.t0 < 2.5);
    if (doneAt > 0 && T >= doneAt && !celebrated) { doneAt = -1; celebrate(); }
    updateCard();
    updateWind();
    updateBreathUI();
    // keep the touch handle over the scope
    const gk = `${Math.round(C.x - Rs)},${Math.round(C.y - Rs)},${Math.round(Rs * 2)}`;
    if (gk !== grabCache) {
      grabCache = gk;
      grab.style.width = grab.style.height = `${Math.round(Rs * 2)}px`;
      grab.style.transform = `translate(${Math.round(C.x - Rs)}px, ${Math.round(C.y - Rs)}px)`;
    }
    // fade the card and wind badge when the scope passes under them
    if (overlays.dirty) measureOverlays();
    for (const o of overlays.list) {
      const nx = clamp(C.x, o.x, o.x + o.w), ny = clamp(C.y, o.y, o.y + o.h);
      const under = Math.hypot(C.x - nx, C.y - ny) < Rs * 0.86;
      if (under !== o.under) { o.under = under; o.el.classList.toggle('is-under', under); }
    }
  }

  function measureOverlays() {
    overlays.dirty = false;
    overlays.list = [cardEl, windEl].filter(Boolean).map((el) => ({ el, x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, under: el.classList.contains('is-under') }));
  }

  function busy() {
    return !!painter || shots.length > 0 || fx.length > 0 || hold.size > 0 || keys.size > 0 || !!drag
      || T - lastInput < (hover || focused ? 20 : 6) || T - recoilAt < 1.3 || doneAt > 0 || Math.abs(Ct.x - C.x) + Math.abs(Ct.y - C.y) > 0.3;
  }

  // css flutter only runs while the canvas does
  let live = false;
  function setLive(on) {
    if (on === live) return;
    live = on;
    root.classList.toggle('is-live', on);
  }

  function frame(now) {
    raf = 0;
    if (!active || destroyed || document.hidden) { setLive(false); return; }
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!world) resize();
    if (!world) { setLive(false); return; }
    if (painter) paintSlice(reduceMotion ? 40 : 11);
    update(dt);
    render();
    if (busy()) raf = requestAnimationFrame(frame);
    else setLive(false);
  }

  function poke() {
    if (!active || destroyed || raf || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
    setLive(true);
  }

  // input
  function setHold(src, on) {
    if (on) hold.add(src); else hold.delete(src);
    btnBreath.setAttribute('aria-pressed', String(hold.size > 0));
    root.classList.toggle('is-holding', hold.size > 0);
    lastInput = T;
    poke();
  }

  const local = (e) => {
    const r = view.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const inUI = (e) => !!(e.target.closest && e.target.closest('.scope-bar > *'));

  // the scope is the cursor here, so hide the site cursor over the valley
  let cursorHidden = false;
  function hideSiteCursor(on) {
    if (on === cursorHidden) return;
    const el = document.querySelector('.cursor');
    if (!el) return;
    cursorHidden = on;
    el.style.visibility = on ? 'hidden' : '';
  }

  // touch help on touch-first devices, or as soon as a finger shows up
  const finePointer = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
  let touchSeen = mobile && !finePointer;
  function sawTouch() {
    if (touchSeen) return;
    touchSeen = true;
    root.classList.add('is-touch');
    setHelp();
  }
  // one span per phrase so lines only break between phrases
  function setHelp() {
    if (!helpEl) return;
    helpEl.textContent = '';
    t(touchSeen ? 'scope.help.touch' : 'scope.help').split(' · ').forEach((part, i) => {
      if (i) helpEl.append(' · ');
      const span = document.createElement('span');
      span.className = 'scope-help-part';
      span.textContent = part;
      helpEl.append(span);
    });
  }

  function onPointerMove(e) {
    if (e.pointerType === 'touch') {
      if (drag && e.pointerId === drag.id) {
        const p = local(e);
        drag.x = p.x; drag.y = p.y;
        // a resting finger holds the breath, a real move (not just a tremble) lets go
        if (Math.hypot(p.x - drag.ax, p.y - drag.ay) > (drag.long ? 36 : 8)) {
          drag.ax = p.x; drag.ay = p.y; drag.still = T;
          if (drag.long) { drag.long = false; setHold('touch', false); }
        }
        poke();
      }
      if (tap && e.pointerId === tap.id) {
        const p = local(e);
        if (Math.hypot(p.x - tap.x, p.y - tap.y) > 10) tap = null;
      }
      return;
    }
    const ui = inUI(e);
    hideSiteCursor(!ui);
    if (ui) return;
    const p = local(e);
    Ct.x = clamp(p.x, 0, W);
    Ct.y = clamp(p.y, 0, H);
    placed = true;
    hover = true;
    lastInput = T;
    poke();
  }

  function onPointerDown(e) {
    if (e.pointerType === 'touch') sawTouch();
    if (inUI(e)) return;
    if (e.pointerType === 'touch') {
      const p = local(e);
      if (e.target === grab || Math.hypot(p.x - C.x, p.y - C.y) < Rs) {
        drag = { id: e.pointerId, x: p.x, y: p.y, ax: p.x, ay: p.y, offX: C.x - p.x, offY: C.y - p.y, t0: T, still: T, long: false };
        try { grab.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
      } else {
        tap = { id: e.pointerId, x: p.x, y: p.y, t: performance.now() };
      }
      placed = true;
      lastInput = T;
      poke();
      return;
    }
    if (e.button !== 0) return;
    const p = local(e);
    Ct.x = clamp(p.x, 0, W);
    Ct.y = clamp(p.y, 0, H);
    placed = true;
    fire();
  }

  function onPointerUp(e) {
    if (drag && e.pointerId === drag.id) {
      if (drag.long) setHold('touch', false);
      drag = null;
      lastInput = T;
      poke();
    }
    if (tap && e.pointerId === tap.id) {
      if (e.type === 'pointerup' && performance.now() - tap.t < 500) {
        Ct.x = clamp(tap.x, 0, W);
        Ct.y = clamp(tap.y, 0, H);
        lastInput = T;
        poke();
      }
      tap = null;
    }
  }

  const AIM_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
  function onKeyDown(e) {
    if (AIM_KEYS.has(e.key)) {
      e.preventDefault();
      keys.add(e.key);
      placed = true;
      poke();
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) fire();
    } else if (e.key === 'Shift') {
      setHold('key', true);
    }
  }
  function onKeyUp(e) {
    if (AIM_KEYS.has(e.key)) keys.delete(e.key);
    else if (e.key === 'Shift') setHold('key', false);
  }
  function onFocus() { focused = true; lastInput = T; poke(); }
  function onBlur() { focused = false; keys.clear(); setHold('key', false); }
  // shift works on hover too, no click needed first
  function onWinKey(e) {
    if (e.key !== 'Shift' || focused) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.type === 'keydown' && hover) setHold('key', true);
    else if (e.type === 'keyup') setHold('key', false);
  }

  // touch fires on contact (other thumb may be steadying the scope), ignore the click after
  let fireTouchAt = -1e9;
  function onFireDown(e) {
    if (e.pointerType === 'touch') { fireTouchAt = performance.now(); e.preventDefault(); fire(); }
  }
  function onFireClick() {
    if (performance.now() - fireTouchAt < 800) return;
    fire();
  }
  function onBreathDown(e) {
    e.preventDefault();
    try { btnBreath.setPointerCapture(e.pointerId); } catch (err) {}
    setHold('btn', true);
  }
  function onBreathUp() { setHold('btn', false); }
  function onBreathKey(e) {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (e.type === 'keydown' && !e.repeat) setHold('btn', true);
    if (e.type === 'keyup') setHold('btn', false);
  }
  const noMenu = (e) => e.preventDefault();
  const onLeave = () => { hover = false; hideSiteCursor(false); };
  function releaseAll() {
    keys.clear();
    drag = null;
    if (hold.size) { hold.clear(); setHold('none', false); }
  }
  const onVis = () => { if (!document.hidden) poke(); else releaseAll(); };

  const ac = new AbortController();
  const on = (el, type, fn) => el.addEventListener(type, fn, { signal: ac.signal });
  on(stage, 'pointermove', onPointerMove);
  on(stage, 'pointerdown', onPointerDown);
  on(stage, 'pointerup', onPointerUp);
  on(stage, 'pointercancel', onPointerUp);
  on(stage, 'pointerleave', onLeave);
  on(stage, 'contextmenu', noMenu);
  on(view, 'keydown', onKeyDown);
  on(view, 'keyup', onKeyUp);
  on(view, 'focus', onFocus);
  on(view, 'blur', onBlur);
  on(btnFire, 'pointerdown', onFireDown);
  on(btnFire, 'click', onFireClick);
  on(btnBreath, 'pointerdown', onBreathDown);
  on(btnBreath, 'pointerup', onBreathUp);
  on(btnBreath, 'pointercancel', onBreathUp);
  on(btnBreath, 'lostpointercapture', onBreathUp);
  on(btnBreath, 'keydown', onBreathKey);
  on(btnBreath, 'keyup', onBreathKey);
  on(btnBreath, 'blur', onBreathUp);
  on(btnBreath, 'click', (e) => e.preventDefault());
  on(btnAgain, 'click', reset);
  on(document, 'visibilitychange', onVis);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { overlays.dirty = true; resize(); if (!active) baseDirty = true; }) : null;
  if (ro) { ro.observe(view); ro.observe(cardEl); ro.observe(windEl); } else on(window, 'resize', resize);

  if (touchSeen) root.classList.add('is-touch');
  if (reduceMotion) root.classList.add('is-still');

  // resize when moved to a screen with a different dpr
  function watchDpr() {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    if (mq.addEventListener) mq.addEventListener('change', () => { if (!destroyed) { resize(); watchDpr(); } }, { once: true, signal: ac.signal });
  }
  watchDpr();

  function relabel() {
    lang.dec = t('scope.decimal') === ',' ? ',' : '.';
    // drop any toast still in the old language
    clearTimeout(toastTimer);
    toastEl.classList.remove('is-on');
    toastEl.textContent = '';
    root.querySelectorAll('[data-sk]').forEach((el) => { el.textContent = t(el.dataset.sk); });
    root.querySelectorAll('[data-sk-label]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.skLabel)));
    view.setAttribute('aria-roledescription', t('scope.role'));
    view.setAttribute('aria-label', t('scope.aria'));
    setHelp();
    updateCard(true);
    updateWind(true);
    updateTally();
    overlays.dirty = true;
    poke();
  }

  buildCard();
  relabel();
  toastEl.classList.remove('is-on');
  resize();

  function setActive(on) {
    on = !!on;
    if (on === active) return;
    active = on;
    if (on) {
      addEventListener('keydown', onWinKey);
      addEventListener('keyup', onWinKey);
      resize();
      lastInput = T;
      if (!paintStarted && painter) toast(t('scope.painting'), 1600);
      poke();
    } else {
      removeEventListener('keydown', onWinKey);
      removeEventListener('keyup', onWinKey);
      releaseAll();
      hideSiteCursor(false);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      setLive(false);
    }
  }

  function destroy() {
    setActive(false);
    destroyed = true;
    clearTimeout(toastTimer);
    ac.abort();
    if (ro) ro.disconnect();
    if (world) { world.canvas.width = world.canvas.height = 0; world = null; }
    base.width = base.height = soft.width = soft.height = lensSprite.width = lensSprite.height = 0;
    sprites.clear();
    painter = null;
  }

  return {
    setActive,
    relabel,
    destroy,
    // test hooks, positions in stage px
    __debug: () => world && ({
      W, H, Z, Rs, s, ox, oy, P: world.P, wind, breath, painted, T, raf, active, lastInput, busy: busy(),
      mil: world.P * s * Z,
      C: { ...C },
      targets: targets.map((tg) => {
        const c = centre(tg);
        return { id: tg.id, d: tg.d, hit: tg.hit, x: ox + c.x * s, y: oy + c.y * s, drop: dropMil(tg.d), drift: driftMil(tg.d, wind) };
      }),
      aimAt(x, y) { Ct.x = x; Ct.y = y; C.x = x; C.y = y; placed = true; lastInput = T; poke(); },
      fire,
      setWind(v) { wind = windTarget = v; windNext = 999; },
      winAll() { targets.forEach((x) => { x.hit = true; }); updateTally(); celebrate(); poke(); },
      paintAll() { const t0 = performance.now(); while (painter) paintSlice(1e9); return performance.now() - t0; },
    }),
  };
}
