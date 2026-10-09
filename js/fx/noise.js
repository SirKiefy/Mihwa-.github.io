// A baked, tileable noise texture shared by every shader on the site.
// R: fbm (period 4) · G: fbm (period 8) · B: fine (period 16) · A: broad (period 2)
import { rng } from '../ink/brush.js?v=774a543f68';

function tileFbm(size, period, octaves, seed) {
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const p = period << o;
    const R = rng(seed * 31 + o * 7 + 1);
    const lat = new Float32Array(p * p);
    for (let i = 0; i < lat.length; i++) lat[i] = R();
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * p, iy = Math.floor(fy), ty = fy - iy;
      const sy = ty * ty * ty * (ty * (ty * 6 - 15) + 10);
      const y0 = (iy % p) * p, y1 = ((iy + 1) % p) * p;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * p, ix = Math.floor(fx), tx = fx - ix;
        const sx = tx * tx * tx * (tx * (tx * 6 - 15) + 10);
        const x0 = ix % p, x1 = (ix + 1) % p;
        const a = lat[y0 + x0] + (lat[y0 + x1] - lat[y0 + x0]) * sx;
        const b = lat[y1 + x0] + (lat[y1 + x1] - lat[y1 + x0]) * sx;
        out[y * size + x] += (a + (b - a) * sy) * amp;
      }
    }
    total += amp;
    amp *= 0.5;
  }
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < out.length; i++) { out[i] /= total; mn = Math.min(mn, out[i]); mx = Math.max(mx, out[i]); }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - mn) / (mx - mn);
  return out;
}

let cached = null;
/** RGBA8 data for a size×size tileable noise texture (memoised). */
export function noiseData(size = 256) {
  if (cached && cached.size === size) return cached;
  const chans = [tileFbm(size, 4, 5, 1), tileFbm(size, 8, 4, 2), tileFbm(size, 16, 3, 3), tileFbm(size, 2, 6, 4)];
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) for (let c = 0; c < 4; c++) data[i * 4 + c] = Math.round(chans[c][i] * 255);
  cached = { size, data };
  return cached;
}
