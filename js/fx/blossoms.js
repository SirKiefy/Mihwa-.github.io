// plum branch for the reasons section. every reason is a bud, a real <button> laid over the canvas
// .love-canvas = branch (painted once per layout), .love-overlay = buds, flowers, petals. both are full viewport width so the trunk can come in from the edge
import { rng, noise1, stamp, strokeGen, wash, samplePath, sealStamp, Painter, PROFILE, PLUM } from '../ink/brush.js?v=9ff5ee8a7c';

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const easeOut = (k) => 1 - Math.pow(1 - clamp(k), 3);
const easeBack = (k) => { k = clamp(k) - 1; return 1 + 2.4 * k * k * k + 1.4 * k * k; };

const INKC = [27, 23, 21];
const PINK = [214, 98, 124];
const ROSE = [200, 70, 96];
const CINNABAR = [192, 68, 54];
const HEART = [218, 186, 98];
const TINTS = [PINK, ROSE, PINK, CINNABAR, PINK, ROSE];
const NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六'];

const TALL_BELOW = 640; // below this content width (px) the branch is drawn upright
const BLOOM_MS = 1150;
const APPEAR_MS = 520;

function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(a).toFixed(3)})`;
const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));

// thin tapered line drawn as one filled ribbon so it stays crisp. outlines, stamens etc
function fineLine(g, ctrl, w, rgb, alpha, seed = 1, { press = 0.3, lift = 0.75 } = {}) {
  const S = samplePath(ctrl, 0.7);
  if (S.length < 2) return;
  const L = [], Rr = [];
  for (const p of S) {
    const k = p.t;
    const ww = w * (press + (1 - press) * smooth(0, 0.18, k)) * (1 - lift * smooth(0.62, 1, k)) * (0.86 + 0.28 * noise1(p.s * 0.09 + seed, 4));
    L.push([p.x + p.nx * ww * 0.5, p.y + p.ny * ww * 0.5]);
    Rr.push([p.x - p.nx * ww * 0.5, p.y - p.ny * ww * 0.5]);
  }
  g.beginPath();
  g.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < L.length; i++) g.lineTo(L[i][0], L[i][1]);
  for (let i = Rr.length - 1; i >= 0; i--) g.lineTo(Rr[i][0], Rr[i][1]);
  g.closePath();
  g.fillStyle = rgba(rgb, alpha);
  g.fill();
}

// open plum flower at (0,0). base = direction of the twig it grows from, the sepals peek out on that side
function paintBlossom(g, R, { seed = 1, tint = PINK, tilt = 0.9, rot = 0, base = Math.PI / 2, paper = false } = {}) {
  const rand = rng(seed);
  const ca = Math.cos(rot), sa = Math.sin(rot);
  const P = (x, y) => [x * ca - y * tilt * sa, x * sa + y * tilt * ca];
  stamp(g, 0, 0, R * 1.3, tint, 0.07, 0.2);
  const a0 = rand() * TAU;
  const petals = [];
  for (let k = 0; k < 5; k++) {
    petals.push({ ang: a0 + (k * TAU) / 5 + (rand() - 0.5) * 0.22, d: R * (0.5 + rand() * 0.05), pr: R * (0.5 + rand() * 0.06) });
  }
  // sepal tips, only in the two gaps facing the twig
  const gaps = petals.map((p, k) => a0 + ((k + 0.5) * TAU) / 5);
  const toTwig = (a) => Math.abs(Math.atan2(Math.sin(a - base), Math.cos(a - base)));
  gaps.sort((x, y) => toTwig(x) - toTwig(y)).slice(0, 2).forEach((a, k) => {
    const p0 = P(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55), p1 = P(Math.cos(a) * R * 1.02, Math.sin(a) * R * 1.02);
    fineLine(g, [p0, p1], R * 0.2, INKC, 0.82, seed + k, { press: 1, lift: 0.8 });
  });
  if (paper) {
    // paper under the petals so the branch doesn't show through the flower
    g.save();
    g.fillStyle = 'rgba(240,234,223,0.86)';
    g.shadowColor = 'rgba(240,234,223,0.9)';
    g.shadowBlur = R * 0.25;
    g.beginPath();
    for (let k = 0; k < 5; k++) {
      const { ang, d, pr } = petals[k];
      const [px, py] = P(Math.cos(ang) * d, Math.sin(ang) * d);
      g.moveTo(px + pr * 0.94 * Math.cos(rot), py + pr * 0.94 * Math.sin(rot));
      g.ellipse(px, py, pr * 0.94, pr * 0.94 * tilt, rot, 0, TAU);
    }
    g.ellipse(0, 0, R * 0.5, R * 0.5 * tilt, rot, 0, TAU);
    g.fill('nonzero');
    g.restore();
  }
  for (let k = 0; k < 5; k++) {
    const { ang, d, pr } = petals[k];
    const [px, py] = P(Math.cos(ang) * d, Math.sin(ang) * d);
    wash(g, px, py, pr, { rgb: tint, alpha: 0.17 + rand() * 0.08, seed: seed * 13 + k, wobble: 0.12, rim: 0.95, sx: 1, sy: tilt, rot });
  }
  stamp(g, 0, 0, R * 0.55, tint, 0.2, 0.3);
  // two outline strokes per petal, left a little open at the tip
  for (let k = 0; k < 5; k++) {
    const { ang, d, pr } = petals[k];
    const cx = Math.cos(ang) * d, cy = Math.sin(ang) * d;
    const arc = (from, to) => {
      const pts = [];
      for (let j = 0; j <= 8; j++) {
        const th = lerp(from, to, j / 8);
        const rr = pr * (1.03 + (noise1(th * 3 + seed + k, 2) - 0.5) * 0.07);
        pts.push(P(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr));
      }
      return pts;
    };
    const lw = Math.max(0.75, R * 0.042);
    const gapA = 0.05 + rand() * 0.12, gapB = 0.05 + rand() * 0.12;
    fineLine(g, arc(ang - 1.68, ang - gapA), lw, INKC, 0.5 + rand() * 0.2, seed * 3 + k);
    fineLine(g, arc(ang + 1.68, ang + gapB), lw * 0.9, INKC, 0.45 + rand() * 0.2, seed * 5 + k);
  }
  stamp(g, 0, 0, R * 0.26, HEART, 0.6, 0.35);
  stamp(g, 0, 0, R * 0.11, [140, 150, 70], 0.45, 0.4);
  // stamens. the ink dots on the ends are what make it read as plum
  const ns = 18 + Math.floor(rand() * 7);
  for (let k = 0; k < ns; k++) {
    const a = (k / ns) * TAU + (rand() - 0.5) * 0.3;
    const len = R * (0.44 + rand() * 0.34);
    const bend = (rand() - 0.5) * 0.3;
    const p0 = P(Math.cos(a) * R * 0.1, Math.sin(a) * R * 0.1);
    const p1 = P(Math.cos(a + bend * 0.5) * len * 0.55, Math.sin(a + bend * 0.5) * len * 0.55);
    const p2 = P(Math.cos(a + bend) * len, Math.sin(a + bend) * len);
    fineLine(g, [p0, p1, p2], Math.max(0.5, R * 0.024), [58, 40, 34], 0.55, seed + k * 7, { press: 0.9, lift: 0.4 });
    const ar = Math.max(0.8, R * (0.038 + rand() * 0.02));
    stamp(g, p2[0], p2[1], ar * 2.4, INKC, 0.2, 0.5);
    g.beginPath();
    g.arc(p2[0], p2[1], ar, 0, TAU);
    g.fillStyle = rand() < 0.16 ? 'rgba(176,128,44,0.85)' : 'rgba(26,20,18,0.85)';
    g.fill();
  }
  const pe = P(Math.cos(a0 + 0.6) * R * 0.2, Math.sin(a0 + 0.6) * R * 0.2);
  fineLine(g, [[0, 0], pe], Math.max(0.55, R * 0.032), [118, 128, 62], 0.75, seed, { press: 1, lift: 0.3 });
}

function paintBud(g, r, { seed = 1, tint = ROSE, dir = -Math.PI / 2 } = {}) {
  const rand = rng(seed);
  const ca = Math.cos(dir), sa = Math.sin(dir);
  const at = (u, v) => [ca * u - sa * v, sa * u + ca * v];
  stamp(g, 0, 0, r * 1.6, tint, 0.07, 0.2);
  const c = at(r * 0.1, 0);
  wash(g, c[0], c[1], r, { rgb: tint, alpha: 0.46, seed, wobble: 0.08, rim: 1, sx: 1.1, sy: 0.9, rot: dir });
  const cap = at(r * 0.38, (rand() - 0.5) * r * 0.2);
  stamp(g, cap[0], cap[1], r * 0.62, PLUM, 0.26, 0.35);
  const pts = [];
  for (let j = 0; j <= 12; j++) {
    const th = lerp(-2.15, 2.15, j / 12);
    pts.push(at(r * 0.1 + Math.cos(th) * r * 1.1, Math.sin(th) * r * 0.93));
  }
  fineLine(g, pts.slice(0, 7), Math.max(0.8, r * 0.11), INKC, 0.62, seed * 3);
  fineLine(g, pts.slice(6).reverse(), Math.max(0.75, r * 0.1), INKC, 0.55, seed * 5);
  fineLine(g, [at(r * 0.9, -r * 0.1), at(r * 0.55, r * 0.2), at(r * 0.15, r * 0.4)], Math.max(0.5, r * 0.06), INKC, 0.2, seed * 7);
  for (const k of [-1, 1]) {
    const p0 = at(-r * 1.02, k * r * 0.18), p1 = at(-r * 0.78, k * r * 0.62);
    fineLine(g, [p0, p1], r * 0.3, INKC, 0.78, seed + k, { press: 1, lift: 0.8 });
  }
  fineLine(g, [at(-r * 1.2, 0), at(-r * 0.92, 0)], r * 0.34, INKC, 0.85, seed + 5, { press: 1, lift: 0.5 });
}

// single loose petal for the falling ones
function paintPetal(g, r, { seed = 1, tint = PINK } = {}) {
  const rand = rng(seed);
  const pts = [];
  for (let j = 0; j < 24; j++) {
    const th = (j / 24) * TAU;
    const k = 1 - 0.32 * Math.pow(Math.max(0, Math.cos(th - Math.PI)), 3) + (noise1(th * 2 + seed, 3) - 0.5) * 0.08;
    pts.push([Math.cos(th) * r * k, Math.sin(th) * r * 0.68 * k]);
  }
  const [cr, cg, cb] = tint;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  const grd = g.createRadialGradient(r * 0.2, 0, 0, 0, 0, r);
  grd.addColorStop(0, `rgba(${cr},${cg},${cb},0.14)`);
  grd.addColorStop(0.75, `rgba(${cr},${cg},${cb},0.24)`);
  grd.addColorStop(1, `rgba(${cr},${cg},${cb},0.4)`);
  g.fillStyle = grd;
  g.fill();
  const a0 = -0.6 - rand() * 0.6;
  const arc = [];
  for (let j = 0; j <= 8; j++) {
    const th = a0 + (j / 8) * 2.4;
    const k = 1 - 0.32 * Math.pow(Math.max(0, Math.cos(th - Math.PI)), 3);
    arc.push([Math.cos(th) * r * 1.02 * k, Math.sin(th) * r * 0.7 * k]);
  }
  fineLine(g, arc, Math.max(0.55, r * 0.07), INKC, 0.32, seed);
}

function tinyBud(g, x, y, r, dir, seed) {
  const ca = Math.cos(dir), sa = Math.sin(dir);
  fineLine(g, [[x - ca * r * 0.95, y - sa * r * 0.95], [x - ca * r * 0.2, y - sa * r * 0.2]], r * 0.95, INKC, 0.85, seed, { press: 1, lift: 0.4 });
  wash(g, x + ca * r * 0.2, y + sa * r * 0.2, r, { rgb: ROSE, alpha: 0.6, seed, wobble: 0.1, rim: 1, sx: 1.08, sy: 0.88, rot: dir });
  stamp(g, x + ca * r * 0.45, y + sa * r * 0.45, r * 0.6, PLUM, 0.32, 0.4);
}

// --- composing the branch ---

// works out the whole painting for one size. nothing gets drawn here
function compose({ W, H, bx0, bx1, avoid, tall, N, seed }) {
  const rand = rng(seed);
  const cw = bx1 - bx0;
  const S = tall ? Math.min(W * 1.15, H) : Math.min(H, cw * 0.62);
  const R = clamp(S * (tall ? 0.05 : 0.043), 15, 27);
  const X = (u) => bx0 + u * cw;
  const Y = (v) => v * H;
  const jit = (p, a = 0.01) => [p[0] + (rand() - 0.5) * a * cw, p[1] + (rand() - 0.5) * a * H];
  const branches = [];
  const occ = [];
  const inAvoid = (x, y, pad = 0) => avoid && x > avoid.x0 - pad && x < avoid.x1 + pad && y > avoid.y0 - pad && y < avoid.y1 + pad;
  const xMax = tall ? W - 6 : Math.min(W - 6, bx1 + cw * 0.05);
  const inBounds = (x, y, m = 8) => x > Math.max(m, bx0 - cw * 0.02) && x < xMax && y > m && y < H - m;

  function addOcc(b) {
    const nd = b.nodes;
    for (let i = 0; i < nd.length - 1; i++) {
      const a = nd[i], c = nd[i + 1];
      const L = Math.hypot(c.x - a.x, c.y - a.y);
      const n = Math.max(1, Math.ceil(L / 7));
      for (let k = 0; k < n; k++) occ.push({ x: lerp(a.x, c.x, k / n), y: lerp(a.y, c.y, k / n), id: b.id, w: lerp(a.w, c.w, k / n) });
    }
  }
  function crowded(x, y, ids, gap) {
    for (const o of occ) {
      if (ids.includes(o.id)) continue;
      if (Math.hypot(o.x - x, o.y - y) < gap + o.w * 0.5) return true;
    }
    return false;
  }
  function finish(nodes, w0, w1, depth, kind, parent, at) {
    let s = 0;
    nodes.forEach((n, i) => { if (i) s += Math.hypot(n.x - nodes[i - 1].x, n.y - nodes[i - 1].y); n.s = s; });
    nodes.forEach((n) => { n.w = lerp(w0, w1, Math.pow(s ? n.s / s : 0, 0.8)); });
    const b = { id: branches.length, depth, kind, nodes, len: s, parent, at, kids: [], sites: [], tone: parent ? parent.tone : 0.92 };
    if (parent) parent.kids.push(b);
    branches.push(b);
    addOcc(b);
    return b;
  }
  // plum branches zigzag at the joints, so break the line up between the keys
  function limb(keys, w0, w1, depth, kind, parent = null, at = 0, zig = 1) {
    const nodes = [];
    let sign = rand() < 0.5 ? -1 : 1;
    for (let k = 0; k < keys.length - 1; k++) {
      const [ax, ay] = keys[k], [cx, cy] = keys[k + 1];
      const L = Math.hypot(cx - ax, cy - ay) || 1;
      const nx = -(cy - ay) / L, ny = (cx - ax) / L;
      nodes.push({ x: ax, y: ay });
      const m = L > S * 0.24 ? 2 : L > S * 0.1 ? 1 : 0;
      for (let j = 1; j <= m; j++) {
        const tt = j / (m + 1) + (rand() - 0.5) * 0.12;
        const off = sign * L * (0.03 + rand() * 0.045) * zig;
        sign = -sign;
        nodes.push({ x: lerp(ax, cx, tt) + nx * off, y: lerp(ay, cy, tt) + ny * off });
      }
    }
    const e = keys[keys.length - 1];
    nodes.push({ x: e[0], y: e[1] });
    return finish(nodes, w0, w1, depth, kind, parent, at);
  }
  // twig off node ni, stops at the edges or when it gets crowded
  function twig(parent, ni, side, len, depth, hang = 0) {
    const nd = parent.nodes;
    const p = nd[ni];
    const a = nd[Math.max(0, ni - 1)], c = nd[Math.min(nd.length - 1, ni + 1)];
    const pdir = Math.atan2(c.y - a.y, c.x - a.x);
    let ang = pdir + side * (0.55 + rand() * 0.55);
    // mostly up and out, only a few hang
    if (Math.sin(ang) > 0.45 && rand() > hang * 0.8) ang = pdir - side * (0.55 + rand() * 0.55);
    if (Math.sin(ang) > 0.75 + hang * 0.2) return null;
    const nseg = depth >= 3 ? 1 + (rand() < 0.5 ? 1 : 0) : 2 + Math.floor(rand() * 2);
    const nodes = [{ x: p.x, y: p.y }];
    let x = p.x, y = p.y, dir = ang, zs = rand() < 0.5 ? 1 : -1;
    const ids = [parent.id, ...(parent.parent ? [parent.parent.id] : [])];
    for (let k = 0; k < nseg; k++) {
      const segL = (len / nseg) * (0.8 + rand() * 0.4);
      dir += zs * (0.16 + rand() * 0.3);
      zs = -zs;
      const nx = x + Math.cos(dir) * segL, ny = y + Math.sin(dir) * segL;
      const mx = (x + nx) / 2, my = (y + ny) / 2;
      if (!inBounds(nx, ny, 10) || inAvoid(nx, ny, R * 0.8) || inAvoid(mx, my, R * 0.5)) break;
      if (crowded(nx, ny, ids, S * 0.03) || (k > 0 && crowded(mx, my, ids, S * 0.022))) break;
      nodes.push({ x: nx, y: ny });
      x = nx; y = ny;
    }
    if (nodes.length < 2) return null;
    const w0 = Math.min(p.w * 0.5, depth >= 3 ? S * 0.0058 : S * 0.0088);
    return finish(nodes, Math.max(1.3, w0), Math.max(0.8, w0 * 0.42), depth, 'twig', parent, ni);
  }
  function sprout(parent, density, len, depth, hang = parent.hang || 0) {
    let side = rand() < 0.5 ? 1 : -1;
    const nd = parent.nodes;
    for (let ni = 1; ni < nd.length - 1; ni++) {
      if (rand() > density) { side = -side; continue; }
      const k = nd[ni].s / parent.len;
      const tw = twig(parent, ni, side, len * (1.1 - 0.5 * k) * (0.75 + rand() * 0.5), depth, hang);
      side = -side;
      if (tw && depth < 3) sprout(tw, 0.5, len * 0.5, depth + 1, hang * 0.5);
    }
  }
  const nearest = (b, x, y) => { let bi = 0, bd = Infinity; b.nodes.forEach((n, i) => { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; bi = i; } }); return bi; };
  const nodeAt = (b, i) => [b.nodes[i].x, b.nodes[i].y];

  // main skeleton is placed by hand, everything smaller grows off it
  let trunk, limbs = [], shoots = [];
  const tone = (b, v) => { b.tone = v; return b; };
  if (!tall) {
    const ay = avoid ? avoid.y0 / H : 0.62;
    trunk = limb([[-S * 0.14, Y(0.83)], jit([X(-0.04), Y(0.79)]), jit([X(0.03), Y(0.7)]), jit([X(0.05), Y(0.58)]), jit([X(0.1), Y(0.48)]), [X(0.16), Y(0.41)]], S * 0.125, S * 0.06, 0, 'trunk', null, 0, 1.8);
    const end = trunk.nodes.length - 1;
    const A = tone(limb([nodeAt(trunk, end), jit([X(0.24), Y(0.32)]), jit([X(0.34), Y(0.27)]), jit([X(0.45), Y(0.23)]), [X(0.55), Y(0.19)]], S * 0.058, S * 0.024, 1, 'limb', trunk, end), 0.93);
    const A1 = tone(limb([nodeAt(A, A.nodes.length - 1), jit([X(0.63), Y(0.12)]), jit([X(0.74), Y(0.085)]), [X(0.86), Y(0.05)]], S * 0.023, S * 0.004, 1, 'limb', A, A.nodes.length - 1), 0.9);
    // second limb normally runs above the card. on a short stage the card is nearly as tall as the painting so it goes up instead
    const dy = Math.min(0.36, ay - 0.15);
    const A2 = tone(ay < 0.26
      ? limb([nodeAt(A, A.nodes.length - 1), jit([X(0.575), Y(0.11)]), [X(0.585), Y(0.025)]], S * 0.016, S * 0.004, 1, 'limb', A, A.nodes.length - 1)
      : limb([nodeAt(A, A.nodes.length - 1), jit([X(0.64), Y(0.23)]), jit([X(0.76), Y(dy - 0.03)]), [X(0.92), Y(dy + 0.01)]], S * 0.02, S * 0.004, 1, 'limb', A, A.nodes.length - 1), 0.88);
    const kb = nearest(trunk, X(0.05), Y(0.58));
    const B = tone(limb([nodeAt(trunk, kb), jit([X(0.15), Y(0.64)]), jit([X(0.26), Y(0.62)]), jit([X(0.37), Y(0.7)]), [X(0.5), Y(0.66)]], S * 0.04, S * 0.005, 1, 'limb', trunk, kb), 0.55);
    B.hang = 0.55;
    limbs = [A, A1, A2, B];
    const ka = nearest(A, X(0.34), Y(0.27));
    shoots.push(tone(limb([nodeAt(A, ka), [X(0.355), Y(0.15)], [X(0.375), Y(0.035)]], S * 0.0092, S * 0.0026, 2, 'shoot', A, ka, 0.4), 0.85));
    const kb2 = nearest(B, X(0.26), Y(0.6));
    shoots.push(tone(limb([nodeAt(B, kb2), [X(0.28), Y(0.46)], [X(0.305), Y(0.35)]], S * 0.008, S * 0.0026, 2, 'shoot', B, kb2, 0.4), 0.6));
  } else {
    trunk = limb([[-S * 0.14, Y(0.86)], jit([X(0.03), Y(0.81)]), jit([X(0.12), Y(0.72)]), jit([X(0.17), Y(0.61)]), [X(0.26), Y(0.5)]], S * 0.12, S * 0.058, 0, 'trunk', null, 0, 1.8);
    const end = trunk.nodes.length - 1;
    const A = tone(limb([nodeAt(trunk, end), jit([X(0.36), Y(0.41)]), jit([X(0.46), Y(0.34)]), [X(0.55), Y(0.27)]], S * 0.056, S * 0.024, 1, 'limb', trunk, end), 0.93);
    const A1 = tone(limb([nodeAt(A, A.nodes.length - 1), jit([X(0.62), Y(0.17)]), jit([X(0.74), Y(0.1)]), [X(0.88), Y(0.045)]], S * 0.023, S * 0.004, 1, 'limb', A, A.nodes.length - 1), 0.9);
    const A2 = tone(limb([nodeAt(A, A.nodes.length - 1), jit([X(0.68), Y(0.3)]), jit([X(0.82), Y(0.28)]), [X(0.97), Y(0.34)]], S * 0.019, S * 0.004, 1, 'limb', A, A.nodes.length - 1), 0.86);
    const kb = nearest(trunk, X(0.17), Y(0.61));
    const B = tone(limb([nodeAt(trunk, kb), jit([X(0.33), Y(0.69)]), jit([X(0.5), Y(0.66)]), jit([X(0.67), Y(0.75)]), [X(0.88), Y(0.73)]], S * 0.036, S * 0.005, 1, 'limb', trunk, kb), 0.55);
    B.hang = 0.6;
    const C = tone(limb([nodeAt(trunk, end), jit([X(0.23), Y(0.37)]), jit([X(0.26), Y(0.24)]), [X(0.21), Y(0.1)]], S * 0.026, S * 0.004, 1, 'limb', trunk, end), 0.72);
    limbs = [A, A1, A2, B, C];
    const ka = nearest(A, X(0.46), Y(0.34));
    shoots.push(tone(limb([nodeAt(A, ka), [X(0.49), Y(0.2)], [X(0.51), Y(0.07)]], S * 0.0088, S * 0.0026, 2, 'shoot', A, ka, 0.4), 0.85));
  }
  for (const b of limbs) sprout(b, 0.62, S * (tall ? 0.15 : 0.16), 2);
  for (const b of shoots) sprout(b, 0.4, S * 0.08, 3);

  // possible spots for the reason buds
  const cands = [];
  const marginX = Math.max(26, R * 1.3), marginY = Math.max(26, R * 1.4);
  const okSite = (x, y) => x > bx0 + marginX && x < bx1 - marginX && y > marginY && y < H - marginY && !inAvoid(x, y, R * 1.8);
  for (const b of branches) {
    if (b.depth < 1) continue;
    const nd = b.nodes;
    const step = S * 0.03;
    const s0 = Math.max(b.len * 0.18, S * 0.04);
    for (let s = s0; s <= b.len + 0.01; s += step) {
      let i = 1;
      while (i < nd.length - 1 && nd[i].s < s) i++;
      const a = nd[i - 1], c = nd[i];
      const k = clamp((s - a.s) / Math.max(1e-3, c.s - a.s));
      const x = lerp(a.x, c.x, k), y = lerp(a.y, c.y, k), w = lerp(a.w, c.w, k);
      const ang = Math.atan2(c.y - a.y, c.x - a.x);
      let nx = -Math.sin(ang), ny = Math.cos(ang);
      if (ny > 0 && rand() < 0.75) { nx = -nx; ny = -ny; }
      const off = w * 0.5 + R * 0.42;
      const px = x + nx * off, py = y + ny * off;
      if (okSite(px, py) && !crowded(px, py, [b.id], R * 0.62)) cands.push({ x: px, y: py, dir: Math.atan2(ny, nx) + (rand() - 0.5) * 0.5, base: Math.atan2(-ny, -nx), b, tip: false });
    }
    const tip = nd[nd.length - 1], pre = nd[nd.length - 2];
    const ta = Math.atan2(tip.y - pre.y, tip.x - pre.x);
    const tx = tip.x + Math.cos(ta) * R * 0.45, ty = tip.y + Math.sin(ta) * R * 0.45;
    if (okSite(tx, ty) && !crowded(tx, ty, [b.id], R * 0.62)) cands.push({ x: tx, y: ty, dir: ta, base: ta + Math.PI, b, tip: true });
  }
  // greedy farthest point so they spread out, starting near the middle
  const sites = [];
  if (cands.length) {
    let cx = 0, cy = 0;
    cands.forEach((c) => { cx += c.x; cy += c.y; });
    cx /= cands.length; cy /= cands.length;
    let first = 0, fd = Infinity;
    cands.forEach((c, i) => { const d = Math.hypot(c.x - cx, c.y - cy); if (d < fd) { fd = d; first = i; } });
    sites.push(cands[first]);
    const md = cands.map((c) => Math.hypot(c.x - cands[first].x, c.y - cands[first].y));
    while (sites.length < N) {
      let bi = -1, bs = -1;
      for (let i = 0; i < cands.length; i++) {
        const sc = md[i] * (cands[i].tip ? 1.12 : 1) * (cands[i].b.depth >= 2 ? 1.04 : 1);
        if (sc > bs) { bs = sc; bi = i; }
      }
      if (bi < 0 || md[bi] < 1) break;
      const c = cands[bi];
      sites.push(c);
      for (let i = 0; i < cands.length; i++) md[i] = Math.min(md[i], Math.hypot(cands[i].x - c.x, cands[i].y - c.y));
    }
  }
  // not enough spots (rare), just double up
  while (sites.length < N && sites.length) {
    const s = sites[sites.length % Math.max(1, sites.length)];
    sites.push({ ...s, x: s.x + R * 1.4, y: s.y - R * 0.6 });
  }
  if (tall) sites.sort((a, b) => a.y - b.y || a.x - b.x);
  else sites.sort((a, b) => a.x - b.x);
  sites.forEach((s, i) => {
    const r2 = rng(seed * 31 + i * 7 + 3);
    s.R = R * (0.92 + r2() * 0.16);
    s.tint = TINTS[Math.floor(r2() * TINTS.length)];
    s.tilt = 0.72 + r2() * 0.26;
    s.rot = r2() * TAU;
    s.seed = Math.floor(seed * 100 + i * 17 + 1);
    s.spin = r2() < 0.5 ? -1 : 1;
    s.b.sites.push(i);
  });

  const tiny = [];
  const farFromSites = (x, y, d) => sites.every((s) => Math.hypot(s.x - x, s.y - y) > d);
  for (const b of branches) {
    if (b.depth < 1) continue;
    const nd = b.nodes;
    const tip = nd[nd.length - 1], pre = nd[nd.length - 2];
    const ta = Math.atan2(tip.y - pre.y, tip.x - pre.x);
    const r = R * (0.12 + rand() * 0.05);
    const x = tip.x + Math.cos(ta) * r * 0.9, y = tip.y + Math.sin(ta) * r * 0.9;
    if (rand() < 0.75 && farFromSites(x, y, R * 1.6) && !inAvoid(x, y, 4) && tiny.every((u) => Math.hypot(u.x - x, u.y - y) > R)) tiny.push({ x, y, r, dir: ta, b });
    if (b.depth === 2 && nd.length > 2 && rand() < 0.6) {
      const i = 1 + Math.floor(rand() * (nd.length - 2));
      const n = nd[i];
      const a = Math.atan2(nd[i + 1].y - nd[i - 1].y, nd[i + 1].x - nd[i - 1].x) + (rand() < 0.5 ? -1 : 1) * (0.9 + rand() * 0.4);
      const rr = R * (0.11 + rand() * 0.05);
      const bx = n.x + Math.cos(a) * (n.w * 0.5 + rr), by = n.y + Math.sin(a) * (n.w * 0.5 + rr);
      if (farFromSites(bx, by, R * 1.6) && !inAvoid(bx, by, 4) && tiny.every((u) => Math.hypot(u.x - bx, u.y - by) > R)) tiny.push({ x: bx, y: by, r: rr, dir: a, b });
    }
  }

  // moss dots on top of the old wood, near the knuckles
  const moss = [];
  for (const b of [trunk, ...limbs]) {
    const nd = b.nodes;
    for (let i = 1; i < nd.length - 1; i++) {
      if (nd[i].x < 2 || rand() > (b.depth === 0 ? 0.95 : 0.55)) continue;
      const a = Math.atan2(nd[i + 1].y - nd[i - 1].y, nd[i + 1].x - nd[i - 1].x);
      let nx = -Math.sin(a), ny = Math.cos(a);
      if (ny > 0) { nx = -nx; ny = -ny; }
      const n = 1 + Math.floor(rand() * (b.depth === 0 ? 3 : 2));
      for (let k = 0; k < n; k++) {
        const along = (rand() - 0.5) * nd[i].w * 1.6;
        const off = nd[i].w * (0.3 + rand() * 0.16);
        const x = nd[i].x + Math.cos(a) * along + nx * off, y = nd[i].y + Math.sin(a) * along + ny * off;
        if (inAvoid(x, y, 2) || !farFromSites(x, y, R * 1.1)) continue;
        moss.push({ x, y, r: S * (0.0022 + rand() * 0.0028) * (b.depth === 0 ? 1.15 : 0.85), a: a + (rand() - 0.5) * 0.9 });
      }
    }
  }

  return { S, R, branches, trunk, limbs, shoots, sites, tiny, moss };
}

// --- ink stroke ---

// one brush stroke = body (smooth ribbon on its own layer, so no seams) + dry hair streaks + dark rims.
// paints a few samples at a time while growing, then gets stamped onto the branch canvas with a faint bleed
class InkStroke {
  constructor(spec, dpr) {
    const {
      pts, width, prof = PROFILE.stroke, rgb = INKC, tone = 0.9, body = 0.62, dry = 0.3, rim = 0.4,
      seed = 1, nb, press = 0, halo = 0.1, hair = 1, spacing = 1.1, caps = false, knots = [],
    } = spec;
    this.caps = caps;
    const S = samplePath(pts, spacing);
    this.S = S; this.n = S.length; this.i = 0; this.dpr = dpr;
    this.rgb = rgb; this.tone = tone; this.bodyA = tone * body; this.halo = halo;
    this.done = this.n < 2;
    if (this.done) return;
    const rand = rng(seed);
    this.rand = rand;
    // flying white: how much paper shows through a dry stroke
    this.fw = smooth(0.45, 0.9, dry);
    const w = S.map((p) => Math.max(0, width * prof(p.t)));
    const L = [], Rr = [], BL = [], BR = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    S.forEach((p, i) => {
      const eL = 1 + (noise1(p.s * 0.045 + seed * 3.1, 2) - 0.5) * 0.24 + (noise1(p.s * 0.23 + seed, 5) - 0.5) * 0.06;
      const eR = 1 + (noise1(p.s * 0.045 + seed * 7.7, 2) - 0.5) * 0.24 + (noise1(p.s * 0.23 + seed + 9, 5) - 0.5) * 0.06;
      const kb = 1 - dry * 0.16 * smooth(0.15, 1, p.t) - dry * 0.08 * noise1(p.s * 0.05 + seed, 6);
      const hw = w[i] * 0.5;
      L.push([p.x + p.nx * hw * eL, p.y + p.ny * hw * eL]);
      Rr.push([p.x - p.nx * hw * eR, p.y - p.ny * hw * eR]);
      BL.push([p.x + p.nx * hw * eL * kb, p.y + p.ny * hw * eL * kb]);
      BR.push([p.x - p.nx * hw * eR * kb, p.y - p.ny * hw * eR * kb]);
      x0 = Math.min(x0, p.x - hw * 1.3); x1 = Math.max(x1, p.x + hw * 1.3);
      y0 = Math.min(y0, p.y - hw * 1.3); y1 = Math.max(y1, p.y + hw * 1.3);
    });
    this.w = w; this.L = L; this.R = Rr; this.BL = BL; this.BR = BR;
    // knots = the joints, where the brush lifts and presses again
    this.knot = new Int8Array(this.n);
    this.near = new Uint8Array(this.n);
    for (const kt of knots) {
      let i = 0;
      while (i < this.n - 1 && S[i].t < kt) i++;
      this.knot[i] = 1;
      const s0 = S[i].s;
      for (let j = Math.max(0, i - 4); j < Math.min(this.n, i + 5); j++) if (Math.abs(S[j].s - s0) < 1.8) this.near[j] = 1;
    }
    const pad = 4 + width * 0.3;
    this.ox = Math.floor((x0 - pad) * dpr); this.oy = Math.floor((y0 - pad) * dpr);
    this.cw = Math.ceil((x1 + pad) * dpr) - this.ox; this.ch = Math.ceil((y1 + pad) * dpr) - this.oy;
    const nbr = nb ?? clamp(Math.round(width / 1.7), 3, 34);
    this.hairs = [];
    // big brushes split into clumps that run dry together, that's what gives the trunk its long white streaks
    const nClump = nbr >= 10 ? 3 + Math.floor(rand() * 3) : 1;
    const clumps = Array.from({ length: nClump }, () => ({ jit: rand() * 1000, ink: 0.75 + rand() * 0.45, rate: 0.5 + rand() * 1.1 }));
    for (let j = 0; j < nbr * hair; j++) {
      const o = (nbr === 1 ? 0 : -1 + (2 * (j % nbr + 0.5)) / nbr) + (rand() - 0.5) * (1.4 / nbr);
      const edge = Math.abs(o);
      const cl = clumps[Math.min(nClump - 1, Math.floor(((clamp(o, -0.999, 0.999) + 1) / 2) * nClump))];
      this.hairs.push({
        o: clamp(o, -0.96, 0.96),
        cj: cl.jit, solo: nClump > 1 ? 0.38 : 1,
        ink: lerp(0.75 + rand() * 0.45, cl.ink, nClump > 1 ? 0.65 : 0) - edge * 0.25 * dry,
        load: 0.75 + rand() * 0.45,
        rate: dry * lerp(0.5 + rand() * 1.1, cl.rate, nClump > 1 ? 0.65 : 0) * (1 + 0.9 * edge),
        lw: Math.max(0.45, (width / nbr) * (0.55 + rand() * 0.9)),
        a: tone * (0.16 + rand() * 0.34),
        wa: this.fw * (0.5 + rand() * 0.45),
        jit: rand() * 1000, px: null, py: null, white: [],
      });
    }
    const rlw = Math.max(0.55, Math.min(width * 0.05 + 0.25, 1.1 + width * 0.022));
    this.rims = [-1, 1].map((sd) => ({ sd, a: tone * rim * (0.45 + rand() * 0.25), lw: rlw, jit: rand() * 1000, px: null, py: null, dry }));
    this.press = press;
    this.width = width;
  }
  alloc() {
    if (this.A || this.done) return;
    this.A = canvasOf(this.cw, this.ch);
    this.B = canvasOf(this.cw, this.ch);
    const d = this.dpr;
    this.ga = this.A.getContext('2d');
    this.gb = this.B.getContext('2d');
    for (const g of [this.ga, this.gb]) g.setTransform(d, 0, 0, d, -this.ox, -this.oy);
    const [r, g, b] = this.rgb;
    this.ga.fillStyle = `rgb(${r},${g},${b})`;
    this.gb.lineCap = 'butt';
    this.gb.lineJoin = 'round';
    if (this.press > 0) {
      const p = this.S[0], w0 = this.w[Math.min(this.n - 1, 2)];
      stamp(this.gb, p.x, p.y, w0 * 0.62, this.rgb, this.tone * 0.3 * this.press, 0.55);
    }
  }
  step(count) {
    if (this.done) return 0;
    this.alloc();
    const i0 = this.i, i1 = Math.min(this.n - 1, i0 + Math.max(1, count));
    const { ga, gb, S, L, R, BL, BR, w } = this;
    const [r, g, b] = this.rgb;
    for (let i = i0; i <= i1; i++) {
      if (!this.knot[i] || i === 0) continue;
      const p = S[i];
      stamp(gb, p.x, p.y, w[i] * 0.66, this.rgb, this.tone * 0.2 * (this.press || 0.6), 0.5);
    }
    // overlap the last piece by one sample so there's no seam
    const a0 = Math.max(0, i0 - 1);
    if (i0 === 0 && (this.caps === true || this.caps === 'start')) this.cap(0);
    ga.beginPath();
    ga.moveTo(BL[a0][0], BL[a0][1]);
    for (let i = a0 + 1; i <= i1; i++) ga.lineTo(BL[i][0], BL[i][1]);
    for (let i = i1; i >= a0; i--) ga.lineTo(BR[i][0], BR[i][1]);
    ga.closePath();
    ga.fill();
    // low freq noise so the dry gaps come out long, not short dashes
    const fw = this.fw > 0.02;
    for (const h of this.hairs) {
      let pen = false, any = false;
      gb.beginPath();
      for (let i = i0; i <= i1; i++) {
        const p = S[i], ww = w[i];
        if (this.knot[i]) h.ink = Math.max(h.ink, h.load * (0.8 + 0.2 * noise1(h.jit + i, 2)));
        const wob = (noise1(p.s * 0.05 + h.jit, 3) - 0.5) * 0.12;
        const k = (h.o + wob) * 0.5;
        const x = lerp(R[i][0], L[i][0], 0.5 + k), y = lerp(R[i][1], L[i][1], 0.5 + k);
        const own = noise1(p.s * 0.03 + h.jit, 7) * 0.8 + noise1(p.s * 0.085 + h.jit, 4) * 0.2;
        const skip = lerp(noise1(p.s * 0.02 + h.cj, 7), own, h.solo) > 0.3 + 0.74 * clamp(h.ink);
        if (h.px !== null && !skip && ww > Math.max(0.3, h.lw * 0.85)) {
          if (!pen) { gb.moveTo(h.px, h.py); pen = true; }
          gb.lineTo(x, y);
          any = true;
        } else pen = false;
        if (fw && skip && h.px !== null && i > 0 && ww > 2 && Math.abs(h.o) < 0.82) h.white.push(h.px, h.py, x, y, i);
        h.px = x; h.py = y;
        if (i > 0) h.ink -= h.rate / this.n;
      }
      if (any) {
        gb.lineWidth = h.lw;
        gb.strokeStyle = `rgba(${r},${g},${b},${(h.a * (0.5 + 0.5 * clamp(h.ink * 1.2))).toFixed(3)})`;
        gb.stroke();
      }
    }
    const last = i1 >= this.n - 1;
    // hold back the newest white, the next body piece overlaps it
    if (fw) this.flyWhite(last ? Infinity : i1 - 1);
    for (const m of this.rims) {
      const E = m.sd < 0 ? BR : BL;
      let pen = false;
      for (let i = i0; i <= i1; i++) {
        const p = S[i];
        const [x, y] = E[i];
        const gap = this.near[i] || noise1(p.s * 0.03 + m.jit, 8) < 0.12 + m.dry * 0.3 * (0.35 + 0.65 * p.t);
        if (m.px !== null && !gap && w[i] > 0.8) {
          if (!pen) {
            if (!m.on) { m.on = true; const q = noise1(p.s * 0.011 + m.jit * 0.5, 9); m.ra = m.a * (0.5 + 0.75 * q); m.rw = m.lw * (0.6 + 0.8 * noise1(p.s * 0.013 + m.jit, 10)); }
            gb.beginPath();
            gb.moveTo(m.px, m.py);
            pen = true;
          }
          gb.lineTo(x, y);
        } else {
          if (pen) this.rimStroke(m);
          pen = false;
          m.on = false;
        }
        m.px = x; m.py = y;
      }
      if (pen) this.rimStroke(m);
    }
    this.i = i1;
    if (last) { this.done = true; if (this.caps === true || this.caps === 'end') this.cap(this.n - 1); }
    return i1 - i0 + 1;
  }
  rimStroke(m) {
    const [r, g, b] = this.rgb;
    this.gb.lineWidth = m.rw;
    this.gb.strokeStyle = `rgba(${r},${g},${b},${clamp(m.ra).toFixed(3)})`;
    this.gb.stroke();
  }
  flyWhite(limit) {
    const g = this.ga;
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.lineCap = 'butt';
    g.lineJoin = 'round';
    for (const h of this.hairs) {
      const Wt = h.white;
      if (!Wt.length) continue;
      const keep = [];
      let lx = NaN, ly = NaN, any = false;
      g.beginPath();
      for (let j = 0; j < Wt.length; j += 5) {
        if (Wt[j + 4] > limit) { keep.push(Wt[j], Wt[j + 1], Wt[j + 2], Wt[j + 3], Wt[j + 4]); continue; }
        if (Wt[j] !== lx || Wt[j + 1] !== ly) g.moveTo(Wt[j], Wt[j + 1]);
        g.lineTo(Wt[j + 2], Wt[j + 3]);
        lx = Wt[j + 2]; ly = Wt[j + 3];
        any = true;
      }
      if (any) {
        g.lineWidth = Math.max(0.5, h.lw * 0.8);
        g.strokeStyle = `rgba(0,0,0,${h.wa.toFixed(3)})`;
        g.stroke();
      }
      h.white = keep;
    }
    g.restore();
  }
  // round end cap. where two strokes overlap at a joint it goes darker, like on real paper
  cap(i) {
    const p = this.S[i], r = this.w[i] * 0.5 * (i ? 0.9 : 0.8);
    if (r < 0.6) return;
    const g = this.ga, a = Math.atan2(p.ny, p.nx), ca = Math.cos(a), sa = Math.sin(a);
    const seed = this.rand() * 100;
    g.beginPath();
    for (let k = 0; k <= 16; k++) {
      const th = (k / 16) * TAU;
      const rr = r * (1 + (noise1(th * 1.3 + seed, 3) - 0.5) * 0.22);
      const u = Math.cos(th) * rr, v = Math.sin(th) * rr * 1.12;
      const x = p.x + u * ca - v * sa, y = p.y + u * sa + v * ca;
      if (k) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
    g.fill();
  }
  finish() { while (!this.done) this.step(400); }
  // target canvas needs an identity transform (device px)
  drawTo(g, withHalo = false) {
    if (!this.A) return;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (withHalo && this.halo > 0) {
      // bleed into the paper. cheap blur: scale the body down and back up
      const k = 7;
      const tiny = canvasOf(this.cw / k, this.ch / k);
      const tg = tiny.getContext('2d');
      tg.imageSmoothingQuality = 'high';
      tg.drawImage(this.A, 0, 0, tiny.width, tiny.height);
      g.imageSmoothingQuality = 'high';
      g.globalAlpha = this.halo * this.tone;
      const gx = this.cw * 0.03, gy = this.ch * 0.03;
      g.drawImage(tiny, this.ox - gx, this.oy - gy, this.cw + gx * 2, this.ch + gy * 2);
    }
    g.globalAlpha = this.bodyA;
    g.drawImage(this.A, this.ox, this.oy);
    g.globalAlpha = 1;
    g.drawImage(this.B, this.ox, this.oy);
    g.restore();
  }
  release() { this.A = this.B = this.ga = this.gb = null; }
}

function mossDot(g, x, y, r, a, seed) {
  const rand = rng(seed);
  const rx = r * (0.95 + rand() * 0.75), ry = r * (0.55 + rand() * 0.35);
  stamp(g, x, y, r * 2.2, INKC, 0.14, 0.4);
  if (rand() < 0.3) {
    const d = r * (1.8 + rand()), th = a + (rand() - 0.5) * 1.4;
    g.beginPath();
    g.ellipse(x + Math.cos(th) * d, y + Math.sin(th) * d, r * 0.45, r * 0.38, a, 0, TAU);
    g.fillStyle = rgba(INKC, 0.8);
    g.fill();
  }
  g.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * TAU;
    const k = 1 + (noise1(th * 1.7 + seed, 3) - 0.5) * 0.36;
    const px = Math.cos(th) * rx * k, py = Math.sin(th) * ry * k;
    const X = x + px * Math.cos(a) - py * Math.sin(a), Y = y + px * Math.sin(a) + py * Math.cos(a);
    if (i) g.lineTo(X, Y); else g.moveTo(X, Y);
  }
  g.closePath();
  g.fillStyle = rgba(INKC, 0.78 + rand() * 0.17);
  g.fill();
}

// --- brushwork ---

// pushes strokes in painting order. ms = how long each one takes to paint
function brushwork(seed, push) {
  const rand = rng(seed * 7 + 1);
  let sd = Math.floor(seed * 1000);
  const add = (spec, speed) => push({ spec, ms: polyLen(spec.pts) / speed });
  const widthAt = (nodes, t) => {
    const s = t * nodes[nodes.length - 1].s;
    let i = 1;
    while (i < nodes.length - 1 && nodes[i].s < s) i++;
    const a = nodes[i - 1], c = nodes[i];
    return lerp(a.w, c.w, clamp((s - a.s) / Math.max(1e-3, c.s - a.s)));
  };
  const normals = (nodes) => nodes.map((n, i) => {
    const a = nodes[Math.max(0, i - 1)], c = nodes[Math.min(nodes.length - 1, i + 1)];
    const L = Math.hypot(c.x - a.x, c.y - a.y) || 1;
    return [-(c.y - a.y) / L, (c.x - a.x) / L];
  });

  function trunk(b) {
    const nd = b.nodes;
    const wmax = Math.max(...nd.map((n) => n.w));
    const pts = nd.map((n) => [n.x, n.y]);
    const prof = (t) => (widthAt(nd, t) / wmax) * (1 - 0.2 * smooth(0.92, 1, t));
    add({ pts, width: wmax, prof, tone: 0.92, body: 0.42, dry: 0.82, rim: 1.1, seed: sd++, halo: 0.16, hair: 1, caps: 'end' }, 0.55);
    const nm = normals(nd);
    // second, drier pass on the shadow side so the trunk looks round
    const down = nm[Math.floor(nm.length / 2)][1] > 0 ? 1 : -1;
    const sh = nd.map((n, i) => [n.x + nm[i][0] * n.w * 0.24 * down, n.y + nm[i][1] * n.w * 0.24 * down]);
    add({ pts: sh, width: wmax * 0.46, prof, tone: 0.9, body: 0.22, dry: 0.92, rim: 0.25, seed: sd++, halo: 0, nb: 10 }, 0.9);
    const fis = nd.map((n, i) => [n.x + nm[i][0] * n.w * 0.14, n.y + nm[i][1] * n.w * 0.14]);
    add({ pts: fis.slice(0, Math.max(3, Math.ceil(fis.length * 0.75))), width: wmax * 0.2, prof: (t) => Math.sin(Math.PI * clamp(t)) * 0.9 + 0.1, tone: 0.9, body: 0.38, dry: 0.9, rim: 0.5, seed: sd++, halo: 0, nb: 6 }, 0.9);
    for (let i = 1; i < nd.length - 1; i++) {
      if (rand() < 0.6) continue;
      const n = nd[i], [nx, ny] = nm[i];
      const tx = ny, ty = -nx;
      const o = (rand() - 0.5) * n.w * 0.5;
      const sgn = rand() < 0.6 ? 1 : -1;
      const p0 = [n.x + nx * n.w * 0.46 * sgn + tx * o, n.y + ny * n.w * 0.46 * sgn + ty * o];
      const p1 = [n.x + nx * n.w * 0.12 * sgn + tx * (o + n.w * 0.22), n.y + ny * n.w * 0.12 * sgn + ty * (o + n.w * 0.22)];
      add({ pts: [p0, p1], width: n.w * 0.08, prof: PROFILE.stroke, tone: 0.8, body: 0.55, dry: 0.6, rim: 0.1, seed: sd++, halo: 0, nb: 3 }, 0.6);
    }
  }
  // limbs and twigs: one stroke through all the joints, re-pressing the brush at each
  function knuckled(b) {
    const nd = b.nodes;
    const isLimb = b.depth === 1;
    const pts = [];
    const nodeIdx = [];
    // side branches start at the parent's edge, painting across the old wood leaves a dark band
    const par = b.parent;
    const fromSide = !!par && b.at < par.nodes.length - 1;
    for (let i = 0; i < nd.length - 1; i++) {
      const a = nd[i], c = nd[i + 1];
      const L = Math.hypot(c.x - a.x, c.y - a.y) || 1;
      const ux = (c.x - a.x) / L, uy = (c.y - a.y) / L;
      const epsA = Math.min(L * 0.16, Math.max(1.2, a.w * 0.3));
      const epsC = Math.min(L * 0.16, Math.max(1.2, c.w * 0.3));
      if (i === 0 && fromSide) {
        const pn = par.nodes, k = b.at;
        const pa = pn[Math.max(0, k - 1)], pc = pn[Math.min(pn.length - 1, k + 1)];
        const pl = Math.hypot(pc.x - pa.x, pc.y - pa.y) || 1;
        const sinA = Math.abs(ux * (pc.y - pa.y) / pl - uy * (pc.x - pa.x) / pl);
        const off = Math.min(L * 0.4, (pn[k].w * 0.36) / Math.max(0.45, sinA));
        pts.push([a.x + ux * off, a.y + uy * off]);
      } else if (i === 0) {
        // continuing off the parent's end: touch down just inside it, narrow, then press
        const back = par ? Math.min(a.w * 0.45, 12) : Math.min(a.w * 0.3, 5);
        pts.push([a.x - ux * back, a.y - uy * back]);
      }
      else { pts.push([a.x + ux * epsA, a.y + uy * epsA]); nodeIdx.push(pts.length - 1.5); }
      const bow = (rand() - 0.5) * L * 0.06;
      pts.push([(a.x + c.x) / 2 - uy * bow, (a.y + c.y) / 2 + ux * bow]);
      if (i < nd.length - 2) pts.push([c.x - ux * epsC, c.y - uy * epsC]);
      else pts.push([c.x, c.y]);
    }
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = cum[cum.length - 1] || 1;
    const at = (fi) => { const i = Math.floor(fi), f = fi - i; return lerp(cum[i], cum[Math.min(cum.length - 1, i + 1)], f); };
    const ns = [0, ...nodeIdx.map(at), total];
    const ws = nd.map((n) => n.w);
    const wmax = Math.max(...ws);
    const tipW = Math.max(0.35, ws[ws.length - 1] * 0.35);
    const prof = (t) => {
      const sx = t * total;
      let k = 1;
      while (k < ns.length - 1 && ns[k] < sx) k++;
      const f = clamp((sx - ns[k - 1]) / Math.max(1e-3, ns[k] - ns[k - 1]));
      // limbs taper over their whole last joint, twigs keep their width and lift late
      const wb = k === ns.length - 1 ? lerp(ws[k - 1], tipW, isLimb || b.kind === 'shoot' ? Math.pow(f, 0.8) : smooth(0.3, 1, f)) : lerp(ws[k - 1], ws[k], f);
      let bulge = 0;
      for (let j = 1; j < ns.length - 1; j++) bulge += Math.exp(-Math.pow((sx - ns[j]) / Math.max(2, ws[j] * 0.7), 2));
      const entry = par && !fromSide ? 0.38 + 0.62 * smooth(0, ws[0] * 1.4, sx) : 0.85 + 0.15 * smooth(0, 0.03, t);
      return (wb / wmax) * (1 + 0.1 * bulge) * entry;
    };
    add({
      pts, width: wmax, prof, tone: b.tone, knots: ns.slice(1, -1).map((v) => v / total),
      body: isLimb ? 0.62 : 0.86, dry: isLimb ? 0.62 : b.kind === 'shoot' ? 0.35 : 0.3, rim: isLimb ? 0.75 : 0.35,
      seed: sd++, press: isLimb ? (fromSide ? 0.75 : 0.18) : 0.4, halo: isLimb ? 0.12 : 0.06, caps: 'start',
      nb: isLimb ? undefined : clamp(Math.round(wmax / 1.2), 2, 6),
    }, isLimb ? 0.62 : b.kind === 'shoot' ? 1.2 : 0.95);
  }
  return { trunk, knuckled };
}

function polyLen(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

// --- the section ---

export function createBlossoms(root, { reasons = () => [], t = (k) => k, reduceMotion = false, mobile = false, sound = {} } = {}) {
  const $ = (s) => root.querySelector(s);
  const stage = $('.love-stage');
  const paintEl = $('.love-paint');
  const canvas = $('.love-canvas');
  const overlay = $('.love-overlay');
  const budsEl = $('.love-buds');
  const reading = $('.love-reading');
  const facesEl = $('.love-faces');
  const faces = [...root.querySelectorAll('.love-face')];
  const countEl = $('.love-count');
  const pipsEl = $('.love-pips');
  const doneEl = $('.love-done');
  const doneText = $('.love-done-text');
  const sealC = $('.love-seal-c');
  const liveEl = $('.love-live');
  const keysEl = $('.love-keys');
  const bg = canvas.getContext('2d');
  const og = overlay.getContext('2d');
  const pluck = (i, o) => { try { sound && sound.pluck && sound.pluck(i, o); } catch (e) { /* sound is optional */ } };

  const SEED = 7.31;
  let texts = [];
  let N = 0;
  let W = 0, H = 0, dpr = 1, tall = false, box = { x0: 0, x1: 0 };
  let comp = null;
  let sprites = [];
  let petalSprites = [];
  let buttons = [];
  let pips = [];
  const st = []; // per reason: { appearAt, bloomAt, nudgeAt }
  let bloomed = 0;
  let current = -1; // reason on the card, -1 = intro
  let faceOn = 0;
  let painter = null, growScale = 1, avoidTop = null;
  let grown = false, growStarted = false, seen = false;
  let active = false, destroyed = false, raf = 0, last = 0;
  let doneShown = false, quick = false, live = null;
  const petals = [];
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };

  if (reduceMotion) root.classList.add('is-still');
  if (mobile) root.classList.add('is-touch');

  // faint plum sprig printed on the card paper
  try {
    const pc = canvasOf(232, 184);
    const pg = pc.getContext('2d');
    pg.setTransform(2, 0, 0, 2, 0, 0);
    const twigSpec = (pts, width, seed) => ({ pts, width, profile: PROFILE.twig, tone: 0.55, dry: 0.35, bleed: 0.15, seed, bristles: 7, chunk: 400 });
    for (const v of strokeGen(pg, twigSpec([[118, 96], [92, 74], [70, 64], [40, 38], [24, 12]], 4.2, 3))) void v;
    for (const v of strokeGen(pg, twigSpec([[70, 64], [58, 80], [36, 84]], 2.4, 5))) void v;
    const at = (x, y, fn) => { pg.save(); pg.translate(x, y); fn(); pg.restore(); };
    at(50, 44, () => paintBlossom(pg, 11, { seed: 4, tint: PINK, tilt: 0.85, rot: 0.6, base: 0.5 }));
    at(80, 78, () => paintBlossom(pg, 9, { seed: 8, tint: ROSE, tilt: 0.7, rot: 2.1, base: -1.2 }));
    at(28, 14, () => paintBud(pg, 4, { seed: 2, tint: ROSE, dir: -2.2 }));
    at(38, 86, () => paintBud(pg, 3.5, { seed: 6, tint: ROSE, dir: 2.9 }));
    // all one pale red like old printed poem paper, so the text can sit on top
    pg.setTransform(1, 0, 0, 1, 0, 0);
    pg.globalCompositeOperation = 'source-in';
    pg.fillStyle = 'rgb(184,50,42)';
    pg.fillRect(0, 0, pc.width, pc.height);
    root.style.setProperty('--love-print', `url(${pc.toDataURL('image/png')})`);
  } catch (e) { /* just decoration */ }

  function syncReasons() {
    const list = (typeof reasons === 'function' ? reasons() : reasons) || [];
    texts = list.map((s) => String(s));
    if (texts.length !== N) {
      N = texts.length;
      while (st.length < N) st.push({ appearAt: 0, bloomAt: 0, nudgeAt: 0 });
      st.length = N;
      bloomed = st.filter((s) => s.bloomAt).length;
      if (current >= N) current = -1;
      buildButtons();
      // count changed, so the finale may need undoing or showing
      if (doneShown && bloomed < N) { doneShown = false; root.classList.remove('is-done'); doneEl.setAttribute('aria-hidden', 'true'); }
      else if (!doneShown && N && bloomed === N) later(finale, 400);
      return true;
    }
    return false;
  }

  function buildButtons() {
    budsEl.textContent = '';
    pipsEl.textContent = '';
    buttons = [];
    pips = [];
    for (let i = 0; i < N; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'love-bud';
      b.dataset.i = String(i);
      b.style.setProperty('--d', `${(i * 0.37) % 2.6}s`);
      b.setAttribute('aria-pressed', st[i].bloomAt ? 'true' : 'false');
      if (st[i].bloomAt) b.classList.add('is-open');
      if (st[i].appearAt) b.classList.add('is-shown');
      budsEl.appendChild(b);
      buttons.push(b);
      const p = document.createElement('i');
      if (st[i].bloomAt) p.className = 'is-on';
      pipsEl.appendChild(p);
      pips.push(p);
    }
    labelButtons();
  }
  function labelButtons() {
    buttons.forEach((b, i) => b.setAttribute('aria-label', fmt(t('love.bud'), { i: i + 1, n: N })));
  }

  function measure() {
    const sr = stage.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || innerWidth;
    const rw = root.clientWidth;
    const wantTall = rw < TALL_BELOW;
    if (wantTall !== tall) { tall = wantTall; root.classList.toggle('is-tall', tall); }
    paintEl.style.left = `${-sr.left}px`;
    paintEl.style.width = `${vw}px`;
    const w = vw, h = paintEl.clientHeight;
    const bx = { x0: sr.left, x1: sr.left + rw };
    let avoid = null;
    if (!tall) {
      const rr = reading.getBoundingClientRect();
      const pad = 10;
      // spare line above the card so longer translations still fit
      const lh = parseFloat(getComputedStyle(faces[faceOn].querySelector('.love-text')).lineHeight) || 40;
      avoid = { x0: rr.left - pad, y0: rr.top - sr.top - pad, x1: rr.right + pad, y1: h + 20, room: Math.min(lh, h * 0.08) };
    }
    return { w, h, bx, avoid };
  }

  function layout(force = false) {
    if (destroyed) return;
    measureCard();
    const m = measure();
    if (m.w < 10 || m.h < 10) return;
    let d = Math.min(2, window.devicePixelRatio || 1);
    const maxPx = 9e6;
    if (m.w * m.h * d * d > maxPx) d = Math.sqrt(maxPx / (m.w * m.h));
    const key = [m.w, m.h, m.bx.x0, m.bx.x1, tall, N, d].join('|');
    // card grew past its space (language switch), recompose. if it shrank keep the old branch so the painting doesn't jump
    const outgrown = !!(m.avoid && avoidTop !== null && m.avoid.y0 < avoidTop - 0.5);
    if (!force && key === layout.key && !outgrown) return;
    layout.key = key;
    W = m.w; H = m.h; dpr = d; box = m.bx;
    for (const c of [canvas, overlay]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    const avoid = m.avoid ? { ...m.avoid, y0: m.avoid.y0 - m.avoid.room } : null;
    avoidTop = avoid ? avoid.y0 : null;
    comp = compose({ W, H, bx0: box.x0, bx1: box.x1, avoid, tall, N, seed: SEED });
    placeButtons();
    makeSprites();
    bg.setTransform(1, 0, 0, 1, 0, 0);
    bg.clearRect(0, 0, canvas.width, canvas.height);
    painter = null;
    live = null;
    if (grown || (growStarted && reduceMotion)) {
      paintAll();
    } else if (growStarted) {
      startGrowth();
    }
    petals.length = 0;
    drawOverlay(performance.now());
    poke();
  }

  function placeButtons() {
    if (!comp) return;
    buttons.forEach((b, i) => {
      const s = comp.sites[i];
      if (!s) return;
      b.style.setProperty('--x', `${s.x.toFixed(1)}px`);
      b.style.setProperty('--y', `${s.y.toFixed(1)}px`);
      // open flowers are bigger, so bigger hit area and focus ring
      b.style.setProperty('--hit-open', `${Math.max(48, s.R * 2.2).toFixed(0)}px`);
      b.style.setProperty('--ring', `${Math.max(48, s.R * 2.7).toFixed(0)}px`);
    });
  }

  function queue() {
    const items = [];
    let total = 0;
    const push = (it) => { items.push(it); total += it.ms; };
    const stroke = ({ spec, ms }) => push({ ms, fn: () => (function* () {
      const s = new InkStroke(spec, dpr);
      if (s.done) return;
      live = s;
      const per = ms / Math.max(1, s.n);
      while (!s.done) { const k = s.step(quick ? 1e4 : 5); yield Math.max(0.01, k * per); }
      s.drawTo(bg, true);
      s.release();
      live = null;
    })() });
    const timed = (ms, body) => push({ ms, fn: () => (function* () { body(); yield ms; })() });
    const bw = brushwork(SEED, stroke);
    const appear = (b) => b.sites.forEach((i) => timed(40, () => showBud(i)));
    const pause = (ms) => push({ ms, fn: () => (function* () { yield ms; })() });
    const done = new Set();
    const paintTree = (b) => {
      if (done.has(b)) return;
      done.add(b);
      if (b.kind === 'trunk') bw.trunk(b); else bw.knuckled(b);
      appear(b);
      for (const k of b.kids) if (k.depth >= 2) paintTree(k);
    };
    paintTree(comp.trunk);
    pause(180);
    for (const b of comp.limbs) { paintTree(b); pause(100); }
    for (const b of comp.shoots) paintTree(b);
    for (const b of comp.branches) paintTree(b);
    pause(160);
    comp.tiny.forEach((u, k) => timed(45, () => { bg.setTransform(dpr, 0, 0, dpr, 0, 0); tinyBud(bg, u.x, u.y, u.r, u.dir, 300 + k); }));
    comp.moss.forEach((m, k) => timed(32, () => { bg.setTransform(dpr, 0, 0, dpr, 0, 0); mossDot(bg, m.x, m.y, m.r, m.a, 500 + k); }));
    timed(1, () => { for (let i = 0; i < N; i++) showBud(i); });
    const p = new Painter(bg, { speed: 1 });
    for (const it of items) p.add(it.fn);
    return { p, total };
  }

  function paintAll() {
    const { p } = queue();
    quick = true;
    p.finish();
    quick = false;
    bg.setTransform(1, 0, 0, 1, 0, 0);
    grown = true;
    root.classList.add('is-grown');
    for (let i = 0; i < N; i++) showBud(i, true);
  }

  function startGrowth() {
    growStarted = true;
    if (reduceMotion) { paintAll(); root.classList.add('is-painted'); drawOverlay(performance.now()); return; }
    // a resize restarted the growth, unopened buds wait for their twig again
    for (let i = 0; i < N; i++) if (!st[i].bloomAt) { st[i].appearAt = 0; if (buttons[i]) buttons[i].classList.remove('is-shown'); }
    const { p, total } = queue();
    painter = p;
    // ~5s total however big the branch is
    growScale = total / (tall ? 4600 : 5400);
    root.classList.add('is-painted');
    poke();
  }

  function growStep(dt) {
    if (!painter) return false;
    const more = painter.step(Math.max(4, dt * 1000 * growScale));
    if (!more) {
      painter = null;
      bg.setTransform(1, 0, 0, 1, 0, 0);
      grown = true;
      root.classList.add('is-grown');
      for (let i = 0; i < N; i++) showBud(i);
      return false;
    }
    return true;
  }

  function showBud(i, instant = false) {
    const s = st[i];
    if (!s) return;
    if (!s.appearAt) s.appearAt = instant || quick || reduceMotion ? -1e9 : performance.now();
    const b = buttons[i];
    if (b && !b.classList.contains('is-shown')) b.classList.add('is-shown');
  }

  function makeSprites() {
    sprites = comp.sites.map((s) => {
      const size = s.R * 3.1;
      const bloom = canvasOf(size * dpr, size * dpr);
      const g1 = bloom.getContext('2d');
      g1.setTransform(dpr, 0, 0, dpr, bloom.width / 2, bloom.height / 2);
      paintBlossom(g1, s.R, { seed: s.seed, tint: s.tint, tilt: s.tilt, rot: s.rot, base: s.base, paper: true });
      const bsz = s.R * 1.7;
      const bud = canvasOf(bsz * dpr, bsz * dpr);
      const g2 = bud.getContext('2d');
      g2.setTransform(dpr, 0, 0, dpr, bud.width / 2, bud.height / 2);
      paintBud(g2, s.R * 0.4, { seed: s.seed + 3, tint: s.tint === CINNABAR ? CINNABAR : ROSE, dir: s.dir });
      return { bloom, bloomSize: size, bud, budSize: bsz, tmp: null };
    });
    const pr = comp.R * 0.3;
    petalSprites = TINTS.slice(0, 4).map((tint, k) => {
      const size = pr * 2.8;
      const c = canvasOf(size * dpr, size * dpr);
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, c.width / 2, c.height / 2);
      paintPetal(g, pr, { seed: 40 + k * 3, tint });
      return { c, size };
    });
  }

  function drawOverlay(now) {
    og.setTransform(1, 0, 0, 1, 0, 0);
    og.clearRect(0, 0, overlay.width, overlay.height);
    if (!comp) return false;
    if (live) live.drawTo(og);
    og.setTransform(dpr, 0, 0, dpr, 0, 0);
    let busy = !!live;
    for (let i = 0; i < N; i++) {
      const s = st[i], site = comp.sites[i], sp = sprites[i];
      if (!s || !site || !sp || !s.appearAt) continue;
      const ka = reduceMotion ? 1 : clamp((now - s.appearAt) / APPEAR_MS);
      if (ka < 1) busy = true;
      if (!s.bloomAt) {
        const sc = 0.4 + 0.6 * easeBack(ka);
        og.globalAlpha = smooth(0, 0.6, ka);
        og.drawImage(sp.bud, site.x - (sp.budSize * sc) / 2, site.y - (sp.budSize * sc) / 2, sp.budSize * sc, sp.budSize * sc);
        og.globalAlpha = 1;
        continue;
      }
      const kb = reduceMotion ? clamp((now - s.bloomAt) / 260) : clamp((now - s.bloomAt) / BLOOM_MS);
      if (i === current) stamp(og, site.x, site.y, site.R * 1.75, site.tint, 0.13 * smooth(0.3, 1, kb), 0.15);
      const kn = s.nudgeAt ? clamp((now - s.nudgeAt) / 700) : 1;
      if (kb < 1 || kn < 1) busy = true;
      if (kb < 1 && !reduceMotion) {
        og.globalAlpha = 1 - smooth(0, 0.42, kb);
        const bs = 1 + 0.35 * kb;
        og.drawImage(sp.bud, site.x - (sp.budSize * bs) / 2, site.y - (sp.budSize * bs) / 2, sp.budSize * bs, sp.budSize * bs);
        og.globalAlpha = 1;
        stamp(og, site.x, site.y, site.R * (0.5 + 1.6 * easeOut(kb)), site.tint, 0.2 * (1 - kb), 0.25);
        drawReveal(sp, site, kb);
      } else if (kb < 1) {
        og.globalAlpha = kb;
        og.drawImage(sp.bloom, site.x - sp.bloomSize / 2, site.y - sp.bloomSize / 2, sp.bloomSize, sp.bloomSize);
        og.globalAlpha = 1;
      } else {
        const nod = kn < 1 && !reduceMotion ? Math.sin(kn * Math.PI) * (1 - kn) : 0;
        if (nod) {
          og.save();
          og.translate(site.x, site.y);
          og.rotate(nod * 0.16 * site.spin);
          og.scale(1 + nod * 0.06, 1 + nod * 0.06);
          og.drawImage(sp.bloom, -sp.bloomSize / 2, -sp.bloomSize / 2, sp.bloomSize, sp.bloomSize);
          og.restore();
        } else {
          og.drawImage(sp.bloom, site.x - sp.bloomSize / 2, site.y - sp.bloomSize / 2, sp.bloomSize, sp.bloomSize);
        }
      }
    }
    for (const p of petals) {
      const k = p.age / p.life;
      const a = smooth(0, 0.08, k) * (1 - smooth(0.62, 1, k));
      if (a <= 0.01) continue;
      const ps = petalSprites[p.v];
      og.save();
      og.globalAlpha = a;
      og.translate(p.x, p.y);
      og.rotate(p.rot);
      og.scale(Math.max(0.12, Math.abs(Math.cos(p.flip))) * p.sc, p.sc);
      og.drawImage(ps.c, -ps.size / 2, -ps.size / 2, ps.size, ps.size);
      og.restore();
    }
    if (petals.length) busy = true;
    return busy;
  }

  // opens from the middle out, like colour spreading on wet paper
  function drawReveal(sp, site, k) {
    const src = sp.bloom;
    if (!sp.tmp) sp.tmp = canvasOf(src.width, src.height);
    const tg = sp.tmp.getContext('2d');
    tg.globalCompositeOperation = 'copy';
    tg.drawImage(src, 0, 0);
    tg.globalCompositeOperation = 'destination-in';
    const c = src.width / 2;
    const e = easeOut(k);
    const rr = Math.max(1, c * (0.1 + 1.05 * e));
    const grd = tg.createRadialGradient(c, c, rr * 0.55, c, c, rr);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    tg.fillStyle = grd;
    tg.fillRect(0, 0, src.width, src.height);
    tg.globalCompositeOperation = 'source-over';
    og.save();
    og.translate(site.x, site.y);
    og.rotate((1 - e) * -0.45 * site.spin);
    const sc = 0.72 + 0.28 * easeBack(k);
    og.scale(sc, sc);
    og.globalAlpha = smooth(0, 0.2, k);
    og.drawImage(sp.tmp, -sp.bloomSize / 2, -sp.bloomSize / 2, sp.bloomSize, sp.bloomSize);
    og.restore();
  }

  function spawnPetals(i, n, delay = 0) {
    if (reduceMotion || !comp) return;
    const site = comp.sites[i];
    if (!site) return;
    const r = rng(Math.floor(performance.now()) + i);
    for (let k = 0; k < n; k++) {
      petals.push({
        x: site.x + (r() - 0.5) * site.R * 1.2,
        y: site.y + (r() - 0.5) * site.R * 0.8,
        vx: (r() - 0.5) * 18 + 6,
        vy: 6 + r() * 14,
        rot: r() * TAU,
        vr: (r() - 0.5) * 1.6,
        flip: r() * TAU,
        vf: 1.4 + r() * 2.2,
        ph: r() * TAU,
        sway: 10 + r() * 16,
        sc: 0.8 + r() * 0.45,
        v: Math.floor(r() * petalSprites.length),
        age: -delay - k * (0.12 + r() * 0.25),
        life: 3.6 + r() * 2.4,
      });
    }
    if (petals.length > 70) petals.splice(0, petals.length - 70);
  }

  function updatePetals(dt) {
    for (let j = petals.length - 1; j >= 0; j--) {
      const p = petals[j];
      p.age += dt;
      if (p.age < 0) continue;
      p.vy = Math.min(46, p.vy + 16 * dt);
      p.x += (p.vx + Math.sin(p.age * 1.7 + p.ph) * p.sway) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.flip += p.vf * dt;
      if (p.age > p.life || p.y > H + 20) petals.splice(j, 1);
    }
    return petals.length > 0;
  }

  function fillFace(face, i) {
    const num = face.querySelector('.love-num');
    const kick = face.querySelector('.love-kick-text');
    const text = face.querySelector('.love-text');
    const hint = face.querySelector('.love-hint');
    if (i < 0) {
      num.textContent = '梅';
      kick.textContent = t('love.kicker');
      text.textContent = t('love.intro');
      hint.textContent = t(mobile ? 'love.hint.touch' : 'love.hint');
      hint.hidden = false;
      face.classList.add('is-intro');
    } else {
      num.textContent = NUM[i] || String(i + 1);
      kick.textContent = fmt(t('love.reason'), { i: i + 1, n: N });
      text.textContent = texts[i] || '';
      hint.textContent = '';
      hint.hidden = true;
      face.classList.remove('is-intro');
    }
  }
  function showCard(i) {
    if (i === current && faces[faceOn].dataset.lang === document.documentElement.lang) return;
    current = i;
    const next = faces[1 - faceOn], prev = faces[faceOn];
    fillFace(next, i);
    next.dataset.lang = document.documentElement.lang;
    prev.classList.remove('is-on');
    prev.setAttribute('aria-hidden', 'true');
    next.classList.add('is-on');
    next.removeAttribute('aria-hidden');
    faceOn = 1 - faceOn;
    buttons.forEach((b, k) => b.classList.toggle('is-current', k === i));
  }
  // size the card for its longest text so nothing jumps
  function measureCard() {
    if (!facesEl) return;
    const probe = faces[0].cloneNode(true);
    probe.classList.add('love-probe');
    probe.classList.remove('is-on');
    probe.removeAttribute('aria-hidden');
    facesEl.appendChild(probe);
    let hmax = 0;
    for (let i = -1; i < N; i++) {
      fillFace(probe, i);
      hmax = Math.max(hmax, probe.offsetHeight);
    }
    probe.remove();
    facesEl.style.minHeight = `${Math.ceil(hmax)}px`;
  }

  function renderCount() {
    countEl.textContent = '';
    String(t('love.count')).split(/(\{n\}|\{total\})/).forEach((part) => {
      if (!part) return;
      if (part === '{n}' || part === '{total}') {
        const s = document.createElement('span');
        s.className = part === '{n}' ? 'love-count-n' : 'love-count-t';
        s.textContent = String(part === '{n}' ? bloomed : N);
        countEl.appendChild(s);
      } else countEl.appendChild(document.createTextNode(part));
    });
    pips.forEach((p, i) => p.classList.toggle('is-on', !!(st[i] && st[i].bloomAt)));
  }

  function activate(i) {
    const s = st[i];
    if (!s || !s.appearAt || !comp) return;
    const now = performance.now();
    const site = comp.sites[i];
    const pan = site ? clamp(((site.x - box.x0) / Math.max(1, box.x1 - box.x0)) * 1.2 - 0.6, -0.6, 0.6) : 0;
    if (!s.bloomAt) {
      s.bloomAt = now;
      bloomed++;
      buttons[i].setAttribute('aria-pressed', 'true');
      buttons[i].classList.add('is-open');
      spawnPetals(i, 3, 0.35);
      pluck(i, { gain: 0.22, pan });
      if (bloomed === N && !doneShown) later(finale, reduceMotion ? 300 : BLOOM_MS + 600);
    } else {
      s.nudgeAt = now;
      spawnPetals(i, 1, 0.1);
      pluck(i, { gain: 0.14, pan });
    }
    showCard(i);
    liveEl.textContent = `${fmt(t('love.reason'), { i: i + 1, n: N })}. ${texts[i] || ''}`;
    renderCount();
    poke();
  }

  function finale() {
    if (destroyed) return;
    doneShown = true;
    root.classList.add('is-done');
    doneEl.setAttribute('aria-hidden', 'false');
    stampSeal();
    if (!reduceMotion) {
      for (let i = 0; i < N; i++) spawnPetals(i, 1 + (i % 2), 0.15 + (i % 5) * 0.3);
    }
    [0, 2, 4, 7].forEach((n, k) => later(() => pluck(n + 2, { gain: 0.16 }), 400 + k * 170));
    later(() => { liveEl.textContent = t('love.done'); }, 900);
    poke();
  }

  function stampSeal() {
    if (!sealC) return;
    const size = 44;
    const d = Math.min(2, window.devicePixelRatio || 1);
    sealC.width = Math.round(size * d);
    sealC.height = Math.round(size * d);
    const draw = () => {
      const g = sealC.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, sealC.width, sealC.height);
      sealStamp(g, sealC.width / 2, sealC.height / 2, size * d * 1.25, '梅', { seed: 9, rot: -0.05 });
    };
    if (document.fonts && document.fonts.load) document.fonts.load('900 40px "Noto Serif KR"', '梅').then(draw, draw);
    else draw();
  }

  function onClick(e) {
    const b = e.target.closest('.love-bud');
    if (!b || !budsEl.contains(b)) return;
    activate(Number(b.dataset.i));
  }
  function onKey(e) {
    const b = e.target.closest && e.target.closest('.love-bud');
    if (!b) return;
    const i = Number(b.dataset.i);
    const shown = buttons.map((x, k) => (x.classList.contains('is-shown') ? k : -1)).filter((k) => k >= 0);
    if (!shown.length) return;
    const at = shown.indexOf(i);
    let to = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = shown[(at + 1) % shown.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = shown[(at - 1 + shown.length) % shown.length];
    else if (e.key === 'Home') to = shown[0];
    else if (e.key === 'End') to = shown[shown.length - 1];
    if (to === null) return;
    e.preventDefault();
    buttons[to].focus();
  }
  budsEl.addEventListener('click', onClick);
  budsEl.addEventListener('keydown', onKey);

  // raf loop, only runs while something is moving
  function frame(now) {
    raf = 0;
    if (!active || destroyed || document.hidden) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    let busy = growStep(dt);
    busy = updatePetals(dt) || busy;
    busy = drawOverlay(now) || busy;
    if (busy) raf = requestAnimationFrame(frame);
  }
  function poke() {
    if (!active || destroyed || raf || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  const onVis = () => { if (!document.hidden) poke(); };
  document.addEventListener('visibilitychange', onVis);

  // wait until it's properly on screen, not just close
  let io = null;
  if (typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { seen = true; maybeGrow(); io.disconnect(); io = null; }
    }), { rootMargin: '0px 0px -22% 0px', threshold: 0 });
    io.observe(paintEl);
  } else seen = true;
  function maybeGrow() {
    if (!active || !seen || !fontsReady || growStarted || destroyed) return;
    layout(true);
    startGrowth();
  }

  let resizeT = 0;
  const onResize = () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (destroyed) return;
      // offscreen: just keep the height right, repaint when it's shown
      if (active) layout(); else { measureCard(); measure(); }
    }, 140);
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
  if (ro) ro.observe(root);
  addEventListener('resize', onResize);
  // card size depends on the fonts, and the branch layout depends on the card
  let fontsReady = !(document.fonts && document.fonts.ready) || document.fonts.status === 'loaded';
  const onFonts = () => { if (destroyed || fontsReady) return; fontsReady = true; onResize(); maybeGrow(); };
  if (!fontsReady) { document.fonts.ready.then(onFonts, onFonts); later(onFonts, 2500); }

  function relabel() {
    const focused = buttons.indexOf(document.activeElement);
    const changed = syncReasons();
    liveEl.textContent = '';
    budsEl.setAttribute('aria-label', t('love.branch'));
    if (keysEl) keysEl.textContent = t('love.keys');
    labelButtons();
    const f = faces[faceOn];
    fillFace(f, current);
    f.dataset.lang = document.documentElement.lang;
    faces[1 - faceOn].setAttribute('aria-hidden', 'true');
    doneText.textContent = t('love.done');
    renderCount();
    if (changed) layout(true);
    else if (active) layout();
    else measureCard();
    if (changed && focused >= 0) {
      const b = buttons[Math.min(focused, N - 1)];
      if (b && b.classList.contains('is-shown')) b.focus();
    }
  }

  syncReasons();
  faces.forEach((f, k) => { f.classList.toggle('is-on', k === 0); if (k) f.setAttribute('aria-hidden', 'true'); });
  doneEl.setAttribute('aria-hidden', 'true');
  relabel();
  layout(true);

  function setActive(on) {
    on = !!on;
    if (on === active) return;
    active = on;
    root.classList.toggle('is-active', on);
    if (on) {
      layout();
      maybeGrow();
      poke();
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function destroy() {
    setActive(false);
    destroyed = true;
    timers.forEach((id) => clearTimeout(id));
    timers.clear();
    clearTimeout(resizeT);
    budsEl.removeEventListener('click', onClick);
    budsEl.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVis);
    removeEventListener('resize', onResize);
    if (ro) ro.disconnect();
    if (io) io.disconnect();
    budsEl.textContent = '';
    pipsEl.textContent = '';
    canvas.width = canvas.height = overlay.width = overlay.height = 1;
    sprites = [];
    petalSprites = [];
    painter = null;
    comp = null;
  }

  return {
    relabel,
    setActive,
    destroy,
    // for tests
    __debug: () => ({
      W, H, dpr, tall, N, bloomed, grown, growStarted, painting: !!painter, current, petals: petals.length, raf: !!raf, seen, active, fontsReady,
      sites: comp ? comp.sites.map((s) => ({ x: s.x, y: s.y, R: s.R })) : [],
      finish: () => { if (painter) { quick = true; painter.finish(); quick = false; growStep(0.016); } drawOverlay(performance.now()); },
      repaint: () => { const t0 = performance.now(); layout(true); return performance.now() - t0; },
    }),
  };
}
