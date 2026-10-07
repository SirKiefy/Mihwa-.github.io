// Her palette: the dominant colours across all her photos (k-means in RGB).
import { rng } from '../ink/brush.js';

export function extractPalette(photos, k = 6) {
  const px = [];
  const c = document.createElement('canvas');
  const g = c.getContext('2d', { willReadFrequently: true });
  for (const ph of photos) {
    const src = ph.image || ph.canvas;
    const w = 40, h = Math.max(8, Math.round(40 * (ph.height / ph.width)));
    c.width = w; c.height = h;
    try {
      g.drawImage(src, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) px.push([d[i], d[i + 1], d[i + 2]]);
    } catch { /* a tainted image: skip it */ }
  }
  if (!px.length) return [];
  const R = rng(5);
  // k-means++ seeding
  const cent = [px[Math.floor(R() * px.length)].slice()];
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  while (cent.length < k) {
    const ds = px.map((p) => Math.min(...cent.map((q) => d2(p, q))));
    const sum = ds.reduce((a, b) => a + b, 0);
    let r = R() * sum, i = 0;
    while (r > ds[i] && i < ds.length - 1) r -= ds[i++];
    cent.push(px[i].slice());
  }
  const lab = new Uint8Array(px.length);
  for (let it = 0; it < 12; it++) {
    const acc = cent.map(() => [0, 0, 0, 0]);
    px.forEach((p, i) => {
      let best = 0, bd = Infinity;
      cent.forEach((q, j) => { const dd = d2(p, q); if (dd < bd) { bd = dd; best = j; } });
      lab[i] = best;
      const a = acc[best]; a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3]++;
    });
    acc.forEach((a, j) => { if (a[3]) cent[j] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
  }
  const counts = cent.map(() => 0);
  lab.forEach((l) => counts[l]++);
  const hex = (v) => Math.round(v).toString(16).padStart(2, '0');
  return cent
    .map((c, j) => ({ rgb: c, hex: `#${hex(c[0])}${hex(c[1])}${hex(c[2])}`.toUpperCase(), share: counts[j] / px.length, lum: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2] }))
    .filter((s) => s.share > 0.01)
    .sort((a, b) => a.lum - b.lum);
}
