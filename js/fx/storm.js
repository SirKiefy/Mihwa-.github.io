// ─────────────────────────────────────────────────────────────────────────────
//  폭풍 · a gentle storm at the edge of a cliff, behind the closing letter.
//
//  One WebGL2 fragment shader paints the whole section as a 수묵화 (ink-wash
//  painting) on hanji, top to bottom:
//    sky      – heavy billowing clouds in grey-indigo washes, lobes left pale
//               on top and darker beneath; near the horizon they thin, and
//               one soft opening in their base lets a faint apricot light
//               down through the rain onto a low island and the water
//    veils    – rain hanging from the cloud base to the sea
//    cliffs   – headlands receding into mist on the left, each paler and
//               flatter than the last; on the shoulder of the near one, a
//               pine bent out over the sea by the wind (소나무)
//    sea      – slate-teal swells rolling in, crests left as white paper
//    rocks    – dark angular rocks at the cliff foot (axe-cut strokes, moss
//               dots); each swell washes up them and throws spray up from
//               behind, which hangs, drifts with the wind and falls back
//    edge     – the grassy cliff edge the viewer stands on: tufts of grass
//               and a few stems of silver grass (억새) streaming in the wind
//    rain     – fine slanted rain in three depths
//  The top and bottom of the painting dissolve into the page's paper.
//  Everything is drawn from the baked tileable noise texture (noise.js).
//
//  It renders at a reduced resolution (the browser upscales it; it is soft by
//  nature) and only the band of the section that is on screen is repainted
//  each frame.
//
//  createStorm(canvas, { reduceMotion, mobile, card }) → { setActive, destroy, renderAt } | null
// ─────────────────────────────────────────────────────────────────────────────
import { noiseData } from './noise.js?v=5484e3cdd9';

// the swell, and the big rock at the cliff foot: shared by the shader and the JS that times the still frame
const WK = 6;         // swells per unit of depth
const WSPD = 0.15;    // swells per second reaching any point
const BIG = { x: 0.04, seed: 1.3 };
const f1 = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

const VERT = `#version 300 es
layout(location = 0) in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uN;
uniform vec2 uRes;       // drawing buffer (px)
uniform vec2 uSize;      // canvas (CSS px)
uniform float uPx;       // CSS px per buffer px
uniform float uV;        // view unit: the viewport height (CSS px)
uniform float uS;        // object unit for rocks and grass (CSS px)
uniform float uHz;       // horizon, CSS px from the top of the section
uniform float uFoot;     // the water line at the cliff foot
uniform float uNarrow;   // 0 on wide screens, 1 on a phone held upright
uniform vec2 uBreak;     // the cloud break: centre x, half width (CSS px)
uniform float uT;        // seconds
uniform vec2 uPtr;       // pointer, smoothed, -1..1
uniform vec4 uCard;      // the letter card (CSS px: x0 y0 x1 y1)
uniform vec4 uFlash;     // light inside the clouds: x, y, radius, strength
uniform vec3 uRain;      // how far each rain layer has fallen (CSS px, wrapped every 256 drops)
out vec4 o;

const vec3 PAPER = vec3(0.945, 0.922, 0.878);
const vec3 INK = vec3(0.086, 0.067, 0.059);
const vec3 SLATE = vec3(0.2, 0.235, 0.3);
const vec3 TEAL = vec3(0.14, 0.25, 0.28);
const vec3 WARM = vec3(0.86, 0.58, 0.42);     // the light in the break: a faint apricot, an echo of the seals' cinnabar

float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec4 nz(vec2 p) { return texture(uN, p); }
vec4 nzl(vec2 p) { return textureLod(uN, p, 0.0); }
// for lookups whose coordinates jump (per wave, per cell): pick the mip level by hand,
// so the jump does not blur a 2x2 block of pixels along every edge
vec4 nzd(vec2 p, float texPerPx) { return textureLod(uN, p, log2(max(texPerPx * 256.0, 1.0))); }
float sat(float x) { return clamp(x, 0.0, 1.0); }
float sq(float x) { return x * x; }   // (pow() is undefined for a negative base)
// ink at density d: pale washes keep the cool tint, heavy ink runs warm black
vec3 inkTone(float d, vec3 tint) { return mix(PAPER, mix(tint, INK, smoothstep(0.45, 1.05, d)), sat(d)); }

// ── sky ─────────────────────────────────────────────────────────────────────
float breakMask(vec2 p) {
  vec2 d = (p - vec2(uBreak.x, uHz - 0.05 * uV)) / vec2(uBreak.y, 0.13 * uV);
  float n = nz(p / uV * vec2(0.6, 1.4) + vec2(uT * 0.0015, 0.2)).r;
  return exp(-dot(d, d) * (0.45 + n * 1.3));
}

vec3 sky(vec2 p, float brk) {
  float hgt = (uHz - p.y) / uV;
  vec2 cq = p / uV - vec2(uT * 0.0045, 0.0);                    // the sky drifts with the wind
  vec4 w = nz(cq * 0.22 + vec2(uT * 0.0012, uT * 0.0007));
  vec2 wq = cq + (w.rg - 0.5) * vec2(0.16, 0.1);                 // and slowly boils
  float gran = nz(p / uV * vec2(5.0, 6.0)).b;
  float topLine = mix(0.4, 0.2, uNarrow) + (nz(vec2(cq.x * 0.16, 0.83)).a - 0.5) * mix(0.55, 0.3, uNarrow);
  // billows: rows of rounded lobes heaped on each other, the lower ones in front.
  // Each lobe is pale where it swells up and shaded where it tucks under the next.
  float bump = nz(wq * vec2(2.6, 3.2) + 0.4).g;
  float d = 0.3 * smoothstep(topLine + 0.02, topLine + 0.1, wq.y), inC = 0.0, rowY = topLine;
  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    float r = 0.06 + 0.032 * fk;
    float sp = r * 1.3;
    float off = hash(vec2(fk, 1.3)) * sp;
    float i0 = floor((wq.x - off) / sp);
    // the three nearest lobes of this row, painted back to front (the lower one in front)
    vec3 L[3];
    float nearest = 1e3;
    for (int j = 0; j < 3; j++) {
      float i = i0 + float(j - 1);
      float h1 = hash(vec2(i, fk + 0.5)), h2 = hash(vec2(i, fk + 7.7)), h3 = hash(vec2(i, fk + 3.3));
      float rr = r * (0.7 + 0.6 * h3) * (1.0 + 0.06 * sin(uT * 0.09 + h1 * 6.3));
      vec2 c = vec2(off + (i + 0.5 + (h1 - 0.5) * 0.55) * sp, rowY + (h2 - 0.5) * r * 0.8);
      float sd = length((wq - c) * vec2(0.82, 1.1)) - rr + (bump - 0.5) * (0.035 + 0.01 * fk);
      L[j] = vec3(sd, c.y, sat((wq.y - (c.y - rr * 0.9)) / (1.7 * rr)));
      nearest = min(nearest, sd);
    }
    if (L[0].y > L[1].y) { vec3 tmp = L[0]; L[0] = L[1]; L[1] = tmp; }
    if (L[1].y > L[2].y) { vec3 tmp = L[1]; L[1] = L[2]; L[2] = tmp; }
    if (L[0].y > L[1].y) { vec3 tmp = L[0]; L[0] = L[1]; L[1] = tmp; }
    float e = 0.008 + 0.005 * fk;
    for (int j = 0; j < 3; j++) {
      float m = smoothstep(e, -e, L[j].x);
      float dl = 0.14 + 0.045 * fk + 0.28 * L[j].z * L[j].z;
      dl += 0.05 * exp(-abs(L[j].x) / 0.006);                    // pigment pools along the lobe's edge
      d = mix(d, dl, m);
    }
    if (k == 0) {
      float m0 = smoothstep(e, -e, nearest);
      inC = max(m0, smoothstep(rowY, rowY + 0.05, wq.y));
      d += 0.06 * exp(-abs(nearest) / 0.007) * m0;                // the wash's edge against open sky
    }
    rowY += r * 0.85;
  }
  d *= inC;
  // the body of the cloud below the billows: one heavy, wet wash
  float b1 = nz(wq * vec2(0.5, 0.7) + 0.17).r;
  float b2 = nz(wq * vec2(1.2, 1.5) + 0.61).g;
  float deep = smoothstep(rowY - 0.12, rowY + 0.25, wq.y + (b1 - 0.5) * 0.25);
  float baseH = 0.15 + 0.1 * nz(vec2(cq.x * 0.35, 0.37)).r;
  float body = 0.36 + 0.18 * smoothstep(0.35, 0.75, b1) + 0.06 * (b2 - 0.5);
  // heavier towards the base, darkest along its underside
  body *= 1.0 + 0.3 * smoothstep(baseH + 0.5, baseH + 0.03, hgt);
  body += 0.1 * exp(-sq((hgt - baseH - 0.02 + (b2 - 0.5) * 0.06) / 0.035));
  float bloom = smoothstep(0.52, 0.56, b2) * (1.0 - smoothstep(0.56, 0.62, b2));
  body += 0.03 * bloom - 0.08 * smoothstep(0.62, 0.78, b2);
  d = mix(d, body, deep);
  inC = max(inC, deep);
  d *= 0.88 + 0.24 * gran;
  // the base frays into rain a little above the sea
  float under = smoothstep(baseH, baseH - 0.13, hgt + (b2 - 0.5) * 0.08);
  float veilN = nz(vec2((p.x + (uHz - p.y) * 0.25) / uV * 2.6 - uT * 0.004, p.y / uV * 0.1 + 0.3)).g;
  float veil = smoothstep(0.42, 0.75, veilN);
  d = mix(d, 0.14 + 0.16 * veil * smoothstep(-0.01, 0.1, hgt), under);
  // a breath of wash over the open sky above
  d = max(d, 0.03 + 0.04 * b2 * smoothstep(0.1 * uV, 0.4 * uV, p.y));
  // the break: the clouds thin over the horizon, and one soft opening in their base lets the
  // light down through the rain in pale shafts
  d *= 1.0 - 0.82 * brk;
  vec2 src = vec2(uBreak.x + 0.1 * uBreak.y, uHz - 0.19 * uV);
  vec2 hq = (p - src) / vec2(uBreak.y * 0.55, 0.065 * uV);
  float hn = nz(p / uV * vec2(1.1, 2.0) + vec2(uT * 0.002, 0.4)).g;
  float hn2 = nz(p / uV * vec2(3.5, 5.0) + vec2(uT * 0.003, 0.7)).r;
  float hl = length(hq * vec2(1.0, 1.0 + 0.6 * smoothstep(0.0, 1.0, hq.y))) + (hn - 0.5) * 1.3 + (hn2 - 0.5) * 0.5;
  float hole = smoothstep(1.0, 0.3, hl);
  d *= 1.0 - 0.3 * exp(-sq((hl - 1.05) / 0.35));            // the cloud edges round it catch the light
  d = mix(d, 0.03, hole * 0.9);
  float below = p.y - src.y;
  float ang = (p.x - src.x) / (max(below, 0.0) + 0.04 * uV);
  float shaft = smoothstep(0.42, 0.72, nz(vec2(ang * 2.2 + uT * 0.002, 0.21)).r);
  float fan = exp(-ang * ang / 0.3) * smoothstep(0.0, 0.05 * uV, below) * smoothstep(-0.005, 0.04, hgt);
  d *= 1.0 - 0.42 * shaft * fan;
  // and a light inside the clouds now and then
  vec2 fd = (p - uFlash.xy) / uFlash.z;
  d *= 1.0 - uFlash.w * 0.3 * exp(-dot(fd, fd)) * (0.3 + 0.7 * inC);
  vec3 col = inkTone(d, SLATE);
  float g = brk * (1.0 - smoothstep(0.0, 0.16, hgt)) * smoothstep(-0.01, 0.006, hgt) + 0.4 * hole + 0.25 * shaft * fan * brk;
  return mix(col, mix(PAPER, WARM, 0.32), sat(g) * 0.5);
}

// a low island on the horizon, in the break
vec3 island(vec3 col, vec2 p) {
  float w = min(0.17 * uV, 0.15 * uSize.x);
  float k = (p.x - (uBreak.x + uBreak.y * 0.2)) / w;
  if (abs(k) > 1.0) return col;
  float n = nz(vec2(p.x / uV * 2.0, 0.71)).r;
  float h = (pow(1.0 - k * k, 0.8) * 0.7 + 0.3 * exp(-sq((k + 0.4) * 3.0))) * (0.026 + 0.012 * n) * uV;
  float y = uHz - p.y;
  float m = smoothstep(h + uPx, h - uPx, y) * smoothstep(-0.004 * uV, 0.0, y);
  float d = 0.4 - 0.2 * smoothstep(h * 0.6, -0.002 * uV, y);
  return mix(col, inkTone(d, SLATE), m);
}

// ── sea ─────────────────────────────────────────────────────────────────────
const float WK = ${f1(WK)};
const float WSPD = ${f1(WSPD)};
float wavePhase(vec2 p, out float z, out float xw) {
  float s = max((p.y - uHz) / uV, 0.0);
  z = 0.1 / (s + 0.01);
  xw = (p.x - 0.5 * uSize.x) / uV * z;
  float bend = (nz(vec2(xw * 0.04, z * 0.03 + 0.3)).g - 0.5) * 1.3
             + (nz(vec2(p.x / uV * 0.45, z * 0.15 + 0.7)).r - 0.5) * 0.28
             // and each crest line undulates a little, by about the same few pixels near and far
             + (nz(vec2(p.x / uV * 1.3, z * 0.2 + 0.5)).r - 0.5) * min(0.2, 14.0 * WK * 0.1 / ((s + 0.01) * (s + 0.01) * uV));
  return z * WK + uT * WSPD + bend;
}

vec3 sea(vec2 p) {
  float s = max((p.y - uHz) / uV, 0.0);
  float z, xw;
  float ph = wavePhase(p, z, xw);
  vec4 n = nz(vec2(xw * 0.25, z * 0.7));
  // dark out under the storm, a little lighter towards the shore
  float d = 0.54 - 0.14 * smoothstep(0.0, 0.35, s) + (n.r - 0.5) * 0.14;
  float wv = nz(vec2(p.x / uV * 0.35, p.y / uV * 0.9) + 0.13).a;
  d += (wv - 0.5) * 0.16;
  float f = fract(ph);
  float id = floor(ph);
  float aa = WK * 0.1 / ((s + 0.01) * (s + 0.01)) / uV * uPx;    // phase per buffer pixel
  float det = smoothstep(0.035, 0.12, s);
  // each swell is one broad horizontal stroke: pressed hard under the crest, dragged dry behind
  float dxp = uPx / uV;                                            // per buffer pixel
  float dzp = 0.1 / ((s + 0.01) * (s + 0.01)) * dxp;
  float seg = nzd(vec2(xw * 0.5 + p.x / uV * 0.4 + id * 0.37, id * 0.61), (0.5 * z + 0.4) * dxp).r;
  float act = smoothstep(0.28, 0.55, seg);
  float dry = nzd(vec2(xw * 0.3 + p.x / uV * 1.2, z * 26.0 + id * 0.3), max((0.3 * z + 1.2) * dxp, 26.0 * dzp)).b;
  float face = smoothstep(0.4, 0.9, f) * (1.0 - smoothstep(1.0 - max(aa, 0.012) * 1.5, 1.0, f));
  d += face * (0.16 + 0.12 * smoothstep(0.4, 0.75, seg)) * act * det * (0.55 + 0.45 * smoothstep(0.3, 0.6, dry));
  // whitecaps: the crest left as paper, broken into dashes; foam trailing on the back
  float cap = smoothstep(0.36, 0.66, nzd(vec2(xw * 1.4 + p.x / uV * 1.6, id * 0.71 + 0.2), (1.4 * z + 1.6) * dxp).g);
  float near = smoothstep((uFoot - uHz) / uV - 0.2, (uFoot - uHz) / uV, s);
  float g = f < 0.6 ? f : f - 1.0;                               // signed distance to the crest
  // the crest stroke swells and tapers along its length, and thins to nothing where it breaks off
  float cw = (0.05 + 0.12 * near) * mix(sqrt(cap), 1.0, near * 0.5);
  float crest = (1.0 - smoothstep(cw * 0.35, cw + aa * 1.6, g)) * smoothstep(-aa * 1.6 - 0.004, 0.0, g)
              * min(1.0, (cw + 0.002) / (aa * 1.2 + 0.002));
  float trail = smoothstep(0.58, 0.72, nz(vec2(xw * 1.1 + p.x / uV * 0.8, z * 10.0)).b) * (1.0 - smoothstep(0.03, 0.4, f));
  d *= 1.0 - (crest * smoothstep(0.0, 0.3, cap + near * 0.6) * 0.95 + trail * 0.45) * mix(act, 1.0, near * 0.6) * det;
  // whitecaps: short white dashes scattered over the water, riding in with the swell
  {
    vec2 cc = vec2(xw * 24.0, (z - uT * WSPD / WK) * 29.0);
    vec2 ci = floor(cc), cf = fract(cc) - 0.5;
    float hc = hash(ci + 0.71);
    float lenK = 0.16 + 0.24 * hash(ci + 3.3);
    float ax = (cf.x + (hash(ci + 1.9) - 0.5) * 0.4) / lenK;
    float lens = sat(1.0 - ax * ax);
    // a little arched stroke, thickest in the middle and tapering to points; never thinner than
    // a pixel, only fainter, so far-off ones do not break into stair-steps
    float cy = cf.y - (hash(ci + 5.7) - 0.5) * 0.4 + 0.06 * ax * ax;
    float cellPx = uV * (s + 0.01) * (s + 0.01) / (0.1 * 29.0) / uPx;   // the cell's height in buffer pixels
    float th = 0.11 * lens * lens;
    float tq = max(th, 0.7 / cellPx);
    float dash = (1.0 - smoothstep(tq * 0.4, tq + 0.6 / cellPx, abs(cy))) * (th / tq);
    float under = smoothstep(0.0, 0.5, lens) * exp(-sq((cy - 0.16) / 0.07));
    float on = step(0.78, hc) * smoothstep(0.35, 0.65, nz(vec2(xw * 0.3, z * 0.8) + 0.4).g) * smoothstep(0.05, 0.12, s) * (1.0 - smoothstep(0.24, 0.36, s));
    d += under * on * 0.1;
    d *= 1.0 - dash * on * 0.8;
  }
  // far out the swells are only flecks of white and drags of grey
  float farK = (1.0 - smoothstep(0.03, 0.13, s)) * smoothstep(0.0, 0.006, s);
  float fl = nzl(vec2(p.x / uV * 0.7 + 0.3, s * 70.0)).b;
  float fl2 = nzl(vec2(p.x / uV * 2.4, s * 160.0 + 0.5)).g;
  d += farK * (smoothstep(0.5, 0.7, fl) - 0.35) * 0.12;
  d *= 1.0 - farK * 0.3 * smoothstep(0.7, 0.85, fl2) * smoothstep(0.012, 0.03, s);
  // the light of the break on the water
  float refl = exp(-sq((p.x - uBreak.x) / (uBreak.y * 0.55))) * exp(-s / 0.07);
  refl *= 0.6 + 0.6 * smoothstep(0.4, 0.7, nzl(vec2(p.x / uV * 1.5, s * 40.0)).b);
  d *= 1.0 - 0.55 * refl;
  vec3 col = inkTone(d, TEAL);
  return mix(col, mix(PAPER, WARM, 0.22), sat(refl) * 0.35 * smoothstep(0.0, 0.015, s));
}

// ── headlands receding into mist ───────────────────────────────────────────
// the ridge line of a headland: it climbs inland to its summit and rounds over at the shoulder
// above the sea. Height above the horizon (V, negative is up) at x.
float ridge(float x, float faceX, float topH, float seed) {
  float xr = (x - faceX) / uV;
  float tn = nz(vec2(x / uV * 0.45 + seed, seed * 0.31)).r;
  float tn2 = nz(vec2(x / uV * 2.5 + seed, seed * 0.7)).b;
  float tn3 = nz(vec2(x / uV * 1.2 + seed * 0.7, seed * 0.13)).g;
  float rise = smoothstep(0.02, -0.17 - 0.08 * hash(vec2(seed, 1.0)), xr);
  return -topH * (0.66 + 0.2 * tn + 0.2 * (tn3 - 0.5) + 0.04 * tn2 + 0.34 * rise) + topH * 0.16 * smoothstep(-0.07, 0.01, xr);
}

// faceX: where the cliff face meets the sea; topH: height above the horizon (V);
// baseS: depth of its foot below the horizon (V); pale: 0..1; detail: 0 for a flat far
// silhouette .. 1 for the near cliff with all its texture strokes
vec3 headland(vec3 col, vec2 p, float faceX, float topH, float baseS, float pale, float seed, float detail) {
  float xr = (p.x - faceX) / uV;
  if (xr > 0.3) return col;
  float y = (p.y - uHz) / uV;
  if (y > baseS + 0.02) return col;
  float tn2 = nz(vec2(p.x / uV * 2.5 + seed, seed * 0.7)).b;
  float topY = ridge(p.x, faceX, topH, seed);
  if (y < topY - 0.2) return col;
  float span = baseS - topY;
  float v = sat((y - topY) / span);
  // the sea face: ledges, and a lean out towards the foot
  float jag = (nz(vec2(y * 1.6, seed)).g - 0.5) * 0.04 + (nz(vec2(y * 5.0, seed + 0.4)).b - 0.5) * 0.014;
  float xb = v * 0.04 + jag;
  float e = uPx / uV * 1.3;
  float m = smoothstep(xb + e, xb - e, xr) * smoothstep(topY - e, topY + e, y);
  // mist: the far headlands dissolve into it from the foot up; across the near one it lies in a
  // drifting band above the water, so its foot stands dark among the rocks
  float mn = nz(vec2(p.x / uV * 1.1 - uT * 0.004, y * 2.0 + seed)).r;
  float vm = v + (mn - 0.5) * 0.35;
  float mist = detail > 0.99 ? 0.6 * smoothstep(0.5, 0.66, vm) * (1.0 - smoothstep(0.7, 0.88, vm)) : smoothstep(0.5, 1.0, vm);
  // outside: a faint halo, so it stands clear of the clouds behind, and its mist running on out over the water
  float gap = max(max(xr - xb, topY - y), 0.0);
  float halo = 0.3 * pale * exp(-gap / 0.07) * smoothstep(baseS, topY, y);
  float spill = mist * 0.85 * exp(-gap / mix(0.06, 0.035, detail));
  col = mix(col, PAPER, sat(max(halo, spill)) * (1.0 - m));
  if (m <= 0.0) return col;
  float df = max(xb - xr, 0.0), dt = max(y - topY, 0.0);
  // folds: vertical creases drawn with one dark line, the plane beyond each turning into shadow
  float shade = 0.0, lines = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float hc = hash(vec2(seed, fi));
    float cx = -(0.03 + 0.065 * fi + 0.03 * hc);
    float wob = (nz(vec2(y * 1.4 + fi * 0.3, seed + fi * 0.17)).r - 0.5) * 0.05;
    float dx = xr - (cx + wob + v * 0.03);
    float run = smoothstep(0.0, 0.06, v - 0.04 * hc) * (1.0 - smoothstep(0.45 + 0.4 * hc, 1.0, v));
    float brk = smoothstep(0.35, 0.55, nz(vec2(fi * 0.31 + seed, y * 2.2)).g);
    lines = max(lines, exp(-abs(dx) / 0.0028) * run * brk);
    shade += smoothstep(-0.002, 0.004, dx) * exp(-max(dx, 0.0) / 0.035) * run;
  }
  // texture strokes: long, nearly vertical cuts (부벽준), gathered by the creases and the face
  vec2 rp = vec2(p.x * 0.985 + p.y * 0.17, p.y * 0.985 - p.x * 0.17) / uV;
  float cut = nz(rp * vec2(6.0, 0.7) + seed).b;
  float cut2 = nz(rp * vec2(13.0, 1.3) + seed * 1.7).g;
  float planeN = nz(vec2(p.x / uV * 1.4, p.y / uV * 0.5) + seed * 0.3).r;
  float faceK = exp(-df / 0.028);
  float near = sat(shade + faceK);
  float dd = detail * detail;                 // the far ones are flat washes: their texture fades fastest
  float d = 0.52 + (0.22 * sat(shade) + 0.22 * faceK) * (0.3 + 0.7 * dd) + (planeN - 0.5) * 0.14 * detail;
  d += (1.0 - detail) * (0.14 - 0.3 * v);   // a flat wash, darkest along the ridge, paling downwards
  d += dd * (0.22 * smoothstep(0.55, 0.7, cut) * (0.3 + 0.7 * near) + 0.12 * smoothstep(0.6, 0.72, cut2) * near);
  d -= dd * 0.16 * smoothstep(0.5, 0.75, planeN) * (1.0 - near);         // a lit plane, left pale
  d += 0.38 * lines * dd;
  // grass and scrub along the top
  d += 0.24 * detail * exp(-dt / 0.022) * (0.6 + 0.4 * cut2);
  d += 0.36 * exp(-dt / 0.005) * (0.7 + 0.3 * tn2);               // the brush along the top
  d += 0.22 * exp(-df / 0.004) * (0.4 + 0.6 * detail);            // and down the face
  float dots = smoothstep(0.6, 0.72, nz(p / uV * 6.0 + seed).b) * exp(-dt / 0.026) * detail;
  d += dots * 0.45;
  vec3 c = mix(inkTone(d * pale, SLATE), PAPER, mist * 0.9);
  return mix(col, c, m);
}

// a pine on the near cliff's shoulder, bent by years of wind out over the sea, its needles in
// flat dark pads that rock a little in the gusts: steadfast in the storm (소나무)
float pineX(float w, float seed, float sway) { return 0.08 * sin(w * 4.0 + seed) * w + 0.28 * w * w + sway * w * w; }
vec3 pine(vec3 col, vec2 p, vec2 root, float sz, float seed) {
  float u = (p.x - root.x) / sz, w = (root.y - p.y) / sz;   // w: height above the root, in tree heights
  if (u < -0.45 || u > 1.15 || w < -0.06 || w > 1.2) return col;
  float gust = smoothstep(0.25, 0.8, nz(vec2(root.x / uV * 0.3 - uT * 0.045, 0.5)).r);
  float sway = 0.012 * sin(uT * 0.9 + seed) + 0.025 * gust;
  float aa = uPx / sz;
  // the trunk: a kink low down, then a long lean out to the right; dark along its edges, barked
  float wt = clamp(w, 0.0, 0.92);
  float tx = pineX(wt, seed, sway);
  float slope = 0.08 * (sin(wt * 4.0 + seed) + 4.0 * wt * cos(wt * 4.0 + seed)) + 0.56 * wt + 2.0 * sway * wt;
  float tw = mix(0.045, 0.014, wt) * (1.0 + 1.2 * smoothstep(0.08, 0.0, w)) * sqrt(1.0 + slope * slope);
  float dx = abs(u - tx);
  float ink = smoothstep(tw + aa, tw - aa, dx) * step(w, 0.93) * smoothstep(-0.05, -0.01, w);
  float bark = nz(vec2(u * 7.0, w * 3.0) + seed).b;
  float d = mix(0.68 + 0.3 * smoothstep(0.45, 0.68, bark), 1.05, smoothstep(tw * 0.3, tw * 0.85, dx));
  // limbs out to the pads, mostly downwind, and the pads: flat, layered, bristling at the rim,
  // darker underneath where the needles hang
  float pads = 0.0, pd = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float bw = i == 4 ? 0.62 : 0.4 + 0.18 * fi;
    float bl = i == 4 ? -0.24 : (i == 3 ? 0.08 : 0.46 - 0.08 * fi);
    vec2 a = vec2(pineX(bw, seed, sway), bw);
    vec2 b = a + vec2(bl + sway * 0.8 * sign(bl), 0.04 + 0.05 * abs(bl));
    vec2 pa = vec2(u, w) - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float bwid = mix(0.018, 0.008, h);
    float lim = smoothstep(bwid + aa, bwid - aa, length(pa - ba * h - vec2(0.0, 0.03 * sin(h * 3.14))));
    if (lim > ink) { ink = lim; d = 0.92; }
    float size = i == 3 ? 1.25 : (i == 4 ? 0.75 : 1.0 - 0.08 * fi);
    for (int k = 0; k < 3; k++) {
      float fk = float(k) - 1.0;
      vec2 c = b + vec2(fk * 0.11 * size + 0.03 * sign(bl), 0.03 * (1.0 - abs(fk)) + 0.015 * hash(vec2(fi, fk + seed)));
      vec2 sc = vec2(0.14, 0.075) * size * (1.0 - 0.2 * abs(fk));
      vec2 e = (vec2(u, w) - c) / sc;
      e.y /= e.y < 0.0 ? 0.55 : 1.0;
      float an = atan(e.y, e.x);
      float r = length(e) + (nz(vec2(an * 1.3 + fi * 0.37 + fk * 0.21 + seed, 0.3)).b - 0.5) * 0.4
                          + (nz(vec2(an * 6.0 + fi + fk, 0.6)).g - 0.5) * 0.3;
      float pm = smoothstep(1.0, 1.0 - 3.0 * aa / sc.y, r);
      if (pm > 0.0) {
        float nd = nz(vec2((u - c.x) * 30.0 + (w - c.y) * 12.0, (w - c.y) * 10.0) + fi * 0.3 + fk * 0.17).g;
        float v = 0.8 + 0.25 * smoothstep(0.45, 0.66, nd) + 0.2 * smoothstep(0.2, -0.8, e.y)
                - 0.22 * smoothstep(0.1, 0.9, e.y) * (1.0 - smoothstep(0.5, 0.62, nd));
        pd = pm > pads ? v : pd;
        pads = max(pads, pm);
      }
    }
  }
  d = mix(d, pd, pads);
  ink = max(ink, pads);
  return mix(col, inkTone(d, SLATE), ink);
}

vec3 mistBand(vec3 col, vec2 p, float yc, float th, float k, float seed) {
  float y0 = (p.y - yc) / uV;
  if (abs(y0) > th * 3.5) return col;
  float n = nz(vec2(p.x / uV * 0.4 - uT * 0.0035 + seed, seed)).r;
  float n2 = nz(vec2(p.x / uV * 1.3 - uT * 0.006, p.y / uV * 2.2 + seed)).g;
  float y = y0 + (n - 0.5) * th * 1.4;
  float m = exp(-y * y / (th * th)) * smoothstep(0.25, 0.75, n2 * 0.7 + n * 0.5);
  return mix(col, PAPER, sat(m * k));
}

// ── rocks at the cliff foot, and the waves breaking on them ────────────────
// x (fraction of width), half width and height (uS), seed;
// and how far out each one stands, as a fraction of the way from the cliff foot to the horizon
const int NR = 5;
const vec4 ROCK[5] = vec4[5](
  vec4(${f1(BIG.x)}, 0.17, 0.24, ${f1(BIG.seed)}), vec4(0.19, 0.095, 0.14, 2.9), vec4(0.29, 0.055, 0.075, 4.1),
  vec4(0.36, 0.03, 0.036, 9.6), vec4(0.13, 0.05, 0.06, 6.6));
const float ROCKOUT[5] = float[5](0.0, 0.03, 0.06, 0.1, 0.0);

float rockBase(int i) { return uFoot - ROCKOUT[i] * (uFoot - uHz); }

// when the last swell reached this rock (seconds), and how hard it hit
vec2 rockWave(vec4 R, float cx, float baseY, out float wave) {
  float z, xw;
  float ph = wavePhase(vec2(cx, baseY - 0.004 * uV), z, xw) + fract(R.w * 0.37) * 0.6;   // each takes it in turn
  wave = floor(ph);
  return vec2(fract(ph) / WSPD, 0.35 + 0.65 * hash(vec2(wave, R.w)));
}

// the top edge of a rock over k = -1..1: straight cuts between six knots, the peak off centre.
// The height (0..1) and the slope of the cut it lies on.
vec2 rockTop(float k, float seed) {
  float u = (k * 0.5 + 0.5) * 5.0;
  float i = clamp(floor(u), 0.0, 4.0), f = u - i;
  float pk = (hash(vec2(seed, 5.1)) - 0.5) * 0.9;
  vec2 x = vec2(i, i + 1.0) / 2.5 - 1.0;
  vec2 h = 1.0 - 0.5 * pow(abs(x - pk) / (1.0 + abs(pk)), vec2(1.2));
  h *= 0.66 + 0.42 * vec2(hash(vec2(i, seed)), hash(vec2(i + 1.0, seed)));
  h *= 1.0 - 0.45 * step(0.99, abs(x));
  return vec2(mix(h.x, h.y, f), h.y - h.x);
}

vec3 rocks(vec3 col, vec2 p) {
  float rS = max(uS, 0.5 * uV);             // on a phone held upright the rocks keep a sensible size
  for (int i = 0; i < NR; i++) {
    vec4 R = ROCK[i];
    float baseY = rockBase(i);
    float persp = mix(1.0, 0.5, ROCKOUT[i] * 2.0);
    float cx = R.x * uSize.x, hw = R.y * rS * persp, hh = R.z * rS * persp;
    float dx = p.x - cx;
    if (abs(dx) > hw * 2.0 || p.y > baseY + 0.03 * uV || p.y < baseY - hh * 1.2) continue;
    float wave;
    vec2 ap = rockWave(R, cx, baseY, wave);
    float age = ap.x, power = ap.y;
    float k = dx / hw;
    if (abs(k) < 1.0) {
      vec2 tp = rockTop(k, R.w);
      float jag = (nz(vec2(p.x / rS * 2.4 + R.w, R.w * 0.3)).b - 0.5) * 0.14 + (nz(vec2(p.x / rS * 9.0, R.w)).g - 0.5) * 0.05;
      float side = pow(max(1.0 - pow(abs(k), 3.0), 0.0), 0.4);
      float topY = baseY - hh * ((tp.x + jag * (1.0 - abs(k))) * side - 0.06);
      float e = uPx * 1.1;
      float m = smoothstep(topY - e, topY + e, p.y) * smoothstep(baseY + 0.012 * uV, baseY - 0.002 * uV, p.y);
      // moss dots (태점) along the ridge, sitting on the outline
      float cw = 0.02 * rS;
      float ci = floor(p.x / cw);
      float hd = hash(vec2(ci, R.w + 2.0));
      vec2 dc = vec2((ci + 0.25 + 0.5 * hash(vec2(ci, R.w + 3.0))) * cw, topY + 1.0);
      float dr = (1.3 + 1.6 * hash(vec2(ci, R.w + 4.0))) * max(1.0, rS / 700.0);
      float dot1 = step(0.55, hd) * smoothstep(dr, dr - 1.2 * uPx, length(p - dc)) * smoothstep(0.9, 0.6, abs(k));
      if (m > 0.0 || dot1 > 0.0) {
        float dt = (p.y - topY) / hh;
        vec2 rq = vec2(p.x * 0.8 - p.y * 0.6, p.y * 0.8 + p.x * 0.6) / rS;
        float cut = nz(rq * vec2(9.0, 1.3) + R.w).b;
        float cut2 = nz(rq * vec2(20.0, 2.6) - R.w).g;
        float lit = smoothstep(0.03, -0.08, tp.y);              // a cut that falls away to the right faces the light
        float topK = 1.0 - smoothstep(0.08, 0.3, dt + (cut - 0.5) * 0.25);
        float d = 0.88 + 0.14 * smoothstep(0.4, -0.8, k);         // the body, darker on the side away from the light
        d -= topK * (0.3 + 0.26 * lit);                         // the planes on top are left pale
        d += 0.24 * smoothstep(0.55, 0.72, cut) * (1.0 - 0.6 * topK);   // axe-cut strokes (부벽준)
        d -= 0.16 * smoothstep(0.6, 0.76, cut2) * (1.0 - topK) * (1.0 - smoothstep(0.3, 0.9, dt));
        // a crease running down from the peak
        float pkx = (hash(vec2(R.w, 5.1)) - 0.5) * 0.9 + 0.4 * (hash(vec2(R.w, 6.3)) - 0.5) + (nz(vec2(dt * 0.6, R.w)).r - 0.5) * 0.3;
        d += 0.45 * exp(-abs(k - pkx) * hw / (1.2 * uPx + 0.8)) * smoothstep(0.02, 0.12, dt) * (1.0 - smoothstep(0.4, 0.9, dt + cut * 0.2));
        d += 0.45 * exp(-(p.y - topY) / (1.4 * uPx + 0.8));       // the outline along the top
        d += 0.12 * smoothstep(baseY - 0.3 * hh, baseY, p.y);     // wet at the waterline
        d = max(d, dot1 * 1.05);
        col = mix(col, inkTone(d, SLATE), max(m, dot1));
        // the swell washes up the rock, then drains off it in streaks
        float wash = exp(-age / 1.3) * smoothstep(0.0, 0.3, age) * power;
        float fb = nz(p / rS * vec2(5.0, 3.5) + vec2(R.w, -age * 0.04)).r;
        float streak = nz(vec2(p.x / rS * 6.0 + R.w, p.y / rS * 0.8 - age * 0.05)).b;
        float up = baseY - hh * (0.04 + 0.32 * wash);
        float sheet = smoothstep(up - 2.0, up + 6.0, p.y + (fb - 0.5) * hh * 0.35) * smoothstep(0.3, 0.5, fb + wash * 0.3);
        float drain = smoothstep(0.66, 0.74, streak) * exp(-age / 2.5) * smoothstep(0.4, 1.0, age) * power
                    * smoothstep(baseY - hh * 0.7, baseY - hh * 0.3, p.y);
        col = mix(col, PAPER, sat(sheet * 0.8 + drain * 0.55) * m * 0.92);
      }
    }
    // foam round its foot, broken into lace, spreading when the swell arrives
    {
      float fy = (p.y - baseY) / rS;
      float spread = hw * (1.15 + 0.6 * exp(-age / 1.6) * power);
      float env = exp(-pow(abs(dx) / spread, 3.0)) * exp(-sq((fy * rS + 0.1 * hh) / (0.12 * hh + 3.0)));
      float f1 = nz(vec2(p.x / rS * 3.0 + R.w, fy * 12.0 - age * 0.03)).b;
      float f2 = nz(vec2(p.x / rS * 7.0 - R.w, fy * 26.0 + age * 0.02)).g;
      float lace = smoothstep(0.6, 0.68, env * (0.05 + 0.6 * f1 + 0.5 * f2 + 0.15 * exp(-age / 1.6) * power));
      lace = max(lace, env * (1.0 - smoothstep(0.0, 0.05, abs(f2 - 0.5))) * 0.75);
      col = mix(col, PAPER, lace * 0.92);
    }
  }
  return col;
}

// spray: when a swell strikes a rock's seaward face, white water bursts up behind it: a lobed
// mass with fingers at its rim, leaning with the wind. It opens into holes and clumps as it
// falls back, flings a few drops and leaves a veil drifting off to the right. White paper,
// held by a faint grey rim.
vec3 spray(vec3 col, vec2 p) {
  float rS = max(uS, 0.5 * uV);
  for (int i = 0; i < NR; i++) {
    vec4 R = ROCK[i];
    if (R.z < 0.05) continue;                  // only the bigger rocks throw spray
    float baseY = rockBase(i);
    float persp = mix(1.0, 0.5, ROCKOUT[i] * 2.0);
    float cx = R.x * uSize.x, hw = R.y * rS * persp, hh = R.z * rS * persp;
    if (p.y > baseY || p.y < baseY - hh * 3.2 || p.x < cx - hw - hh * 1.4 || p.x > cx + hw + hh * 2.4) continue;
    float wave;
    vec2 ap = rockWave(R, cx, baseY, wave);
    float age = ap.x, power = ap.y;
    float life = age / 4.2;
    if (life >= 1.0) continue;
    // where the swell strikes: the rock's seaward face, near its top
    vec2 o = vec2(cx + hw * (hash(vec2(R.w, 4.0)) - 0.5) * 0.6, baseY - hh * 0.6);
    float shoot = 1.0 - pow(1.0 - sat(life * 2.4), 3.0);
    vec2 q = (p - o) / hh;
    q.x -= (0.2 + 0.7 * life) * max(-q.y, 0.0) * 0.45;      // the higher, the further the wind has taken it
    float r = length(q);
    float th = atan(q.x, -q.y);                             // 0 straight up, positive to the right
    // the outline: lobed, tallest straight up, low at the sides
    float lob = nz(vec2(th * 0.3 + wave * 0.23 + R.w, 0.37)).r;
    float lob2 = nz(vec2(th * 1.2 + wave * 0.71, R.w)).g;
    float reach = (0.45 + 0.75 * power) * shoot * (0.45 + 0.7 * lob + 0.25 * lob2) * pow(max(cos(th * 1.15), 0.0), 0.8) + 1e-3;
    float rr = r / reach;
    // the mass: dense at the heart, breaking into clumps and holes as it falls back
    float pn = nz(p / rS * vec2(4.2, 3.4) + vec2(wave * 0.37 - life * 0.12, R.w + life * 0.2)).b;
    float pn2 = nz(p / rS * vec2(10.0, 8.0) + vec2(R.w, wave * 0.19)).r;
    float dens = (1.0 - rr) * 1.5 + (pn - 0.5) * 0.9 + (pn2 - 0.5) * 0.55;
    float thr = 0.15 + 1.0 * smoothstep(0.15, 1.0, life);
    float mass = smoothstep(thr, thr + 0.3, dens);
    float rim = smoothstep(thr - 0.15, thr + 0.05, dens) * (1.0 - smoothstep(thr + 0.05, thr + 0.3, dens));
    // fingers flung out past the rim
    float dth = 0.13;
    float j = floor(th / dth);
    float hj = hash(vec2(j, wave + R.w)), hj2 = hash(vec2(j + 9.1, wave + R.w));
    float c = (j + 0.5 + (hj2 - 0.5) * 0.4) * dth;
    float tip = 1.0 + 0.2 * hj;
    float aw = dth * (0.1 + 0.16 * hj2) * (1.0 - smoothstep(0.85, tip, rr));
    float finger = 0.7 * smoothstep(aw, aw * 0.35, abs(th - c)) * step(0.55, hj) * smoothstep(0.8, 0.92, rr)
                 * (1.0 - smoothstep(tip - 0.1, tip, rr)) * (1.0 - smoothstep(0.35, 0.8, life));
    // drops off the tips
    vec2 dq = (p - o) / 6.0 - vec2(life * life * hh * 0.2 / 6.0, 0.0);
    vec2 di = floor(dq);
    vec2 dp = di + 0.25 + 0.5 * vec2(hash(di + 1.3 + wave), hash(di + 2.9));
    float dr = 0.22 + 0.2 * hash(di + 4.4);
    float drop = step(0.93, hash(di + wave * 7.1 + R.w)) * smoothstep(dr, dr - 0.12, length(dq - dp))
               * smoothstep(0.85, 1.0, rr) * (1.0 - smoothstep(1.25, 1.6, rr)) * step(q.y, 0.1);
    // a veil of fine spray, lifting and drifting off
    vec2 vq = (q - vec2(0.25 + life * 0.9, -0.45 - 0.55 * shoot)) / vec2(0.7 + 0.8 * life, 0.5 + 0.35 * life);
    float vn = nz(p / rS * vec2(2.0, 2.6) + vec2(-life * 0.12, wave * 0.13)).g;
    float veil = exp(-dot(vq, vq)) * smoothstep(0.35, 0.7, vn) * smoothstep(0.05, 0.3, life);
    float fade = (1.0 - smoothstep(0.6, 1.0, life)) * power;
    col *= 1.0 - 0.1 * rim * fade;
    col = mix(col, PAPER, sat((mass * 0.9 + finger + drop * 0.85) * fade + veil * 0.3 * fade));
  }
  return col;
}

// white water along the cliff foot: lace drifting on dark water, and the roller of each
// swell breaking as it comes in
vec3 surf(vec3 col, vec2 p) {
  float y = (p.y - uFoot) / uV;
  if (y < -0.05) return col;
  float z, xw;
  float ph = wavePhase(vec2(p.x, uFoot - 0.004 * uV), z, xw);
  float age = fract(ph) / WSPD;
  float surge = exp(-age / 2.0) * smoothstep(0.0, 0.4, age);
  float top = -0.004 - 0.01 * surge + (nz(vec2(p.x / uV * 2.6, 0.4)).r - 0.5) * 0.008;
  float zone = smoothstep(top - 0.004, top + 0.004, y);
  float l1 = nz(vec2(p.x / uV * 1.4 - uT * 0.005, y * 6.0 - age * 0.02)).b;
  float l2 = nz(vec2(p.x / uV * 3.2 + uT * 0.004, y * 13.0 + 0.3)).g;
  // lace: the foam lies in threads and patches, the water dark between them
  float thread = 1.0 - smoothstep(0.0, 0.05 + 0.03 * surge, abs(l1 * 0.7 + l2 * 0.3 - 0.5));
  float blot = smoothstep(0.58, 0.68, l2 * 0.6 + l1 * 0.4 + surge * 0.12);
  // the roller: a white band along the front of the zone, thickest just after the swell breaks
  float roll = exp(-sq((y - top - 0.004) / (0.004 + 0.006 * surge))) * (0.5 + 0.5 * smoothstep(0.3, 0.6, l2));
  float lace = sat(max(max(thread * 0.85, blot), roll));
  vec3 water = inkTone(0.5 + 0.12 * l2, TEAL);
  return mix(col, mix(water, PAPER, lace * 0.95), zone);
}

// ── the cliff edge the viewer stands on, and its grass ─────────────────────
float edgeY(float x) {
  float u = x / uSize.x;
  return uSize.y - uV * (0.155 + 0.085 * smoothstep(0.3, 1.0, u)) + (nz(vec2(x / uV * 0.5, 0.77)).r - 0.5) * 0.05 * uV;
}

vec3 foreground(vec3 col, vec2 p) {
  float ye = edgeY(p.x);
  // the turf: a dark stroke pressed along the lip, with flying white where the brush ran dry,
  // then a pale wash flicked with short strokes of grass, left to fade into the paper
  if (p.y > ye - 2.0) {
    float dy = (p.y - ye) / uV;
    // (no lookup here is stretched much more in one direction than the other: thresholding a
    // strongly stretched, mipmapped lookup draws blocks)
    float s1 = nz(vec2(p.x / uV * 1.4, dy * 4.0) + 0.4).b;
    float s3 = nz(vec2(p.x / uV * 0.4, 0.2)).r;
    // short strokes of grass flicked up and to the right all through it
    // (rotated, not sheared, into the stroke direction, so the noise lattice does not show as blocks)
    vec2 fq = vec2(dot(p, vec2(0.88, 0.48)), dot(p, vec2(-0.48, 0.88))) / uV;
    vec2 fq2 = vec2(dot(p, vec2(0.83, 0.56)), dot(p, vec2(-0.56, 0.83))) / uV;
    float flick = nz(fq * vec2(13.0, 2.2) + 0.33).b;
    float flick2 = nz(fq2 * vec2(24.0, 3.6) + 0.71).g;
    float mass = 1.0 - smoothstep(0.012 + 0.016 * s3, 0.075 + 0.045 * s3, dy + (s1 - 0.5) * 0.03);
    float d = (0.7 + 0.2 * smoothstep(0.4, 0.7, s1)) * mass;
    d *= 0.8 + 0.3 * smoothstep(0.45, 0.7, flick) + 0.08 * smoothstep(0.5, 0.7, flick2);
    // flying white where the brush ran dry, more of it lower down
    d *= 1.0 - 0.7 * smoothstep(0.5, 0.64, flick2 * 0.6 + s1 * 0.4) * smoothstep(0.01, 0.07, dy);
    d += 0.3 * exp(-(p.y - ye) / (2.0 * uPx + 1.0));                                   // pressed hard at the lip
    float m = smoothstep(-uPx, uPx, p.y - ye);
    col = mix(col, inkTone(d, SLATE), m);
  }
  // grass: tapered blades in tufts, leaning with the wind and swaying in the gusts that run along the edge
  float gS = max(uS, 0.55 * uV);           // on a phone held upright the grass keeps a sensible size
  float gh = (0.075 + 0.045 * smoothstep(0.4, 0.9, p.x / uSize.x)) * gS;
  float sh = gh * 1.9;                     // the silver grass stands taller
  if (p.y < ye - sh * 1.05) return col;
  float gust = smoothstep(0.25, 0.8, nz(vec2(p.x / uV * 0.3 - uT * 0.045, 0.5)).r);
  if (p.y > ye - gh * 1.15 && p.y < ye + 4.0) {
    float cw = max(0.0055 * gS, 2.5);
    float cell = floor(p.x / cw);
    float ink = 0.0;
    for (int j = -14; j <= 1; j++) {     // (a blade leans at most 13 cells to the right)
      float c = cell + float(j);
      float h1 = hash(vec2(c, 1.7)), h2 = hash(vec2(c, 9.1)), h3 = hash(vec2(c, 4.3));
      float tuft = smoothstep(0.3, 0.72, nz(vec2(c * cw / uV * 2.4, 0.13)).r);    // the grass grows in clumps
      float bh = gh * (0.22 + 0.78 * h2 * h2) * (0.35 + 0.8 * tuft);
      float v = (ye + 3.0 - p.y) / bh;
      if (v < 0.0 || v > 1.0) continue;
      float bx = (c + h1) * cw;
      float lean = min((0.18 + 0.2 * h3 + 0.22 * gust + 0.04 * sin(uT * (1.1 + h1 * 0.8) + h2 * 6.28)) * bh, 9.5 * cw);
      float x = bx + lean * v * v + (h1 - 0.5) * bh * 0.25 * v;
      float wt = max(1.4 * uPx, 0.0042 * gS) * (1.0 - v * 0.9) * (0.7 + 0.6 * h1);
      float w = max(wt, 1.1 * uPx);
      float blade = (1.0 - smoothstep(0.35, 1.0, abs(p.x - x) / w)) * (wt / w);
      ink = max(ink, blade * (h3 > 0.7 ? 0.45 : 0.7 + 0.3 * h2));               // some stand behind, paler
    }
    float tone = 0.92 - 0.3 * sat((ye - p.y) / gh);
    col = mix(col, inkTone(tone, SLATE), ink);
  }
  // silver grass (억새): a few tall stems, their plumes streaming downwind
  if (p.y < ye + 4.0) {
    float cw = 0.05 * gS * (1.0 + uNarrow);
    float cell = floor(p.x / cw);
    for (int j = -4; j <= 0; j++) {     // (a stem and its plume reach up to four cells downwind)
      float c = cell + float(j);
      float h1 = hash(vec2(c, 2.3)), h2 = hash(vec2(c, 7.9));
      if (h2 < 0.5) continue;
      float bx = (c + 0.2 + 0.6 * h1) * cw;
      float yb = edgeY(bx) + 3.0;
      float bh = sh * (0.7 + 0.3 * h2);
      float v = (yb - p.y) / bh;
      if (v < 0.0 || v > 1.12) continue;
      float sway = 0.04 * sin(uT * (0.7 + 0.3 * h1) + h2 * 6.28 + bx / uV * 3.0);
      float lean = (0.3 + 0.25 * gust + sway) * bh;
      float x = bx + lean * v * v;
      // the stem
      float sw = max(0.0025 * gS, 1.0 * uPx);
      float stem = (1.0 - smoothstep(0.3, 1.0, abs(p.x - x) / sw)) * step(v, 0.98);
      col = mix(col, inkTone(0.62, SLATE), stem * 0.8);
      // the plume: soft and silvery, drawn with fine hairs, streaming off the top of the stem
      float pv = (v - 0.58) / 0.46;
      if (pv > 0.0 && pv < 1.2) {
        float slope = 2.0 * lean * v / bh;                        // the stem's lean here
        float pw = bh * 0.055 * sin(3.14159 * sat(pv / 1.1)) + uPx;
        float stream = (0.08 + 0.12 * gust + sway) * bh * pv * pv + pw * 0.4;  // the wind combs it out downwind
        float dxp = p.x - x - stream;
        float pm = exp(-sq(dxp / pw)) * smoothstep(1.15, 0.9, pv);
        float hair = nz(vec2(dxp / bh * 30.0 - pv * slope * 6.0, pv * 1.5 + h1)).b;
        col = mix(col, inkTone(0.26 + 0.4 * smoothstep(0.52, 0.7, hair), SLATE), pm * 0.85);
      }
    }
  }
  return col;
}

// ── rain ───────────────────────────────────────────────────────────────────
float rainLayer(vec2 p, float ang, float cell, float len, float fall, float dens, float wid, float seed) {
  float c = cos(ang), s = sin(ang);
  vec2 r = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  r.y -= fall;
  float col = floor(r.x / cell);
  float yy = r.y / len + hash(vec2(col, seed)) * 17.0;
  float id = mod(floor(yy), 256.0);
  float pr = hash(vec2(col + 0.5, id + seed));
  if (pr > dens) return 0.0;
  float along = fract(yy) / (0.3 + 0.45 * hash(vec2(id, col + seed)));
  if (along > 1.0) return 0.0;
  float fx = r.x - (col + 0.2 + 0.6 * hash(vec2(id + 3.1, col))) * cell;
  float w = max(wid, uPx * 0.9);
  float line = 1.0 - smoothstep(w * 0.35, w * 0.5 + uPx * 0.7, abs(fx));
  return line * sin(3.14159 * along) * (wid / w) * (0.55 + 0.45 * pr / dens);
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * uPx;
  float W = uSize.x, H = uSize.y;
  // the painting dissolves into the page above and below
  float en = nz(px / uV * vec2(0.5, 0.3) + 0.21).r;
  float aTop = smoothstep(0.0, mix(0.3, 0.2, uNarrow) * uV, px.y + (en - 0.5) * mix(0.2, 0.12, uNarrow) * uV);
  float aBot = 1.0 - smoothstep(H - 0.12 * uV, H - 0.005 * uV, px.y + (en - 0.5) * 0.08 * uV);
  float alpha = aTop * aBot;
  if (alpha < 0.002) { o = vec4(0.0); return; }

  // under the letter card only a breath of it shows through: keep it plain there
  float inCard = min(min(px.x - uCard.x, uCard.z - px.x), min(px.y - uCard.y, uCard.w - px.y));
  vec3 plain = inkTone(0.12 + 0.2 * smoothstep(0.0, 0.6 * uV, px.y), SLATE);
  if (inCard > 90.0) { o = vec4(plain * alpha, alpha); return; }

  // layers shift a little with the pointer, the nearer the more
  vec2 par = uPtr * vec2(1.0, 0.5);
  vec2 pSky = px + par * 5.0;
  vec2 pSea = px + par * 10.0;
  vec3 col = vec3(0.0);
  if (pSea.y < uHz + 2.0 * uPx) {                 // (the sea covers the sky below the horizon)
    col = sky(pSky, breakMask(pSky));
    if (px.y > uHz - 0.06 * uV) col = island(col, px + par * 7.0);
  }
  if (pSea.y > uHz) col = mix(col, sea(pSea), smoothstep(uHz, uHz + 1.5 * uPx, pSea.y));
  col = mistBand(col, px + par * 8.0, uHz - 0.004 * uV, 0.016, 0.5, 0.3);

  // headlands, far to near, with mist between them
  float fs = uFoot - uHz;
  vec2 pc = px + par * 7.0;
  col = headland(col, pc, W * mix(0.45, 0.6, uNarrow), 0.11, 0.012, 0.5, 5.3, 0.0);
  col = mistBand(col, pc, uHz - 0.005 * uV, 0.03, 0.55, 1.7);
  pc = px + par * 10.0;
  col = headland(col, pc, W * mix(0.34, 0.42, uNarrow), 0.24, 0.05, 0.8, 2.1, 0.5);
  col = mistBand(col, pc, uHz + 0.045 * uV, 0.04, 0.5, 3.9);
  pc = px + par * 14.0;
  col = headland(col, pc, W * mix(0.19, 0.22, uNarrow), 0.66, fs / uV + 0.02, 0.92, 7.7, 1.0);
  {
    // the pine stands back from the edge, on the shoulder of the near cliff
    float nfx = W * mix(0.19, 0.22, uNarrow);
    float rx = nfx - 0.12 * uV;
    if (rx > 0.04 * uV) col = pine(col, pc, vec2(rx, uHz + (ridge(rx, nfx, 0.66, 7.7) + 0.006) * uV), 0.24 * uV, 3.7);
  }
  col = mistBand(col, pc, uFoot - 0.1 * uV, 0.05, 0.3, 6.1);
  {
    // a drift of cloud across the near cliff, about halfway up
    float cxk = smoothstep(W * mix(0.19, 0.22, uNarrow) + 0.12 * uV, W * mix(0.19, 0.22, uNarrow) - 0.05 * uV, pc.x);
    vec3 mc = mistBand(col, pc + vec2(0.0, (nz(vec2(pc.x / uV * 0.9 - uT * 0.006, 0.61)).r - 0.5) * 0.12 * uV), uHz - 0.28 * uV, 0.055, 0.42, 8.3);
    col = mix(col, mc, cxk);
  }

  // far and middle rain, in front of the far scene; it falls from the clouds, not above them
  float a1 = 0.2;
  float rainK = smoothstep(mix(0.4, 0.22, uNarrow) * uV, mix(0.75, 0.5, uNarrow) * uV, px.y);
  float rf = rainLayer(px + par * 6.0, a1, 7.0, 90.0, uRain.x, 0.33, 0.6, 1.0);
  float rm = rainLayer(px + par * 12.0, a1 + 0.02, 13.0, 160.0, uRain.y, 0.28, 0.9, 2.0);
  col = mix(col, inkTone(0.5, SLATE), rf * 0.22 * rainK);
  col = mix(col, inkTone(0.55, SLATE), rm * 0.3 * rainK);

  // the rocks, the surf and the spray at the cliff foot
  vec2 pr = px + par * 18.0;
  if (pr.y > uFoot - 0.75 * uV && pr.y < uFoot + 0.1 * uV) {
    col = surf(col, pr);
    col = spray(col, pr);       // the swells strike the seaward faces, so the spray rises from behind the rocks
    col = rocks(col, pr);
  }
  col = foreground(col, px + par * 26.0);

  float rn = rainLayer(px + par * 30.0, a1 + 0.04, 29.0, 260.0, uRain.z, 0.2, 1.4, 3.0);
  col = mix(col, inkTone(0.5, SLATE), rn * 0.26 * rainK);

  col = mix(col, plain, smoothstep(30.0, 90.0, inCard));

  // hanji: soft mottling and long fibres, ink settling into them
  vec2 pq = px / 640.0;
  float mott = nz(pq * 0.9).a;
  float fib = nz(vec2(pq.x * 6.0, pq.y * 6.0) + 0.3).b;
  float fib2 = nz(vec2(pq.x * 20.0, pq.y * 4.5)).b;
  col *= (0.982 + 0.03 * mott) * (0.99 + 0.018 * fib);
  col += smoothstep(0.62, 0.8, fib2) * 0.012;
  col += (hash(gl_FragCoord.xy) - 0.5) * 0.014;
  o = vec4(col * alpha, alpha);
}`;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// a stable random number per integer
const h1 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const gauss = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (w * w));

// ── the shader's swell timing, worked out here to choose the still frame ──
// the noise texture as the shader reads it at mip level 0: bilinear, wrapping; channel c
function nzJ(u, v, c) {
  const { data, size } = noiseData(256);
  const at = (i, j) => data[((((j % size) + size) % size) * size + (((i % size) + size) % size)) * 4 + c] / 255;
  const x = u * size - 0.5, y = v * size - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
  const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
  return a + (b - a) * fy;
}
// the shader's hash(), in single precision
const fr = Math.fround;
const fractJ = (x) => fr(x - Math.floor(x));
function hashJ(x, y) {
  let a = fractJ(fr(x * 0.1031)), b = fractJ(fr(y * 0.1031)), c = a;
  const d = fr(fr(fr(a * fr(b + 33.33)) + fr(b * fr(c + 33.33))) + fr(c * fr(a + 33.33)));
  a = fr(a + d); b = fr(b + d); c = fr(c + d);
  return fractJ(fr(fr(a + b) * c));
}

export function createStorm(canvas, { reduceMotion = false, mobile = false, card = null } = {}) {
  if (!canvas) return null;
  let gl = null;
  try {
    gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true });
  } catch { gl = null; }
  if (!gl) return null;

  // ── GL resources (built again if the context is lost and restored) ──
  let prog = null, vao = null, vb = null, tex = null, U = {}, layoutSent = false;
  function init() {
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    prog = gl.createProgram();
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs); gl.deleteShader(fs);   // freed along with the program
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    U = {};
    for (let i = 0, n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS); i < n; i++) {
      const name = gl.getActiveUniform(prog, i).name;
      U[name] = gl.getUniformLocation(prog, name);
    }
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const nd = noiseData(256);
    tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, nd.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.uniform1i(U.uN, 0);
    layoutSent = false;
  }
  try { init(); } catch (e) {
    console.warn('storm: shader failed', e);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }

  // ── layout ──
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  const maxRB = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 4096, gl.getParameter(gl.MAX_VIEWPORT_DIMS)?.[1] || 4096, 8192);
  const cardEl = card || canvas.parentElement?.querySelector('.letter') || null;
  let res = 0.5, W = 0, H = 0, V = 0, S = 0, lastIW = -1, lastIH = -1;
  let hz = 0, foot = 0, brkX = 0, brkR = 0, narrow = 0, stillT = 1.3;
  const cardR = [0, 0, 0, 0];
  let dirty = true, full = true;

  function measure() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    // the view unit follows width changes and large height changes only, so a mobile URL bar
    // showing or hiding does not reflow the sky
    if (innerWidth !== lastIW || Math.abs(innerHeight - lastIH) > 160 || !V) {
      V = clamp(innerHeight, 480, 1100); lastIW = innerWidth; lastIH = innerHeight;
    }
    S = Math.min(V, W * 0.95);
    let cardBottom = -1;
    if (cardEl) {
      const c = cardEl.getBoundingClientRect();
      cardR[0] = c.left - r.left; cardR[1] = c.top - r.top; cardR[2] = c.right - r.left; cardR[3] = c.bottom - r.top;
      cardBottom = cardR[3];
    } else cardR.fill(0);
    // the sea meets the sky a little below the card, so the whole view opens up under the letter
    hz = cardBottom > 0 ? cardBottom + 0.22 * V : H - 0.78 * V;
    hz = clamp(hz, Math.min(0.5 * V, H * 0.4), H - 0.5 * V);
    foot = Math.max(hz + 0.22 * V, H - 0.2 * V);
    narrow = clamp((1.0 - W / V) / 0.5, 0, 1);
    brkX = W * (0.84 - 0.1 * narrow);
    brkR = Math.min(0.34 * V, 0.24 * W);
    stillT = chooseStill();
    // reduced resolution; the browser upscales it (it is soft by nature)
    res = mobile ? Math.min(0.6, 0.45 * dpr) : Math.min(0.62, 0.5 * dpr);
    const area = W * H * res * res;
    const cap = mobile ? 1.6e6 : 3.2e6;
    if (area > cap) res *= Math.sqrt(cap / area);
    if (H * res > maxRB) res = maxRB / H;
    const bw = Math.max(1, Math.round(W * res)), bh = Math.max(1, Math.round(H * res));
    if (bw !== canvas.width || bh !== canvas.height) { canvas.width = bw; canvas.height = bh; }
    full = true; dirty = false; layoutSent = false;
  }

  // the moment painted for reduced motion (and the default for renderAt): about a second after
  // a strong swell strikes the big rock, its spray at full height. The shader's wavePhase(),
  // at the rock, at time 0:
  function chooseStill() {
    const x = BIG.x * W, y = foot - 0.004 * V;
    const s = Math.max((y - hz) / V, 0), z = 0.1 / (s + 0.01), xw = ((x - 0.5 * W) / V) * z;
    const bend = (nzJ(xw * 0.04, z * 0.03 + 0.3, 1) - 0.5) * 1.3
      + (nzJ((x / V) * 0.45, z * 0.15 + 0.7, 0) - 0.5) * 0.28
      + (nzJ((x / V) * 1.3, z * 0.2 + 0.5, 0) - 0.5) * Math.min(0.2, (14 * WK * 0.1) / ((s + 0.01) * (s + 0.01) * V));
    const ph0 = z * WK + bend + ((BIG.seed * 0.37) % 1) * 0.6;
    const first = ((((1.1 * WSPD - ph0) % 1) + 1) % 1) / WSPD;
    // of the first two swells, the one that strikes harder (before the first flash of light at 16 s)
    const power = (tt) => hashJ(Math.floor(ph0 + tt * WSPD), BIG.seed);
    return power(first + 1 / WSPD) > power(first) ? first + 1 / WSPD : first;
  }

  // ── a soft flicker of light inside the clouds, every 25–40 s (deterministic in time) ──
  const flash = [0, 0, 1, 0];
  let fT = 16, fK = 0;               // the latest flash at or before the last time asked for
  function flashAt(t) {
    flash[3] = 0;
    if (t < fT) { fT = 16; fK = 0; }
    while (fK < 1e6) {
      const next = fT + 25 + 15 * h1(fK);
      if (next > t) break;
      fT = next; fK++;
    }
    const T = fT, k = fK;
    const dt = t - T;
    if (dt < 0 || dt > 2.5) return;
    const e = Math.max(0.55 * gauss(dt, 0.06, 0.06), gauss(dt, 0.34, 0.09)) + 0.28 * Math.exp(-Math.max(0, dt - 0.34) / 0.55) * clamp((dt - 0.22) / 0.12, 0, 1);
    const left = h1(k + 0.31) < 0.5;
    flash[0] = W * (left ? 0.06 + 0.2 * h1(k + 0.7) : 0.74 + 0.2 * h1(k + 0.7));
    flash[1] = Math.max(0.35 * V, hz - V * (0.3 + 0.45 * h1(k + 0.9)));
    flash[2] = 0.3 * V;
    flash[3] = e * (0.65 + 0.35 * h1(k + 0.5));
  }

  // ── pointer parallax ──
  const ptr = [0, 0], ptrT = [0, 0];
  const onPtr = (e) => {
    if (e.pointerType === 'touch') return;
    ptrT[0] = clamp((e.clientX / innerWidth) * 2 - 1, -1, 1);
    ptrT[1] = clamp((e.clientY / innerHeight) * 2 - 1, -1, 1);
  };
  if (!reduceMotion) addEventListener('pointermove', onPtr, { passive: true });

  let lost = false;
  function draw(t, whole) {
    if (lost) return;
    if (dirty) measure();
    let y0 = 0, y1 = H;
    // only the band of the section that is on screen (and a margin) is repainted
    if (!whole && !full) {
      const r = canvas.getBoundingClientRect();
      const m = 0.3 * innerHeight;        // enough that even a fast fling only ever reveals fresh paint
      y0 = clamp(-r.top - m, 0, H); y1 = clamp(innerHeight - r.top + m, 0, H);
      if (y1 <= y0) return;
    }
    full = false;
    flashAt(t);
    const bh = canvas.height, sy = bh / H;
    gl.viewport(0, 0, canvas.width, bh);
    gl.enable(gl.SCISSOR_TEST);
    const g0 = Math.max(0, Math.floor((H - y1) * sy) - 1), g1 = Math.min(bh, Math.ceil((H - y0) * sy) + 1);
    gl.scissor(0, g0, canvas.width, g1 - g0);
    if (!layoutSent) {
      // the layout only changes on a resize: sent once, not every frame
      gl.uniform2f(U.uRes, canvas.width, bh);
      gl.uniform2f(U.uSize, W, H);
      gl.uniform1f(U.uPx, W / canvas.width);
      gl.uniform1f(U.uV, V);
      gl.uniform1f(U.uS, S);
      gl.uniform1f(U.uHz, hz);
      gl.uniform1f(U.uFoot, foot);
      gl.uniform1f(U.uNarrow, narrow);
      gl.uniform2f(U.uBreak, brkX, brkR);
      gl.uniform4f(U.uCard, cardR[0], cardR[1], cardR[2], cardR[3]);
      layoutSent = true;
    }
    gl.uniform1f(U.uT, t);
    gl.uniform2f(U.uPtr, ptr[0], ptr[1]);
    gl.uniform4f(U.uFlash, flash[0], flash[1], flash[2], flash[3]);
    // rain: fall speed (px/s) and drop spacing per layer, wrapped here in double precision
    gl.uniform3f(U.uRain, (t * 240) % (90 * 256), (t * 400) % (160 * 256), (t * 640) % (260 * 256));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.SCISSOR_TEST);
  }

  // ── loop: only while active and the tab is visible ──
  let raf = 0, active = false, t = 0, last = 0, destroyed = false, stillQueued = false;
  const minGap = mobile ? 1000 / 34 : 1000 / 70; // it is slow: at most ~60 fps, ~30 on phones
  function frame(now) {
    raf = 0;
    if (!active || document.hidden || destroyed || lost) return;
    raf = requestAnimationFrame(frame);
    if (now - last < minGap) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    const k = 1 - Math.exp(-dt * 1.5);
    ptr[0] += (ptrT[0] - ptr[0]) * k; ptr[1] += (ptrT[1] - ptr[1]) * k;
    draw(t, false);
  }
  // reduced motion: one painted moment, repainted (once per frame at most) when the layout changes
  function still() {
    if (stillQueued) return;
    stillQueued = true;
    requestAnimationFrame(() => { stillQueued = false; if (!destroyed) draw(stillT, true); });
  }
  function start() {
    if (destroyed || lost || raf || !active || document.hidden) return;
    if (reduceMotion) { if (dirty || full) still(); return; }
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);

  const relayout = () => { dirty = true; if (reduceMotion && active) still(); };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(relayout) : null;
  ro?.observe(canvas);
  if (cardEl) ro?.observe(cardEl);
  addEventListener('resize', relayout);

  const onLost = (e) => { e.preventDefault(); lost = true; stop(); };
  const onRestored = () => {
    try { init(); } catch { return; }
    lost = false; dirty = true;
    if (reduceMotion) { if (active) still(); } else start();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  measure();
  if (reduceMotion) draw(stillT, true);

  return {
    /** run while the section is on screen, stop when it is not */
    setActive(on) {
      active = !!on;
      if (active) start(); else stop();
    },
    /** paint one frame at a given time (seconds), the whole section: for stills and tests */
    renderAt(seconds) {
      if (destroyed) return;
      dirty = true;
      if (seconds === undefined) { measure(); seconds = stillT; }
      draw(seconds, true);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; active = false; stop();
      removeEventListener('pointermove', onPtr);
      removeEventListener('resize', relayout);
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      ro?.disconnect();
      if (!lost) { gl.deleteTexture(tex); gl.deleteBuffer(vb); gl.deleteVertexArray(vao); gl.deleteProgram(prog); }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
