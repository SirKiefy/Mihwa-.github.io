// ─────────────────────────────────────────────────────────────────────────────
//  WANTED. A Red Dead Redemption 2 wanted poster, reprinted as a woodblock on
//  aged hanji: its top-left corner torn away (the scrap is still pinned under
//  an old nail), so it now hangs from one nail and sways when you brush past.
//  Click it and a bullet hole punches through, with ink splinters; aim at her
//  face and the bullet turns into a cinnabar heart instead.
//  Beside it, her two dog tags hang on ball chains from a plum branch and
//  clink when they swing into each other, and a small field card.
//
//  mountWanted(root, { photo, t, reduceMotion, sound }) → { relabel, setPhoto, setActive, destroy }
// ─────────────────────────────────────────────────────────────────────────────
import { rng, noise1, stamp, wash, stroke, dotGen, blossomGen, bud, PROFILE, INK } from '../ink/brush.js?v=774a543f68';

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const dprNow = () => Math.min(2, window.devicePixelRatio || 1);
const MAX_HOLES = 6;
const SHADE = { x: 24, t: 14, b: 50 };   // room around the poster for its painted shadow
const PRINT = [30, 24, 22];      // woodblock ink
const RUST = [128, 70, 36];
const SEAL_RGB = [184, 50, 42];

// ─────────────────────────── markup ───────────────────────────

const RETICLE = '<svg class="wanted-reticle" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="7"/><path d="M12 2v6.2M12 15.8V22M2 12h6.2M15.8 12H22"/><circle class="wanted-reticle-dot" cx="12" cy="12" r="1.15"/></svg>';
const RULE = `<p class="wanted-rule" aria-hidden="true"><span></span>${RETICLE}<span></span></p>`;

/** The inside of the fragment (the outer element is `<div class="wanted" id="wanted">`). */
export const WANTED_INNER = `
  <svg class="wanted-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      <!-- woodblock print: ragged edges, and specks where the ink missed the paper -->
      <filter id="wanted-print" x="-4%" y="-8%" width="108%" height="116%">
        <feTurbulence type="fractalNoise" baseFrequency="0.62" numOctaves="2" seed="9" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G" result="d"/>
        <feTurbulence type="fractalNoise" baseFrequency="0.48" numOctaves="3" seed="23" result="n2"/>
        <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4.2 0 0 0 -1.05" result="speck"/>
        <feComposite in="d" in2="speck" operator="in"/>
      </filter>
      <!-- the same, gentler, for small type -->
      <filter id="wanted-print-lite" x="-4%" y="-8%" width="108%" height="116%">
        <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="5" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="0.8" xChannelSelector="R" yChannelSelector="G" result="d"/>
        <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="29" result="n2"/>
        <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  5 0 0 0 -0.9" result="speck"/>
        <feComposite in="d" in2="speck" operator="in"/>
      </filter>
      <filter id="wanted-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>
      <path id="wanted-chain-d" d=""/>
    </defs>
  </svg>
  <i class="ink" data-ink="bloom" data-dark="0.2" data-seed="17.3" style="left:-4%;top:6%;width:58%;height:74%"></i>
  <i class="ink" data-ink="line" data-dark="0.8" data-seed="23.9" data-w="1" data-dry="1" data-bow="-0.3" style="right:2%;bottom:-26px;width:min(24rem,44%);height:16px"></i>

  <figure class="wanted-board">
    <canvas class="wanted-scrap" aria-hidden="true"></canvas>
    <span class="wanted-nail wanted-nail--old" aria-hidden="true"></span>
    <div class="wanted-poster">
      <canvas class="wanted-paper" aria-hidden="true"></canvas>
      <div class="wanted-sheet">
        <p class="wanted-kicker"><span aria-hidden="true">★ </span><span data-wk="wanted.kicker"></span><span aria-hidden="true"> ★</span></p>
        <h3 class="wanted-head" data-wk="wanted.head">WANTED</h3>
        <p class="wanted-sub" data-wk="wanted.sub"></p>
        <div class="wanted-portrait"><img alt="" decoding="async" data-wk-alt="wanted.alt"></div>
        <p class="wanted-name"><span class="wanted-name-latin" data-wk="wanted.name">MIHWA</span><span class="wanted-name-ko" data-wk="wanted.name.ko"></span></p>
        ${RULE}
        <p class="wanted-label" data-wk="wanted.for"></p>
        <p class="wanted-crime" data-wk="wanted.crime"></p>
        <p class="wanted-reward-label" data-wk="wanted.reward"></p>
        <p class="wanted-reward" data-wk="wanted.reward.v"></p>
        <p class="wanted-reward-x" data-wk="wanted.reward.x"></p>
        <p class="wanted-fine" data-wk="wanted.fine"></p>
      </div>
      <span class="wanted-stamp" aria-hidden="true"><span>美</span><span>花</span></span>
      <canvas class="wanted-holes" aria-hidden="true"></canvas>
      <button type="button" class="wanted-shoot" data-wk-label="wanted.shoot"></button>
    </div>
    <span class="wanted-nail wanted-nail--pivot" aria-hidden="true"></span>
    <figcaption class="wanted-hint" data-wk="wanted.hint"></figcaption>
  </figure>

  <div class="wanted-side">
    <div class="wanted-tags">
      <button type="button" class="wanted-stage">
        <canvas class="wanted-branch" aria-hidden="true"></canvas>
        <svg class="wanted-chain" viewBox="0 0 300 350" aria-hidden="true" focusable="false">
          <use href="#wanted-chain-d" class="wanted-chain-shadow" filter="url(#wanted-soft)"/>
          <use href="#wanted-chain-d" class="wanted-chain-link"/>
          <use href="#wanted-chain-d" class="wanted-chain-ball"/>
          <use href="#wanted-chain-d" class="wanted-chain-hi"/>
        </svg>
        <span class="wanted-tag wanted-tag--b" aria-hidden="true"><span class="wanted-tag-plate"><span class="wanted-tag-text">
          <span data-wk="wanted.tag2"></span><span class="wanted-tag-gap" data-wk="wanted.tag2.duty"></span>
        </span></span></span>
        <span class="wanted-tag wanted-tag--a" aria-hidden="true"><span class="wanted-tag-plate"><span class="wanted-tag-text">
          <span data-wk="wanted.tag.name"></span><span data-wk="wanted.tag.ko"></span><span data-wk="wanted.tag.sn"></span><span data-wk="wanted.tag.blood"></span><span data-wk="wanted.tag.faith"></span>
        </span></span></span>
      </button>
      <p class="wanted-tags-hint" data-wk="wanted.tags.hint"></p>
    </div>

    <aside class="wanted-card">
      <span class="wanted-card-stamp" aria-hidden="true"><span>名</span><span>射</span><span>手</span></span>
      <p class="wanted-card-kicker" data-wk="wanted.card.kicker"></p>
      <h3 class="wanted-card-title" data-wk="wanted.card.title"></h3>
      <dl>
        <div><dt data-wk="wanted.card.callsign.k"></dt><dd data-wk="wanted.card.callsign.v"></dd></div>
        <div><dt data-wk="wanted.card.games.k"></dt><dd data-wk="wanted.card.games.v"></dd></div>
        <div><dt data-wk="wanted.card.role.k"></dt><dd><span data-wk="wanted.card.role.v"></span>${RETICLE}</dd></div>
        <div><dt data-wk="wanted.card.area.k"></dt><dd data-wk="wanted.card.area.v"></dd></div>
        <div><dt data-wk="wanted.card.patience.k"></dt><dd><span data-wk="wanted.card.patience.v"></span></dd></div>
      </dl>
      <p class="wanted-card-note" data-wk="wanted.card.note"></p>
    </aside>
  </div>
`;

/** The complete fragment to put in the page. */
export const WANTED_HTML = `<div class="wanted" id="wanted">${WANTED_INNER}</div>`;

// ─────────────────────────── small canvas helpers ───────────────────────────

function sizeCanvas(c, w, h, dpr) {
  const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
  if (c.width !== W) c.width = W;
  if (c.height !== H) c.height = H;
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return g;
}
function offCanvas(w, h, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [c, g];
}
const pathOf = (pts, close = true) => {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  if (close) p.closePath();
  return p;
};
/** offset of el inside an ancestor, in layout pixels (ignores transforms) */
function offsetIn(el, anc) {
  let x = 0, y = 0;
  while (el && el !== anc) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
  return [x, y];
}

// ─────────────────────────── the sheet: geometry ───────────────────────────

/**
 * A slightly ragged rectangle with the top-left corner torn off along a
 * fibrous line. Returns Path2Ds for the poster, the torn-off scrap and the
 * whole sheet, plus the tear line itself.
 */
function sheetGeometry(W, H, seed) {
  const R = rng(seed);
  const wear = (d) => 2.6 * Math.pow(Math.max(0, 1 - d / 14), 2);
  const off = (s, k, d) => 0.5 + noise1(s * 0.06, seed + k) * 1.5 + noise1(s * 0.4, seed + k + 9) * 0.6 + (R() < 0.025 ? R() * 2.2 : 0) + wear(d);
  const step = 4;
  const top = [], right = [], bottom = [], left = [];
  for (let x = 0; x <= W; x += step) top.push([x, off(x, 1, Math.min(x, W - x))]);
  for (let y = 0; y <= H; y += step) right.push([W - off(y, 2, Math.min(y, H - y)), y]);
  for (let x = W; x >= 0; x -= step) bottom.push([x, H - off(x, 3, Math.min(x, W - x))]);
  for (let y = H; y >= 0; y -= step) left.push([off(y, 4, Math.min(y, H - y)), y]);

  // Two tears: the poster's own edge, and nearer the corner the edge of the
  // little scrap still pinned under the old nail. Between them, nothing.
  const tearLine = (tx, ty, k) => {
    const T1 = [tx, off(tx, 1, tx)], T2 = [off(ty, 4, ty), ty];
    const dx = T2[0] - T1[0], dy = T2[1] - T1[1], len = Math.hypot(dx, dy);
    const nx = dy / len, ny = -dx / len; // points into the poster (+x, +y)
    const n = Math.ceil(len / 2);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, taper = Math.pow(Math.sin(Math.PI * u), 0.6);
      const o = len * 0.08 * Math.sin(Math.PI * u)
        + taper * ((noise1(u * 5 + 3, seed + k) - 0.5) * len * 0.12 + (noise1(u * 26, seed + k + 1) - 0.5) * 4 + (R() - 0.5) * 1.4);
      pts.push([Math.max(0.5, T1[0] + dx * u + nx * o), Math.max(0.5, T1[1] + dy * u + ny * o)]);
    }
    pts[0] = T1; pts[n] = T2;
    return { pts, nx, ny, tx, ty };
  };
  const tear = tearLine(Math.round(W * 0.27), Math.round(W * 0.22), 5);
  const tear2 = tearLine(Math.round(W * 0.14), Math.round(W * 0.115), 13);

  const paperPts = [...top.filter(([x]) => x > tear.tx), ...right, ...bottom, ...left.filter(([, y]) => y > tear.ty), ...tear.pts.slice().reverse()];
  const scrapPts = [...top.filter(([x]) => x < tear2.tx), ...tear2.pts, ...left.filter(([, y]) => y < tear2.ty)];
  return {
    W, H, tear, tear2,
    outer: pathOf([...top, ...right, ...bottom, ...left]),
    paper: pathOf(paperPts),
    scrap: pathOf(scrapPts),
    scrapW: Math.ceil(Math.max(...scrapPts.map((p) => p[0])) + 6),
    scrapH: Math.ceil(Math.max(...scrapPts.map((p) => p[1])) + 6),
  };
}

// ─────────────────────────── the sheet: painting ───────────────────────────

let grainTile = null, woodTile = null;
function grain() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d');
  const img = g.createImageData(160, 160);
  const R = rng(77);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = R();
    img.data[i] = 90 + v * 60; img.data[i + 1] = 70 + v * 40; img.data[i + 2] = 40 + v * 30;
    img.data[i + 3] = Math.pow(R(), 3) * 120;
  }
  g.putImageData(img, 0, 0);
  return (grainTile = c);
}
/** where a woodblock fails to print: streaks along the grain, and specks */
function woodGrain() {
  if (woodTile) return woodTile;
  const c = document.createElement('canvas');
  c.width = c.height = 240;
  const g = c.getContext('2d');
  const R = rng(31);
  g.lineCap = 'round';
  for (let i = 0; i < 170; i++) {
    const y = R() * 240, x = R() * 240, l = 8 + R() * R() * 120;
    g.strokeStyle = `rgba(0,0,0,${0.18 + R() * 0.6})`;
    g.lineWidth = 0.4 + R() * R() * 1.6;
    g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + l * 0.3, y + (R() - 0.5) * 2, x + l * 0.7, y + (R() - 0.5) * 2, x + l, y + (R() - 0.5) * 1.5); g.stroke();
  }
  for (let i = 0; i < 700; i++) {
    g.fillStyle = `rgba(0,0,0,${0.35 + R() * 0.65})`;
    g.beginPath(); g.arc(R() * 240, R() * 240, 0.25 + R() * R() * 1.3, 0, TAU); g.fill();
  }
  return (woodTile = c);
}

/** a printed rule: a band whose two edges wander independently, like a cut block */
function roughBand(g, x0, y0, x1, y1, w, seed) {
  const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  const px = -uy, py = ux;
  const n = Math.max(2, Math.ceil(len / 3));
  const a = [], b = [];
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * len;
    const ww = w * (0.92 + 0.16 * noise1(s * 0.05, seed));
    const e1 = (noise1(s * 0.5, seed + 1) - 0.5) * 0.7, e2 = (noise1(s * 0.5, seed + 2) - 0.5) * 0.7;
    a.push([x0 + ux * s + px * (ww / 2 + e1), y0 + uy * s + py * (ww / 2 + e1)]);
    b.push([x0 + ux * s - px * (ww / 2 + e2), y0 + uy * s - py * (ww / 2 + e2)]);
  }
  g.fill(pathOf([...a, ...b.reverse()]));
}
function roughRect(g, x, y, w, h, lw, seed) {
  roughBand(g, x - lw / 2, y, x + w + lw / 2, y, lw, seed);
  roughBand(g, x + w, y, x + w, y + h, lw, seed + 3);
  roughBand(g, x + w + lw / 2, y + h, x - lw / 2, y + h, lw, seed + 6);
  roughBand(g, x, y + h, x, y, lw, seed + 9);
}
/** a carved corner block: solid ink with a five-petal flower cut out of it */
function cornerBlock(g, cx, cy, b, seed) {
  const R = rng(seed);
  g.fillStyle = `rgb(${PRINT})`;
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    pts.push([cx + Math.cos(a) * b * 0.7071 + (R() - 0.5) * 0.8, cy + Math.sin(a) * b * 0.7071 + (R() - 0.5) * 0.8]);
  }
  g.fill(pathOf(pts));
  g.save();
  g.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k / 5) * TAU;
    g.beginPath(); g.arc(cx + Math.cos(a) * b * 0.19, cy + Math.sin(a) * b * 0.19, b * 0.15, 0, TAU); g.fill();
  }
  g.beginPath(); g.arc(cx, cy, b * 0.12, 0, TAU); g.fill();
  g.restore();
  g.beginPath(); g.arc(cx, cy, b * 0.05, 0, TAU); g.fill();
}

function inkLayer(W, H, dpr, seed) {
  const [c, g] = offCanvas(W, H, dpr);
  g.fillStyle = `rgb(${PRINT})`;
  const m = W * 0.052, gap = W * 0.016;
  const lw1 = Math.max(2.2, W * 0.0095), lw2 = Math.max(1, W * 0.0032);
  roughRect(g, m, m, W - 2 * m, H - 2 * m, lw1, seed);
  roughRect(g, m + gap, m + gap, W - 2 * (m + gap), H - 2 * (m + gap), lw2, seed + 20);
  const b = W * 0.056;
  [[m, m], [W - m, m], [W - m, H - m], [m, H - m]].forEach(([x, y], i) => cornerBlock(g, x, y, b, seed + 40 + i));
  // where the block failed to print
  g.globalCompositeOperation = 'destination-out';
  g.globalAlpha = 0.85;
  g.fillStyle = g.createPattern(woodGrain(), 'repeat');
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  return c;
}

function rustStreak(g, x, y, len, seed) {
  const R = rng(seed);
  stamp(g, x, y, 10, RUST, 0.2, 0.3);
  const n = 26;
  for (let i = 0; i < n; i++) {
    const k = i / n;
    stamp(g, x + (noise1(k * 3, seed) - 0.5) * 5 + (R() - 0.5), y + 5 + k * len, 2.8 * (1 - k * 0.6), RUST, 0.09 * Math.pow(1 - k, 1.4), 0.4);
  }
}

function crease(g, x0, y0, x1, y1, seed) {
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(len / 6);
  const px = -(y1 - y0) / len, py = (x1 - x0) / len;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n, o = (noise1(k * 9, seed) - 0.5) * 2.2;
    pts.push([lerp(x0, x1, k) + px * o, lerp(y0, y1, k) + py * o]);
  }
  const line = (dx, dy, style, w) => { g.strokeStyle = style; g.lineWidth = w; g.stroke(pathOf(pts.map(([x, y]) => [x + dx, y + dy]), false)); };
  line(px * 4, py * 4, 'rgba(110,78,44,0.035)', 8);
  line(0, 0, 'rgba(255,251,240,0.55)', 1.1);
  line(px * 1.1, py * 1.1, 'rgba(105,74,42,0.16)', 0.9);
}

/** the whole sheet, before it is split into the poster and the scrap */
function paintSheet(geo, dpr, seed) {
  const { W, H } = geo;
  const [c, g] = offCanvas(W, H, dpr);
  const R = rng(seed);
  g.save();
  g.clip(geo.outer);
  // aged, yellowed hanji
  const base = g.createRadialGradient(W * 0.52, H * 0.42, 0, W * 0.5, H * 0.46, Math.hypot(W, H) * 0.6);
  base.addColorStop(0, '#f2e8d0');
  base.addColorStop(0.55, '#ecdcbc');
  base.addColorStop(1, '#dcc49b');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  // tea and rain stains, with tide lines
  const stains = [[0.8, 0.82, 0.3], [0.16, 0.6, 0.2], [0.86, 0.2, 0.13], [0.36, 0.95, 0.16], [0.62, 0.5, 0.1]];
  stains.forEach(([x, y, r], i) => wash(g, W * x, H * y, W * r, { rgb: [150, 104, 52], alpha: 0.045 + R() * 0.05, seed: seed + i * 7, wobble: 0.34, rim: 0.9, sx: 1, sy: 0.8 + R() * 0.4, rot: R() * 3 }));
  // paper grain
  g.globalAlpha = 0.5;
  g.fillStyle = g.createPattern(grain(), 'repeat');
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
  // hanji fibres: long, thin, wandering
  g.lineCap = 'round';
  const nf = Math.round((W * H) / 900);
  for (let i = 0; i < nf; i++) {
    const x = R() * W, y = R() * H, a = R() * TAU, l = 6 + R() * R() * 40, bend = (R() - 0.5) * l * 0.6;
    const light = R() < 0.72;
    g.strokeStyle = light ? `rgba(253,249,236,${0.25 + R() * 0.4})` : `rgba(120,88,50,${0.05 + R() * 0.07})`;
    g.lineWidth = 0.35 + R() * 0.6;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 - Math.sin(a) * bend, y + Math.sin(a) * l * 0.5 + Math.cos(a) * bend, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // foxing
  for (let i = 0; i < 46; i++) {
    const cx = R() * W, cy = R() * H, k = 1 + Math.floor(R() * 4);
    for (let j = 0; j < k; j++) stamp(g, cx + (R() - 0.5) * 10, cy + (R() - 0.5) * 10, 0.6 + R() * R() * 3, [140, 92, 44], 0.08 + R() * 0.22, 0.5);
  }
  // it was folded in quarters once
  crease(g, 0, H * 0.49, W, H * 0.5, seed + 3);
  crease(g, W * 0.505, 0, W * 0.495, H, seed + 4);
  // age creeping in from the edges
  g.shadowColor = 'rgba(132,88,40,0.55)';
  g.shadowBlur = W * 0.07 * dpr;
  const ring = new Path2D();
  ring.rect(-W, -H, W * 3, H * 3);
  ring.addPath(geo.outer);
  g.fillStyle = '#000';
  g.fill(ring, 'evenodd');
  g.shadowBlur = 0;
  g.shadowColor = 'transparent';
  // rust bleeding down from the nails
  rustStreak(g, W / 2, W * 0.03, H * 0.12, seed + 8);
  rustStreak(g, W * 0.085, W * 0.03, W * 0.07, seed + 9);
  g.restore();
  // the woodblock frame, printed on top
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.shadowColor = 'rgba(30,24,22,0.4)';
  g.shadowBlur = 1.4 * dpr;
  g.globalAlpha = 0.92;
  g.drawImage(inkLayer(W, H, dpr, seed + 11), 0, 0, W, H);
  g.restore();
  return c;
}

/** the freshly torn edge: paler, with loose fibres sticking out */
function tearEdge(g, { pts: tear, nx, ny }, side, seed) {
  const R = rng(seed);
  const ox = -nx * side, oy = -ny * side; // outward, away from this piece
  g.save();
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(251,246,234,0.85)';
  g.lineWidth = 2.6;
  g.stroke(pathOf(tear, false));
  g.restore();
  g.lineCap = 'round';
  for (let i = 1; i < tear.length - 1; i++) {
    if (R() < 0.35) continue;
    const [x, y] = tear[i];
    const l = 0.8 + R() * R() * 5.5, a = (R() - 0.5) * 1.6;
    const dx = ox * Math.cos(a) - oy * Math.sin(a), dy = ox * Math.sin(a) + oy * Math.cos(a);
    g.strokeStyle = `rgba(247,241,226,${0.5 + R() * 0.45})`;
    g.lineWidth = 0.35 + R() * 0.5;
    g.beginPath();
    g.moveTo(x - dx * 1.5, y - dy * 1.5);
    g.quadraticCurveTo(x + dx * l * 0.5 + (R() - 0.5) * 2, y + dy * l * 0.5 + (R() - 0.5) * 2, x + dx * l, y + dy * l);
    g.stroke();
  }
}

// ─────────────────────────── bullet holes ───────────────────────────

function holeSprite(r, seed, dpr) {
  const S = Math.ceil(r * 11);
  const [c, g] = offCanvas(S, S, dpr);
  const R = rng(seed);
  const cx = S / 2, cy = S / 2;
  // the ink on the bullet soaks into the hanji: a soft bloom, with the
  // pigment pooling in a tide line at its edge
  for (let i = 0; i < 6; i++) stamp(g, cx + (R() - 0.5) * r * 1.6, cy + (R() - 0.5) * r * 1.6, r * (1.5 + R() * 1.3), INK, 0.03 + R() * 0.03, 0.3);
  const tide = r * (2 + R() * 0.6), ns0 = seed % 997, sq = 0.82 + R() * 0.25, tr = R() * TAU;
  for (let i = 0, n = 110; i < n; i++) {
    const a = (i / n) * TAU, w = i / n;
    const rr = tide * (0.84 + 0.32 * (noise1(a * 1.7, ns0) * (1 - w) + noise1(a * 1.7 - TAU * 1.7, ns0) * w));
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr * sq;
    stamp(g, cx + px * Math.cos(tr) - py * Math.sin(tr), cy + px * Math.sin(tr) + py * Math.cos(tr), 0.9 + R() * 0.8, INK, 0.035 + R() * 0.035, 0.45);
  }
  // a scorch
  stamp(g, cx + (R() - 0.5) * r * 0.6, cy + (R() - 0.5) * r * 0.6, r * 2.1, [86, 52, 30], 0.2, 0.35);
  // splinters of ink, flicked out like a dry brush: pressed at the hole,
  // lifting to a point, and breaking up where the brush ran dry
  const n = 8 + Math.floor(R() * 5);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + (R() - 0.5) * 0.7;
    const len = r * (0.8 + R() * R() * 3.4), w = r * (0.14 + R() * 0.22), r0 = r * 0.6;
    const bend = (R() - 0.5) * len * 0.4;
    const ca = Math.cos(a), sa = Math.sin(a);
    const P = (d, o) => [cx + ca * d - sa * o, cy + sa * d + ca * o];
    const [x1, y1] = P(r0, -w / 2), [x2, y2] = P(r0 + len, bend), [x3, y3] = P(r0, w / 2);
    const [qx, qy] = P(r0 + len * 0.5, bend * 0.45);
    const p = new Path2D();
    p.moveTo(x1, y1); p.quadraticCurveTo(qx - sa * w * 0.2, qy + ca * w * 0.2, x2, y2); p.quadraticCurveTo(qx + sa * w * 0.2, qy - ca * w * 0.2, x3, y3); p.closePath();
    g.fillStyle = `rgba(22,17,15,${0.08 + R() * 0.07})`;
    g.save(); g.translate(ca * 0.7, sa * 0.7); g.fill(p); g.restore(); // a soft wet fringe
    g.fillStyle = `rgba(22,17,15,${0.62 + R() * 0.36})`;
    g.fill(p);
    g.save();
    g.globalCompositeOperation = 'destination-out';
    for (let j = 0, m = Math.round(len / 3.2); j < m; j++) {
      const d = r0 + len * (0.45 + 0.55 * R()), o = (R() - 0.5) * w * 0.8;
      const [dx, dy] = P(d, o + bend * Math.pow((d - r0) / len, 2));
      g.globalAlpha = 0.5 + R() * 0.5;
      g.beginPath(); g.ellipse(dx, dy, 0.35 + R() * 0.9, 0.2 + R() * 0.25, a, 0, TAU); g.fill();
    }
    g.restore();
  }
  // torn lips of paper around the hole, catching the light
  for (let k = 0; k < 7; k++) {
    const a = R() * TAU, d = r * (0.85 + R() * 0.3), w = r * (0.35 + R() * 0.3);
    const ca = Math.cos(a), sa = Math.sin(a);
    g.fillStyle = `rgba(246,236,214,${0.55 + R() * 0.35})`;
    g.beginPath();
    g.moveTo(cx + ca * d - sa * w, cy + sa * d + ca * w);
    g.lineTo(cx + ca * (d + r * (0.3 + R() * 0.4)), cy + sa * (d + r * (0.3 + R() * 0.4)));
    g.lineTo(cx + ca * d + sa * w, cy + sa * d - ca * w);
    g.fill();
  }
  // the hole
  const pts = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU, rr = r * (0.82 + 0.3 * noise1(i * 0.9, seed) + (R() - 0.5) * 0.12);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const grd = g.createRadialGradient(cx - r * 0.25, cy - r * 0.3, 0, cx, cy, r * 1.15);
  grd.addColorStop(0, '#040303');
  grd.addColorStop(0.65, '#100b09');
  grd.addColorStop(1, 'rgba(40,28,22,0.92)');
  g.fillStyle = grd;
  g.fill(pathOf(pts));
  // a glint of paper thickness on the far rim
  g.strokeStyle = 'rgba(230,214,186,0.22)';
  g.lineWidth = Math.max(0.5, r * 0.09);
  g.beginPath(); g.arc(cx, cy, r * 0.8, 0.18 * Math.PI, 0.4 * Math.PI); g.stroke();
  // spatter
  const ns = 5 + Math.floor(R() * 7);
  for (let i = 0; i < ns; i++) {
    const a = R() * TAU, d = r * (1.8 + R() * 3);
    stamp(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.4 + R() * R() * 1.5, INK, 0.45 + R() * 0.45, 0.6);
  }
  return c;
}

/**
 * Aimed at her face, the bullet lands as a cinnabar heart: pressed like a
 * seal, with a carved inner line, uneven paste and specks where it missed.
 */
function heartSprite(r, seed, dpr) {
  const S = Math.ceil(r * 8);
  const [c, g] = offCanvas(S, S, dpr);
  const R = rng(seed);
  const cx = S / 2, cy = S / 2 + r * 0.1, k = r * 0.105, rot = (R() - 0.5) * 0.5;
  const heart = (sc, jit) => {
    const pts = [];
    for (let i = 0; i < 72; i++) {
      const t = (i / 72) * TAU;
      const x = 16 * Math.pow(Math.sin(t), 3), y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) - 1.5;
      const j = sc * (1 + (R() - 0.5) * jit);
      pts.push([cx + (x * Math.cos(rot) - y * Math.sin(rot)) * k * j, cy + (x * Math.sin(rot) + y * Math.cos(rot)) * k * j]);
    }
    return pathOf(pts);
  };
  stamp(g, cx, cy, r * 2.6, SEAL_RGB, 0.08, 0.25); // oil from the paste, soaking out
  g.fillStyle = `rgba(${SEAL_RGB},0.93)`;
  g.fill(heart(1, 0.03));
  g.save();
  g.globalCompositeOperation = 'destination-out';
  // the carved line
  g.lineJoin = 'round';
  g.lineWidth = Math.max(0.75, r * 0.085);
  g.strokeStyle = '#000';
  g.stroke(heart(0.72, 0.015));
  // uneven pressure: paler patches
  for (let i = 0; i < 4; i++) stamp(g, cx + (R() - 0.5) * r * 2.4, cy + (R() - 0.5) * r * 2.2, r * (0.5 + R() * 0.7), INK, 0.12 + R() * 0.18, 0.2);
  // specks where the paste missed the paper
  for (let i = 0; i < r * 6; i++) {
    g.globalAlpha = 0.3 + R() * 0.7;
    g.beginPath(); g.arc(cx + (R() - 0.5) * r * 3.6, cy + (R() - 0.5) * r * 3.2, 0.2 + R() * R() * r * 0.11, 0, TAU); g.fill();
  }
  g.restore();
  return c;
}

// ─────────────────────────── dog tags: geometry ───────────────────────────
// Everything on the tag stage is laid out in units of a 300 × 350 box.

const TW = 116, TH = 206, HY = 18;           // tag size and its hole, from the top
const BRANCH = [[318, 52], [262, 47], [206, 41], [150, 38], [96, 33], [48, 25], [14, 14]];
const BRANCH_W = 12;
function branchTop(x) {
  let i = 0;
  while (i < BRANCH.length - 2 && BRANCH[i + 1][0] > x) i++;
  const [x0, y0] = BRANCH[i], [x1, y1] = BRANCH[i + 1];
  const y = lerp(y0, y1, (x0 - x) / (x0 - x1));
  const w = BRANCH_W * PROFILE.twig((BRANCH[0][0] - x) / (BRANCH[0][0] - BRANCH[BRANCH.length - 1][0]));
  return y - w * 0.5;
}

function paintBranch(canvas, s, dpr) {
  const g = sizeCanvas(canvas, 300 * s, 80 * s, dpr);
  g.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
  // the old branch, then the young twigs
  stroke(g, { pts: BRANCH, width: BRANCH_W, profile: PROFILE.twig, tone: 0.9, dry: 0.5, bleed: 0.3, spread: 0.55, seed: 41 });
  stroke(g, { pts: [[170, 39], [152, 25], [134, 14], [119, 6]], width: 4.6, profile: PROFILE.twig, tone: 0.86, dry: 0.4, seed: 43 });
  stroke(g, { pts: [[258, 46], [266, 33], [281, 19]], width: 4, profile: PROFILE.twig, tone: 0.85, dry: 0.4, seed: 44 });
  stroke(g, { pts: [[60, 28], [47, 37], [33, 44]], width: 2.8, profile: PROFILE.twig, tone: 0.8, dry: 0.35, seed: 45 });
  stroke(g, { pts: [[128, 37], [138, 52], [146, 60]], width: 2.4, profile: PROFILE.twig, tone: 0.8, dry: 0.35, seed: 46 });
  // moss dots
  [[196, 36, 1.5], [120, 31, 1.3], [66, 25, 1.2], [240, 41, 1.2]].forEach(([x, y, r], i) => { const it = dotGen(g, x, y, r, { seed: 50 + i, tone: 0.9 }); while (!it.next().done); });
  // plum blossoms and buds
  [[118, 9, 10.5, 0.95], [281, 18, 10, 1], [24, 15, 8.5, 0.9], [149, 61, 8, 0.85], [177, 31, 6.5, 0.7], [246, 58, 6, 0.75]].forEach(([x, y, r, open], i) => {
    const it = blossomGen(g, x, y, r, { seed: 60 + i, open });
    while (!it.next().done);
  });
  [[138, 17, 2.8], [268, 28, 2.5], [44, 37, 2.2], [232, 36, 2.4], [36, 21, 2]].forEach(([x, y, r], i) => bud(g, x, y, r, 70 + i));
}

// ─────────────────────────── mount ───────────────────────────

export function mountWanted(root, { photo, t = (k) => k, reduceMotion = false, sound = {} } = {}) {
  if (!root.querySelector('.wanted-board')) {
    root.classList.add('wanted');
    root.innerHTML = WANTED_INNER;
  }
  const $ = (s) => root.querySelector(s);
  const board = $('.wanted-board'), poster = $('.wanted-poster'), sheetEl = $('.wanted-sheet');
  const paperC = $('.wanted-paper'), holesC = $('.wanted-holes'), scrapC = $('.wanted-scrap');
  const oldNail = $('.wanted-nail--old'), shootBtn = $('.wanted-shoot'), portrait = $('.wanted-portrait'), img = $('.wanted-portrait img');
  const stage = $('.wanted-stage'), branchC = $('.wanted-branch'), chainD = $('#wanted-chain-d');
  const tagEls = { a: $('.wanted-tag--a'), b: $('.wanted-tag--b') };
  const hintEl = $('.wanted-hint'), tagsHintEl = $('.wanted-tags-hint');
  const touchy = matchMedia('(hover: none)').matches;
  const hitCtx = document.createElement('canvas').getContext('2d');
  const play = (name, opts) => { try { sound && typeof sound[name] === 'function' && sound[name](opts); } catch { /* no sound is fine */ } };

  let active = true, raf = 0, last = 0, destroyed = false, painted = false, stageDpr = 0;
  const ac = new AbortController();
  const opt = { signal: ac.signal };

  // ── poster state ──
  const P = { W: 0, H: 0, dpr: 0, rest: -2.2, ang: 0, vel: 0, pivotY: 0, geo: null, photo: null, holes: [], parts: [], puffs: [] };

  function applyPoster() {
    poster.style.transform = `rotate(${(P.rest + P.ang).toFixed(3)}deg)`;
  }

  function buildPaper() {
    const W = poster.offsetWidth, H = poster.offsetHeight, dpr = dprNow();
    if (!W || !H || (W === P.W && H === P.H && dpr === P.dpr)) return;
    const resprite = W !== P.W || dpr !== P.dpr;
    P.W = W; P.H = H; P.dpr = dpr;
    P.rest = W < 400 ? -1.4 : -2.2;
    P.pivotY = W * 0.03;
    poster.style.transformOrigin = `50% ${P.pivotY}px`;
    applyPoster();
    const geo = (P.geo = sheetGeometry(W, H, 7));
    const sheet = paintSheet(geo, dpr, 7);
    // the poster, with its shadow on the wall painted in once. (A CSS
    // drop-shadow on the swinging poster would be re-blurred on every frame.)
    // On a phone the margin is narrower, so the canvas never pokes past the screen.
    const narrow = W < 400, sx = narrow ? 12 : SHADE.x, k = narrow ? 0.75 : 1;
    let g = sizeCanvas(paperC, W + sx * 2, H + SHADE.t + SHADE.b, dpr);
    paperC.style.left = `${-sx}px`;
    paperC.style.top = `${-SHADE.t}px`;
    g.translate(sx, SHADE.t);
    g.save();
    g.fillStyle = '#d9c4a0';
    for (const [oy, blur, a] of [[20 * k, 18 * k, 0.25], [3, 3.5, 0.2]]) {
      g.shadowColor = `rgba(60,38,18,${a})`;
      g.shadowBlur = blur * dpr;
      g.shadowOffsetY = oy * dpr;
      g.fill(geo.paper);
    }
    g.restore();
    g.save(); g.clip(geo.paper); g.drawImage(sheet, 0, 0, W, H); g.restore();
    tearEdge(g, geo.tear, 1, 3);
    // the scrap left behind under the old nail, unrotated, where the corner used to be
    g = sizeCanvas(scrapC, geo.scrapW, geo.scrapH, dpr);
    g.save(); g.clip(geo.scrap); g.drawImage(sheet, 0, 0, W, H); g.restore();
    tearEdge(g, geo.tear2, -1, 4);
    scrapC.style.left = `${poster.offsetLeft}px`;
    scrapC.style.top = `${poster.offsetTop}px`;
    oldNail.style.left = `${poster.offsetLeft + W * 0.085}px`;
    oldNail.style.top = `${poster.offsetTop + W * 0.03}px`;
    // holes keep their place on the sheet; their sprites follow the new size
    measurePhoto();
    sizeCanvas(holesC, W, H, dpr);
    if (resprite) P.holes.forEach(makeHoleSprite);
    drawHoles(performance.now(), 0);
  }

  const holeR = () => clamp(P.W * 0.019, 5.5, 10);
  function makeHoleSprite(h) {
    const r = holeR();
    h.r = r;
    h.sprite = h.kind === 'heart' ? heartSprite(r, h.seed, P.dpr) : holeSprite(r, h.seed, P.dpr);
    h.size = h.kind === 'heart' ? Math.ceil(r * 8) : Math.ceil(r * 11);
  }

  function toLocal(cx, cy) {
    const br = board.getBoundingClientRect();
    const px = br.left + poster.offsetLeft + P.W / 2, py = br.top + poster.offsetTop + P.pivotY;
    const a = -(P.rest + P.ang) * D2R, dx = cx - px, dy = cy - py;
    return [P.W / 2 + dx * Math.cos(a) - dy * Math.sin(a), P.pivotY + dx * Math.sin(a) + dy * Math.cos(a)];
  }
  const onPaper = (x, y) => P.geo && hitCtx.isPointInPath(P.geo.paper, x, y);
  function portraitBox() {
    const [x, y] = offsetIn(portrait, poster);
    return [x, y, portrait.offsetWidth, portrait.offsetHeight];
  }
  /** her photo inside the frame: no hole or splinter is ever drawn over it */
  function measurePhoto() {
    const [x, y] = offsetIn(img, poster);
    P.photo = [x, y, img.offsetWidth, img.offsetHeight];
  }
  const inBox = (x, y, [bx, by, bw, bh], m = 0) => x > bx - m && x < bx + bw + m && y > by - m && y < by + bh + m;

  function addHole(x, y) {
    if (!P.geo) return;
    const now = performance.now();
    // she's bulletproof: a shot on her portrait turns into a heart
    const kind = inBox(x, y, portraitBox(), holeR()) ? 'heart' : 'hole';
    const h = { u: x / P.W, v: y / P.H, kind, seed: (Math.random() * 1e6) | 0, born: now, fading: 0 };
    makeHoleSprite(h);
    P.holes.push(h);
    const live = P.holes.filter((o) => !o.fading);
    if (live.length > MAX_HOLES) live[0].fading = now;
    play('shot', { gain: 0.42, pan: clamp((x / P.W - 0.5) * 0.6, -0.5, 0.5) });
    if (!reduceMotion) {
      // a jolt on the nail, a puff of ink, splinters and flakes of paper
      P.vel = clamp(P.vel + (x / P.W - 0.5) * 7 + (Math.random() - 0.5) * 5, -9, 9);
      P.puffs.push({ x, y, t0: now, r: h.r, kind });
      const n = kind === 'heart' ? 6 : 12;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, sp = 70 + Math.random() * 190, paper = kind === 'hole' && i % 4 === 0;
        P.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0, max: 0.4 + Math.random() * 0.45, size: paper ? 1.6 + Math.random() * 1.6 : 0.7 + Math.random() * 1.5, rot: a, paper, heart: kind === 'heart' });
      }
    }
    drawHoles(now, 0);
    kick();
  }

  function randomSpot() {
    const box = portraitBox();
    for (let i = 0; i < 40; i++) {
      const x = P.W * (0.12 + Math.random() * 0.76), y = P.H * (0.08 + Math.random() * 0.86);
      if (onPaper(x, y) && !inBox(x, y, box, holeR() * 2.5)) return [x, y];
    }
    return [P.W * 0.8, P.H * 0.86];
  }

  /** returns true while something is still moving */
  function drawHoles(now, dt) {
    const { W, H, dpr } = P;
    if (!W || !P.geo) return false;
    const g = holesC.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    let busy = false;
    // puffs of ink where the bullet went through
    P.puffs = P.puffs.filter((p) => {
      const k = (now - p.t0) / 520;
      if (k >= 1) return false;
      busy = true;
      stamp(g, p.x, p.y, p.r * (1.6 + k * 4), p.kind === 'heart' ? SEAL_RGB : INK, 0.2 * (1 - k) * (1 - k), 0.25);
      return true;
    });
    // holes stay on the paper and off her photo; hearts may sit on it
    const holeClip = new Path2D();
    holeClip.addPath(P.geo.paper);
    if (P.photo) holeClip.rect(...P.photo);
    for (const h of P.holes) {
      let a = 1, sc = 1;
      if (h.fading) {
        a = reduceMotion ? 0 : 1 - (now - h.fading) / 900;
        if (a <= 0) { h.dead = true; continue; }
        busy = true;
      }
      const age = (now - h.born) / 1000;
      if (!reduceMotion && age < 0.1) { sc = 0.6 + 4 * age; busy = true; }
      const s = h.size * sc;
      g.save();
      if (h.kind === 'heart') g.clip(P.geo.paper); else g.clip(holeClip, 'evenodd');
      g.globalAlpha = a;
      g.globalCompositeOperation = h.kind === 'heart' ? 'multiply' : 'source-over';
      g.drawImage(h.sprite, h.u * W - s / 2, h.v * H - s / 2, s, s);
      g.restore();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    P.holes = P.holes.filter((h) => !h.dead);
    // splinters and paper flakes in flight
    P.parts = P.parts.filter((p) => {
      p.life += dt;
      if (p.life >= p.max) return false;
      busy = true;
      p.vy += 620 * dt; p.vx *= 1 - 2.2 * dt; p.vy *= 1 - 1.2 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const k = 1 - p.life / p.max;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(Math.atan2(p.vy, p.vx));
      g.globalAlpha = k * k;
      g.fillStyle = p.heart ? `rgb(${SEAL_RGB})` : p.paper ? '#f4ead6' : '#16110f';
      g.beginPath();
      g.ellipse(0, 0, p.size * (p.paper ? 1.2 : 2.2), p.size * (p.paper ? 0.9 : 0.55), 0, 0, TAU);
      g.fill();
      g.restore();
      return true;
    });
    g.globalAlpha = 1;
    return busy;
  }

  function stepPoster(dt) {
    if (reduceMotion) return false;
    if (Math.abs(P.ang) < 0.03 && Math.abs(P.vel) < 0.08) {
      if (P.ang || P.vel) { P.ang = 0; P.vel = 0; applyPoster(); }
      return false;
    }
    P.vel += (-15 * P.ang - 1.4 * P.vel) * dt;
    P.ang = clamp(P.ang + P.vel * dt, -4, 4);
    applyPoster();
    return true;
  }

  // pointer brushing past the poster
  let lastPt = null;
  board.addEventListener('pointermove', (e) => {
    if (reduceMotion || !active || !P.geo) return;
    const [x, y] = toLocal(e.clientX, e.clientY);
    if (lastPt && onPaper(x, y)) {
      const dx = clamp(e.clientX - lastPt[0], -40, 40);
      const lever = clamp((y - P.pivotY) / P.H, 0, 1);
      P.vel = clamp(P.vel - dx * lever * 0.1, -7, 7);
      kick();
    }
    lastPt = [e.clientX, e.clientY];
  }, opt);
  board.addEventListener('pointerleave', () => { lastPt = null; }, opt);
  shootBtn.addEventListener('click', (e) => {
    let x, y;
    if (e.detail === 0 || (!e.clientX && !e.clientY)) [x, y] = randomSpot();
    else {
      [x, y] = toLocal(e.clientX, e.clientY);
      if (!onPaper(x, y)) return; // the missing corner: nothing to hit
    }
    addHole(x, y);
  }, opt);

  // ── dog tags ──
  const T = {
    a: { px: 92, L: 104, th: 0, thv: 0, ph: 1.2, phv: 0, kth: 34, kph: 26, hx: 0, hy: 0 },
    b: { px: 214, L: 46, th: 0, thv: 0, ph: -1.4, phv: 0, kth: 52, kph: 28, hx: 0, hy: 0 },
  };
  T.a.py = branchTop(T.a.px) - 0.5;
  T.b.py = branchTop(T.b.px) - 0.5;
  T.a.ph0 = T.a.ph; T.b.ph0 = T.b.ph;
  let S = 1, lastClink = 0;

  function holeOf(tg) {
    const a = tg.th * D2R;
    tg.hx = tg.px - Math.sin(a) * tg.L;
    tg.hy = tg.py + Math.cos(a) * tg.L;
  }
  function chainLoop(tg) {
    const { px, py, hx, hy } = tg;
    const l = [px - 4.6, py + 3], r = [px + 4.6, py + 3];
    const bow = (p) => { const mx = (p[0] + hx) / 2, my = (p[1] + hy) / 2; return `${(mx + (p[0] - px) * 0.35).toFixed(2)} ${my.toFixed(2)}`; };
    return `M${hx.toFixed(2)} ${hy.toFixed(2)}Q${bow(l)} ${l[0].toFixed(2)} ${l[1]}A4.6 4.6 0 0 1 ${r[0].toFixed(2)} ${r[1]}Q${bow(r)} ${hx.toFixed(2)} ${hy.toFixed(2)}`;
  }
  function layoutTags() {
    for (const k of ['a', 'b']) {
      const tg = T[k];
      holeOf(tg);
      tagEls[k].style.transform = `translate(${((tg.hx - TW / 2) * S).toFixed(2)}px, ${((tg.hy - HY) * S).toFixed(2)}px) rotate(${tg.ph.toFixed(3)}deg)`;
    }
    chainD.setAttribute('d', chainLoop(T.a) + chainLoop(T.b));
  }
  // a tag's frame: origin at its hole, y down the tag
  const toTag = (tg, x, y) => {
    const a = -tg.ph * D2R, dx = x - tg.hx, dy = y - tg.hy;
    return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
  };
  const fromTag = (tg, x, y) => {
    const a = tg.ph * D2R;
    return [tg.hx + x * Math.cos(a) - y * Math.sin(a), tg.hy + x * Math.sin(a) + y * Math.cos(a)];
  };
  /** the right edge of A against the left edge of B: how deep, where, how fast */
  function contact() {
    const A = T.a, B = T.b;
    let best = null;
    const test = (from, to, side) => {
      for (let y = -HY + 14; y <= TH - HY - 12; y += 16) {
        const [wx, wy] = fromTag(from, side * TW / 2, y);
        const [lx, ly] = toTag(to, wx, wy);
        if (ly < -HY + 6 || ly > TH - HY - 6) continue;
        const pen = side > 0 ? lx + TW / 2 : TW / 2 - lx;
        if (pen > 0 && pen < 40 && (!best || pen > best.pen)) best = { pen, dA: side > 0 ? y : ly, dB: side > 0 ? ly : y };
      }
    };
    test(A, B, 1);
    test(B, A, -1);
    return best;
  }
  function stepTags(dt) {
    if (reduceMotion) return false;
    let busy = false;
    for (const tg of [T.a, T.b]) {
      const thAcc = -tg.kth * tg.th - 1.4 * tg.thv;
      tg.thv += thAcc * dt;
      tg.th += tg.thv * dt;
      const phAcc = -tg.kph * (tg.ph - tg.ph0) - 1.8 * tg.phv - 0.5 * thAcc;
      tg.phv += phAcc * dt;
      tg.ph += tg.phv * dt;
      tg.thv = clamp(tg.thv, -70, 70); tg.phv = clamp(tg.phv, -170, 170);
      tg.th = clamp(tg.th, -16, 16); tg.ph = clamp(tg.ph, -26, 26);
      if (Math.abs(tg.th) > 0.06 || Math.abs(tg.thv) > 0.3 || Math.abs(tg.ph - tg.ph0) > 0.06 || Math.abs(tg.phv) > 0.3) busy = true;
      else { tg.th = 0; tg.thv = 0; tg.ph = tg.ph0; tg.phv = 0; }
    }
    holeOf(T.a); holeOf(T.b);
    const c = contact();
    if (c) {
      const A = T.a, B = T.b;
      const dA = Math.max(30, c.dA), dB = Math.max(30, c.dB);
      // push apart: A swings left (angle up), B swings right (angle down)
      A.ph += ((c.pen * 0.5) / dA) / D2R;
      B.ph -= ((c.pen * 0.5) / dB) / D2R;
      const vA = -A.phv * D2R * dA, vB = -B.phv * D2R * dB; // sideways speed at the contact, px/s, + = right
      const rel = vA - vB;
      if (rel > 0) {
        const e = 0.45, j = ((1 + e) / 2) * rel;
        A.phv = -(vA - j) / (D2R * dA);
        B.phv = -(vB + j) / (D2R * dB);
        A.thv -= rel * 0.05; B.thv += rel * 0.05;
        const now = performance.now();
        if (rel > 16 && now - lastClink > 110) {
          lastClink = now;
          play('ping', { gain: clamp(0.03 + rel / 2600, 0.03, 0.12) });
        }
      }
      busy = true;
    }
    layoutTags();
    return busy;
  }

  function sizeStage() {
    S = stage.clientWidth / 300 || 1;
    stageDpr = dprNow();
    paintBranch(branchC, S, stageDpr);
    layoutTags();
  }

  // brushing past the tags, from anywhere near them
  let lastTagPt = null;
  root.addEventListener('pointermove', (e) => {
    if (reduceMotion || !active) return;
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / S, y = (e.clientY - r.top) / S;
    if (lastTagPt && x > -30 && x < 330 && y > -10 && y < 370) {
      const dx = clamp((e.clientX - lastTagPt[0]) / S, -30, 30);
      if (dx) {
        let hit = false;
        for (const tg of [T.a, T.b]) {
          const [lx, ly] = toTag(tg, x, y);
          if (lx > -TW / 2 - 16 && lx < TW / 2 + 16 && ly > -HY - 14 && ly < TH - HY + 12) {
            const lever = clamp((ly + HY) / TH, 0.15, 1);
            tg.phv = clamp(tg.phv - dx * lever * 1.5, -120, 120);
            tg.thv = clamp(tg.thv - dx * 0.3, -40, 40);
            hit = true;
          }
        }
        if (hit) kick();
      }
    }
    lastTagPt = [e.clientX, e.clientY];
  }, opt);
  root.addEventListener('pointerleave', () => { lastTagPt = null; }, opt);
  stage.addEventListener('click', (e) => {
    if (reduceMotion) {
      play('ping', { gain: 0.08 });
      play('ping', { gain: 0.05, delay: 0.11 });
      return;
    }
    let which = null;
    if (e.detail !== 0) {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / S, y = (e.clientY - r.top) / S;
      for (const k of ['a', 'b']) {
        const [lx, ly] = toTag(T[k], x, y);
        if (Math.abs(lx) < TW / 2 + 6 && ly > -HY - 6 && ly < TH - HY + 6) which = k;
      }
    }
    // swing them into each other
    if (which !== 'b') { T.a.phv -= which ? 150 : 110; T.a.thv -= 14; }
    if (which !== 'a') { T.b.phv += which ? 150 : 100; T.b.thv += 10; }
    kick();
  }, opt);

  // ── the loop: runs only while something moves ──
  function frame(now) {
    raf = 0;
    if (!active || destroyed || document.hidden) return;
    const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000));
    last = now;
    let busy = false;
    // fixed small substeps keep the springs stable at any frame rate
    const n = Math.ceil(dt * 240), h = dt / n;
    for (let i = 0; i < n; i++) {
      busy = stepPoster(h) || busy;
      busy = stepTags(h) || busy;
    }
    busy = drawHoles(now, dt) || busy;
    if (busy) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (raf || !active || destroyed || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else kick(); }, opt);

  // ── text ──
  function fitTags() {
    for (const el of root.querySelectorAll('.wanted-tag-text')) {
      el.style.fontSize = '';
      let fs = parseFloat(getComputedStyle(el).fontSize);
      for (let i = 0; i < 14 && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1); i++) {
        fs *= 0.94;
        el.style.fontSize = `${fs.toFixed(2)}px`;
      }
    }
  }
  function relabel(fit = true) {
    root.querySelectorAll('[data-wk]').forEach((el) => { el.textContent = t(el.dataset.wk); });
    root.querySelectorAll('[data-wk-alt]').forEach((el) => { el.alt = t(el.dataset.wkAlt); });
    root.querySelectorAll('[data-wk-label]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.wkLabel)); });
    hintEl.textContent = t(touchy ? 'wanted.hint.touch' : 'wanted.hint');
    tagsHintEl.textContent = t(touchy ? 'wanted.tags.hint.touch' : 'wanted.tags.hint');
    const say = (ks) => ks.map((k) => t(k).replace(/-\s*\n\s*/g, '-').replace(/\s*\n\s*/g, ' ')).join(', ');
    stage.setAttribute('aria-label', `${t('wanted.tags.label')} ${say(['wanted.tag.name', 'wanted.tag.ko', 'wanted.tag.sn', 'wanted.tag.blood', 'wanted.tag.faith'])}. ${say(['wanted.tag2', 'wanted.tag2.duty'])}.`);
    if (fit && painted) fitTags();
    if (P.geo) { measurePhoto(); drawHoles(performance.now(), 0); }
  }
  function setPhoto(ph) {
    const src = ph && (ph.inkUrl || ph.url);
    if (src) img.src = src; else img.removeAttribute('src');
  }

  // ── sizing ──
  let sizeQueued = false;
  const ro = new ResizeObserver(() => {
    if (sizeQueued || !painted) return;
    sizeQueued = true;
    requestAnimationFrame(() => {
      sizeQueued = false;
      if (destroyed) return;
      buildPaper();
      if (Math.abs(stage.clientWidth / 300 - S) > 0.001 || !branchC.width || branchC.width < 2) sizeStage();
      fitTags();
    });
  });
  ro.observe(poster);
  ro.observe(stage);
  const onFonts = () => { if (!destroyed && painted) { fitTags(); buildPaper(); } };
  if (document.fonts) {
    document.fonts.ready.then(onFonts);
    document.fonts.addEventListener('loadingdone', onFonts, opt);
  }
  // a new device pixel ratio (browser zoom, another screen): repaint the canvases sharp
  const checkDpr = () => {
    if (destroyed || !painted || (dprNow() === P.dpr && dprNow() === stageDpr)) return;
    buildPaper();
    sizeStage();
  };
  const watchDpr = () => {
    matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener('change', () => { watchDpr(); checkDpr(); }, { once: true, signal: ac.signal });
  };
  watchDpr();
  window.addEventListener('resize', checkDpr, opt);

  relabel(false);
  setPhoto(photo);
  applyPoster();
  // painting the paper and the branch takes a moment: do it when the page is idle
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 30));
  idle(() => {
    if (destroyed) return;
    painted = true;
    fitTags();
    sizeStage();
    buildPaper();
    poster.classList.add('is-painted');
  }, { timeout: 1500 });

  return {
    relabel: () => relabel(true),
    setPhoto,
    setActive(on) {
      active = !!on;
      if (!active) { cancelAnimationFrame(raf); raf = 0; lastPt = lastTagPt = null; } else kick();
    },
    destroy() {
      destroyed = true;
      active = false;
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      ac.abort();
    },
  };
}
