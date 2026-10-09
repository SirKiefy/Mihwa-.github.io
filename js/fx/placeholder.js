// fake film photos, shown until real ones are added in her.js
import { rng } from '../ink/brush.js?v=e0590b5d34';

const TONES = [
  ['#2c1f1b', '#b9805f', '#f0b27a'],
  ['#2a2419', '#c9a26a', '#ffd9a0'],
  ['#1f2826', '#8fa597', '#e8e1c8'],
  ['#2d1d20', '#c4898a', '#f6c9c0'],
  ['#26251c', '#a99d73', '#efe2b6'],
  ['#1b202b', '#7b8aa6', '#d9d4e4'],
  ['#2e211d', '#d19a7e', '#ffd2b8'],
  ['#231c17', '#a88867', '#ead3ae'],
  ['#1f1c24', '#9b8aa4', '#f0d7d7'],
  ['#27201a', '#b48b62', '#f7c98f'],
  ['#1d2320', '#96a58c', '#f1e6c4'],
  ['#2b1b18', '#c07a62', '#f5b89a'],
];

export function makePlaceholder(i, aspect = 4 / 5, label = 'your photo here', long = 900) {
  const w = aspect >= 1 ? long : Math.round(long * aspect);
  const h = aspect >= 1 ? Math.round(long / aspect) : long;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const R = rng(1000 + i * 17);
  const [dark, mid, light] = TONES[i % TONES.length];

  const a = R() * Math.PI * 2;
  const grd = g.createLinearGradient(w / 2 - Math.cos(a) * w, h / 2 - Math.sin(a) * h, w / 2 + Math.cos(a) * w, h / 2 + Math.sin(a) * h);
  grd.addColorStop(0, mid);
  grd.addColorStop(0.5, light);
  grd.addColorStop(1, light);
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);

  // blurry room shapes
  for (let k = 0; k < 7; k++) {
    const x = R() * w, y = R() * h, r = (0.25 + R() * 0.5) * Math.max(w, h);
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    const col = R() < 0.3 ? mid : light;
    rg.addColorStop(0, hexA(col, 0.3 + R() * 0.25));
    rg.addColorStop(1, hexA(col, 0));
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
  }

  // bokeh
  g.globalCompositeOperation = 'screen';
  const nb = 10 + Math.floor(R() * 14);
  for (let k = 0; k < nb; k++) {
    const x = R() * w, y = R() * h * 0.8, r = (0.015 + R() * 0.05) * w;
    const rg = g.createRadialGradient(x, y, r * 0.6, x, y, r);
    rg.addColorStop(0, hexA(light, 0.16 + R() * 0.2));
    rg.addColorStop(0.9, hexA(light, 0.2 + R() * 0.2));
    rg.addColorStop(1, hexA(light, 0));
    g.fillStyle = rg;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.globalCompositeOperation = 'source-over';

  // a figure, so the ink version has someone in it
  drawFigure(g, w, h, R, i, dark, mid, light);

  g.globalCompositeOperation = 'screen';
  // light leak
  const lx = R() < 0.5 ? 0 : w, ly = R() * h;
  const leak = g.createRadialGradient(lx, ly, 0, lx, ly, w * 0.9);
  leak.addColorStop(0, 'rgba(255,120,60,0.55)');
  leak.addColorStop(0.35, 'rgba(255,90,50,0.18)');
  leak.addColorStop(1, 'rgba(255,90,50,0)');
  g.fillStyle = leak;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';

  const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);

  // grain
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let p = 0; p < d.length; p += 4) {
    const n = (R() - 0.5) * 22;
    d[p] += n; d[p + 1] += n; d[p + 2] += n;
  }
  g.putImageData(img, 0, 0);

  const fs = Math.round(w * 0.032);
  g.font = `500 ${fs}px "DM Mono", ui-monospace, monospace`;
  g.fillStyle = 'rgba(255,248,236,0.72)';
  g.textBaseline = 'bottom';
  g.fillText(`${String(i + 1).padStart(2, '0')}  ·  ${label}`, fs * 1.4, h - fs * 1.3);

  return { canvas: c, url: c.toDataURL('image/jpeg', 0.88), width: w, height: h, placeholder: true };
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// entries without a src try photos/01.jpg, 02.jpg and so on (jpeg, png and webp
// work too), so you can just drop files in named like that. missing ones get a placeholder
const EXT = ['jpg', 'jpeg', 'png', 'webp'];
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
export async function loadPhotos(list, label) {
  return Promise.all(list.map(async (p, i) => {
    const tries = p.src ? [p.src] : EXT.map((e) => `photos/${String(i + 1).padStart(2, '0')}.${e}`);
    for (const src of tries) {
      const img = await loadImage(src);
      if (img) return { image: img, url: src, width: img.naturalWidth, height: img.naturalHeight, placeholder: false, meta: p, index: i };
    }
    return { ...makePlaceholder(i, p.aspect || 4 / 5, label), meta: p, index: i };
  }));
}

const lerp = (a, b, t) => a + (b - a) * t;
function mixHex(a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((sh) => Math.round(lerp((A >> sh) & 255, (B >> sh) & 255, t)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// [x, y, head size as a fraction of height, tilt, turn, hair]  hair: 0 long, 1 bob, 2 bun
const POSES = [
  [0.52, 0.36, 0.17, -0.06, 0.3, 0],
  [0.38, 0.36, 0.16, 0.1, 0.6, 0],
  [0.6, 0.33, 0.18, -0.12, -0.45, 1],
  [0.5, 0.4, 0.15, 0.04, 0.1, 2],
  [0.44, 0.33, 0.21, 0.14, 0.35, 0],
  [0.62, 0.37, 0.15, -0.05, -0.7, 0],
  [0.4, 0.35, 0.17, 0.08, 0.5, 1],
  [0.55, 0.32, 0.22, -0.1, -0.2, 0],
  [0.5, 0.38, 0.17, 0.12, 0.0, 2],
  [0.36, 0.34, 0.19, -0.14, 0.7, 0],
  [0.58, 0.35, 0.18, 0.06, -0.35, 1],
  [0.47, 0.36, 0.16, -0.04, 0.4, 0],
];

function drawFigure(g, w, h, R, i, dark, mid, light) {
  const [px, py, hs, tilt, turn, hair] = POSES[i % POSES.length];
  const H = hs * h * (w / h > 1 ? 1.15 : 1);
  const layer = document.createElement('canvas');
  layer.width = w; layer.height = h;
  const f = layer.getContext('2d');
  f.translate(px * w, py * h);
  f.rotate(tilt * 0.5);

  // light comes from the side the face turns to
  const ls = turn >= 0 ? -1 : 1;
  const hairCol = f.createLinearGradient(ls * 0.7 * H, -0.8 * H, -ls * 0.5 * H, 1.2 * H);
  hairCol.addColorStop(0, '#4a3a33');
  hairCol.addColorStop(0.35, '#1c1512');
  hairCol.addColorStop(1, '#0e0a09');
  const cloth = f.createLinearGradient(ls * 1.2 * H, 0.9 * H, -ls * 0.6 * H, 3.2 * H);
  cloth.addColorStop(0, mixHex(mid, light, 0.1));
  cloth.addColorStop(0.45, mixHex(dark, mid, 0.35));
  cloth.addColorStop(1, mixHex(dark, '#000000', 0.25));
  const skin = mixHex(mid, light, 0.55);
  const shade = mixHex(mid, dark, 0.35);
  const fx = turn * 0.13 * H; // face offset inside the hair

  // back of the long hair, behind the shoulders
  f.fillStyle = hairCol;
  if (hair === 0) {
    f.beginPath();
    f.moveTo(-0.5 * H - fx * 0.3, -0.1 * H);
    f.bezierCurveTo(-0.68 * H, 0.5 * H, -0.66 * H, 1.1 * H, -0.72 * H, 1.55 * H);
    f.lineTo(0.72 * H, 1.55 * H);
    f.bezierCurveTo(0.66 * H, 1.1 * H, 0.68 * H, 0.5 * H, 0.5 * H - fx * 0.3, -0.1 * H);
    f.closePath();
    f.fill();
  }

  f.save();
  f.rotate(tilt * 0.6);
  f.fillStyle = cloth;
  f.beginPath();
  f.moveTo(-0.22 * H, 0.82 * H);
  f.bezierCurveTo(-0.45 * H, 1.0 * H, -1.0 * H, 1.02 * H, -1.2 * H, 1.36 * H);
  f.bezierCurveTo(-1.34 * H, 1.62 * H, -1.3 * H, 2.4 * H, -1.42 * H, 5 * H);
  f.lineTo(1.42 * H, 5 * H);
  f.bezierCurveTo(1.3 * H, 2.4 * H, 1.34 * H, 1.62 * H, 1.2 * H, 1.36 * H);
  f.bezierCurveTo(1.0 * H, 1.02 * H, 0.45 * H, 1.0 * H, 0.22 * H, 0.82 * H);
  f.closePath();
  f.fill();
  f.fillStyle = skin;
  f.beginPath();
  f.moveTo(-0.34 * H + fx * 0.3, 1.0 * H);
  f.quadraticCurveTo(fx * 0.3, 1.5 * H, 0.34 * H + fx * 0.3, 1.0 * H);
  f.closePath();
  f.fill();
  f.restore();

  f.fillStyle = shade;
  f.beginPath();
  f.moveTo(-0.17 * H + fx * 0.4, 0.3 * H);
  f.lineTo(-0.2 * H + fx * 0.3, 0.95 * H);
  f.quadraticCurveTo(fx * 0.3, 1.08 * H, 0.2 * H + fx * 0.3, 0.95 * H);
  f.lineTo(0.17 * H + fx * 0.4, 0.3 * H);
  f.closePath();
  f.fill();

  // hair around the head, then bob or bun
  f.fillStyle = hairCol;
  f.beginPath();
  f.ellipse(-fx * 0.35, -0.06 * H, 0.52 * H, 0.6 * H, 0, 0, Math.PI * 2);
  f.fill();
  if (hair === 1) {
    f.beginPath();
    f.moveTo(-0.52 * H - fx * 0.35, -0.1 * H);
    f.quadraticCurveTo(-0.6 * H, 0.5 * H, -0.42 * H, 0.66 * H);
    f.lineTo(0.42 * H, 0.66 * H);
    f.quadraticCurveTo(0.6 * H, 0.5 * H, 0.52 * H - fx * 0.35, -0.1 * H);
    f.closePath();
    f.fill();
  } else if (hair === 2) {
    f.beginPath();
    f.ellipse(-fx * 0.6, -0.68 * H, 0.28 * H, 0.24 * H, 0, 0, Math.PI * 2);
    f.fill();
  }

  // two locks over the shoulders
  if (hair === 0) {
    f.fillStyle = hairCol;
    [-1, 1].forEach((sd) => {
      const o = -fx * 0.3;
      f.beginPath();
      f.moveTo(sd * 0.5 * H + o, -0.05 * H);
      f.bezierCurveTo(sd * 0.62 * H + o, 0.5 * H, sd * 0.56 * H, 1.1 * H, sd * (0.66 + 0.04 * sd * turn) * H, 1.75 * H);
      f.quadraticCurveTo(sd * 0.5 * H, 1.8 * H, sd * 0.38 * H, 1.66 * H);
      f.bezierCurveTo(sd * 0.36 * H, 1.1 * H, sd * 0.3 * H + o, 0.5 * H, sd * 0.3 * H + o, 0.1 * H);
      f.closePath();
      f.fill();
    });
  }

  const fw = 0.38 * H * (1 - Math.abs(turn) * 0.14);
  const lg = f.createLinearGradient(fx - fw, 0, fx + fw, 0);
  const lit = turn >= 0 ? [skin, shade] : [shade, skin];
  lg.addColorStop(0, lit[0]);
  lg.addColorStop(0.55, skin);
  lg.addColorStop(1, lit[1]);
  f.fillStyle = lg;
  f.beginPath();
  f.ellipse(fx, 0.05 * H, fw, 0.47 * H, 0, 0, Math.PI * 2);
  f.fill();

  // fringe
  f.fillStyle = hairCol;
  f.beginPath();
  f.moveTo(fx - fw * 1.08, 0.02 * H);
  f.bezierCurveTo(fx - fw * 1.12, -0.64 * H, fx + fw * 1.12, -0.64 * H, fx + fw * 1.08, 0.02 * H);
  f.bezierCurveTo(fx + fw * 0.7, -0.14 * H, fx + fw * 0.35, -0.2 * H + turn * 0.03 * H, fx + turn * 0.1 * H, -0.12 * H);
  f.bezierCurveTo(fx - fw * 0.3, -0.2 * H, fx - fw * 0.7, -0.14 * H, fx - fw * 1.08, 0.02 * H);
  f.closePath();
  f.fill();

  // soft focus, if the browser can blur
  if ('filter' in g) {
    g.save();
    g.filter = `blur(${Math.max(1, Math.round(w / 500))}px)`;
    g.drawImage(layer, 0, 0);
    g.restore();
  } else {
    g.drawImage(layer, 0, 0);
  }
}
