// ─────────────────────────────────────────────────────────────────────────────
//  Her baby. A slate-grey cat, almost black, with a plush coat that catches a
//  softer grey sheen on his back and small green eyes, loafs on the top
//  platform of his cream cat tree by the window, paws tucked, tail hanging
//  over the edge. He breathes, blinks slowly, twitches an ear now and then,
//  and follows the avocado with his eyes (otherwise your pointer).
//
//  The avocado, which she hates passionately, sits on the floor looking smug.
//  Poke it, drag and fling it (gravity, bounces, spin, squish), or toss it up
//  to him: anything that lands near his platform gets swatted off with a quick
//  paw, and a cinnabar seal 禁 ("forbidden") is pressed where it was.
//  Stroke him to make him purr; click him for a tiny 야옹.
//
//  Two canvases: .cat-bg holds the room (wall, window, floor, the cat tree),
//  painted once per layout; .cat-fg holds everything alive, redrawn while
//  something moves. The cat is painted once into sprites (body, head, ears,
//  muzzle) with the brush engine; eyes, tail, paws and the avocado's face are
//  drawn live.
//
//  createCat(root, { t, reduceMotion, mobile, sound, name }) → { setActive, relabel, destroy }
// ─────────────────────────────────────────────────────────────────────────────
import { rng, noise1, stamp, stroke, sealStamp } from '../ink/brush.js?v=774a543f68';

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const easeOut = (k) => 1 - Math.pow(1 - clamp(k), 3);
const easeIn = (k) => { k = clamp(k); return k * k * k; };
const easeInOut = (k) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const easeBack = (k) => { k = clamp(k) - 1; return 1 + 2.4 * k * k * k + 1.4 * k * k; };
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(a).toFixed(3)})`;
const mix = (c1, c2, k) => [0, 1, 2].map((i) => Math.round(c1[i] + (c2[i] - c1[i]) * k));
const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));
const dprNow = () => Math.min(2, window.devicePixelRatio || 1);

// ─────────────────────────── palette ───────────────────────────

const INKC = [24, 22, 22];
const FUR_TOP = [100, 106, 121];
const FUR_MID = [66, 70, 82];
const FUR_LOW = [36, 38, 46];
const FUR_DARK = [18, 19, 24];
const FUR_SHEEN = [168, 176, 194];
const EAR_IN = [140, 112, 120];
const BEAN = [168, 128, 136];
const WOOD = [204, 156, 102];
const WOOD_L = [226, 186, 132];
const WOOD_D = [152, 104, 60];
const WOOD_INK = [92, 58, 32];
const CREAM = [247, 242, 230];
const CREAM_S = [222, 211, 190];
const CREAM_D = [184, 170, 146];
const CREAM_INK = [128, 114, 96];
const SISAL = [226, 210, 176];
const SISAL_D = [172, 148, 110];
const SISAL_LINE = [138, 112, 76];
const LEAF_D = [62, 96, 56];
const LEAF = [102, 140, 80];
const LEAF_L = [164, 194, 122];
const SKY = [240, 243, 230];
const AVO_SKIN = [40, 66, 32];
const AVO_SKIN_L = [84, 118, 50];
const SEAL_RGB = [184, 50, 42];

// ─────────────────────────── text (fallback: English) ───────────────────────────

export const CAT_STRINGS = {
  en: {
    'cat.label': 'Her baby, a slate-grey cat with green eyes, loafing on his cat tree by the window. On the floor sits an avocado, looking far too pleased with itself.',
    'cat.label.named': '{name}, her baby: a slate-grey cat with green eyes, loafing on his cat tree by the window. On the floor sits an avocado, looking far too pleased with itself.',
    'cat.caption': 'Her baby keeps watch by the window, and this house is strictly avocado-free.',
    'cat.caption.named': '{name}, her baby, keeps watch by the window, and this house is strictly avocado-free.',
    'cat.hint': 'Poke the avocado, fling it around, or toss it up to him: he knows what to do. Stroke his back to say thank you.',
    'cat.hint.touch': 'Tap the avocado, fling it with your finger, or toss it up to him: he knows what to do. Stroke his back to say thank you.',
    'cat.btn.poke': 'Poke the avocado',
    'cat.btn.swat': 'Let him handle it',
    'cat.btn.pet': 'Pet her baby',
    'cat.btn.pet.named': 'Pet {name}',
    'cat.count.0': 'Avocado bullied: not yet',
    'cat.count.1': 'Avocado bullied: {n} time',
    'cat.count.n': 'Avocado bullied: {n} times',
    'cat.m.1': 'And so it begins.',
    'cat.m.3': 'It’s starting to sweat.',
    'cat.m.5': 'It had it coming.',
    'cat.m.10': 'Mimi would be proud.',
    'cat.m.15': 'He hasn’t even stood up yet.',
    'cat.m.25': 'Okay, it has learned its lesson.',
    'cat.m.40': 'It has not learned its lesson.',
    'cat.m.60': 'Somewhere, a bowl of guacamole is trembling.',
    'cat.m.100': 'One hundred. He accepts payment in treats.',
  },
  fr: {
    'cat.label': 'Son bébé, un chat gris ardoise aux yeux verts, pattes repliées sous lui sur son arbre à chat près de la fenêtre. Par terre trône un avocat, l’air bien trop content de lui.',
    'cat.label.named': '{name}, son bébé : un chat gris ardoise aux yeux verts, pattes repliées sous lui sur son arbre à chat près de la fenêtre. Par terre trône un avocat, l’air bien trop content de lui.',
    'cat.caption': 'Son bébé monte la garde près de la fenêtre, et ici, les avocats sont strictement interdits.',
    'cat.caption.named': '{name}, son bébé, monte la garde près de la fenêtre, et ici, les avocats sont strictement interdits.',
    'cat.hint': 'Piquez l’avocat, lancez-le dans tous les sens ou envoyez-le-lui là-haut : il sait quoi faire. Caressez-lui le dos pour le remercier.',
    'cat.hint.touch': 'Touchez l’avocat, lancez-le du doigt ou envoyez-le-lui là-haut : il sait quoi faire. Caressez-lui le dos pour le remercier.',
    'cat.btn.poke': 'Piquer l’avocat',
    'cat.btn.swat': 'Le laisser faire',
    'cat.btn.pet': 'Caresser son bébé',
    'cat.btn.pet.named': 'Caresser {name}',
    'cat.count.0': 'Avocat malmené : pas encore',
    'cat.count.1': 'Avocat malmené : {n} fois',
    'cat.count.n': 'Avocat malmené : {n} fois',
    'cat.m.1': 'Et c’est parti.',
    'cat.m.3': 'L’avocat commence à transpirer.',
    'cat.m.5': 'Il l’a bien cherché.',
    'cat.m.10': 'Mimi serait fière.',
    'cat.m.15': 'Et son bébé ne s’est même pas levé.',
    'cat.m.25': 'Bon, il a compris la leçon.',
    'cat.m.40': 'Il n’a pas compris la leçon.',
    'cat.m.60': 'Quelque part, un bol de guacamole tremble.',
    'cat.m.100': 'Cent. Il accepte d’être payé en friandises.',
  },
  ko: {
    'cat.label': '미화네 아기: 초록 눈의 짙은 회색 고양이가 창가 캣타워 위에서 식빵을 굽고 있어요. 바닥에는 아보카도 하나가 괜히 잘난 척하며 앉아 있어요.',
    'cat.label.named': '미화네 아기 {name}: 초록 눈의 짙은 회색 고양이가 창가 캣타워 위에서 식빵을 굽고 있어요. 바닥에는 아보카도 하나가 괜히 잘난 척하며 앉아 있어요.',
    'cat.caption': '창가를 지키는 미화네 아기. 이 집은 아보카도 출입 금지예요.',
    'cat.caption.named': '창가를 지키는 미화네 아기, {name}. 이 집은 아보카도 출입 금지예요.',
    'cat.hint': '아보카도를 콕 찌르거나, 휙 던지거나, 아기 쪽으로 올려 보내 보세요. 알아서 처리해 줄 거예요. 고마우면 등을 쓰다듬어 주세요.',
    'cat.hint.touch': '아보카도를 톡 건드리거나, 손가락으로 휙 던지거나, 아기 쪽으로 올려 보내 보세요. 알아서 처리해 줄 거예요. 고마우면 등을 쓰다듬어 주세요.',
    'cat.btn.poke': '아보카도 콕 찌르기',
    'cat.btn.swat': '아기한테 맡기기',
    'cat.btn.pet': '아기 쓰다듬기',
    'cat.btn.pet.named': '{name} 쓰다듬기',
    'cat.count.0': '아보카도 괴롭힌 횟수: 아직 없음',
    'cat.count.1': '아보카도 괴롭힌 횟수: {n}번',
    'cat.count.n': '아보카도 괴롭힌 횟수: {n}번',
    'cat.m.1': '자, 이제 시작이에요.',
    'cat.m.3': '아보카도가 식은땀을 흘리기 시작했어요.',
    'cat.m.5': '자업자득이에요.',
    'cat.m.10': '미미가 자랑스러워할 거예요.',
    'cat.m.15': '아기는 아직 일어나지도 않았어요.',
    'cat.m.25': '좋아요, 이제 정신 차렸겠죠.',
    'cat.m.40': '아니요, 아직 정신 못 차렸네요.',
    'cat.m.60': '어딘가에서 과카몰리 한 그릇이 떨고 있어요.',
    'cat.m.100': '백 번! 수고비는 간식으로 받는대요.',
  },
};
const MILESTONES = [1, 3, 5, 10, 15, 25, 40, 60, 100];

// ─────────────────────────── markup ───────────────────────────

const ICON_AVO = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 2.2c2 0 2.9 1.9 3.3 3.9.4 1.8 2.6 3.2 2.6 6.3 0 3.3-2.6 5.4-5.9 5.4S4.1 15.7 4.1 12.4c0-3.1 2.2-4.5 2.6-6.3C7.1 4.1 8 2.2 10 2.2z"/><circle cx="10" cy="12.6" r="2.6"/></svg>';
const ICON_PAW = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><ellipse cx="10" cy="13.4" rx="4.1" ry="3.3"/><circle cx="4.6" cy="8.6" r="1.7"/><circle cx="8" cy="5.4" r="1.8"/><circle cx="12" cy="5.4" r="1.8"/><circle cx="15.4" cy="8.6" r="1.7"/></svg>';
const ICON_PET = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 16.4S3.2 12.3 3.2 7.6A3.4 3.4 0 0 1 10 6a3.4 3.4 0 0 1 6.8 1.6c0 4.7-6.8 8.8-6.8 8.8z"/></svg>';

/** The inside of the fragment (the outer element is `<div class="cat" id="cat">`). */
export const CAT_INNER = `
  <div class="cat-stage" role="img">
    <canvas class="cat-bg" aria-hidden="true"></canvas>
    <canvas class="cat-fg" aria-hidden="true"></canvas>
    <span class="cat-grab" aria-hidden="true"></span>
  </div>
  <p class="cat-caption"><span class="cat-caption-main"></span> <span class="cat-caption-hint"></span></p>
  <div class="cat-bar">
    <p class="cat-count" aria-live="polite"><span class="cat-count-n"></span> <span class="cat-count-note"></span></p>
    <div class="cat-btns">
      <button type="button" class="cat-btn cat-btn--poke">${ICON_AVO}<span class="cat-btn-text" data-ck="cat.btn.poke"></span></button>
      <button type="button" class="cat-btn cat-btn--swat">${ICON_PAW}<span class="cat-btn-text" data-ck="cat.btn.swat"></span></button>
      <button type="button" class="cat-btn cat-btn--pet">${ICON_PET}<span class="cat-btn-text cat-btn-pet"></span></button>
    </div>
  </div>
`;
/** The complete fragment to put in the page. */
export const CAT_HTML = `<div class="cat" id="cat">${CAT_INNER}</div>`;

// ─────────────────────────── geometry helpers ───────────────────────────

/** closed Catmull–Rom through control points */
function closedSpline(ctrl, step = 1.5) {
  const n = ctrl.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
    const m = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  return out;
}
const toPath = (pts, close = true) => {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  if (close) p.closePath();
  return p;
};
/** outward normals of a closed outline (checked against the path) */
function normalsOf(pts, path, hit) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    let nx = b[1] - a[1], ny = -(b[0] - a[0]);
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    if (hit.isPointInPath(path, p[0] + nx * 2, p[1] + ny * 2)) { nx = -nx; ny = -ny; }
    return [nx, ny];
  });
}

/** an offscreen canvas painted in its own units (u = css px per unit) */
function makeSprite(x0, y0, x1, y1, u, dpr, paint) {
  const c = document.createElement('canvas');
  const k = u * dpr;
  c.width = Math.max(1, Math.ceil((x1 - x0) * k));
  c.height = Math.max(1, Math.ceil((y1 - y0) * k));
  const g = c.getContext('2d');
  g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  paint(g);
  return { c, x0, y0, w: x1 - x0, h: y1 - y0 };
}
const blit = (g, sp, x = 0, y = 0) => g.drawImage(sp.c, x + sp.x0, y + sp.y0, sp.w, sp.h);

/** short hair marks inside a path */
function hairs(g, path, hit, R, { box, n, flow, pick, len = [4, 9], width = [0.5, 1.25], bend = 0.35 }) {
  const [bx0, by0, bx1, by1] = box;
  for (let i = 0; i < n; i++) {
    const x = bx0 + R() * (bx1 - bx0), y = by0 + R() * (by1 - by0);
    if (!hit.isPointInPath(path, x, y)) continue;
    const a = flow(x, y) + (R() - 0.5) * 0.5;
    const pk = pick(x, y, R);
    if (!pk) continue;
    const L = lerp(len[0], len[1], R()) * (pk[2] ?? 1);
    const dx = Math.cos(a) * L, dy = Math.sin(a) * L, b = (R() - 0.5) * L * bend;
    g.strokeStyle = rgba(pk[0], pk[1]);
    g.lineWidth = lerp(width[0], width[1], R());
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + dx * 0.5 - (dy / L) * b, y + dy * 0.5 + (dx / L) * b, x + dx, y + dy);
    g.stroke();
  }
}
/** fuzz poking out of a silhouette */
function fuzzEdge(g, pts, nrm, R, { keep = () => true, len = [2.5, 6], lean = 0, cols, n = 2, width = [0.5, 1.1] }) {
  g.lineCap = 'round';
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (!keep(x, y)) continue;
    const [nx, ny] = nrm[i];
    for (let k = 0; k < n; k++) {
      const a = Math.atan2(ny, nx) + (R() - 0.5) * 1.1 + lean;
      const L = lerp(len[0], len[1], R());
      const sx = x - nx * 1.6, sy = y - ny * 1.6;
      const [c, al] = cols[Math.floor(R() * cols.length)];
      g.strokeStyle = rgba(c, al * (0.6 + R() * 0.4));
      g.lineWidth = lerp(width[0], width[1], R());
      g.beginPath();
      g.moveTo(sx, sy);
      g.quadraticCurveTo(sx + Math.cos(a) * L * 0.5 + (R() - 0.5) * 1.2, sy + Math.sin(a) * L * 0.5 + (R() - 0.5) * 1.2, sx + Math.cos(a) * L, sy + Math.sin(a) * L);
      g.stroke();
    }
  }
}

// ─────────────────────────── the cat (cat units: origin = top platform centre) ───────────────────────────

// his loaf, seen from the side: rump overhanging the left edge, back sloping
// down from high hips to the shoulders, chest under the head
const BODY = [[104, 6], [60, 11], [0, 12], [-56, 12], [-90, 16], [-112, 20], [-131, 14], [-145, -4], [-152, -36], [-144, -72], [-120, -100], [-84, -113], [-42, -108], [-4, -96], [30, -87], [60, -89], [92, -80], [112, -50], [116, -18]];
// a round, full-cheeked head (Russian Blue / Chartreux)
const HEAD = [[0, -39], [22, -37], [38, -27], [46, -10], [49, 8], [44, 24], [28, 35], [0, 40], [-28, 35], [-44, 24], [-49, 8], [-46, -10], [-38, -27], [-22, -37]];
const EAR = [[-15, 4], [-12, -8], [-6, -19], [-1, -26], [3, -24], [8, -15], [13, -5], [16, 4]];
const EAR_INNER = [[-8.5, 2], [-6.5, -7], [-3, -15.5], [-0.5, -19], [2, -15], [6, -7], [8.5, 2]];
const HEAD_C = [98, -104];
const HS = 1.14; // head scale
const SHOULDER = [80, -38];
const PAW_REST = [88, 9];

function paintBody(g, hit, dense) {
  const R = rng(11);
  const pts = closedSpline(BODY, 1.1);
  const path = toPath(pts);
  // the top of the back, per column
  const back = new Float32Array(320).fill(1e9);
  for (const [x, y] of pts) { const i = Math.round(x) + 180; if (i >= 0 && i < 320 && y < back[i]) back[i] = y; }
  for (let i = 1; i < 320; i++) if (back[i] > 1e8) back[i] = back[i - 1];
  for (let i = 318; i >= 0; i--) if (back[i] > 1e8) back[i] = back[i + 1];
  const backY = (x) => back[clamp(Math.round(x) + 180, 0, 319)];

  const gr = g.createLinearGradient(0, -104, 0, 14);
  gr.addColorStop(0, rgba(FUR_TOP, 1));
  gr.addColorStop(0.42, rgba(FUR_MID, 1));
  gr.addColorStop(1, rgba(FUR_LOW, 1));
  g.fillStyle = gr;
  g.fill(path);
  g.save();
  g.clip(path);
  // the soft grey sheen along his back, and on the round of the haunch
  for (let x = -146; x <= 96; x += 4) stamp(g, x, backY(x) + 14, 18 + R() * 8, FUR_SHEEN, 0.1 + 0.05 * R(), 0.2);
  stamp(g, -100, -66, 40, FUR_SHEEN, 0.1, 0.1);
  stamp(g, 70, -60, 26, FUR_SHEEN, 0.06, 0.1);
  // underside and the fold between haunch and belly
  for (let x = -150; x <= 118; x += 7) stamp(g, x, 16, 26 + R() * 8, FUR_DARK, 0.13, 0.2);
  stamp(g, -58, -6, 26, FUR_DARK, 0.15, 0.2);
  stamp(g, -142, -24, 26, FUR_DARK, 0.12, 0.2);
  // fur: back toward the tail, down the flanks, wrapping round the rump
  hairs(g, path, hit, R, {
    box: [-152, -112, 120, 16], n: dense ? 9000 : 6000, len: [3, 6.5], width: [0.5, 1.15],
    flow: (x, y) => {
      const by = backY(x), v = clamp((y - by) / Math.max(20, 12 - by));
      let a = Math.PI - 0.2 - 0.95 * v;
      a -= smooth(-104, -148, x) * (0.9 - 0.4 * v);
      a += smooth(70, 112, x) * 0.9 * v; // chest: down
      return a;
    },
    pick: (x, y, r) => {
      const by = backY(x), v = clamp((y - by) / Math.max(20, 12 - by));
      const light = r() < 0.55 * (1 - v) * (1 - v) + 0.05;
      return light ? [FUR_SHEEN, 0.06 + r() * 0.13] : [FUR_DARK, 0.1 + r() * 0.2];
    },
  });
  g.restore();
  // a plush, fuzzy silhouette
  const nrm = normalsOf(pts, path, hit);
  fuzzEdge(g, pts, nrm, R, { keep: (x, y) => y < 2, lean: 0, cols: [[FUR_LOW, 0.4], [FUR_MID, 0.4], [FUR_SHEEN, 0.16]], n: 2, len: [1.2, 3.2], width: [0.5, 0.9] });
  // confident dry-brush lines: the back, the haunch, the shoulder
  stroke(g, { pts: [[62, -92], [30, -89], [-4, -98], [-42, -110], [-84, -115], [-120, -101], [-144, -73], [-152, -37], [-145, -6]], width: 4.4, dry: 0.62, tone: 0.82, bleed: 0.15, rgb: INKC, seed: 21, spread: 0.3 });
  stroke(g, { pts: [[-132, 12], [-128, -22], [-106, -48], [-80, -48], [-62, -26], [-56, 6]], width: 2.4, dry: 0.75, tone: 0.42, bleed: 0.1, rgb: INKC, seed: 22 });
  stroke(g, { pts: [[72, -64], [86, -36], [84, -6]], width: 2.2, dry: 0.75, tone: 0.32, bleed: 0.1, rgb: INKC, seed: 23 });
  stroke(g, { pts: [[118, -26], [114, -6], [104, 8]], width: 2.6, dry: 0.6, tone: 0.55, bleed: 0.1, rgb: INKC, seed: 24 });
}

function paintHead(g, hit, dense) {
  const R = rng(31);
  const pts = closedSpline(HEAD, 0.9);
  const path = toPath(pts);
  const gr = g.createRadialGradient(-8, -18, 4, 0, 0, 52);
  gr.addColorStop(0, rgba(mix(FUR_TOP, FUR_SHEEN, 0.15), 1));
  gr.addColorStop(0.55, rgba(FUR_MID, 1));
  gr.addColorStop(1, rgba(FUR_LOW, 1));
  g.fillStyle = gr;
  g.fill(path);
  g.save();
  g.clip(path);
  // sheen on the brow, shadow under the cheeks and round the eyes
  for (let i = 0; i < 9; i++) stamp(g, -26 + i * 6.5, -27 + Math.abs(i - 4) * 1.5, 13, FUR_SHEEN, 0.07, 0.2);
  stamp(g, -30, 6, 18, FUR_SHEEN, 0.06, 0.2);
  stamp(g, 0, 40, 30, FUR_DARK, 0.2, 0.2);
  stamp(g, -46, 22, 16, FUR_DARK, 0.14, 0.2);
  stamp(g, 46, 22, 16, FUR_DARK, 0.14, 0.2);
  // fur radiates out from the nose
  hairs(g, path, hit, R, {
    box: [-50, -42, 50, 42], n: dense ? 2600 : 1900, len: [3, 6.5], width: [0.45, 1.05],
    flow: (x, y) => Math.atan2(y - 12, x) + (y < 0 ? 0.12 * Math.sign(x) : 0),
    pick: (x, y, r) => {
      const light = r() < (y < -8 ? 0.42 : 0.22);
      return light ? [FUR_SHEEN, 0.06 + r() * 0.13] : [FUR_DARK, 0.1 + r() * 0.2];
    },
  });
  g.restore();
  const nrm = normalsOf(pts, path, hit);
  fuzzEdge(g, pts, nrm, R, { keep: (x, y) => y < 34, cols: [[FUR_LOW, 0.45], [FUR_MID, 0.4], [FUR_SHEEN, 0.16]], n: 2, len: [1, 2.8], width: [0.45, 0.85] });
  // cheek tufts
  fuzzEdge(g, pts, nrm, R, { keep: (x, y) => y > 6 && y < 30, cols: [[FUR_MID, 0.5], [FUR_LOW, 0.45]], n: 2, len: [2, 4.5] });
  stroke(g, { pts: [[-45, -12], [-37, -28], [-20, -38], [2, -40], [22, -37], [38, -27], [46, -10]], width: 3.2, dry: 0.55, tone: 0.78, bleed: 0.12, rgb: INKC, seed: 33 });
  stroke(g, { pts: [[-49, 2], [-47, 16], [-40, 27], [-28, 35]], width: 2.6, dry: 0.6, tone: 0.6, bleed: 0.1, rgb: INKC, seed: 34 });
  stroke(g, { pts: [[49, 2], [47, 16], [41, 26]], width: 2.4, dry: 0.65, tone: 0.5, bleed: 0.1, rgb: INKC, seed: 35 });
}

function paintMuzzle(g) {
  // whisker pads, a lighter chin and soft shadows round the eyes
  stamp(g, -8.5, 13, 10.5, [112, 117, 132], 0.3, 0.25);
  stamp(g, 8.5, 13, 10.5, [112, 117, 132], 0.3, 0.25);
  stamp(g, 0, 22, 8, [96, 100, 114], 0.22, 0.3);
  stamp(g, -17, -3, 11, FUR_DARK, 0.2, 0.3);
  stamp(g, 17, -3, 11, FUR_DARK, 0.2, 0.3);
  const R = rng(41);
  g.fillStyle = rgba(FUR_DARK, 0.55);
  for (const sx of [-1, 1]) for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    g.beginPath();
    g.arc(sx * (5.5 + c * 2.6 + R() * 0.6), 12 + r * 2.4 + c * 0.4, 0.55, 0, TAU);
    g.fill();
  }
}

function paintEar(g, hit) {
  const R = rng(51);
  const pts = closedSpline(EAR, 0.6);
  const path = toPath(pts);
  const gr = g.createLinearGradient(0, -26, 0, 4);
  gr.addColorStop(0, rgba(FUR_LOW, 1));
  gr.addColorStop(1, rgba(FUR_MID, 1));
  g.fillStyle = gr;
  g.fill(path);
  g.save();
  g.clip(path);
  const inner = toPath(closedSpline(EAR_INNER, 0.6));
  g.fillStyle = rgba(EAR_IN, 0.42);
  g.fill(inner);
  stamp(g, 0, -6, 7, EAR_IN, 0.35, 0.3);
  hairs(g, inner, hit, R, {
    box: [-9, -20, 9, 3], n: 160, len: [3, 6], width: [0.35, 0.7],
    flow: (x) => -Math.PI / 2 + x * 0.06, pick: (x, y, r) => [[226, 222, 228], 0.25 + r() * 0.25],
  });
  hairs(g, path, hit, R, {
    box: [-16, -27, 17, 5], n: 220, len: [2, 4], width: [0.4, 0.8],
    flow: () => -Math.PI / 2, pick: (x, y, r) => (hit.isPointInPath(inner, x, y) ? null : [FUR_SHEEN, 0.1 + r() * 0.12]),
  });
  g.restore();
  const nrm = normalsOf(pts, path, hit);
  fuzzEdge(g, pts, nrm, R, { keep: (x, y) => y < 2, cols: [[FUR_LOW, 0.5]], n: 1, len: [1.5, 3.5] });
  stroke(g, { pts: [[-15, 3], [-11, -9], [-5, -20], [-0.5, -26.5], [4, -23], [9, -14], [15, -2]], width: 1.8, dry: 0.4, tone: 0.8, bleed: 0.1, rgb: INKC, seed: 52, bristles: 6 });
}

/** a plush cream disc of a cat tree, centred on its top face */
function paintDisc(g, hit, rx, ry, th, seed) {
  const R = rng(seed);
  const rim = new Path2D();
  rim.moveTo(rx, 0);
  rim.lineTo(rx, th);
  rim.ellipse(0, th, rx, ry, 0, 0, Math.PI);
  rim.lineTo(-rx, 0);
  rim.ellipse(0, 0, rx, ry, 0, Math.PI, 0, true);
  rim.closePath();
  const top = new Path2D();
  top.ellipse(0, 0, rx, ry, 0, 0, TAU);
  // underside shadow
  stamp(g, 0, th + ry * 0.8, rx * 0.9, [90, 74, 58], 0.12, 0.2);
  // rim: a soft cylinder
  let gr = g.createLinearGradient(-rx, 0, rx, 0);
  gr.addColorStop(0, rgba(CREAM_D, 1));
  gr.addColorStop(0.3, rgba(CREAM_S, 1));
  gr.addColorStop(0.62, rgba(mix(CREAM_S, CREAM, 0.5), 1));
  gr.addColorStop(1, rgba(CREAM_D, 1));
  g.fillStyle = gr;
  g.fill(rim);
  g.save();
  g.clip(rim);
  const vg = g.createLinearGradient(0, ry * 0.4, 0, th + ry);
  vg.addColorStop(0, 'rgba(255,252,244,0)');
  vg.addColorStop(1, 'rgba(120,100,80,0.25)');
  g.fillStyle = vg;
  g.fill(rim);
  hairs(g, rim, hit, R, {
    box: [-rx, 0, rx, th + ry], n: rx * th * 0.9, len: [1.5, 3.5], width: [0.4, 0.9], bend: 1,
    flow: () => Math.PI / 2 + (R() - 0.5) * 2,
    pick: (x, y, r) => (r() < 0.5 ? [CREAM_INK, 0.12 + r() * 0.12] : [[255, 252, 244], 0.3 + r() * 0.3]),
  });
  g.restore();
  // top face: lit from the window on the right
  gr = g.createLinearGradient(-rx, -ry, rx, ry);
  gr.addColorStop(0, rgba(mix(CREAM, CREAM_S, 0.55), 1));
  gr.addColorStop(0.6, rgba(CREAM, 1));
  gr.addColorStop(1, rgba([252, 249, 240], 1));
  g.fillStyle = gr;
  g.fill(top);
  g.save();
  g.clip(top);
  stamp(g, -rx * 0.35, -ry * 0.1, rx * 0.5, CREAM_D, 0.12, 0.2);
  hairs(g, top, hit, R, {
    box: [-rx, -ry, rx, ry], n: rx * ry * 0.9, len: [1.2, 3], width: [0.4, 0.9], bend: 1,
    flow: () => R() * TAU,
    pick: (x, y, r) => (r() < 0.55 ? [CREAM_INK, 0.08 + r() * 0.12] : [[255, 253, 248], 0.4 + r() * 0.3]),
  });
  g.restore();
  // soft ink outlines
  const front = [];
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI; front.push([Math.cos(a) * rx, Math.sin(a) * ry]); }
  const bottom = front.map(([x, y]) => [x, y + th]);
  stroke(g, { pts: front, width: 1.4, dry: 0.55, tone: 0.42, bleed: 0.1, rgb: CREAM_INK, seed: seed + 1, bristles: 5 });
  stroke(g, { pts: bottom, width: 1.8, dry: 0.5, tone: 0.55, bleed: 0.15, rgb: CREAM_INK, seed: seed + 2, bristles: 5 });
  const back = [];
  for (let i = 0; i <= 20; i++) { const a = Math.PI + (i / 20) * Math.PI; back.push([Math.cos(a) * rx, Math.sin(a) * ry]); }
  stroke(g, { pts: back, width: 1.1, dry: 0.7, tone: 0.28, bleed: 0.05, rgb: CREAM_INK, seed: seed + 3, bristles: 4 });
  stroke(g, { pts: [[-rx, 0], [-rx - 0.4, th * 0.5], [-rx, th]], width: 1.4, dry: 0.5, tone: 0.45, rgb: CREAM_INK, seed: seed + 4, bristles: 4 });
  stroke(g, { pts: [[rx, 0], [rx + 0.4, th * 0.5], [rx, th]], width: 1.2, dry: 0.6, tone: 0.32, rgb: CREAM_INK, seed: seed + 5, bristles: 4 });
}

/** a sisal-wrapped post from y0 down to y1, ending on an ellipse */
function paintPost(g, x, y0, y1, w, s, seed) {
  const R = rng(seed);
  const hw = w / 2, e = hw * 0.28;
  const path = new Path2D();
  path.moveTo(x - hw, y0);
  path.lineTo(x - hw, y1);
  path.ellipse(x, y1, hw, e, 0, Math.PI, 0, true);
  path.lineTo(x + hw, y0);
  path.closePath();
  const gr = g.createLinearGradient(x - hw, 0, x + hw, 0);
  gr.addColorStop(0, rgba(SISAL_D, 1));
  gr.addColorStop(0.36, rgba(SISAL, 1));
  gr.addColorStop(0.66, rgba(mix(SISAL, [246, 236, 214], 0.5), 1));
  gr.addColorStop(1, rgba(mix(SISAL_D, SISAL, 0.3), 1));
  g.fillStyle = gr;
  g.fill(path);
  g.save();
  g.clip(path);
  g.lineCap = 'round';
  for (let y = y0 + R() * 3; y < y1 + e; y += (3 + R() * 1.2) * s) {
    g.beginPath();
    g.moveTo(x - hw, y);
    g.quadraticCurveTo(x, y + e * 1.5, x + hw, y + (R() - 0.5) * s);
    g.strokeStyle = rgba(SISAL_LINE, 0.2 + R() * 0.22);
    g.lineWidth = (0.6 + R() * 0.8) * s;
    g.stroke();
  }
  for (let i = 0; i < (y1 - y0) * 1.2; i++) {
    const px = x + (R() - 0.5) * w, py = y0 + R() * (y1 - y0), a = R() * TAU, L = (1 + R() * 3) * s;
    g.strokeStyle = R() < 0.5 ? rgba([252, 244, 228], 0.35) : rgba(SISAL_LINE, 0.2);
    g.lineWidth = 0.5 * s;
    g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L); g.stroke();
  }
  g.restore();
  stroke(g, { pts: [[x - hw, y0], [x - hw - 0.4 * s, (y0 + y1) / 2], [x - hw, y1]], width: 1.6 * s, dry: 0.6, tone: 0.5, rgb: [96, 78, 56], seed: seed + 1, bristles: 4 });
  stroke(g, { pts: [[x + hw, y0], [x + hw + 0.3 * s, (y0 + y1) / 2], [x + hw, y1]], width: 1.3 * s, dry: 0.7, tone: 0.34, rgb: [96, 78, 56], seed: seed + 2, bristles: 4 });
}

// ─────────────────────────── the avocado (units: s, origin = centre of mass) ───────────────────────────

const AVO = [[0, -54], [8.5, -52], [14.5, -45], [17.5, -34], [20, -22], [25.5, -10], [29.5, 2], [29.5, 13], [24, 20.5], [13, 24.2], [0, 25], [-13, 24.2], [-24, 20.5], [-29.5, 13], [-29.5, 2], [-25.5, -10], [-20, -22], [-17.5, -34], [-14.5, -45], [-8.5, -52]];
const AVO_SHAPES = [{ x: 0, y: -4, r: 28 }, { x: 0, y: -38, r: 16 }];
const AVO_EYES = [[-7.5, -21], [7.5, -21]];

function paintAvocado(g) {
  const R = rng(61);
  const pts = closedSpline(AVO, 0.8);
  const path = toPath(pts);
  // skin
  let gr = g.createLinearGradient(-30, 20, 24, -50);
  gr.addColorStop(0, rgba([30, 50, 26], 1));
  gr.addColorStop(0.55, rgba(AVO_SKIN, 1));
  gr.addColorStop(1, rgba(AVO_SKIN_L, 1));
  g.fillStyle = gr;
  g.fill(path);
  g.save();
  g.clip(path);
  for (let i = 0; i < 260; i++) {
    const x = (R() - 0.5) * 62, y = -56 + R() * 82;
    g.fillStyle = R() < 0.5 ? 'rgba(14,26,10,.35)' : 'rgba(150,180,90,.25)';
    g.beginPath(); g.arc(x, y, 0.35 + R() * 0.6, 0, TAU); g.fill();
  }
  g.restore();
  // flesh
  const fp = AVO.map(([x, y]) => [x * 0.84, -6 + (y + 6) * 0.87]);
  const flesh = toPath(closedSpline(fp, 0.8));
  gr = g.createRadialGradient(-2, -2, 2, 0, -6, 34);
  gr.addColorStop(0, 'rgb(244,238,170)');
  gr.addColorStop(0.5, 'rgb(222,228,138)');
  gr.addColorStop(0.8, 'rgb(184,210,96)');
  gr.addColorStop(1, 'rgb(136,176,64)');
  g.fillStyle = gr;
  g.fill(flesh);
  g.save();
  g.clip(flesh);
  stamp(g, 10, -36, 9, [252, 250, 210], 0.35, 0.2);
  for (let i = 0; i < 90; i++) {
    const x = (R() - 0.5) * 50, y = -46 + R() * 66;
    g.strokeStyle = rgba([150, 170, 70], 0.12);
    g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 3, y + (R() - 0.5) * 3); g.stroke();
  }
  g.restore();
  g.strokeStyle = 'rgba(112,150,44,.55)';
  g.lineWidth = 1.1;
  g.stroke(flesh);
  // the pit, a round belly
  gr = g.createRadialGradient(-4, 0, 1, 0, 4, 13);
  gr.addColorStop(0, 'rgb(186,128,76)');
  gr.addColorStop(0.6, 'rgb(140,90,50)');
  gr.addColorStop(1, 'rgb(98,60,32)');
  g.fillStyle = gr;
  g.beginPath(); g.ellipse(0, 4.5, 12, 12.5, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(236,196,150,.55)';
  g.beginPath(); g.ellipse(-4.5, -1.5, 3.4, 2.2, -0.6, 0, TAU); g.fill();
  stroke(g, { pts: [[-12, 4], [-9, 13], [0, 17], [9, 13], [12, 4]], width: 1.2, dry: 0.4, tone: 0.5, rgb: [70, 40, 20], seed: 62, bristles: 4 });
  // a confident outline, in two strokes like a painter would
  const half = Math.floor(pts.length / 2);
  stroke(g, { pts: [...pts.slice(0, half + 1)], width: 2.2, dry: 0.4, tone: 0.85, bleed: 0.1, rgb: [16, 26, 12], seed: 63, bristles: 7 });
  stroke(g, { pts: [...pts.slice(half), pts[0]], width: 2.4, dry: 0.45, tone: 0.9, bleed: 0.1, rgb: [16, 26, 12], seed: 64, bristles: 7 });
}

// ─────────────────────────── the room ───────────────────────────

function paintRoom(g, L, hit, SP) {
  const { W, H, s } = L;
  const R = rng(71);
  // wall, with daylight round the window
  let gr = g.createLinearGradient(0, 0, 0, L.wallBase);
  gr.addColorStop(0, 'rgba(226,212,184,0.0)');
  gr.addColorStop(0.25, 'rgba(226,212,184,0.22)');
  gr.addColorStop(1, 'rgba(214,198,168,0.34)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, L.wallBase);
  const wcx = (L.win.x0 + L.win.x1) / 2, wcy = (L.win.y0 + L.win.y1) / 2;
  stamp(g, wcx, wcy, Math.max(L.win.x1 - L.win.x0, L.win.y1 - L.win.y0) * 0.9, [252, 249, 238], 0.5, 0.2);

  paintWindow(g, L, R);
  if (L.sign) paintSign(g, L, SP);

  // floor: warm boards, the skirting line, and light from the window
  gr = g.createLinearGradient(0, L.wallBase, 0, H);
  gr.addColorStop(0, 'rgba(196,166,124,0.42)');
  gr.addColorStop(1, 'rgba(206,182,146,0.12)');
  g.fillStyle = gr;
  g.fillRect(0, L.wallBase, W, H - L.wallBase);
  for (let i = 0; i < 5; i++) {
    const y = L.wallBase + (H - L.wallBase) * (0.18 + i * 0.19) * (1 + i * 0.08);
    if (y > H - 4) break;
    stroke(g, { pts: [[-10, y], [W * 0.5, y + (R() - 0.5) * 2], [W + 10, y + (R() - 0.5) * 2]], width: 1.1, dry: 0.85, tone: 0.18 + i * 0.03, rgb: [120, 86, 52], seed: 80 + i, bristles: 3 });
  }
  const lx0 = L.win.x0 + 40 * s, lx1 = L.win.x1 - 10 * s;
  for (let i = 0; i < 18; i++) {
    const u = i / 17, k = R();
    const y = lerp(L.wallBase + 6 * s, H - 10, k);
    const x = lerp(lx0, lx1, u) + (y - L.wallBase) * 0.7;
    stamp(g, x, y, (34 + R() * 26) * s, [255, 251, 238], 0.13, 0.15);
  }
  stroke(g, { pts: [[-10, L.wallBase], [W * 0.3, L.wallBase + 1], [W * 0.7, L.wallBase - 0.5], [W + 10, L.wallBase]], width: 2.4, dry: 0.7, tone: 0.45, rgb: [70, 50, 34], seed: 90, bristles: 6 });

  // the cat tree: base, posts, lower platform, upper post; the top platform is a sprite
  stamp(g, L.base.x, L.floorY + 2 * s, L.base.rx * 1.05, [70, 54, 40], 0.16, 0.15);
  stamp(g, L.base.x - L.base.rx * 0.3, L.floorY, L.base.rx * 0.6, [70, 54, 40], 0.1, 0.15);
  g.save(); g.translate(L.base.x, L.base.y); g.scale(s, s);
  paintDisc(g, hit, L.base.rx / s, L.base.ry / s, L.base.th / s, 120);
  g.restore();
  paintPost(g, L.post.x, L.low.y, L.base.y, L.post.w, s, 130);
  paintPost(g, L.post2.x, L.low.y + L.low.th, L.base.y, L.post2.w, s, 140);
  g.save(); g.translate(L.low.x, L.low.y); g.scale(s, s);
  paintDisc(g, hit, L.low.rx / s, L.low.ry / s, L.low.th / s, 150);
  g.restore();
  paintPost(g, L.post.x, L.plat.y + L.plat.th, L.low.y, L.post.w, s, 160);
  // shadow of the top platform on the post
  stamp(g, L.post.x, L.plat.y + L.plat.th + 10 * s, 26 * s, [80, 60, 40], 0.16, 0.2);
  blit2(g, SP.plat, L.plat.x, L.plat.y, s);

  // let the room fade into the page at its edges
  g.save();
  g.globalCompositeOperation = 'destination-out';
  const fw = L.narrow ? 14 : Math.min(160, W * 0.13);
  for (const [a, b] of [[0, fw], [W, W - fw]]) {
    gr = g.createLinearGradient(a, 0, b, 0);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(Math.min(a, b), 0, fw, H);
  }
  gr = g.createLinearGradient(0, H - 46, 0, H);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = gr; g.fillRect(0, H - 46, W, 46);
  gr = g.createLinearGradient(0, 0, 0, 30);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, 30);
  g.restore();
}
/** draw a sprite painted in s-units at (x, y) */
function blit2(g, sp, x, y, s) {
  g.drawImage(sp.c, x + sp.x0 * s, y + sp.y0 * s, sp.w * s, sp.h * s);
}

function paintWindow(g, L, R) {
  const { s } = L;
  const { x0, y0, x1, y1 } = L.win;
  const f = 15 * s;
  const gx0 = x0 + f, gy0 = y0 + f, gx1 = x1 - f, gy1 = y1 - f * 0.8;
  const gw = gx1 - gx0, gh = gy1 - gy0;
  // daylight and blurred green outside
  g.save();
  g.beginPath(); g.rect(gx0, gy0, gw, gh); g.clip();
  let gr = g.createLinearGradient(0, gy0, 0, gy1);
  gr.addColorStop(0, rgba(SKY, 1));
  gr.addColorStop(0.45, rgba(mix(SKY, LEAF_L, 0.55), 1));
  gr.addColorStop(1, rgba(mix(LEAF, LEAF_L, 0.4), 1));
  g.fillStyle = gr;
  g.fillRect(gx0, gy0, gw, gh);
  const big = Math.max(gw, gh);
  for (let i = 0; i < 26; i++) {
    const x = gx0 + R() * gw, y = gy0 + gh * (0.3 + R() * 0.8);
    stamp(g, x, y, big * (0.12 + R() * 0.16), R() < 0.5 ? LEAF_D : LEAF, 0.16 + R() * 0.2, 0.15);
  }
  for (let i = 0; i < 12; i++) {
    const x = gx0 + R() * gw, y = gy0 + gh * R() * 0.5;
    stamp(g, x, y, big * (0.1 + R() * 0.12), SKY, 0.35 + R() * 0.3, 0.15);
  }
  // bokeh
  for (let i = 0; i < 46; i++) {
    const x = gx0 + R() * gw, y = gy0 + R() * gh * 0.85, r = (5 + R() * 12) * s;
    const light = R() < 0.7;
    stamp(g, x, y, r, light ? [246, 250, 232] : LEAF_L, (light ? 0.28 : 0.2) + R() * 0.25, 0.75);
  }
  // a reflection or two on the glass
  g.globalCompositeOperation = 'lighter';
  for (const [k, w] of [[0.62, 26], [0.74, 10]]) {
    g.beginPath();
    const bx = gx0 + gw * k;
    g.moveTo(bx, gy0); g.lineTo(bx + w * s, gy0); g.lineTo(bx + w * s - gh * 0.55, gy1); g.lineTo(bx - gh * 0.55, gy1); g.closePath();
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fill();
  }
  g.restore();
  // frame: warm light wood
  const frame = new Path2D();
  frame.rect(x0, y0, x1 - x0, y1 - y0);
  frame.rect(gx0, gy0, gw, gh);
  const midX = gx0 + gw * 0.56, mw = f * 0.55;
  g.fillStyle = rgba(WOOD, 1);
  g.fill(frame, 'evenodd');
  g.fillRect(midX - mw / 2, gy0, mw, gh);
  g.save();
  g.clip(frame, 'evenodd');
  for (let i = 0; i < 40; i++) {
    const vert = i % 2 === 0;
    const x = vert ? (R() < 0.5 ? x0 + R() * f : x1 - f + R() * f) : x0 + R() * (x1 - x0);
    const y = vert ? y0 + R() * (y1 - y0) : (R() < 0.5 ? y0 + R() * f : y1 - f + R() * f);
    const L2 = (40 + R() * 120) * s;
    g.strokeStyle = rgba(R() < 0.6 ? WOOD_D : WOOD_L, 0.25 + R() * 0.2);
    g.lineWidth = (0.6 + R()) * s;
    g.beginPath(); g.moveTo(x, y); g.lineTo(vert ? x + (R() - 0.5) * s : x + L2, vert ? y + L2 : y + (R() - 0.5) * s); g.stroke();
  }
  stamp(g, x1 - f * 0.5, (y0 + y1) / 2, (y1 - y0) * 0.5, WOOD_D, 0.08, 0.2);
  g.restore();
  // the glass sits a little deeper than the frame
  g.strokeStyle = rgba(WOOD_INK, 0.45);
  g.lineWidth = 2 * s;
  g.strokeRect(gx0 + s, gy0 + s, gw - 2 * s, gh - 2 * s);
  g.fillStyle = rgba(WOOD_L, 0.6);
  g.fillRect(midX - mw / 2, gy0, mw * 0.35, gh);
  const ol = (pts, w, tone, seed) => stroke(g, { pts, width: w * s, dry: 0.55, tone, bleed: 0.12, rgb: WOOD_INK, seed, bristles: 5 });
  ol([[x0, y1], [x0 - 0.5, (y0 + y1) / 2], [x0, y0]], 2.4, 0.6, 201);
  ol([[x0, y0], [(x0 + x1) / 2, y0 + 0.5], [x1, y0]], 2.4, 0.55, 209);
  ol([[x1, y0], [x1 + 0.5, (y0 + y1) / 2], [x1, y1]], 2.2, 0.5, 202);
  ol([[gx0, gy1], [gx0, (gy0 + gy1) / 2], [gx0, gy0]], 1.4, 0.35, 203);
  ol([[gx0, gy0], [(gx0 + gx1) / 2, gy0], [gx1, gy0]], 1.4, 0.35, 210);
  ol([[midX - mw / 2, gy0], [midX - mw / 2, gy1]], 1.2, 0.35, 204);
  ol([[midX + mw / 2, gy0], [midX + mw / 2, gy1]], 1.2, 0.3, 205);
  // the sill
  const sx0 = x0 - 12 * s, sx1 = x1 + 12 * s, st = 12 * s;
  stamp(g, (sx0 + sx1) / 2, y1 + st + 8 * s, (sx1 - sx0) * 0.4, [90, 66, 44], 0.1, 0.2);
  g.fillStyle = rgba(WOOD_L, 1);
  g.fillRect(sx0, y1 - 3 * s, sx1 - sx0, 6 * s);
  g.fillStyle = rgba(mix(WOOD, WOOD_D, 0.35), 1);
  g.fillRect(sx0, y1 + 3 * s, sx1 - sx0, st - 3 * s);
  ol([[sx0, y1 - 3 * s], [sx1, y1 - 3 * s]], 1.6, 0.45, 206);
  ol([[sx0, y1 + st], [(sx0 + sx1) / 2, y1 + st + 0.5], [sx1, y1 + st]], 2.2, 0.55, 207);
  ol([[sx0, y1 - 3 * s], [sx0, y1 + st]], 1.4, 0.5, 208);
}

function paintSign(g, L, SP) {
  const { s } = L;
  const { x, y } = L.sign;
  g.save();
  g.translate(x, y);
  g.rotate(-0.06);
  const w = 74 * s, h = 96 * s;
  g.save();
  g.shadowColor = 'rgba(70,48,24,0.25)';
  g.shadowBlur = 10 * s;
  g.shadowOffsetY = 5 * s;
  g.fillStyle = '#faf6ec';
  g.fillRect(-w / 2, -h / 2, w, h);
  g.restore();
  g.strokeStyle = 'rgba(160,140,110,.5)';
  g.lineWidth = 0.8;
  g.strokeRect(-w / 2 + 4 * s, -h / 2 + 4 * s, w - 8 * s, h - 8 * s);
  // a little avocado, firmly crossed out
  g.save();
  g.translate(0, -10 * s);
  g.rotate(0.12);
  g.scale(0.5, 0.5);
  blit2(g, SP.avo, 0, 14 * s, s);
  g.restore();
  const ring = [];
  for (let i = 0; i <= 40; i++) { const a = -2.2 + (i / 40) * TAU * 1.04; ring.push([Math.cos(a) * 25 * s, -12 * s + Math.sin(a) * 25 * s]); }
  stroke(g, { pts: ring, width: 4 * s, dry: 0.3, tone: 0.9, bleed: 0.2, rgb: SEAL_RGB, seed: 301, bristles: 8 });
  stroke(g, { pts: [[-17 * s, -29 * s], [17 * s, 5 * s]], width: 4.4 * s, dry: 0.3, tone: 0.9, bleed: 0.2, rgb: SEAL_RGB, seed: 302, bristles: 8 });
  g.fillStyle = 'rgba(30,26,24,.9)';
  g.font = `${19 * s}px "Nanum Brush Script", "Gowun Batang", cursive`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('출입금지', 0, 31 * s);
  // a strip of tape
  g.fillStyle = 'rgba(232,220,190,.75)';
  g.save(); g.translate(0, -h / 2); g.rotate(0.08); g.fillRect(-12 * s, -5 * s, 24 * s, 10 * s); g.restore();
  g.restore();
}

// ─────────────────────────── the component ───────────────────────────

export function createCat(root, { t = (k) => k, reduceMotion = false, mobile = false, sound = {}, name = '' } = {}) {
  if (!root.querySelector('.cat-stage')) {
    root.classList.add('cat');
    root.innerHTML = CAT_INNER;
  }
  const $ = (q) => root.querySelector(q);
  const stage = $('.cat-stage'), bgC = $('.cat-bg'), fgC = $('.cat-fg'), grabEl = $('.cat-grab');
  const capMain = $('.cat-caption-main'), capHint = $('.cat-caption-hint');
  const countN = $('.cat-count-n'), countNote = $('.cat-count-note');
  const btnPoke = $('.cat-btn--poke'), btnSwat = $('.cat-btn--swat'), btnPet = $('.cat-btn--pet'), petText = $('.cat-btn-pet');
  const touchy = matchMedia('(hover: none)').matches;
  const hit = document.createElement('canvas').getContext('2d');
  const nm = String(name || '').trim();
  const tt = (k) => {
    let v = null;
    try { v = t(k); } catch { v = null; }
    return v && v !== k ? v : (CAT_STRINGS.en[k] ?? k);
  };
  const play = (n, ...a) => { try { sound && typeof sound[n] === 'function' && sound[n](...a); } catch { /* no sound is fine */ } };
  const RM = !!reduceMotion;

  let L = null, SP = null, spKey = '', W = 0, H = 0, dpr = 0;
  let active = true, destroyed = false, ready = false, raf = 0, last = 0, lastDraw = 0;
  const ac = new AbortController();
  const opt = { signal: ac.signal };
  const now0 = () => performance.now();

  // the avocado
  const A = {
    x: 0, y: 0, vx: 0, vy: 0, ang: 0, w: 0, sq: 0, sqv: 0, sqA: -Math.PI / 2,
    alpha: 1, scale: 1, grab: null, place: null, fade: null, sleeping: true, restT: 0, grounded: false,
    face: 'smug', faceUntil: 0, worriedAt: -1e9, touchedCat: false, lastMove: -1e9, fast: false, peak: 0,
  };
  // the cat
  const C = {
    yaw: 0.55, pitch: -0.2, tilt: 0, breath: 0, bph: 0, lid: 0, blink: null, blinkAt: 0,
    tw: null, twAt: 0, earL: 0, earR: 0, flat: 0, agit: 0, dil: 0.45, happy: 0, petUntil: 0,
    meowAt: -1e9, swat: null, lastSwat: -1e9, tailPh: 0, curlPh: 0, satisfiedAt: -1e9,
  };
  const pom = { a: 0, w: 0, hitT: 0 };
  const fx = { purrs: [], meows: [], seals: [], rings: [], strokes: [] };
  const pointer = { x: 0, y: 0, t: -1e9 };
  const pet = { dist: 0, lastX: null, dir: 0, flips: 0, t: 0, spawnT: 0 };
  let tapCat = null;
  let count = 0, lastMilestone = 0, lastPurr = -1e9;

  // ── layout ──
  function computeLayout(w, h) {
    const narrow = w < 600;
    let s = narrow ? Math.min(w / 350, (h - 110) / 440) : Math.min((h - 70) / 440, w / 820);
    s = clamp(s, 0.55, 1.3);
    const floorY = h - (narrow ? 62 : 54);
    const topY = floorY - 272 * s;
    const catX = narrow ? clamp(w * 0.46, 176 * s, w - 158 * s) : w * 0.38;
    const plat = { x: catX, y: topY, rx: 98 * s, ry: 25 * s, th: 22 * s };
    const low = { x: catX + 62 * s, y: topY + 152 * s, rx: (narrow ? 104 : 118) * s, ry: 28 * s, th: 20 * s };
    const base = { x: catX + (narrow ? 4 : 22) * s, y: floorY - 12 * s, rx: (narrow ? 84 : 132) * s, ry: 22 * s, th: 12 * s };
    const post = { x: catX - 8 * s, w: 34 * s };
    const post2 = { x: low.x + (narrow ? 34 : 58) * s, w: 30 * s };
    const win = narrow
      ? { x0: w * 0.09, y0: 14, x1: w - 12, y1: topY + 36 * s }
      : { x0: catX - 74 * s, y0: Math.max(16, topY - 250 * s), x1: Math.min(w - 60, catX + 440 * s), y1: topY + 36 * s };
    const sign = !narrow && catX - 180 * s > 120 ? { x: Math.max(70 * s, (catX - 180 * s) * 0.55), y: topY - 60 * s } : null;
    const P = {
      W: w, H: h, s, narrow, floorY, topY, catX, plat, low, base, post, post2, win, sign,
      wallBase: floorY - 30 * s,
      pom: { x: catX + 50 * s, y: topY + 40 * s, len: 80 * s, r: 15 * s },
      home: { x: narrow ? w - 32 * s : Math.min(w - 90 * s, catX + 330 * s) },
      G: 2500 * s,
    };
    // colliders: capsules (a→b, radius); flat ones can be stood on
    const cap = (ax, ay, bx, by, r, o = {}) => ({ ax, ay, bx, by, r, e: 0.35, mu: 0.5, ...o });
    P.cols = [
      cap(plat.x - plat.rx + 10 * s, topY + 10 * s, plat.x + plat.rx - 10 * s, topY + 10 * s, 10 * s, { flat: true, e: 0.3 }),
      cap(catX - 104 * s, topY - 52 * s, catX + 64 * s, topY - 50 * s, 50 * s, { cat: true, e: 0.25, mu: 0.3 }),
      cap(catX + HEAD_C[0] * s, topY + HEAD_C[1] * s, catX + HEAD_C[0] * s, topY + HEAD_C[1] * s, 48 * s, { cat: true, e: 0.25, mu: 0.3 }),
      cap(post.x, topY + 26 * s, post.x, base.y, post.w / 2),
      cap(low.x - low.rx + 10 * s, low.y + 10 * s, low.x + low.rx - 10 * s, low.y + 10 * s, 10 * s, { flat: true, e: 0.3 }),
      cap(post2.x, low.y + 24 * s, post2.x, base.y, post2.w / 2),
      cap(base.x - base.rx + 8 * s, base.y + 6 * s, base.x + base.rx - 8 * s, base.y + 6 * s, 6 * s, { flat: true, e: 0.3 }),
      cap(win.x0 - 8 * s, win.y1 + 4 * s, win.x1 + 8 * s, win.y1 + 4 * s, 4 * s, { flat: true, e: 0.3 }),
    ];
    P.chest = { x: catX + 86 * s, y: topY - 40 * s };
    return P;
  }

  /** the first surface straight below (x, y): returns the y an object would rest on */
  function surfaceBelow(x, y) {
    let best = L.floorY;
    for (const c of L.cols) {
      if (!c.flat) continue;
      if (x < c.ax || x > c.bx) continue;
      const top = c.ay - c.r;
      if (top >= y - 2 && top < best) best = top;
    }
    return best;
  }
  const avoBottom = () => 25 * L.s;
  /** the ground under x: the floor, or the base of the cat tree */
  function groundAt(x) {
    const b = L.cols[6];
    return x > b.ax && x < b.bx ? b.ay - b.r : L.floorY;
  }
  function restOnFloorAt(x) {
    A.x = clamp(x, 34 * L.s, L.W - 34 * L.s);
    A.y = groundAt(A.x) - avoBottom();
    A.vx = A.vy = A.w = 0; A.ang = 0; A.sleeping = true;
  }

  // ── painting ──
  function buildSprites() {
    const { s } = L;
    const key = `${s.toFixed(4)}|${dpr}`;
    if (key === spKey && SP) return false;
    spKey = key;
    const dense = !mobile;
    SP = {
      body: makeSprite(-182, -122, 132, 26, s, dpr, (g) => paintBody(g, hit, dense)),
      head: makeSprite(-60, -50, 60, 50, s * HS, dpr, (g) => paintHead(g, hit, dense)),
      muzzle: makeSprite(-30, -18, 30, 36, s * HS, dpr, paintMuzzle),
      ear: makeSprite(-22, -32, 22, 10, s * HS, dpr, (g) => paintEar(g, hit)),
      plat: makeSprite(-108, -36, 108, 64, s, dpr, (g) => paintDisc(g, hit, 98, 25, 22, 110)),
      avo: makeSprite(-36, -60, 36, 32, s, dpr, paintAvocado),
    };
    // the front lip of the top platform, drawn over his belly so he sits in the plush
    SP.lip = makeSprite(-108, -36, 108, 64, s, dpr, (g) => {
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(SP.plat.c, 0, 0);
      g.restore();
      const top = new Path2D(); top.ellipse(0, 0, 98, 25, 0, 0, TAU);
      g.save(); g.clip(top);
      for (let x = -88; x <= 88; x += 4) stamp(g, x, 6.5, 6, [60, 50, 42], 0.09, 0.3);
      g.restore();
      // keep only what is in front of him: below a gentle curve across the cushion
      g.globalCompositeOperation = 'destination-in';
      const keep = new Path2D();
      keep.moveTo(-110, 6);
      for (let x = -110; x <= 110; x += 4) keep.lineTo(x, 4.5 + 2.2 * (1 - (x / 100) ** 2) + noise1(x * 0.15, 3) * 1.2);
      keep.lineTo(110, 70); keep.lineTo(-110, 70); keep.closePath();
      g.filter = `blur(${(0.7 * s * dpr).toFixed(2)}px)`;
      g.fillStyle = '#000';
      g.setTransform(s * dpr, 0, 0, s * dpr, 108 * s * dpr, 36 * s * dpr);
      g.fill(keep);
      g.filter = 'none';
    });
    // the seal: 禁, forbidden
    const sz = Math.round(54 * s * dpr);
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(sz * 1.2);
    sealStamp(c.getContext('2d'), c.width / 2, c.height / 2, sz / 0.62, '禁', { seed: 9, alpha: 0.94 });
    SP.seal = { c, size: c.width / dpr };
    return true;
  }

  function paintBg() {
    const g = bgC.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, bgC.width, bgC.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    signFont = brushReady();
    paintRoom(g, L, hit, SP);
  }
  // the sign's 출입금지 is in Nanum Brush Script: repaint the room once, when that font arrives
  let signFont = false;
  // (with the text: Google serves Korean fonts in unicode-range slices, and checking or loading
  // without it only covers the slice with a space in it)
  const SIGN_TEXT = '출입금지';
  const brushReady = () => { try { return !document.fonts || document.fonts.check('20px "Nanum Brush Script"', SIGN_TEXT); } catch { return true; } };

  function relayout(force = false) {
    const w = stage.clientWidth, h = stage.clientHeight, d = dprNow();
    if (!w || !h) return;
    if (!force && w === W && h === H && d === dpr) return;
    const old = L;
    W = w; H = h; dpr = d;
    for (const c of [bgC, fgC]) {
      c.width = Math.round(w * d);
      c.height = Math.round(h * d);
    }
    L = computeLayout(w, h);
    buildSprites();
    paintBg();
    grabEl.style.width = grabEl.style.height = `${Math.round(78 * L.s)}px`;
    grabEl.style.marginLeft = grabEl.style.marginTop = `${-Math.round(39 * L.s)}px`;
    // the avocado keeps its place in the room
    if (!old || A.sleeping) restOnFloorAt(old ? A.x * (w / old.W) : L.home.x);
    else { A.x *= w / old.W; A.y = Math.min(A.y * (h / old.H), L.floorY - avoBottom()); }
    if (A.place) { A.place = null; restOnFloorAt(L.home.x); }
    // never leave it shrunk or faded out by an interrupted animation
    if (!A.fade) A.alpha = 1;
    A.scale = 1;
    draw(now0());
    kick();
  }

  // ── the avocado: physics ──
  const avoMass = 1;
  const inertia = () => 0.42 * (26 * L.s) ** 2;

  function wake() { A.sleeping = false; A.restT = 0; }

  function stepAvocado(h, now) {
    const { s } = L;
    if (A.grab && RM) { A.ang = 0; A.w = 0; A.lastMove = now; return true; }
    if (A.grab) {
      const gx = A.grab.tx, gy = A.grab.ty;
      const nvx = (gx - A.x) * 22, nvy = (gy - A.y) * 22;
      A.vx = lerp(A.vx, nvx, 0.5); A.vy = lerp(A.vy, nvy, 0.5);
      A.x += A.vx * h; A.y += A.vy * h;
      A.x = clamp(A.x, 20 * s, L.W - 20 * s);
      A.y = clamp(A.y, 30 * s, L.floorY - avoBottom());
      const ta = clamp(A.vx / (1800 * s), -0.7, 0.7);
      A.w += ((ta - A.ang) * 120 - A.w * 14) * h;
      A.ang += A.w * h;
      A.lastMove = now;
      return true;
    }
    if (A.place || A.sleeping || RM) return false;
    A.vy += L.G * h;
    A.vx *= 1 - 0.05 * h;
    A.x += A.vx * h; A.y += A.vy * h; A.ang += A.w * h;
    A.grounded = false;
    const I = inertia();
    const ca = Math.cos(A.ang), sa = Math.sin(A.ang);
    let impact = 0, impN = 0;
    for (const sh of AVO_SHAPES) {
      const ox = (sh.x * ca - sh.y * sa) * s, oy = (sh.x * sa + sh.y * ca) * s;
      const rad = sh.r * s;
      const contact = (nx, ny, pen, e, mu, col) => {
        if (pen <= 0) return;
        A.x += nx * pen; A.y += ny * pen;
        const px = ox - nx * rad, py = oy - ny * rad;
        const vcx = A.vx - A.w * py, vcy = A.vy + A.w * px;
        const vn = vcx * nx + vcy * ny;
        if (ny < -0.55) A.grounded = true;
        if (col && col.cat) A.touchedCat = true;
        if (vn >= 0) return;
        const rn = px * ny - py * nx;
        const ee = vn < -90 * s ? e : 0;
        const j = (-(1 + ee) * vn) / (1 / avoMass + (rn * rn) / I);
        A.vx += (j * nx) / avoMass; A.vy += (j * ny) / avoMass; A.w += (rn * j) / I;
        const tx = -ny, ty = nx;
        const vt = (A.vx - A.w * py) * tx + (A.vy + A.w * px) * ty;
        const rt = px * ty - py * tx;
        let jt = -vt / (1 / avoMass + (rt * rt) / I);
        jt = clamp(jt, -mu * j, mu * j);
        A.vx += (jt * tx) / avoMass; A.vy += (jt * ty) / avoMass; A.w += (rt * jt) / I;
        if (-vn > impact) { impact = -vn; impN = Math.atan2(ny, nx); }
      };
      const cx = A.x + ox, cy = A.y + oy;
      contact(0, -1, cy + rad - L.floorY, 0.38, 0.6);
      contact(1, 0, rad - cx, 0.5, 0.4);
      contact(-1, 0, cx + rad - L.W, 0.5, 0.4);
      contact(0, 1, rad - cy, 0.4, 0.4);
      for (const c of L.cols) {
        const cx2 = A.x + ox, cy2 = A.y + oy;
        const dx = c.bx - c.ax, dy = c.by - c.ay, ll = dx * dx + dy * dy;
        const k = ll ? clamp(((cx2 - c.ax) * dx + (cy2 - c.ay) * dy) / ll) : 0;
        const qx = c.ax + dx * k, qy = c.ay + dy * k;
        let nx = cx2 - qx, ny = cy2 - qy;
        const d = Math.hypot(nx, ny);
        const pen = rad + c.r - d;
        if (pen <= 0) continue;
        if (d < 1e-4) { nx = 0; ny = -1; } else { nx /= d; ny /= d; }
        contact(nx, ny, pen, c.e, c.mu, c);
      }
    }
    if (impact > 160 * s) {
      A.sqv -= Math.min(10, impact / (170 * s));
      A.sqA = impN;
      if (A.fast && impact > 500 * s) { setFace('dizzy', 1500); }
      A.fast = false;
    }
    // back on its feet: a smug little rock upright
    const spd = Math.hypot(A.vx, A.vy);
    if (A.grounded) {
      A.w *= 1 - 2.2 * h;
      if (spd < 260 * s) A.w += (-wrapA(A.ang) * 34 - A.w * 3.5) * h;
      if (spd < 10 * s && Math.abs(A.w) < 0.12 && Math.abs(wrapA(A.ang)) < 0.03) {
        A.restT += h;
        if (A.restT > 0.3) { A.sleeping = true; A.vx = A.vy = A.w = 0; A.ang = 0; }
      } else A.restT = 0;
    } else A.restT = 0;
    if (spd > 30 * s) A.lastMove = now;
    if (spd > 900 * s) A.fast = true;
    // never lose it
    if (!(A.x > -50 && A.x < L.W + 50 && A.y > -200 && A.y < L.H + 50)) restOnFloorAt(L.home.x);
    return !A.sleeping;
  }

  function setFace(f, ms) { A.face = f; A.faceUntil = now0() + ms; }

  // ── bullying ──
  function bully() {
    count++;
    renderCount(true);
  }
  function poke(px, py) {
    const now = now0();
    const { s } = L;
    setFace('worried', 1700);
    A.worriedAt = now;
    play('pluck', 0, { gain: 0.24, pan: clamp((A.x / L.W) * 1.4 - 0.7, -0.7, 0.7) });
    fx.rings.push({ x: px ?? A.x, y: py ?? A.y - 6 * s, t0: now });
    if (!RM && !A.place) {
      wake();
      const side = px != null ? Math.sign(A.x - px) || (Math.random() < 0.5 ? -1 : 1) : (Math.random() < 0.5 ? -1 : 1);
      if (A.grounded || A.sleeping || Math.abs(A.vy) < 50 * s) A.vy = -240 * s;
      A.vx += side * 70 * s;
      A.w += side * (5 + Math.random() * 3);
    }
    A.sqv -= 7; A.sqA = -Math.PI / 2;
    bully();
    kick();
  }

  function inZone() {
    const { s } = L;
    const d = Math.hypot(A.x - L.chest.x, A.y - L.chest.y);
    if (d < 182 * s && A.y < L.topY + 44 * s && A.x > L.catX - 160 * s) return true;
    // sitting on his back, even up on the rump: that will not be tolerated either
    return A.grounded && !A.grab && A.y < L.topY - 70 * s && A.x > L.catX - 170 * s && A.x < L.catX + 130 * s;
  }
  function startSwat(now) {
    C.swat = { t0: now, hit: false, dur: RM ? 1100 : 600 };
    C.lastSwat = now;
    wake();
  }
  function handleIt() {
    if (!L || C.swat || A.place) return;
    const now = now0();
    if (A.grab) endGrab(null);
    A.place = { t0: now, from: [A.x, A.y], landed: false };
    A.touchedCat = false;
    kick();
  }

  function pawPos(k) {
    // in cat units; the target follows the avocado until the strike lands, then stays put
    // (otherwise the paw would chase it across the room like a rubber arm)
    const { s } = L;
    if (!C.swat.tgt || !C.swat.hit) C.swat.tgt = [(A.x - L.catX) / s, (A.y - 14 * s - L.topY) / s];
    const [ax, ay] = C.swat.tgt;
    const S = SHOULDER;
    let dx = ax - S[0], dy = ay - S[1];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const reach = clamp(d - 22, 30, 160);
    const T = [S[0] + dx * reach, S[1] + dy * reach];
    const cock = [S[0] + 44, S[1] - 34];
    const thru = [T[0] + dx * 12, T[1] + dy * 12];
    if (RM) return { p: k < 0.85 ? T : PAW_REST, beans: false };
    if (k < 0.36) return { p: lerpP(PAW_REST, cock, easeOut(k / 0.36)), beans: true };
    if (k < 0.48) return { p: lerpP(cock, T, easeIn((k - 0.36) / 0.12)), beans: false };
    if (k < 0.6) return { p: lerpP(T, thru, easeOut((k - 0.48) / 0.12)), beans: false };
    return { p: lerpP(thru, PAW_REST, easeInOut((k - 0.6) / 0.4)), beans: false };
  }
  const lerpP = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];

  function swatHit(now) {
    const { s } = L;
    const side = A.x >= L.catX + 20 * s ? 1 : -1;
    fx.seals.push({ x: A.x, y: A.y - 12 * s, t0: now, rot: (Math.random() - 0.5) * 0.3 });
    play('pluck', 1, { gain: 0.26, pan: clamp((A.x / L.W) * 1.4 - 0.7, -0.7, 0.7) });
    play('pluck', 6, { gain: 0.08 });
    A.place = null;
    A.touchedCat = false;
    bully();
    C.satisfiedAt = now + (RM ? 1100 : 650);
    if (RM) {
      // no flight: it fades out of his reach and comes back on the floor
      fadeAvo(() => restOnFloorAt(side > 0 ? Math.max(L.home.x, L.catX + 230 * s) : 60 * s), 260, 420);
      setFace('dizzy', 1600);
      return;
    }
    wake();
    A.vx = side * (820 + Math.random() * 300) * s;
    A.vy = -(520 + Math.random() * 240) * s;
    A.w = side * (11 + Math.random() * 7);
    A.sqv -= 8; A.sqA = Math.PI;
    A.fast = true;
    setFace('squeeze', 900);
  }

  function fadeAvo(mid, outMs, delayIn) {
    const t0 = now0();
    A.fade = { t0, outMs, delayIn, mid, midDone: false };
  }

  // ── grabbing ──
  function local(e) {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  function onAvocado(x, y, pad) {
    if (!L || A.alpha < 0.5) return false;
    const { s } = L;
    const ca = Math.cos(-A.ang), sa = Math.sin(-A.ang);
    const dx = x - A.x, dy = y - A.y;
    const lx = (dx * ca - dy * sa) / s, ly = (dx * sa + dy * ca) / s;
    return AVO_SHAPES.some((sh) => Math.hypot(lx - sh.x, ly - sh.y) < sh.r + pad / s);
  }
  function onCat(x, y) {
    if (!L) return false;
    const { s } = L;
    const cx = (x - L.catX) / s, cy = (y - L.topY) / s;
    if (Math.hypot(cx - HEAD_C[0], cy - HEAD_C[1]) < 60) return true;
    if (cx > -150 && cx < 118 && cy > -110 && cy < 14) {
      const k = clamp((cx + 104) / 168), py = lerp(-52, -50, k), px = lerp(-104, 64, k);
      return Math.hypot(cx - px, cy - py) < 58 || (cy > -92 && cx > -138 && cx < 116);
    }
    return false;
  }

  function startGrab(e, x, y) {
    const now = now0();
    A.grab = { id: e.pointerId, ox: A.x - x, oy: A.y - y, tx: A.x, ty: A.y, x0: x, y0: y, t0: now, moved: 0, samples: [[x, y, now]] };
    A.place = null;
    A.scale = 1;
    if (!A.fade) A.alpha = 1;
    wake();
    setFace('squeeze', 1e9);
    stage.classList.add('is-grabbing');
    try { stage.setPointerCapture(e.pointerId); } catch { /* fine */ }
    kick();
  }
  function moveGrab(x, y) {
    const g = A.grab, now = now0();
    g.moved += Math.hypot(x - g.samples[g.samples.length - 1][0], y - g.samples[g.samples.length - 1][1]);
    g.samples.push([x, y, now]);
    while (g.samples.length > 2 && now - g.samples[0][2] > 90) g.samples.shift();
    g.tx = x + g.ox; g.ty = y + g.oy;
    if (RM) { A.x = clamp(g.tx, 20 * L.s, L.W - 20 * L.s); A.y = clamp(g.ty, 30 * L.s, L.floorY - avoBottom()); }
    kick();
  }
  function endGrab(e) {
    const g = A.grab;
    if (!g) return;
    A.grab = null;
    stage.classList.remove('is-grabbing');
    const now = now0();
    const { s } = L;
    const quick = g.moved < 8 && now - g.t0 < 400;
    if (quick && e) { A.vx = A.vy = 0; A.w *= 0.3; setFace('smug', 0); poke(...local(e)); return; }
    // velocity from the last few samples
    const a = g.samples[0], b = g.samples[g.samples.length - 1];
    const dt = Math.max(16, b[2] - a[2]) / 1000;
    let vx = (b[0] - a[0]) / dt, vy = (b[1] - a[1]) / dt;
    if (now - b[2] > 120) { vx = 0; vy = 0; }
    const sp = Math.hypot(vx, vy), max = 2600 * s;
    if (sp > max) { vx *= max / sp; vy *= max / sp; }
    if (RM) {
      setFace('worried', 1200);
      if (inZone()) { startSwat(now); kick(); return; }
      const x = A.x;
      fadeAvo(() => { A.x = x; A.y = surfaceBelow(x, A.y + 20 * s) - avoBottom(); A.ang = 0; A.sleeping = true; }, 160, 200);
      if (sp > 450 * s) bully();
      kick();
      return;
    }
    A.vx = vx; A.vy = vy;
    A.w += clamp(vx / (32 * s), -14, 14) * 0.5 + (Math.random() - 0.5) * 4;
    A.fast = sp > 700 * s;
    setFace(sp > 450 * s ? 'squeeze' : 'worried', sp > 450 * s ? 700 : 1200);
    wake();
    if (sp > 450 * s) bully();
    kick();
  }

  // ── petting and talking ──
  function petNow(now, ms = 900) {
    C.petUntil = Math.max(C.petUntil, now + ms);
    if (now - lastPurr > 1700) {
      lastPurr = now;
      play('purr', { gain: 0.24, seconds: 1.9 });
    }
    kick();
  }
  function meow(now) {
    if (now - C.meowAt < 450) return;
    C.meowAt = now;
    fx.meows.push({ t0: now, side: Math.random() < 0.5 ? -1 : 1 });
    play('meow', { gain: 0.16 });
    kick();
  }

  // ── pointer events ──
  stage.addEventListener('pointerdown', (e) => {
    if (!L || (e.button !== undefined && e.button > 0)) return;
    const [x, y] = local(e);
    pointer.x = x; pointer.y = y; pointer.t = now0();
    const pad = e.pointerType === 'touch' ? 14 : 6;
    if (e.target === grabEl || onAvocado(x, y, pad)) {
      e.preventDefault();
      startGrab(e, x, y);
      return;
    }
    if (onCat(x, y)) tapCat = { id: e.pointerId, x, y, t0: now0(), moved: 0 };
  }, opt);
  stage.addEventListener('pointermove', (e) => {
    if (!L) return;
    const [x, y] = local(e);
    const now = now0();
    if (A.grab && e.pointerId === A.grab.id) { moveGrab(x, y); return; }
    if (e.pointerType === 'mouse' || e.buttons) { pointer.x = x; pointer.y = y; pointer.t = now; }
    if (tapCat && tapCat.id === e.pointerId) tapCat.moved += Math.hypot(x - tapCat.x, y - tapCat.y), tapCat.x = x, tapCat.y = y;
    const overCat = onCat(x, y);
    if (e.pointerType === 'mouse') stage.style.cursor = onAvocado(x, y, 6) ? 'grab' : overCat ? 'pointer' : '';
    // stroking him: back and forth over his fur
    if (overCat && (e.pointerType === 'mouse' || e.buttons)) {
      if (now - pet.t > 650) { pet.dist = 0; pet.flips = 0; pet.lastX = x; pet.dir = 0; }
      const dx = x - (pet.lastX ?? x);
      pet.dist += Math.abs(dx) + Math.abs(e.movementY || 0) * 0.3;
      const dir = Math.abs(dx) > 1.5 ? Math.sign(dx) : 0;
      if (dir && pet.dir && dir !== pet.dir) pet.flips++;
      if (dir) pet.dir = dir;
      pet.lastX = x; pet.t = now;
      if (pet.dist > 70 && (pet.flips >= 1 || pet.dist > 170)) petNow(now);
    }
    kick();
  }, opt);
  const up = (e) => {
    if (A.grab && e.pointerId === A.grab.id) endGrab(e.type === 'pointerup' ? e : null);
    if (tapCat && tapCat.id === e.pointerId) {
      if (e.type === 'pointerup' && tapCat.moved < 10 && now0() - tapCat.t0 < 450) meow(now0());
      tapCat = null;
    }
  };
  stage.addEventListener('pointerup', up, opt);
  stage.addEventListener('pointercancel', up, opt);
  stage.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') pointer.t = -1e9; }, opt);
  grabEl.addEventListener('contextmenu', (e) => e.preventDefault(), opt);

  btnPoke.addEventListener('click', () => {
    if (!L) return;
    if (A.grab) return;
    poke(null, null);
  }, opt);
  btnSwat.addEventListener('click', () => handleIt(), opt);
  btnPet.addEventListener('click', () => {
    if (!L) return;
    const now = now0();
    petNow(now, 2400);
    if (!RM) fx.strokes.push({ t0: now });
  }, opt);

  // ── the loop ──
  function update(dt, now) {
    const { s } = L;
    let hot = false;
    // avocado
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let i = 0; i < n; i++) if (stepAvocado(h, now)) hot = true;
    // squash spring
    if (Math.abs(A.sq) > 0.002 || Math.abs(A.sqv) > 0.01) {
      if (RM) { A.sq = 0; A.sqv = 0; } else {
        for (let i = 0; i < n; i++) { A.sqv += (-460 * A.sq - 16 * A.sqv) * h; A.sq += A.sqv * h; }
        A.sq = clamp(A.sq, -0.38, 0.3);
        hot = true;
      }
    }
    if (A.face !== 'smug' && now > A.faceUntil && !A.grab) A.face = 'smug';
    // fades (reduced motion, and the swat there)
    if (A.fade) {
      const e = now - A.fade.t0, f = A.fade;
      if (e < f.outMs) A.alpha = 1 - e / f.outMs;
      else {
        if (!f.midDone) { f.midDone = true; f.mid && f.mid(); }
        A.alpha = clamp((e - f.outMs - f.delayIn * 0.3) / (f.delayIn * 0.7));
        if (e > f.outMs + f.delayIn) { A.alpha = 1; A.fade = null; }
      }
      hot = true;
    }
    // "let him handle it": up onto the platform, a smug moment, then the paw
    if (A.place) {
      const p = A.place, e = now - p.t0;
      const px = L.catX + 52 * s, py = L.topY + 18 * s - avoBottom();
      if (RM) {
        if (e < 180) A.alpha = 1 - e / 180;
        else { A.x = px; A.y = py; A.ang = 0; A.alpha = clamp((e - 180) / 200); }
        if (e > 900 && !C.swat) startSwat(now);
      } else {
        if (e < 170) A.scale = 1 - easeIn(e / 170);
        else if (e < 470) {
          const k = (e - 170) / 300;
          A.x = px; A.y = py - 80 * s * (1 - k * k); A.ang = 0; A.w = 0;
          A.scale = Math.min(1, easeBack(clamp(k * 1.8)));
        } else {
          if (!p.landed) { p.landed = true; A.y = py; A.scale = 1; A.sqv -= 6; A.sqA = -Math.PI / 2; setFace('smug', 0); }
          if (e > 900 && !C.swat) startSwat(now);
        }
      }
      A.vx = A.vy = 0;
      A.sleeping = true;
      hot = true;
    }
    // the swat
    if (!C.swat && !A.grab && !A.place && !A.fade && now - C.lastSwat > 500 && inZone()) {
      const slow = Math.hypot(A.vx, A.vy) < 720 * s;
      if (slow || A.touchedCat) startSwat(now);
    }
    if (!inZone()) A.touchedCat = false;
    if (C.swat) {
      const k = (now - C.swat.t0) / C.swat.dur;
      if (!C.swat.hit && k >= (RM ? 0.25 : 0.48)) {
        C.swat.hit = true;
        if (inZone() || A.place) swatHit(now);
      }
      if (k >= 1) C.swat = null;
      hot = true;
    }

    // the cat
    const tgtAvo = A.alpha > 0.4 && (A.grab || A.place || C.swat || now - A.lastMove < 1400);
    let tx, ty;
    if (tgtAvo) { tx = A.x; ty = A.y - 10 * s; }
    else if (!RM && now - pointer.t < 2600) { tx = pointer.x; ty = pointer.y; }
    else {
      // idle: mostly out of the window, sometimes at you, sometimes a glare at the avocado
      const phase = Math.floor(now / 5200), mode = RM ? 1 : [0, 1, 0, 2, 1, 0][phase % 6];
      if (mode === 0) { tx = L.catX + 380 * s + Math.sin(now / 4100) * 60 * s; ty = L.topY - 150 * s + Math.sin(now / 2900) * 30 * s; }
      else if (mode === 1) { tx = L.catX + HEAD_C[0] * s + 10 * s; ty = L.topY + 40 * s; }
      else { tx = A.x; ty = A.y; }
    }
    const hx = L.catX + HEAD_C[0] * s, hy = L.topY + HEAD_C[1] * s;
    const yawT = Math.tanh((tx - hx) / (200 * s)), pitchT = clamp(Math.tanh((ty - hy) / (170 * s)), -0.8, 1);
    if (RM) { C.yaw = yawT; C.pitch = pitchT; } else {
      const kk = 1 - Math.exp(-dt * (tgtAvo ? 11 : 5));
      C.yaw += (yawT - C.yaw) * kk; C.pitch += (pitchT - C.pitch) * kk;
    }
    C.tilt = C.yaw * 0.07 - C.pitch * 0.04 + (RM ? 0 : Math.sin(now / 3700) * 0.03) + C.happy * 0.1;
    const near = Math.hypot(A.x - hx, A.y - hy) < 240 * s;
    const flatT = (C.swat || (near && (A.grab || A.place || now - A.lastMove < 600))) ? 1 : 0;
    const agitT = (C.swat || A.grab || A.place || now - A.lastMove < 900) ? 1 : 0;
    const dilT = tgtAvo ? 1 : now - pointer.t < 2600 ? 0.62 : 0.4;
    const happyT = now < C.petUntil ? 1 : 0;
    const ease = (v, tg, up, dn) => v + (tg - v) * (1 - Math.exp(-dt * (tg > v ? up : dn)));
    C.flat = RM ? flatT : ease(C.flat, flatT, 9, 2.5);
    C.agit = RM ? 0 : ease(C.agit, agitT, 4, 0.8);
    C.dil = RM ? dilT : ease(C.dil, dilT, 6, 1.5);
    C.happy = RM ? happyT : ease(C.happy, happyT, 7, 2.2);
    if (!RM) {
      C.bph += dt * TAU / (C.happy > 0.5 ? 2.6 : 3.4);
      C.breath = (Math.sin(C.bph) * 0.5 + 0.5);
      C.tailPh += dt * (1.05 + C.agit * 3.2);
      C.curlPh += dt * 0.55;
      // blinks: quick ones, and slow ones (a cat's "I love you")
      if (!C.blink && now > C.blinkAt) C.blink = { t0: now, slow: Math.random() < 0.4 };
      if (now - C.satisfiedAt > 0 && now - C.satisfiedAt < 40 && !C.blink) C.blink = { t0: now, slow: true };
      if (C.blink) {
        const d = C.blink.slow ? [300, 420, 380] : [80, 50, 110];
        const e = now - C.blink.t0;
        C.lid = e < d[0] ? easeInOut(e / d[0]) : e < d[0] + d[1] ? 1 : 1 - easeInOut((e - d[0] - d[1]) / d[2]);
        if (e > d[0] + d[1] + d[2]) { C.blink = null; C.lid = 0; C.blinkAt = now + 2200 + Math.random() * 4200; }
      }
      // ear twitches
      if (!C.tw && now > C.twAt) C.tw = { t0: now, ear: Math.random() < 0.5 ? 'L' : 'R', n: Math.random() < 0.35 ? 2 : 1 };
      C.earL = C.earR = 0;
      if (C.tw) {
        const e = (now - C.tw.t0) / 170;
        const v = e < C.tw.n ? Math.sin(Math.PI * (e % 1)) * 0.42 : 0;
        if (C.tw.ear === 'L') C.earL = -v; else C.earR = v;
        if (e >= C.tw.n) { C.tw = null; C.twAt = now + 2600 + Math.random() * 5200; }
      }
      // the pom-pom sways
      const dWind = Math.sin(now / 1300) * 0.08 + Math.sin(now / 517) * 0.03;
      pom.w += (-(L.G / L.pom.len) * Math.sin(pom.a - dWind * 0.3) * 0.25 - pom.w * 0.9) * dt;
      pom.a += pom.w * dt;
      const bx = L.pom.x + Math.sin(pom.a) * L.pom.len, by = L.pom.y + Math.cos(pom.a) * L.pom.len;
      if (Math.hypot(A.x - bx, A.y - by) < L.pom.r + 30 * s && now - pom.hitT > 300 && Math.hypot(A.vx, A.vy) > 80 * s) {
        pom.hitT = now; pom.w += clamp(A.vx / L.pom.len, -6, 6);
      }
      // purr marks while he is being stroked
      if (C.petUntil > now && now - pet.spawnT > 320) {
        pet.spawnT = now;
        fx.purrs.push({ t0: now, x: -100 + Math.random() * 140, y: -112 - Math.random() * 10, seed: Math.random() * 100 });
      }
    } else {
      C.breath = 0; C.lid = 0;
      if (C.petUntil > now && fx.purrs.length < 3) fx.purrs.push({ t0: now, x: -90 + fx.purrs.length * 55, y: -120 - (fx.purrs.length % 2) * 14, seed: fx.purrs.length * 7 });
    }
    // effects
    const life = (arr, ms) => { for (let i = arr.length - 1; i >= 0; i--) if (now - arr[i].t0 > ms) arr.splice(i, 1); return arr.length > 0; };
    if (life(fx.purrs, 1500)) hot = true;
    if (life(fx.meows, 1300)) hot = true;
    if (life(fx.seals, 1600)) hot = true;
    if (life(fx.rings, 500)) hot = true;
    if (life(fx.strokes, 2300)) hot = true;
    if (C.happy > 0.01 || C.petUntil > now || now - A.worriedAt < 1800 || A.face !== 'smug') hot = true;
    if (A.grab) hot = true;
    return hot;
  }

  // ── drawing ──
  function draw(now) {
    if (!L || !SP) return;
    const g = fgC.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, fgC.width, fgC.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { s } = L;
    drawAvoShadow(g);
    drawPom(g);
    g.save();
    g.translate(L.catX, L.topY);
    g.scale(s, s);
    drawTail(g, now);
    // breathing: the loaf rises and falls from the platform
    const br = C.breath * 0.016;
    g.save();
    g.translate(0, 12); g.scale(1 + br * 0.2, 1 + br); g.translate(0, -12);
    blit(g, SP.body);
    g.restore();
    blit(g, SP.lip);
    drawPaw(g, 60, 10, 0.92, -0.06);
    const sw = C.swat ? pawPos((now - C.swat.t0) / C.swat.dur) : null;
    if (!sw) drawPaw(g, PAW_REST[0], PAW_REST[1], 1, 0.06);
    drawHead(g, now, br);
    drawStrokes(g, now);
    drawPurrs(g, now);
    drawMeows(g, now);
    g.restore();
    drawRings(g, now);
    drawAvocado(g, now);
    // the paw lands on top of the avocado, and the seal is pressed over where it sat
    if (sw) {
      g.save();
      g.translate(L.catX, L.topY);
      g.scale(s, s);
      drawLeg(g, SHOULDER, sw.p, sw.beans);
      g.restore();
    }
    drawSeals(g, now);
    // the grab handle follows the avocado
    grabEl.style.transform = `translate(${A.x.toFixed(1)}px, ${(A.y - 14 * s).toFixed(1)}px)`;
    grabEl.style.visibility = A.alpha > 0.5 ? 'visible' : 'hidden';
    lastDraw = now;
  }

  function drawPom(g) {
    const { s } = L;
    const { x, y, len, r } = L.pom;
    const bx = x + Math.sin(pom.a) * len, by = y + Math.cos(pom.a) * len;
    g.strokeStyle = 'rgba(180,166,140,.9)';
    g.lineWidth = 1.1 * s;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + bx) / 2 + pom.w * 2 * s, (y + by) / 2, bx, by - r * 0.6); g.stroke();
    // fluffy ball
    stamp(g, bx, by + r * 0.15, r * 1.35, CREAM_D, 0.3, 0.45);
    const gr = g.createRadialGradient(bx - r * 0.35, by - r * 0.4, r * 0.1, bx, by, r);
    gr.addColorStop(0, 'rgb(255,253,246)'); gr.addColorStop(0.7, rgba(CREAM, 1)); gr.addColorStop(1, rgba(CREAM_S, 1));
    g.fillStyle = gr;
    g.beginPath(); g.arc(bx, by, r * 0.92, 0, TAU); g.fill();
    const R = rng(77);
    g.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const a = R() * TAU, r0 = r * (0.6 + R() * 0.3), r1 = r * (0.95 + R() * 0.22);
      const lower = Math.sin(a) > 0.2;
      g.strokeStyle = lower && R() < 0.6 ? rgba(CREAM_INK, 0.3) : 'rgba(255,252,244,.85)';
      g.lineWidth = 0.8 * s;
      g.beginPath(); g.moveTo(bx + Math.cos(a) * r0, by + Math.sin(a) * r0); g.lineTo(bx + Math.cos(a + 0.12) * r1, by + Math.sin(a + 0.12) * r1); g.stroke();
    }
  }

  function tailPoints() {
    const N = 13, seg = 11.2;
    let x = -126, y = 10;
    const pts = [[x, y]];
    const amp = RM ? 0 : 0.14 + 0.36 * C.agit;
    const curl = RM ? 0.7 : 0.55 + 0.45 * Math.sin(C.curlPh) + C.happy * 0.5;
    for (let i = 0; i < N; i++) {
      const u = (i + 1) / N;
      let a = Math.PI / 2 + 0.55 * (1 - smooth(0, 0.3, u));
      a += amp * Math.sin(C.tailPh - u * 2.4) * smooth(0.12, 1, u);
      a -= curl * smooth(0.62, 1, u) * 1.5;
      x += Math.cos(a) * seg; y += Math.sin(a) * seg;
      pts.push([x, y]);
    }
    return pts;
  }
  const TAIL_R = (() => { const R = rng(91); return Array.from({ length: 600 }, () => R()); })();
  function drawTail(g) {
    const P = tailPoints();
    const n = P.length;
    const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const u = i / (n - 1);
      const w = lerp(14, 8, u) * (u > 0.9 ? Math.sqrt(Math.max(0, 1 - (u - 0.9) / 0.12)) * 0.6 + 0.4 : 1);
      left.push([P[i][0] + nx * w, P[i][1] + ny * w]);
      right.push([P[i][0] - nx * w, P[i][1] - ny * w]);
    }
    const tip = P[n - 1], pre = P[n - 2];
    const tdx = tip[0] - pre[0], tdy = tip[1] - pre[1], tl = Math.hypot(tdx, tdy) || 1;
    g.beginPath();
    left.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.quadraticCurveTo(tip[0] + (tdx / tl) * 9, tip[1] + (tdy / tl) * 9, right[n - 1][0], right[n - 1][1]);
    for (let i = n - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
    g.closePath();
    const gr = g.createLinearGradient(-150, 0, -110, 0);
    gr.addColorStop(0, rgba(FUR_LOW, 1)); gr.addColorStop(1, rgba(FUR_MID, 1));
    g.fillStyle = gr;
    g.fill();
    g.lineCap = 'round'; g.lineJoin = 'round';
    // sheen on the window side, ink on the shadow side
    g.beginPath();
    for (let i = 1; i < n - 1; i++) {
      const x = lerp(P[i][0], right[i][0], 0.45), y = lerp(P[i][1], right[i][1], 0.45);
      i === 1 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.strokeStyle = rgba(FUR_SHEEN, 0.1); g.lineWidth = 7; g.stroke();
    g.strokeStyle = rgba(FUR_SHEEN, 0.1); g.lineWidth = 3; g.stroke();
    g.beginPath();
    left.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.strokeStyle = rgba(FUR_DARK, 0.7); g.lineWidth = 1.6; g.stroke();
    // short plush hairs along the tail, silver toward the light
    g.lineWidth = 0.7;
    for (let i = 1; i < n; i++) {
      const dx = P[i][0] - P[i - 1][0], dy = P[i][1] - P[i - 1][1], l = Math.hypot(dx, dy) || 1;
      const ux = dx / l, uy = dy / l;
      for (let k = 0; k < 7; k++) {
        const r1 = TAIL_R[(200 + i * 21 + k * 3) % 600], r2 = TAIL_R[(201 + i * 21 + k * 3) % 600], r3 = TAIL_R[(202 + i * 21 + k * 3) % 600];
        const across = r1 * 1.7 - 0.85; // -: shadow side, +: window side
        const bx = lerp(P[i - 1][0], P[i][0], r2), by = lerp(P[i - 1][1], P[i][1], r2);
        const w = Math.hypot(left[i][0] - P[i][0], left[i][1] - P[i][1]);
        const x0 = bx + (right[i][0] - P[i][0]) / (w || 1) * w * across, y0 = by + (right[i][1] - P[i][1]) / (w || 1) * w * across;
        const L2 = 3 + r3 * 3.5;
        g.strokeStyle = across > 0.15 && r3 < 0.6 ? rgba(FUR_SHEEN, 0.16) : rgba(FUR_DARK, 0.28);
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + ux * L2 + (r2 - 0.5), y0 + uy * L2); g.stroke();
      }
    }
    // fuzz
    for (let i = 1; i < n; i++) {
      const dx = P[i][0] - P[i - 1][0], dy = P[i][1] - P[i - 1][1], l = Math.hypot(dx, dy) || 1;
      for (let k = 0; k < 4; k++) {
        const r = TAIL_R[(i * 4 + k) % 200], side = k % 2 ? left : right;
        const sx = side[i][0], sy = side[i][1];
        const ox = side[i][0] - P[i][0], oy = side[i][1] - P[i][1], ol = Math.hypot(ox, oy) || 1;
        const L2 = 1.5 + r * 2.5;
        g.strokeStyle = k < 2 ? rgba(FUR_LOW, 0.6) : rgba(FUR_SHEEN, 0.2);
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(sx - (ox / ol) * 1.5, sy - (oy / ol) * 1.5);
        g.lineTo(sx + (ox / ol) * L2 * 0.6 + (dx / l) * L2, sy + (oy / ol) * L2 * 0.6 + (dy / l) * L2);
        g.stroke();
      }
    }
  }

  function drawPaw(g, x, y, k, rot) {
    g.save();
    g.translate(x, y); g.rotate(rot); g.scale(k, k);
    const gr = g.createLinearGradient(0, -7, 0, 8);
    gr.addColorStop(0, rgba(mix(FUR_TOP, FUR_SHEEN, 0.3), 1)); gr.addColorStop(0.55, rgba(FUR_MID, 1)); gr.addColorStop(1, rgba(FUR_LOW, 1));
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(-12, 2);
    g.bezierCurveTo(-12, -7, -4, -8.5, 1, -8.5);
    g.bezierCurveTo(8, -8.5, 13, -5, 13, 1);
    g.bezierCurveTo(13, 6, 9, 7.5, 0, 7.5);
    g.bezierCurveTo(-8, 7.5, -12, 6, -12, 2);
    g.fill();
    // toes: little dents along the front
    g.strokeStyle = rgba(FUR_DARK, 0.8); g.lineWidth = 1; g.lineCap = 'round';
    for (const tx of [-4.5, 0.5, 5.5]) { g.beginPath(); g.moveTo(tx, 3.6); g.quadraticCurveTo(tx + 0.3, 5.6, tx + 0.2, 7.2); g.stroke(); }
    g.strokeStyle = rgba(FUR_DARK, 0.6); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-11.5, 3); g.bezierCurveTo(-10, 7, -4, 7.8, 0, 7.6); g.bezierCurveTo(7, 7.6, 12, 6, 12.6, 2); g.stroke();
    g.strokeStyle = rgba(FUR_SHEEN, 0.45); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-8, -3); g.quadraticCurveTo(0, -6.5, 8, -3.5); g.stroke();
    // chest fur falling over the top of the paw
    const R = rng(Math.round(x * 7));
    for (let i = 0; i < 16; i++) {
      const px = -11 + i * 1.5 + R(), py = -8.5 - R() * 2, L2 = 2.5 + R() * 3.5;
      g.strokeStyle = rgba(R() < 0.7 ? FUR_LOW : FUR_MID, 0.75);
      g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(px, py); g.lineTo(px - 0.6 + R() * 1.2, py + L2); g.stroke();
    }
    g.restore();
  }

  function drawLeg(g, S, P, beans) {
    const dx = P[0] - S[0], dy = P[1] - S[1], d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
    const w0 = 13, w1 = 9.5;
    const mx = (S[0] + P[0]) / 2, my = (S[1] + P[1]) / 2;
    g.beginPath();
    g.moveTo(S[0] + nx * w0, S[1] + ny * w0);
    g.quadraticCurveTo(mx + nx * (w0 + w1) * 0.55, my + ny * (w0 + w1) * 0.55, P[0] + nx * w1, P[1] + ny * w1);
    g.lineTo(P[0] - nx * w1, P[1] - ny * w1);
    g.quadraticCurveTo(mx - nx * (w0 + w1) * 0.55, my - ny * (w0 + w1) * 0.55, S[0] - nx * w0, S[1] - ny * w0);
    g.closePath();
    const gr = g.createLinearGradient(S[0] + nx * w0, S[1] + ny * w0, S[0] - nx * w0, S[1] - ny * w0);
    gr.addColorStop(0, rgba(FUR_MID, 1)); gr.addColorStop(1, rgba(FUR_LOW, 1));
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = rgba(FUR_DARK, 0.7); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(S[0] + nx * w0, S[1] + ny * w0); g.quadraticCurveTo(mx + nx * (w0 + w1) * 0.55, my + ny * (w0 + w1) * 0.55, P[0] + nx * w1, P[1] + ny * w1); g.stroke();
    g.strokeStyle = rgba(FUR_SHEEN, 0.3); g.lineWidth = 2;
    g.beginPath(); g.moveTo(S[0] - nx * w0 * 0.4, S[1] - ny * w0 * 0.4); g.lineTo(P[0] - nx * w1 * 0.4, P[1] - ny * w1 * 0.4); g.stroke();
    g.save();
    g.translate(P[0], P[1]);
    g.rotate(Math.atan2(uy, ux));
    g.fillStyle = rgba(FUR_MID, 1);
    g.beginPath(); g.ellipse(3, 0, 12.5, 10.5, 0, 0, TAU); g.fill();
    g.strokeStyle = rgba(FUR_DARK, 0.8); g.lineWidth = 1.3;
    g.beginPath(); g.ellipse(3, 0, 12.5, 10.5, 0, -1.3, 1.3); g.stroke();
    if (beans) {
      // toe beans!
      g.fillStyle = rgba(BEAN, 0.95);
      g.beginPath(); g.ellipse(1, 0, 4.2, 5, 0, 0, TAU); g.fill();
      for (const [bx, by] of [[8.5, -6], [11, -1.6], [11, 2.8], [8.5, 6.8]]) { g.beginPath(); g.arc(bx, by, 1.9, 0, TAU); g.fill(); }
    } else {
      g.lineWidth = 1;
      for (const ty of [-4, 0, 4]) { g.beginPath(); g.moveTo(11, ty); g.lineTo(15, ty * 1.1); g.stroke(); }
    }
    g.restore();
  }

  function drawHead(g, now, br) {
    const yaw = C.yaw, pitch = C.pitch;
    const hx = HEAD_C[0] + yaw * 4, hy = HEAD_C[1] + pitch * 3 - br * 110;
    g.save();
    g.translate(hx, hy);
    g.rotate(C.tilt);
    g.scale(HS, HS);
    // ears, behind the skull
    const flat = C.flat;
    const earL = -0.4 - flat * 0.55 + C.earL - C.happy * 0.12;
    const earR = 0.4 + flat * 0.55 + C.earR + C.happy * 0.12;
    drawEar(g, -24 - yaw * 5, -27 + flat * 3, earL, 1 - 0.28 * Math.max(0, -yaw), -1);
    drawEar(g, 24 - yaw * 5, -28 + flat * 3, earR, 1 - 0.28 * Math.max(0, yaw), 1);
    blit(g, SP.head);
    const fx0 = yaw * 13, fy0 = pitch * 7;
    blit(g, SP.muzzle, fx0, fy0);
    // eyes
    const meowK = clamp(1 - (now - C.meowAt) / 600);
    const lid = Math.max(C.lid, C.happy > 0.5 ? 1 : 0);
    for (const side of [-1, 1]) {
      const fore = 1 - 0.3 * Math.max(0, side * yaw);
      const ex = fx0 + side * (17 - 3.5 * Math.max(0, side * yaw)) - side * 1.5 * Math.max(0, -side * yaw);
      const ey = fy0 - 3;
      drawEye(g, ex, ey, side, fore, lid, C.happy > 0.5);
    }
    // nose and mouth
    const nx = fx0 + yaw * 2, ny = fy0 + 11;
    g.fillStyle = rgba([58, 52, 62], 1);
    g.beginPath();
    g.moveTo(nx - 4, ny - 2); g.quadraticCurveTo(nx, ny - 3.6, nx + 4, ny - 2);
    g.quadraticCurveTo(nx + 3.4, ny + 0.4, nx + 0.7, ny + 2.6); g.quadraticCurveTo(nx, ny + 3.2, nx - 0.7, ny + 2.6);
    g.quadraticCurveTo(nx - 3.4, ny + 0.4, nx - 4, ny - 2);
    g.fill();
    g.fillStyle = 'rgba(170,170,184,.5)';
    g.beginPath(); g.ellipse(nx - 1.2, ny - 1.6, 1.4, 0.7, 0, 0, TAU); g.fill();
    g.strokeStyle = rgba(FUR_DARK, 0.95); g.lineWidth = 1.15; g.lineCap = 'round';
    if (meowK > 0) {
      const o = Math.sin(Math.PI * clamp((now - C.meowAt) / 600)) ;
      g.fillStyle = rgba([54, 26, 32], 1);
      g.beginPath(); g.ellipse(nx, ny + 7.5, 3.6, 1.5 + 3 * o, 0, 0, TAU); g.fill();
      g.fillStyle = rgba([196, 120, 128], 1);
      g.beginPath(); g.ellipse(nx, ny + 8.5 + 1.6 * o, 2.2, 1.2 * o, 0, 0, TAU); g.fill();
    } else {
      g.beginPath();
      g.moveTo(nx, ny + 2.6); g.lineTo(nx, ny + 5);
      g.moveTo(nx, ny + 5); g.quadraticCurveTo(nx - 2.4, ny + 8.4, nx - 5.4, ny + 6.2);
      g.moveTo(nx, ny + 5); g.quadraticCurveTo(nx + 2.4, ny + 8.4, nx + 5.4, ny + 6.2);
      g.stroke();
    }
    // whiskers
    g.lineWidth = 0.55;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const sx = nx + side * 9, sy = ny + 4 + i * 1.8;
        const a = (i - 1) * 0.16 + 0.06, L2 = 30 - i * 3 + (side * yaw > 0 ? -6 : 3);
        const ex = sx + side * Math.cos(a) * L2, ey = sy + Math.sin(a) * L2;
        g.strokeStyle = 'rgba(222,222,230,.55)';
        g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo((sx + ex) / 2, (sy + ey) / 2 - 2, ex, ey + 2); g.stroke();
      }
    }
    g.restore();
  }

  function drawEar(g, x, y, rot, sx, mirror) {
    g.save();
    g.translate(x, y); g.rotate(rot); g.scale(sx * mirror, 1);
    blit(g, SP.ear);
    g.restore();
  }

  function drawEye(g, ex, ey, side, fore, lid, happy) {
    const ew = 9 * fore, eh = 6.9;
    const ix = ex - side * ew, ox = ex + side * ew; // inner / outer corners
    const iy = ey + 1, oy = ey - 1.4;
    if (happy) {
      g.strokeStyle = rgba(FUR_DARK, 1); g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(ix, iy + 1.5); g.quadraticCurveTo(ex, ey - eh * 1.5, ox, oy + 1.5); g.stroke();
      return;
    }
    if (lid > 0.9) {
      g.strokeStyle = rgba(FUR_DARK, 1); g.lineWidth = 1.8; g.lineCap = 'round';
      g.beginPath(); g.moveTo(ix, iy); g.quadraticCurveTo(ex, ey + eh * 0.8, ox, oy); g.stroke();
      return;
    }
    const upY = lerp(ey - eh * 1.9, ey + eh * 1.6, lid);
    const almond = new Path2D();
    almond.moveTo(ix, iy);
    almond.quadraticCurveTo(ex, upY, ox, oy);
    almond.quadraticCurveTo(ex, ey + eh * 1.7, ix, iy);
    almond.closePath();
    // dark socket rim
    g.fillStyle = rgba(FUR_DARK, 0.9);
    g.save(); g.translate(ex, ey); g.scale(1.18, 1.25); g.translate(-ex, -ey); g.fill(almond); g.restore();
    g.save();
    g.clip(almond);
    const lx = C.yaw * 2.2, ly = C.pitch * 1.6;
    const gr = g.createRadialGradient(ex + lx * 0.5, ey + ly * 0.5 + 1, 0.5, ex, ey, ew * 1.1);
    gr.addColorStop(0, 'rgb(214,214,118)');
    gr.addColorStop(0.42, 'rgb(156,190,92)');
    gr.addColorStop(0.8, 'rgb(92,132,64)');
    gr.addColorStop(1, 'rgb(46,70,40)');
    g.fillStyle = gr;
    g.fillRect(ex - ew - 2, ey - eh * 2, ew * 2 + 4, eh * 4);
    // the pupil: wide when the avocado is on the move
    const pw = ew * (0.16 + 0.42 * C.dil);
    g.fillStyle = 'rgb(10,10,12)';
    g.beginPath(); g.ellipse(ex + lx, ey + ly, pw, eh * 0.98, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.88)';
    g.beginPath(); g.arc(ex + lx - side * 0.5 - 2.4, ey + ly - 2.6, 1.5, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)';
    g.beginPath(); g.arc(ex + lx + 2.2, ey + ly + 2.2, 0.7, 0, TAU); g.fill();
    g.restore();
    g.strokeStyle = rgba(FUR_DARK, 1); g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(ix, iy); g.quadraticCurveTo(ex, upY, ox, oy); g.stroke();
  }

  function drawStrokes(g, now) {
    // a soft hand of light gliding along his back
    for (const st of fx.strokes) {
      const e = (now - st.t0) / 2300;
      const pass = Math.min(2, Math.floor(e * 3)), k = (e * 3) % 1;
      const path = [[66, -100], [30, -100], [-6, -106], [-44, -116], [-82, -118], [-116, -106]];
      const pt = (u) => {
        const f = u * (path.length - 1), i = Math.min(path.length - 2, Math.floor(f)), r = f - i;
        return lerpP(path[i], path[i + 1], r);
      };
      for (let j = 0; j < 8; j++) {
        const u = clamp(easeInOut(k) - j * 0.035);
        const [x, y] = pt(u);
        stamp(g, x, y, 14 - j, [255, 250, 236], (0.22 - j * 0.025) * Math.sin(Math.PI * k) * (pass < 3 ? 1 : 0), 0.3);
      }
    }
  }

  function drawPurrs(g, now) {
    g.lineCap = 'round';
    for (const p of fx.purrs) {
      const e = (now - p.t0) / 1500;
      const a = Math.sin(Math.PI * clamp(e)) * 0.85;
      const x = p.x + (RM ? 0 : Math.sin(e * 5 + p.seed) * 6), y = p.y - (RM ? 0 : e * 46);
      if (p.seed % 3 < 1) {
        // now and then a little cinnabar heart
        const k = 0.75 + 0.25 * Math.sin(Math.PI * clamp(e * 2.5));
        g.save();
        g.translate(x, y);
        g.rotate(Math.sin(p.seed) * 0.25);
        g.scale(k, k);
        g.fillStyle = rgba(SEAL_RGB, a * 0.85);
        g.beginPath();
        g.moveTo(0, 5.5);
        g.bezierCurveTo(-7.5, 0, -6.5, -6.5, -3.2, -6.5);
        g.bezierCurveTo(-1.4, -6.5, -0.3, -5.2, 0, -3.6);
        g.bezierCurveTo(0.3, -5.2, 1.4, -6.5, 3.2, -6.5);
        g.bezierCurveTo(6.5, -6.5, 7.5, 0, 0, 5.5);
        g.fill();
        g.restore();
        continue;
      }
      // a purr: a little wavering ink line, like the hum it is
      g.strokeStyle = rgba([52, 44, 40], a * 0.9);
      g.lineWidth = 1.5;
      g.beginPath();
      for (let i = 0; i <= 20; i++) {
        const u = i / 20, px = x - 11 + u * 22, py = y + Math.sin(u * TAU * 2.5 + 0.4) * 2.2 * (0.6 + 0.4 * Math.sin(Math.PI * u));
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke();
    }
  }

  function drawMeows(g, now) {
    for (const m of fx.meows) {
      const e = (now - m.t0) / 1300;
      const pop = RM ? 1 : easeBack(clamp(e * 4));
      const a = e < 0.7 ? 1 : 1 - (e - 0.7) / 0.3;
      g.save();
      // above his head, but kept inside the picture on narrow screens
      const mx = Math.min(HEAD_C[0] + 46 + C.yaw * 8, (L.W - 34 - L.catX) / L.s);
      const my = Math.max(HEAD_C[1] - 54, (30 - L.topY) / L.s) - (RM ? 0 : e * 14);
      g.translate(mx, my);
      g.rotate(-0.12);
      g.scale(pop, pop);
      g.globalAlpha = clamp(a);
      g.font = '30px "Nanum Pen Script", "Gowun Batang", cursive';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(22,17,15,.92)';
      g.fillText('야옹', 0, 0);
      g.strokeStyle = 'rgba(22,17,15,.6)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-26, 12); g.quadraticCurveTo(-30, 18, -34, 22); g.stroke();
      g.restore();
    }
    g.globalAlpha = 1;
  }

  function drawSeals(g, now) {
    if (!SP.seal) return;
    for (const f of fx.seals) {
      const e = (now - f.t0) / 1600;
      const pressK = RM ? 1 : easeOut(clamp(e / 0.1));
      const sc = RM ? 1 : lerp(1.7, 1, pressK);
      const a = e < 0.1 ? (RM ? clamp(e / 0.1) : pressK) : e < 0.68 ? 1 : 1 - (e - 0.68) / 0.32;
      const sz = SP.seal.size;
      g.save();
      g.translate(f.x, f.y);
      g.rotate(f.rot);
      g.scale(sc, sc);
      g.globalAlpha = clamp(a) * 0.95;
      g.drawImage(SP.seal.c, -sz / 2, -sz / 2, sz, sz);
      g.restore();
    }
  }

  function drawRings(g, now) {
    for (const r of fx.rings) {
      const e = (now - r.t0) / 500;
      g.strokeStyle = rgba(INKC, 0.35 * (1 - e));
      g.lineWidth = 1.4;
      g.beginPath(); g.arc(r.x, r.y, (RM ? 14 : 6 + e * 22) * L.s, 0, TAU); g.stroke();
    }
  }

  function drawAvoShadow(g) {
    const { s } = L;
    if (A.alpha <= 0.01) return;
    const surf = surfaceBelow(A.x, A.y);
    const hgt = Math.max(0, surf - (A.y + avoBottom()));
    const k = clamp(1 - hgt / (260 * s));
    if (k <= 0) return;
    g.save();
    g.globalAlpha = A.alpha * k * A.scale;
    g.translate(A.x, surf - 1 * s);
    g.scale(1, 0.22);
    stamp(g, 0, 0, 30 * s * (0.6 + 0.4 * k), [60, 44, 30], 0.28, 0.3);
    g.restore();
  }

  function drawAvocado(g, now) {
    const { s } = L;
    if (A.alpha <= 0.01 || A.scale <= 0.01) return;
    g.save();
    g.globalAlpha = A.alpha;
    g.translate(A.x, A.y);
    // squash along the last impact normal
    if (A.sq) {
      g.rotate(A.sqA);
      g.scale(1 + A.sq, 1 - A.sq * 0.75);
      g.rotate(-A.sqA);
    }
    g.rotate(A.ang);
    g.scale(A.scale * s, A.scale * s);
    blit(g, SP.avo);
    drawAvoFace(g, now);
    g.restore();
    // the sweat drop and the little "!"
    const wk = now - A.worriedAt;
    if (wk < 1700 && A.alpha > 0.5) {
      const a = wk < 1300 ? 1 : 1 - (wk - 1300) / 400;
      // places on the avocado (its own frame, so they turn with it and never land on its face)
      const ca = Math.cos(A.ang), sa = Math.sin(A.ang);
      const at = (lx, ly) => [A.x + (lx * ca - ly * sa) * s, A.y + (lx * sa + ly * ca) * s];
      const fl = A.x > L.W - 64 * s ? -1 : 1; // keep them inside the picture at the right edge
      const [dx0, dy0] = at(22 * fl, -44), [ex0, ey0] = at(-20 * fl, -52);
      g.save();
      g.globalAlpha = clamp(a);
      const dy = RM ? 0 : Math.min(1, wk / 900) * 7 * s;
      g.translate(dx0, dy0 + dy);
      g.beginPath();
      g.moveTo(0, -8 * s);
      g.bezierCurveTo(3.2 * s, -3 * s, 5 * s, 0, 5 * s, 2.4 * s);
      g.arc(0, 2.4 * s, 5 * s, 0, Math.PI);
      g.bezierCurveTo(-5 * s, 0, -3.2 * s, -3 * s, 0, -8 * s);
      g.fillStyle = 'rgba(188,218,238,.95)';
      g.fill();
      g.strokeStyle = 'rgba(62,98,138,.8)'; g.lineWidth = 1.1 * s; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.9)';
      g.beginPath(); g.ellipse(-1.6 * s, 2 * s, 1.2 * s, 1.8 * s, 0.3, 0, TAU); g.fill();
      g.restore();
      if (wk < 900) {
        const pop = RM ? 1 : easeBack(clamp(wk / 220));
        g.save();
        g.globalAlpha = clamp(wk < 650 ? 1 : 1 - (wk - 650) / 250);
        g.translate(ex0, ey0);
        g.rotate(-0.15);
        g.scale(pop, pop);
        g.fillStyle = rgba(SEAL_RGB, 1);
        g.font = `italic ${30 * s}px "Instrument Serif", Georgia, serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('!', 0, 0);
        g.restore();
      }
    }
  }

  function drawAvoFace(g, now) {
    const face = A.face;
    // its dot eyes glance at the pointer, or at him
    const lt = now - pointer.t < 2600 ? [pointer.x, pointer.y] : [L.catX + HEAD_C[0] * L.s, L.topY + HEAD_C[1] * L.s];
    const ddx = lt[0] - A.x, ddy = lt[1] - (A.y - 20 * L.s), dl = Math.hypot(ddx, ddy) || 1;
    const ca = Math.cos(-A.ang), sa = Math.sin(-A.ang);
    const gx = ((ddx * ca - ddy * sa) / dl) * 1.3, gy = ((ddx * sa + ddy * ca) / dl) * 1;
    const ink = 'rgba(22,17,15,.95)';
    // blush
    stamp(g, -13.5, -13, 4.6, [232, 120, 110], face === 'smug' ? 0.32 : 0.45, 0.4);
    stamp(g, 13.5, -13, 4.6, [232, 120, 110], face === 'smug' ? 0.32 : 0.45, 0.4);
    g.fillStyle = ink; g.strokeStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round';
    if (face === 'smug') {
      for (const [ex, ey] of AVO_EYES) {
        g.beginPath(); g.arc(ex + gx, ey + gy + 0.6, 2.1, 0, TAU); g.fill();
        // heavy, unimpressed lids
        g.fillStyle = 'rgb(230,230,150)';
        g.beginPath(); g.rect(ex - 3.4, ey - 3.4, 6.8, 2.9); g.fill();
        g.fillStyle = ink;
        g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(ex - 3.2, ey - 0.4); g.lineTo(ex + 3.2, ey - 0.7); g.stroke();
      }
      g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-3.6, -12.8); g.quadraticCurveTo(0.6, -10.6, 4.4, -13.9); g.stroke();
    } else if (face === 'worried') {
      for (const [ex, ey] of AVO_EYES) {
        g.beginPath(); g.arc(ex + gx * 0.5, ey, 2.5, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.9)';
        g.beginPath(); g.arc(ex + gx * 0.5 - 0.8, ey - 0.9, 0.8, 0, TAU); g.fill();
        g.fillStyle = ink;
      }
      g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(-10.5, -26); g.lineTo(-5, -28.2); g.moveTo(10.5, -26); g.lineTo(5, -28.2); g.stroke();
      g.beginPath();
      g.moveTo(-3.6, -12.4); g.quadraticCurveTo(-1.8, -14, 0, -12.4); g.quadraticCurveTo(1.8, -10.8, 3.6, -12.4);
      g.stroke();
    } else if (face === 'squeeze') {
      g.lineWidth = 1.4;
      for (const [ex, ey] of AVO_EYES) {
        const d = ex < 0 ? 1 : -1;
        g.beginPath(); g.moveTo(ex - d * 2.6, ey - 2.6); g.lineTo(ex + d * 2.2, ey); g.lineTo(ex - d * 2.6, ey + 2.6); g.stroke();
      }
      g.beginPath(); g.ellipse(0, -11.8, 2.3, 2.8, 0, 0, TAU); g.fill();
    } else {
      // dizzy: little spirals
      g.lineWidth = 0.9;
      for (const [ex, ey] of AVO_EYES) {
        g.beginPath();
        for (let i = 0; i <= 24; i++) { const a = i * 0.55 + now / 120, r = 0.4 + i * 0.13; const px = ex + Math.cos(a) * r, py = ey + Math.sin(a) * r; i ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.stroke();
      }
      g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(-4, -12.2); g.quadraticCurveTo(-2, -14, 0, -12.2); g.quadraticCurveTo(2, -10.4, 4, -12.2); g.stroke();
    }
  }

  // ── loop control ──
  function frame(now) {
    raf = 0;
    if (!active || destroyed || document.hidden || !ready) return;
    const dt = clamp((now - last) / 1000, 0.001, 0.05);
    last = now;
    const hot = update(dt, now);
    const idle = !RM && !hot;
    // idle (breathing, blinking, the tail) is gentle: about 30 fps is plenty
    if (!idle || now - lastDraw > 30) draw(now);
    if (hot || !RM) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (raf || !active || destroyed || document.hidden || !ready) return;
    last = now0();
    raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else kick();
  }, opt);

  // ── text ──
  function renderCount(bump) {
    const key = count === 0 ? 'cat.count.0' : count === 1 ? 'cat.count.1' : 'cat.count.n';
    const str = tt(key);
    const [before, after] = str.split('{n}');
    countN.textContent = '';
    if (after === undefined) countN.textContent = str;
    else {
      const b = document.createElement('b');
      b.textContent = String(count);
      countN.append(before, b, after);
    }
    let m = 0;
    for (const v of MILESTONES) if (count >= v) m = v;
    countNote.textContent = m ? tt(`cat.m.${m}`) : '';
    if (bump && m && m !== lastMilestone && !RM) {
      countNote.classList.remove('is-new');
      void countNote.offsetWidth;
      countNote.classList.add('is-new');
    }
    lastMilestone = m;
  }
  function relabel() {
    root.querySelectorAll('[data-ck]').forEach((el) => { el.textContent = tt(el.dataset.ck); });
    capMain.textContent = nm ? fmt(tt('cat.caption.named'), { name: nm }) : tt('cat.caption');
    capHint.textContent = tt(touchy ? 'cat.hint.touch' : 'cat.hint');
    petText.textContent = nm ? fmt(tt('cat.btn.pet.named'), { name: nm }) : tt('cat.btn.pet');
    stage.setAttribute('aria-label', nm ? fmt(tt('cat.label.named'), { name: nm }) : tt('cat.label'));
    renderCount(false);
  }

  // ── sizing ──
  let sizeQueued = false;
  const ro = new ResizeObserver(() => {
    if (sizeQueued || !ready) return;
    sizeQueued = true;
    requestAnimationFrame(() => { sizeQueued = false; if (!destroyed) relayout(); });
  });
  ro.observe(stage);
  const watchDpr = () => {
    matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener('change', () => { watchDpr(); if (ready) relayout(); }, { once: true, signal: ac.signal });
  };
  watchDpr();
  const onFonts = () => { if (!destroyed && ready && L && L.sign && !signFont && brushReady()) paintBg(); };
  if (document.fonts) {
    document.fonts.load('20px "Nanum Brush Script"', SIGN_TEXT).then(onFonts, () => {});
    document.fonts.load('20px "Nanum Pen Script"', '야옹').catch(() => {});
    document.fonts.addEventListener('loadingdone', onFonts, opt);
  }

  relabel();
  C.blinkAt = now0() + 1500;
  C.twAt = now0() + 2500;
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 30));
  // two idle slices: first paint the cat's sprites, then the room (each is a fair bit of brushwork,
  // so splitting them keeps a scroll from hitching while the scene wakes up)
  idle(() => {
    if (destroyed) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    if (w && h) { dpr = dprNow(); L = computeLayout(w, h); buildSprites(); L = null; }
    idle(() => {
      if (destroyed) return;
      ready = true;
      relayout(true);
    }, { timeout: 1200 });
  }, { timeout: 1200 });

  return {
    setActive(on) {
      active = !!on;
      if (!active) {
        cancelAnimationFrame(raf); raf = 0;
        if (A.grab) endGrab(null);
        tapCat = null;
      } else kick();
    },
    relabel,
    destroy() {
      destroyed = true;
      active = false;
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      ac.abort();
    },
    // for tests and the curious
    _debug: { A, C, get L() { return L; }, poke: () => poke(null, null), handleIt, pet: () => btnPet.click(), meow: () => meow(now0()) },
  };
}
