// ─────────────────────────────────────────────────────────────────────────────
//  Turn a photo into a Korean ink painting (수묵화).
//  Brush outlines come from a difference of Gaussians (dark lines where a
//  region is darker than its surroundings, broken by a dry brush); tones are
//  laid in as three or four washes whose edges wander, granulate and pool
//  darker at their rims; finally the ink bleeds a little into the hanji.
// ─────────────────────────────────────────────────────────────────────────────
import { noiseData } from './noise.js?v=84ce73c042';

const PAPER = [241, 235, 224];
const INK = [24, 19, 17];

function boxesForGauss(sigma, n = 3) {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
  const m = Math.round(mIdeal);
  return Array.from({ length: n }, (_, i) => (i < m ? wl : wu));
}
function boxH(src, dst, w, h, r) {
  const iarr = 1 / (r + r + 1);
  for (let y = 0; y < h; y++) {
    let ti = y * w, li = ti, ri = ti + r;
    const fv = src[ti], lv = src[ti + w - 1];
    let val = (r + 1) * fv;
    for (let j = 0; j < r; j++) val += src[ti + Math.min(j, w - 1)];
    for (let j = 0; j <= r; j++) { val += src[Math.min(ri++, y * w + w - 1)] - fv; dst[ti++] = val * iarr; }
    for (let j = r + 1; j < w - r; j++) { val += src[ri++] - src[li++]; dst[ti++] = val * iarr; }
    for (let j = w - r; j < w; j++) { val += lv - src[li++]; dst[ti++] = val * iarr; }
  }
}
function boxV(src, dst, w, h, r) {
  const iarr = 1 / (r + r + 1);
  for (let x = 0; x < w; x++) {
    let ti = x, li = ti, ri = ti + r * w;
    const fv = src[ti], lv = src[ti + w * (h - 1)];
    let val = (r + 1) * fv;
    for (let j = 0; j < r; j++) val += src[ti + Math.min(j, h - 1) * w];
    for (let j = 0; j <= r; j++) { val += src[Math.min(ri, x + (h - 1) * w)] - fv; dst[ti] = val * iarr; ri += w; ti += w; }
    for (let j = r + 1; j < h - r; j++) { val += src[ri] - src[li]; dst[ti] = val * iarr; li += w; ri += w; ti += w; }
    for (let j = h - r; j < h; j++) { val += lv - src[li]; dst[ti] = val * iarr; li += w; ti += w; }
  }
}
function gauss(src, w, h, sigma) {
  const out = Float32Array.from(src);
  if (sigma < 0.3) return out;
  const tmp = new Float32Array(src.length);
  for (const b of boxesForGauss(sigma)) {
    const r = Math.max(0, (b - 1) >> 1);
    if (!r) continue;
    boxH(out, tmp, w, h, r);
    boxV(tmp, out, w, h, r);
  }
  return out;
}
/** Kuwahara filter via integral images: painterly, edge-preserving flattening. */
function kuwahara(src, w, h, r) {
  const W = w + 1;
  const S = new Float64Array(W * (h + 1)), Q = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let rs = 0, rq = 0;
    for (let x = 0; x < w; x++) {
      const v = src[y * w + x];
      rs += v; rq += v * v;
      S[(y + 1) * W + x + 1] = S[y * W + x + 1] + rs;
      Q[(y + 1) * W + x + 1] = Q[y * W + x + 1] + rq;
    }
  }
  const box = (A, x0, y0, x1, y1) => A[(y1 + 1) * W + x1 + 1] - A[y0 * W + x1 + 1] - A[(y1 + 1) * W + x0] + A[y0 * W + x0];
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = Infinity, mean = src[y * w + x];
      for (let q = 0; q < 4; q++) {
        const x0 = Math.max(0, q & 1 ? x : x - r), x1 = Math.min(w - 1, q & 1 ? x + r : x);
        const y0 = Math.max(0, q & 2 ? y : y - r), y1 = Math.min(h - 1, q & 2 ? y + r : y);
        const cnt = (x1 - x0 + 1) * (y1 - y0 + 1);
        const m = box(S, x0, y0, x1, y1) / cnt;
        const v = box(Q, x0, y0, x1, y1) / cnt - m * m;
        if (v < best) { best = v; mean = m; }
      }
      out[y * w + x] = mean;
    }
  }
  return out;
}

const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * @param source  image or canvas
 * @param opts.max     longest side of the result
 * @param opts.color   0 = pure ink, 1 = a light wash of the photo's own colours
 * @param opts.seed    varies the noise so no two paintings share their washes
 */
export function inkify(source, { max = 1000, color = 0.12, seed = 0 } = {}) {
  const sw = source.naturalWidth || source.width, sh = source.naturalHeight || source.height;
  const s = Math.min(1, max / Math.max(sw, sh));
  const w = Math.max(8, Math.round(sw * s)), h = Math.max(8, Math.round(sh * s));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(source, 0, 0, w, h);
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;

  // luminance, stretched between the 2nd and 98th percentiles
  const L = new Float32Array(n);
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const v = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    L[i] = v / 255;
    hist[v | 0]++;
  }
  let acc = 0, lo = 0, hi = 255;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > n * 0.02) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > n * 0.02) { hi = v; break; } }
  const span = Math.max(0.08, (hi - lo) / 255), off = lo / 255;
  for (let i = 0; i < n; i++) L[i] = Math.max(0, Math.min(1, (L[i] - off) / span));

  const k = Math.max(0.45, w / 900);
  // flatten into painterly regions first, then soften their edges a touch
  const K = kuwahara(gauss(L, w, h, 0.7 * k), w, h, Math.max(2, Math.round(5 * k)));
  const G1 = gauss(K, w, h, 0.8 * k + 0.35);
  const G2 = gauss(K, w, h, 2.6 * k);
  const Gw = gauss(K, w, h, 1.6 * k);

  // noise (tileable, bilinear)
  const nd = noiseData(256).data;
  const N = (x, y, sc, ch) => {
    const fx = (x * sc + seed * 37.1) % 256, fy = (y * sc + seed * 19.7) % 256;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255;
    const a = nd[((y0 & 255) * 256 + (x0 & 255)) * 4 + ch], b = nd[((y0 & 255) * 256 + x1) * 4 + ch];
    const cc = nd[(y1 * 256 + (x0 & 255)) * 4 + ch], dd = nd[(y1 * 256 + x1) * 4 + ch];
    return ((a + (b - a) * tx) * (1 - ty) + (cc + (dd - cc) * tx) * ty) / 255;
  };

  // washes: mostly continuous, with two soft wet edges, uneven like a real brush
  const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return v - Math.floor(v); };
  const wash = new Float32Array(n);
  const inv = 1 / k;
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++) {
      const t = 1 - Gw[i];
      const j = (N(x * inv, y * inv, 0.3, 0) - 0.5) * 0.14;
      let dv = Math.pow(sm(0.12, 0.98, t), 1.5) * 0.36
             + 0.12 * sm(0.3 + j, 0.36 + j, t)
             + 0.16 * sm(0.52 + j, 0.58 + j, t)
             + 0.22 * sm(0.74 + j, 0.8 + j, t);
      // the darkest washes are laid with a drier, streaky brush
      const streak = N(x * inv * 0.5, y * inv * 4, 1.3, 2);
      dv *= 1 - sm(0.7, 0.95, t) * sm(0.55, 0.8, streak) * 0.35;
      dv *= 0.84 + 0.32 * N(x * inv, y * inv, 0.22, 3);   // uneven loading of the brush
      dv *= 0.95 + 0.1 * hash(x, y);                        // fine granulation
      wash[i] = dv;
    }
  }
  const washB = gauss(wash, w, h, 3 * k);
  // lines: a dry brush along the darker side of edges
  const dens = new Float32Array(n);
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++) {
      const dog = G2[i] - G1[i];
      let line = sm(0.022, 0.085, dog);
      const dry = sm(0.25, 0.55, N(x * inv * 0.6, y * inv * 3.5, 1.4, 2) * 0.6 + N(x * inv * 3.5, y * inv * 0.6, 1.4, 1) * 0.4);
      line *= 0.6 + 0.4 * dry;
      const pool = Math.max(0, wash[i] - washB[i]) * 1.5;
      dens[i] = Math.min(1, wash[i] + pool + line * 0.82);
    }
  }
  // ink bleeds into the fibres
  const bleed = gauss(dens, w, h, 1.1 * k);
  const fib = (x, y) => N(x * 0.9, y * 0.9, 1, 2);
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++) {
      const D = Math.min(1, Math.max(dens[i], bleed[i] * 0.94));
      const paper = 0.975 + 0.04 * fib(x, y);
      const o = i * 4;
      for (let ch = 0; ch < 3; ch++) {
        const base = PAPER[ch] * paper;
        const inked = base + (INK[ch] - base) * D;
        // a whisper of the photo's own colour, carried by the wash
        const tint = base * (d[o + ch] / 255) * 0.95 + base * 0.05;
        const tinted = tint + (INK[ch] - tint) * D;
        d[o + ch] = inked + (tinted - inked) * color * (1 - D * 0.6);
      }
      d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
