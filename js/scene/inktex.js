// textures painted with the ink brush, plus the land map for the globe
import * as THREE from '../../vendor/three/three.module.min.js?v=15902125b0';
import { rng, stroke, strokeGen, blossomGen, bud, wash, stamp, PROFILE, INK } from '../ink/brush.js?v=15902125b0';
import { LAND_PATH, LAND_W, LAND_H } from '../data/land.js?v=15902125b0';

const run = (gen) => { const it = gen; while (!it.next().done); };

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tex(c, { srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

// r = land, g = a wide soft bleed around the coasts
export function makeLandTexture(scale = 1) {
  const W = Math.round(LAND_W * scale), H = Math.round(LAND_H * scale);
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  const p = new Path2D(LAND_PATH);
  g.save();
  g.scale(scale, scale);
  g.globalCompositeOperation = 'lighter';
  g.shadowColor = 'rgb(0,255,0)';
  g.shadowBlur = 26 * scale;
  g.fillStyle = 'rgb(0,150,0)';
  g.fill(p, 'evenodd');
  g.shadowColor = 'rgb(255,0,0)';
  g.shadowBlur = 3 * scale;
  g.fillStyle = 'rgb(255,0,0)';
  g.fill(p, 'evenodd');
  g.restore();
  const t = tex(c, { srgb: false });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function makePineTexture(seed = 1) {
  const W = 256, H = 384;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const R = rng(seed);
  const u = W / 256;
  const trunk = [[W * 0.5 + (R() - 0.5) * 20, H * 1.0]];
  let x = trunk[0][0], y = H;
  const lean = (R() - 0.5) * 1.1;
  for (let i = 0; i < 5; i++) {
    y -= H * (0.13 + R() * 0.03);
    x += (lean * 18 + (R() - 0.5) * 26) * u;
    trunk.push([x, y]);
  }
  stroke(ctx, { pts: trunk, width: 12 * u, profile: (t) => (1 - 0.6 * t) * Math.min(1, t * 30 + 0.2), tone: 0.85, dry: 0.55, bleed: 0.1, spread: 0.6, seed });
  const clusters = [];
  for (let i = 2; i < trunk.length; i++) {
    const [bx, by] = trunk[i];
    const sides = i === trunk.length - 1 ? [-1, 1] : [R() < 0.5 ? -1 : 1];
    for (const s of sides) {
      const len = (40 + R() * 40) * u * (1 - i * 0.08);
      const ex = bx + s * len, ey = by - (R() * 16 - 4) * u;
      stroke(ctx, { pts: [[bx, by], [bx + s * len * 0.5, by - 8 * u], [ex, ey]], width: 5 * u, profile: PROFILE.twig, tone: 0.9, dry: 0.4, bleed: 0.1, seed: seed + i * 7 + s });
      clusters.push([ex, ey - 4 * u, (34 + R() * 18) * u]);
      if (R() < 0.6) clusters.push([bx + s * len * 0.45, by - 10 * u, (24 + R() * 12) * u]);
    }
  }
  clusters.push([trunk[trunk.length - 1][0], trunk[trunk.length - 1][1] - 10 * u, 44 * u]);
  for (const [cx, cy, cw] of clusters) {
    wash(ctx, cx, cy, cw * 0.5, { rgb: INK, alpha: 0.5, seed: Math.floor(cx + cy), sx: 1, sy: 0.32, rim: 0.2, wobble: 0.35 });
    const n = 16;
    for (let k = 0; k < n; k++) {
      const a = Math.PI + 0.25 + (k / (n - 1)) * (Math.PI - 0.5);
      const bx = cx + (R() - 0.5) * cw * 0.7, by = cy + cw * 0.08;
      const len = cw * (0.22 + R() * 0.14);
      stroke(ctx, { pts: [[bx, by], [bx + Math.cos(a) * len, by + Math.sin(a) * len * 0.7]], width: 1.8 * u, profile: PROFILE.twig, tone: 0.95, dry: 0.1, bleed: 0.05, bristles: 3, seed: seed + k * 3 + Math.floor(cx) });
    }
  }
  return tex(c);
}

export function makePavilionTexture() {
  const W = 256, H = 200;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const u = W / 256;
  const s = (pts, width, tone = 0.95, seed = 1, dry = 0.2) => stroke(ctx, { pts, width: width * u, tone, dry, bleed: 0.15, seed, profile: PROFILE.stroke });
  ctx.fillStyle = 'rgba(27,23,21,0.28)';
  ctx.beginPath();
  ctx.moveTo(W * 0.1, H * 0.4); ctx.quadraticCurveTo(W * 0.3, H * 0.47, W * 0.5, H * 0.46);
  ctx.quadraticCurveTo(W * 0.7, H * 0.47, W * 0.9, H * 0.4);
  ctx.lineTo(W * 0.5, H * 0.14); ctx.closePath(); ctx.fill();
  // eaves, the upturned korean roof line
  s([[W * 0.05, H * 0.34], [W * 0.14, H * 0.43], [W * 0.3, H * 0.47], [W * 0.5, H * 0.465], [W * 0.7, H * 0.47], [W * 0.86, H * 0.43], [W * 0.95, H * 0.34]], 6, 0.95, 3);
  s([[W * 0.12, H * 0.41], [W * 0.5, H * 0.14]], 4, 0.9, 4);
  s([[W * 0.88, H * 0.41], [W * 0.5, H * 0.14]], 4, 0.9, 5);
  s([[W * 0.5, H * 0.14], [W * 0.5, H * 0.07]], 3.5, 1, 6);
  [0.24, 0.4, 0.6, 0.76].forEach((px, i) => s([[W * px, H * 0.47], [W * px, H * 0.82]], 3.2, 0.9, 10 + i, 0.3));
  // railing and platform
  s([[W * 0.2, H * 0.67], [W * 0.8, H * 0.67]], 2.2, 0.8, 20);
  s([[W * 0.14, H * 0.83], [W * 0.86, H * 0.83]], 5, 0.95, 21, 0.4);
  s([[W * 0.2, H * 0.9], [W * 0.8, H * 0.9]], 3, 0.6, 22, 0.5);
  return tex(c);
}

// 2x2 atlas: three blossoms, and two buds share the last cell
export function makeBlossomAtlas() {
  const S = 256;
  const c = canvas(S * 2, S * 2);
  const ctx = c.getContext('2d');
  run(blossomGen(ctx, S * 0.5, S * 0.5, S * 0.3, { seed: 3, rot: 0.2 }));
  run(blossomGen(ctx, S * 1.5, S * 0.5, S * 0.29, { seed: 8, rot: 1.3 }));
  run(blossomGen(ctx, S * 0.5, S * 1.5, S * 0.3, { seed: 13, open: 0.5, rot: -0.4 }));
  bud(ctx, S * 1.42, S * 1.46, S * 0.1, 4);
  bud(ctx, S * 1.62, S * 1.6, S * 0.075, 9);
  return tex(c);
}

// paper grain for the css background
export function makeGrainDataURL() {
  const S = 320;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const R = rng(99);
  for (let i = 0; i < S * S; i++) {
    const v = 200 + R() * 55;
    img.data[i * 4] = v; img.data[i * 4 + 1] = v * 0.97; img.data[i * 4 + 2] = v * 0.92;
    img.data[i * 4 + 3] = R() < 0.5 ? 0 : 38 + R() * 30;
  }
  g.putImageData(img, 0, 0);
  g.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const x = R() * S, y = R() * S, a = R() * Math.PI * 2, l = 6 + R() * 26;
    g.strokeStyle = R() < 0.5 ? `rgba(120,96,64,${0.05 + R() * 0.08})` : `rgba(255,255,255,${0.2 + R() * 0.25})`;
    g.lineWidth = 0.4 + R() * 0.7;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (R() - 0.5) * 6, y + Math.sin(a) * l * 0.5 + (R() - 0.5) * 6, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  return c.toDataURL('image/png');
}

// torn paper edge as an svg data url
export function makeDeckle(color = '#f2ebdd', flip = false) {
  const W = 900, H = 26;
  const R = rng(flip ? 7 : 3);
  let d = flip ? `M0 0 L${W} 0 ` : `M0 ${H} L${W} ${H} `;
  const pts = [];
  for (let x = W; x >= 0; x -= 6) {
    const y = 8 + R() * 6 + Math.sin(x * 0.02) * 3 + (R() < 0.08 ? R() * 8 : 0);
    pts.push([x, flip ? H - y : y]);
  }
  pts[0][1] = pts[pts.length - 1][1];
  d += pts.map(([x, y]) => `L${x} ${y.toFixed(1)}`).join(' ') + ' Z';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}' preserveAspectRatio='none'><path d='${d}' fill='${color}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export { stamp, strokeGen };
