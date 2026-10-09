// the storm behind the letter: sky, cliffs, sea, rocks, grass and rain, all in one fragment shader.
// drawn at reduced res and only the visible strip is redrawn each frame. falls back to the css wash if the shader dies later
import { noiseData } from './noise.js?v=15902125b0';

// shared with the shader, and used to time the still frame
const WK = 6;         // swells per unit of depth
const WSPD = 0.15;    // swells per second
const BIG = { x: 0.12, seed: 1.3 };
// portrait phones: push the rocks in from the left so the spray isn't cut off
const rockX = (x, narrow) => x + narrow * (0.18 + 0.1 * x);
const f1 = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

const VERT = `#version 300 es
layout(location = 0) in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uN;
uniform vec2 uRes;       // drawing buffer (px)
uniform vec2 uSize;      // canvas, css px
uniform float uPx;       // css px per buffer px
uniform float uV;        // view unit (viewport height, clamped)
uniform float uS;        // size unit for rocks and grass
uniform float uHz;       // horizon y
uniform float uFoot;     // waterline at the cliff foot
uniform float uNarrow;   // 0 wide, 1 portrait phone
uniform vec2 uBreak;     // gap in the clouds: centre x, half width
uniform float uT;        // seconds
uniform vec2 uPtr;       // pointer, smoothed, -1..1
uniform vec4 uCard;      // letter card rect x0 y0 x1 y1
uniform vec4 uFlash;     // cloud flash: x, y, radius, strength
uniform vec3 uRain;      // rain offset per layer, wrapped in js
out vec4 o;

const vec3 PAPER = vec3(0.945, 0.922, 0.878);
const vec3 INK = vec3(0.086, 0.067, 0.059);
const vec3 SLATE = vec3(0.2, 0.235, 0.3);
const vec3 TEAL = vec3(0.17, 0.23, 0.28);
const vec3 WARM = vec3(0.86, 0.58, 0.42);     // faint apricot light through the gap

float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec4 nz(vec2 p) { return texture(uN, p); }
vec4 nzl(vec2 p) { return textureLod(uN, p, 0.0); }
// manual mip level for lookups that jump per cell, otherwise every edge gets a blurry 2x2 block
vec4 nzd(vec2 p, float texPerPx) { return textureLod(uN, p, log2(max(texPerPx * 256.0, 1.0))); }
float sat(float x) { return clamp(x, 0.0, 1.0); }
float sq(float x) { return x * x; }   // pow() breaks on negatives
// wrap uT first, mobile gpus get sin() wrong for big args
float tsin(float k, float ph) { return sin(6.2831853 * fract(uT * k * 0.15915494) + ph); }
// pale washes keep the tint, heavy ink goes warm black
vec3 inkTone(float d, vec3 tint) { return mix(PAPER, mix(tint, INK, smoothstep(0.45, 1.05, d)), sat(d)); }

// sky
float breakMask(vec2 p) {
  vec2 d = (p - vec2(uBreak.x, uHz - 0.05 * uV)) / vec2(uBreak.y, 0.13 * uV);
  float n = nz(p / uV * vec2(0.6, 1.4) + vec2(uT * 0.0015, 0.2)).r;
  return exp(-dot(d, d) * (0.45 + n * 1.3));
}

vec3 sky(vec2 p, float brk) {
  float hgt = (uHz - p.y) / uV;
  vec2 cq = p / uV - vec2(uT * 0.0045, 0.0);
  vec4 w = nz(cq * 0.22 + vec2(uT * 0.0012, uT * 0.0007));
  vec2 wq = cq + (w.rg - 0.5) * vec2(0.16, 0.1);
  float gran = nz(p / uV * vec2(5.0, 6.0)).b;
  float topLine = mix(0.4, 0.2, uNarrow) + (nz(vec2(cq.x * 0.16, 0.83)).a - 0.5) * mix(0.55, 0.3, uNarrow);
  // billows: rows of round lobes, lower rows in front, pale on top and shaded underneath
  float bump = nz(wq * vec2(2.6, 3.2) + 0.4).g;
  float d = 0.3 * smoothstep(topLine + 0.02, topLine + 0.1, wq.y), inC = 0.0, rowY = topLine;
  // no lobe reaches this high, skip the rows
  if (wq.y > topLine - 0.16) for (int k = 0; k < 6; k++) {
    float fk = float(k);
    float r = 0.06 + 0.032 * fk;
    float sp = r * 1.3;
    float off = hash(vec2(fk, 1.3)) * sp;
    float i0 = floor((wq.x - off) / sp);
    // 3 nearest lobes, sorted so the lower one ends up in front
    vec3 L[3];
    float nearest = 1e3;
    for (int j = 0; j < 3; j++) {
      float i = i0 + float(j - 1);
      float h1 = hash(vec2(i, fk + 0.5)), h2 = hash(vec2(i, fk + 7.7)), h3 = hash(vec2(i, fk + 3.3));
      // drop a few so the top edge isn't a neat scallop
      if (fract(h3 * 7.0) < 0.15) { L[j] = vec3(1e3, 0.0, 0.0); continue; }
      float rr = r * (0.55 + 0.9 * h3) * (1.0 + 0.06 * tsin(0.09, h1 * 6.3));
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
      dl += 0.05 * exp(-abs(L[j].x) / 0.006);
      d = mix(d, dl, m);
    }
    if (k == 0) {
      float m0 = smoothstep(e, -e, nearest);
      inC = max(m0, smoothstep(rowY, rowY + 0.05, wq.y));
      d += 0.06 * exp(-abs(nearest) / 0.007) * m0;
    }
    rowY += r * 0.85;
  }
  rowY = topLine + 0.714;                                         // sum of the 6 row steps
  d *= inC;
  // cloud body under the billows, one heavy wet wash
  float b1 = nz(wq * vec2(0.5, 0.7) + 0.17).r;
  float b2 = nz(wq * vec2(1.2, 1.5) + 0.61).g;
  float deep = smoothstep(rowY - 0.12, rowY + 0.25, wq.y + (b1 - 0.5) * 0.25);
  float baseH = 0.15 + 0.1 * nz(vec2(cq.x * 0.35, 0.37)).r;
  float body = 0.36 + 0.18 * smoothstep(0.35, 0.75, b1) + 0.06 * (b2 - 0.5);
  body *= 1.0 + 0.3 * smoothstep(baseH + 0.5, baseH + 0.03, hgt);
  body += 0.1 * exp(-sq((hgt - baseH - 0.02 + (b2 - 0.5) * 0.06) / 0.035));
  float bloom = smoothstep(0.52, 0.56, b2) * (1.0 - smoothstep(0.56, 0.62, b2));
  body += 0.03 * bloom - 0.08 * smoothstep(0.62, 0.78, b2);
  d = mix(d, body, deep);
  inC = max(inC, deep);
  d *= 0.88 + 0.24 * gran;
  // base frays into rain a bit above the sea
  float under = smoothstep(baseH, baseH - 0.13, hgt + (b2 - 0.5) * 0.08);
  float veilN = nz(vec2((p.x + (uHz - p.y) * 0.25) / uV * 2.6 - uT * 0.004, p.y / uV * 0.1 + 0.3)).g;
  float veil = smoothstep(0.42, 0.75, veilN);
  d = mix(d, 0.14 + 0.16 * veil * smoothstep(-0.01, 0.1, hgt), under);
  d = max(d, 0.03 + 0.04 * b2 * smoothstep(0.1 * uV, 0.4 * uV, p.y));
  // the gap: clouds thin over the horizon, and a ragged hole lets light shafts down
  d *= 1.0 - 0.82 * brk;
  vec2 src = vec2(uBreak.x + 0.1 * uBreak.y, uHz - 0.19 * uV);
  vec2 hq = (p - src) / vec2(uBreak.y * 0.9, 0.065 * uV);
  float hole = 0.0;
  if (dot(hq, hq) < 9.0) {
    float hn = nz(p / uV * vec2(1.1, 2.0) + vec2(uT * 0.002, 0.4)).g;
    float hn2 = nz(p / uV * vec2(3.5, 5.0) + vec2(uT * 0.003, 0.7)).r;
    float hl = length(hq * vec2(1.0, 1.0 + 0.6 * smoothstep(0.0, 1.0, hq.y))) + (hn - 0.5) * 1.3 + (hn2 - 0.5) * 0.5
             + 0.4 * smoothstep(0.0, 1.0, hq.x) * hn2;
    hole = smoothstep(1.0, 0.3, hl);
    d *= 1.0 - 0.3 * exp(-sq((hl - 1.05) / 0.35));
    d = mix(d, 0.1, hole * 0.75);
    d += 0.1 * smoothstep(0.55, 0.7, hn2) * hole;
  }
  float below = p.y - src.y;
  float ang = (p.x - src.x) / (max(below, 0.0) + 0.04 * uV);
  float fan = exp(-ang * ang / 0.3) * smoothstep(0.0, 0.05 * uV, below) * smoothstep(-0.005, 0.04, hgt);
  float shaft = fan > 0.002 ? smoothstep(0.42, 0.72, nz(vec2(ang * 2.2 + uT * 0.002, 0.21)).r) : 0.0;
  d *= 1.0 - 0.42 * shaft * fan;
  // the occasional flash inside the clouds
  vec2 fd = (p - uFlash.xy) / uFlash.z;
  float flashK = uFlash.w * exp(-dot(fd, fd)) * (0.3 + 0.7 * inC);
  d *= 1.0 - 0.45 * flashK;
  vec3 col = inkTone(d, SLATE);
  float g = brk * (1.0 - smoothstep(0.0, 0.16, hgt)) * smoothstep(-0.01, 0.006, hgt) + 0.4 * hole + 0.25 * shaft * fan * brk + 0.25 * flashK;
  return mix(col, mix(PAPER, WARM, 0.32), sat(g) * 0.5);
}

// small island on the horizon next to the gap
vec3 island(vec3 col, vec2 p) {
  float w = min(0.17 * uV, 0.15 * uSize.x);
  float k = (p.x - (uBreak.x - uBreak.y * 0.3)) / w;
  if (abs(k) > 1.0) return col;
  float n = nz(vec2(p.x / uV * 2.0, 0.71)).r;
  float h = (pow(1.0 - k * k, 0.8) * 0.7 + 0.3 * exp(-sq((k + 0.4) * 3.0))) * (0.026 + 0.012 * n) * uV;
  float y = uHz - p.y;
  float m = smoothstep(h + uPx, h - uPx, y) * smoothstep(-0.004 * uV, 0.0, y);
  float d = 0.4 - 0.2 * smoothstep(h * 0.6, -0.002 * uV, y);
  return mix(col, inkTone(d, SLATE), m);
}

// sea
const float WK = ${f1(WK)};
const float WSPD = ${f1(WSPD)};
float wavePhase(vec2 p, out float z, out float xw) {
  float s = max((p.y - uHz) / uV, 0.0);
  z = 0.1 / (s + 0.01);
  xw = (p.x - 0.5 * uSize.x) / uV * z;
  float bend = (nz(vec2(xw * 0.04, z * 0.03 + 0.3)).g - 0.5) * 1.3
             + (nz(vec2(p.x / uV * 0.45, z * 0.15 + 0.7)).r - 0.5) * 0.28
             + (nz(vec2(p.x / uV * 1.3, z * 0.2 + 0.5)).r - 0.5) * min(0.2, 14.0 * WK * 0.1 / ((s + 0.01) * (s + 0.01) * uV));
  return z * WK + uT * WSPD + bend;
}

vec3 sea(vec2 p) {
  float s = max((p.y - uHz) / uV, 0.0);
  float z, xw;
  float ph = wavePhase(p, z, xw);
  vec4 n = nz(vec2(xw * 0.25, z * 0.7));
  float wv = nz(vec2(p.x / uV * 0.35, p.y / uV * 0.9) + 0.13).a;
  // far water stays pale under the mist, ink gathers toward the shore
  float d = 0.43 + 0.08 * smoothstep(0.05, 0.4, s) + (n.r - 0.5) * 0.14 + (wv - 0.5) * 0.16;
  d *= 0.3 + 0.7 * smoothstep(0.0, 0.05, s + (wv - 0.5) * 0.04);
  float aa = WK * 0.1 / ((s + 0.01) * (s + 0.01)) / uV * uPx;    // phase per buffer pixel
  float det = smoothstep(0.035, 0.12, s);
  float near = smoothstep((uFoot - uHz) / uV - 0.2, (uFoot - uHz) / uV, s);
  float dxp = uPx / uV;                                            // per buffer pixel
  float dzp = 0.1 / ((s + 0.01) * (s + 0.01)) * dxp;
  if (det > 0.0) {
    // each swell is a row of brush strokes, each with its own length, height and bow. about half are left unpainted
    float idc = floor(ph + 0.4);
    float sx = xw * 2.0 + p.x / uV * 2.4 + hash(vec2(idc, 0.3)) * 3.0;   // along the crest, in cells
    float s2 = floor(sx * 0.5);
    float longK = step(hash(vec2(s2 + 3.0, idc)), 0.25);
    float si = mix(floor(sx), s2 * 2.0, longK);
    float hs = hash(vec2(si, idc)), hs2 = hash(vec2(si + 7.0, idc)), hs3 = fract(hs * 9.37), hs4 = fract(hs2 * 7.13);
    float len = mix(0.3 + 0.7 * hs4 * hs4, 0.65 + 0.35 * hs4, longK);
    float u = ((sx - si) / (1.0 + longK) - (1.0 - len) * fract(hs2 * 5.71)) / len;   // along the stroke, 0..1
    float tap = sin(3.14159 * sat(u));
    float inS = smoothstep(0.0, 0.35, tap);
    float off = (hs - 0.5) * 0.2 - 0.06 * tap * tap;
    float f = fract(ph + off);
    float onS = step(0.35, hs2) * inS;
    // only sample these near the crest
    float g = f < 0.6 ? f : f - 1.0;                               // signed distance to the crest
    // darker wash on the back of the swell. half follows the stroke, half the swell, so nothing jumps between cells
    float dry = g > -(aa * 1.6 + 0.01) ? nzd(vec2(xw * 0.3 + p.x / uV * 1.2, z * 26.0 + idc * 0.3), max((0.3 * z + 1.2) * dxp, 26.0 * dzp)).b : 0.5;
    float fw = fract(ph + off * inS);
    float back = smoothstep(0.03, 0.22, f) * (1.0 - smoothstep(0.25, 0.6, f));
    float backW = smoothstep(0.03, 0.22, fw) * (1.0 - smoothstep(0.25, 0.6, fw));
    d += (0.5 * backW + 0.5 * back * step(0.35, hs2) * tap) * (0.07 + 0.06 * hs3 * tap) * det * (0.6 + 0.4 * smoothstep(0.3, 0.6, dry));
    if (onS > 0.0) {
      // crest left as bare paper, broken where the brush runs dry, foam trailing behind
      float cw = (0.04 + 0.1 * near) * (0.5 + 0.7 * hs3) * (0.4 + 0.6 * sqrt(tap));
      float crest = (1.0 - smoothstep(cw * 0.35, cw + aa * 1.6, g)) * smoothstep(-aa * 1.6 - 0.004, 0.0, g)
                  * min(1.0, (cw + 0.002) / (aa * 1.2 + 0.002));
      if (crest > 0.0) {
        float dryc = nzd(vec2(xw * 0.12 + p.x / uV * 0.35, idc * 0.37 + 0.5), 0.35 * dxp).g;
        crest *= (0.3 + 0.7 * smoothstep(0.3, 0.55, dryc)) * (0.75 + 0.25 * smoothstep(0.3, 0.6, dry));
      }
      float trail = f < 0.4 ? smoothstep(0.58, 0.72, nz(vec2(xw * 1.1 + p.x / uV * 0.8, z * 10.0)).b) * (1.0 - smoothstep(0.03, 0.4, f)) : 0.0;
      d *= 1.0 - (crest * 0.95 + trail * 0.45) * onS * det;
    }
  }
  // whitecaps
  if (s > 0.05 && s < 0.36) {
    vec2 cc = vec2(xw * 24.0, (z + uT * WSPD / WK) * 29.0);
    vec2 ci = floor(cc), cf = fract(cc) - 0.5;
    float hc = hash(ci + 0.71);
    if (hc >= 0.78) {
      float lenK = 0.1 + 0.3 * sq(hash(ci + 3.3));
      float ax = (cf.x + (hash(ci + 1.9) - 0.5) * 0.4) / lenK;
      float lens = sat(1.0 - ax * ax);
      // never thinner than 1px, just fainter, so the far ones don't stair-step
      float cy = cf.y - (hash(ci + 5.7) - 0.5) * 0.4 + 0.06 * ax * ax;
      float cellPx = uV * (s + 0.01) * (s + 0.01) / (0.1 * 29.0) / uPx;   // cell height in buffer px
      float th = (0.07 + 0.08 * hash(ci + 6.1)) * lens * lens;
      float tq = max(th, 0.7 / cellPx);
      float dash = (1.0 - smoothstep(tq * 0.4, tq + 0.6 / cellPx, abs(cy))) * (th / tq);
      float on = smoothstep(0.35, 0.65, nz(vec2(xw * 0.3, z * 0.8) + 0.4).g) * smoothstep(0.05, 0.12, s) * (1.0 - smoothstep(0.24, 0.36, s));
      d *= 1.0 - dash * on * 0.8;
    }
  }
  // far out it's just sparse little dashes, one per cell, most cells empty
  float farK = (1.0 - smoothstep(0.03, 0.13, s)) * smoothstep(0.0, 0.006, s);
  if (farK > 0.0) {
    float row = floor(p.y / 5.0);
    vec2 fc = vec2(p.x / 24.0 + 0.5 * mod(row, 2.0) + 0.3, p.y / 5.0);
    vec2 fi = floor(fc), ff = fract(fc) - 0.5;
    float hf = hash(fi + 0.37);
    float on = step(0.7, hf) * smoothstep(0.45, 0.65, n.g);
    d -= farK * 0.03;
    if (on > 0.0) {
      float lenK = 0.3 + 0.7 * fract(hf * 7.31);
      float ax = (ff.x + (fract(hf * 13.7) - 0.5) * 0.3) / (0.5 * lenK);
      float lens = sat(1.0 - ax * ax);
      float cyp = (ff.y + (fract(hf * 5.3) - 0.5) * 0.3) * 5.0;
      float th = (1.0 + 0.6 * fract(hf * 3.17)) * lens;              // half height, px
      float tq = max(th, 0.7 * uPx);
      float dash = (1.0 - smoothstep(tq * 0.5, tq + 0.7 * uPx, abs(cyp))) * (th / tq) * on;
      float white = step(0.88, hf);
      d += farK * dash * (1.0 - white) * 0.084;
      d *= 1.0 - farK * 0.3 * dash * white * smoothstep(0.012, 0.03, s);
    }
  }
  // the gap reflected on the water
  float refl = exp(-sq((p.x - uBreak.x) / (uBreak.y * 0.55))) * exp(-s / 0.07);
  if (refl > 0.002) refl *= 0.6 + 0.6 * smoothstep(0.4, 0.7, nzl(vec2(p.x / uV * 1.5, s * 40.0)).b);
  d *= 1.0 - 0.55 * refl;
  vec3 col = inkTone(d, TEAL);
  return mix(col, mix(PAPER, WARM, 0.22), sat(refl) * 0.35 * smoothstep(0.0, 0.015, s));
}

// headlands
// ridge height above the horizon in V (negative is up). climbs inland, rounds off at the shoulder
float ridge(float x, float faceX, float topH, float seed) {
  float xr = (x - faceX) / uV;
  float tn = nz(vec2(x / uV * 0.45 + seed, seed * 0.31)).r;
  float tn2 = nz(vec2(x / uV * 2.5 + seed, seed * 0.7)).b;
  float tn3 = nz(vec2(x / uV * 1.2 + seed * 0.7, seed * 0.13)).g;
  float rise = smoothstep(0.02, -0.17 - 0.08 * hash(vec2(seed, 1.0)), xr);
  return -topH * (0.66 + 0.2 * tn + 0.2 * (tn3 - 0.5) + 0.04 * tn2 + 0.34 * rise) + topH * 0.16 * smoothstep(-0.07, 0.01, xr);
}

// faceX: where the cliff meets the sea. topH and baseS in V. detail 0 = flat far silhouette, 1 = near cliff with texture
vec3 headland(vec3 col, vec2 p, float faceX, float topH, float baseS, float pale, float seed, float detail) {
  float xr = (p.x - faceX) / uV;
  if (xr > mix(0.3, 0.2, detail)) return col;
  float y = (p.y - uHz) / uV;
  // below the foot only the far ones' mist matters
  if (y > baseS + (detail > 0.99 ? 0.02 : 0.2)) return col;
  float topY = y > baseS ? baseS - 0.01 : ridge(p.x, faceX, topH, seed);
  if (y < topY - 0.2) return col;
  float span = baseS - topY;
  float v = sat((y - topY) / span);
  float jag = (nz(vec2(y * 1.6, seed)).g - 0.5) * 0.04 + (nz(vec2(y * 5.0, seed + 0.4)).b - 0.5) * 0.014;
  float xb = v * 0.04 + jag;
  float e = uPx / uV * 1.3;
  float m = smoothstep(xb + e, xb - e, xr) * smoothstep(topY - e, topY + e, y) * step(y, baseS + 0.02);
  // far ones fade into mist from the foot up, the near one gets a band halfway up
  float mn = nz(vec2(p.x / uV * 1.1 - uT * 0.004, y * 2.0 + seed)).r;
  float vm = v + (mn - 0.5) * 0.35;
  float mist = detail > 0.99 ? 0.6 * smoothstep(0.3, 0.42, vm) * (1.0 - smoothstep(0.48, 0.62, vm)) : smoothstep(0.5, 1.0, vm);
  // faint halo so it stands off the clouds, plus mist spilling out over the water
  float gap = max(max(xr - xb, topY - y), 0.0);
  float halo = 0.16 * pale * exp(-gap / 0.07) * smoothstep(baseS, topY, y) * smoothstep(0.3, 0.7, mn);
  float spill = mist * 0.85 * exp(-gap / mix(0.06, 0.035, detail)) * exp(-max(y - baseS, 0.0) / (0.025 + 0.07 * mn));
  col = mix(col, PAPER, sat(max(halo, spill)) * (1.0 - m));
  if (m <= 0.0) return col;
  float tn2 = nz(vec2(p.x / uV * 2.5 + seed, seed * 0.7)).b;
  float df = max(xb - xr, 0.0), dt = max(y - topY, 0.0);
  // vertical creases, shadow past each one
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
  float faceK = exp(-df / 0.028);
  float near = sat(shade + faceK);
  float dd = detail * detail;
  float d = 0.5 + (0.26 * sat(shade) + 0.22 * faceK) * (0.3 + 0.7 * dd);
  d += (1.0 - detail) * (0.14 - 0.3 * v);
  d += 0.38 * lines * dd;
  float brush = 1.0;
  if (detail > 0.01) {
    // a few broad planes (some pale, some wet and dark), a ledge or two, and long axe cut strokes over them
    vec2 rp = vec2(p.x * 0.985 + p.y * 0.17, p.y * 0.985 - p.x * 0.17) / uV;
    float cut = nz(rp * vec2(6.0, 0.7) + seed).b;
    float cut2 = nz(rp * vec2(13.0, 1.3) + seed * 1.7).g;
    vec4 pn = nz(rp * vec2(1.2, 1.4) + seed * 0.3);
    float planeN = pn.r;
    d += (planeN - 0.5) * 0.14 * detail;
    d -= dd * 0.3 * smoothstep(0.5, 0.6, planeN) * (1.0 - near);
    d += dd * (0.14 * smoothstep(0.42, 0.32, planeN) + 0.3 * smoothstep(0.6, 0.85, v));
    // ledges: pale lip with a shadow under it. the step is spread over a few buffer px so it doesn't stair-step when upscaled
    float lg0 = v * 2.4 + hash(vec2(seed, 2.2));
    float li = floor(lg0 + 0.5);
    float lg = lg0 + (nzl(vec2(p.x / uV * 0.35 + seed, li * 0.37 + 0.2)).g - 0.5) * 0.24;
    float lf = fract(lg), ls = lf < 0.5 ? lf : lf - 1.0;      // signed dist to the ledge
    float lpx = 2.4 * uPx / (span * uV) * 3.5;                 // 3.5 buffer px, in ledge units
    float ledge = mix(-0.06 * smoothstep(-0.2, 0.0, ls), 0.3 * exp(-max(ls - 0.5 * lpx, 0.0) / 0.035), smoothstep(-lpx, lpx, ls));
    d += dd * ledge * step(0.5, lg) * (1.0 - smoothstep(0.8, 0.95, v));
    float stroke = smoothstep(0.5, 0.56, cut) * smoothstep(0.35, 0.6, cut2) * smoothstep(0.35, 0.55, pn.g);
    d += dd * (0.3 * stroke * (0.4 + 0.6 * near) + 0.12 * smoothstep(0.6, 0.72, cut2) * near);
    vec4 dn = nz(p / uV * 6.0 + seed);
    d += 0.24 * detail * exp(-dt / 0.022) * (0.6 + 0.4 * cut2);
    brush = mix(1.0, 0.25 + 0.75 * smoothstep(0.35, 0.6, dn.g), detail);
    d += smoothstep(0.6, 0.72, dn.b) * exp(-dt / 0.026) * detail * 0.45;
  }
  d += 0.36 * exp(-dt / 0.005) * (0.7 + 0.3 * tn2);
  d += 0.22 * exp(-df / 0.004) * (0.4 + 0.6 * detail) * brush;
  vec3 c = mix(inkTone(d * pale, SLATE), PAPER, mist * 0.9);
  return mix(col, c, m);
}

// wind bent pine on the near cliff's shoulder
float pineX(float w, float seed, float sway) { return 0.08 * sin(w * 4.0 + seed) * w + 0.28 * w * w + sway * w * w; }
vec3 pine(vec3 col, vec2 p, vec2 root, float sz, float seed) {
  float u = (p.x - root.x) / sz, w = (root.y - p.y) / sz;   // w = height above the root, in tree heights
  if (u < -0.45 || u > 1.15 || w < -0.06 || w > 1.2) return col;
  float gust = smoothstep(0.25, 0.8, nz(vec2(root.x / uV * 0.3 - uT * 0.045, 0.5)).r);
  float sway = 0.012 * tsin(0.9, seed) + 0.025 * gust;
  float aa = uPx / sz;
  // trunk: kink low down, then a long lean out to the right
  float wt = clamp(w, 0.0, 0.92);
  float tx = pineX(wt, seed, sway);
  float slope = 0.08 * (sin(wt * 4.0 + seed) + 4.0 * wt * cos(wt * 4.0 + seed)) + 0.56 * wt + 2.0 * sway * wt;
  float tw = mix(0.045, 0.014, wt) * (1.0 + 1.2 * smoothstep(0.08, 0.0, w)) * sqrt(1.0 + slope * slope);
  float dx = abs(u - tx);
  float ink = smoothstep(tw + aa, tw - aa, dx) * step(w, 0.93) * smoothstep(-0.05, -0.01, w);
  float bark = nz(vec2(u * 7.0, w * 3.0) + seed).b;
  float d = mix(0.68 + 0.3 * smoothstep(0.45, 0.68, bark), 1.05, smoothstep(tw * 0.3, tw * 0.85, dx));
  // limbs out to flat needle pads, darker underneath
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

// rocks
// x (fraction of width), half width, height (in uS), seed. ROCKOUT is how far out each sits, foot to horizon
const int NR = 5;
const vec4 ROCK[5] = vec4[5](
  vec4(${f1(BIG.x)}, 0.17, 0.24, ${f1(BIG.seed)}), vec4(0.23, 0.12, 0.17, 2.9), vec4(0.31, 0.07, 0.095, 4.1),
  vec4(0.37, 0.04, 0.047, 9.6), vec4(0.165, 0.065, 0.075, 6.6));
const float ROCKOUT[5] = float[5](0.0, 0.03, 0.06, 0.1, 0.0);
const float BIGX = ${f1(BIG.x)};

float rockBase(int i) { return uFoot - ROCKOUT[i] * (uFoot - uHz); }
// same as rockX() in the js
float rockX(float x) { return mix(x, 0.18 + x * 1.1, uNarrow) * uSize.x; }

// returns (seconds since the last swell hit, how hard)
vec2 rockWave(vec4 R, float cx, float baseY, out float wave) {
  float z, xw;
  float ph = wavePhase(vec2(cx, baseY - 0.004 * uV), z, xw) + fract(R.w * 0.37) * 0.6;   // staggered per rock
  wave = floor(ph);
  return vec2(fract(ph) / WSPD, 0.35 + 0.65 * hash(vec2(wave, R.w)));
}

// top edge of a rock for k in -1..1, returns (height, slope). slope is blended across knots so the planes don't seam
vec2 rockTop(float k, float seed) {
  float u = (k * 0.5 + 0.5) * 5.0;
  float i = clamp(floor(u), 0.0, 4.0), f = u - i;
  float pk = (hash(vec2(seed, 5.1)) - 0.5) * 0.9;
  vec4 x = vec4(i - 1.0, i, i + 1.0, i + 2.0) / 2.5 - 1.0;
  vec4 h = 1.0 - 0.5 * pow(abs(x - pk) / (1.0 + abs(pk)), vec4(1.2));
  h *= 0.66 + 0.42 * vec4(hash(vec2(i - 1.0, seed)), hash(vec2(i, seed)), hash(vec2(i + 1.0, seed)), hash(vec2(i + 2.0, seed)));
  h *= 1.0 - 0.45 * step(0.99, abs(x));
  vec3 sl = h.yzw - h.xyz;
  float slope = mix(mix(sl.x, sl.y, smoothstep(0.0, 0.4, f)), sl.z, smoothstep(0.6, 1.0, f));
  return vec2(mix(h.y, h.z, f), slope);
}

vec3 rocks(vec3 col, vec2 p) {
  float rS = max(uS, 0.5 * uV);             // min size on portrait phones
  for (int i = 0; i < NR; i++) {
    vec4 R = ROCK[i];
    float baseY = rockBase(i);
    float persp = mix(1.0, 0.5, ROCKOUT[i] * 2.0);
    float cx = rockX(R.x), hw = R.y * rS * persp, hh = R.z * rS * persp;
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
      // moss dots on the ridge
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
        float lit = smoothstep(0.03, -0.08, tp.y) * (0.6 + 0.4 * smoothstep(0.4, 0.6, cut));   // slopes down to the right = lit
        float topK = 1.0 - smoothstep(0.08, 0.3, dt + (cut - 0.5) * 0.25);
        float d = 0.88 + 0.14 * smoothstep(0.4, -0.8, k);
        d -= topK * (0.3 + 0.26 * lit);
        d += 0.24 * smoothstep(0.55, 0.72, cut) * (1.0 - 0.6 * topK);
        d -= 0.16 * smoothstep(0.6, 0.76, cut2) * (1.0 - topK) * (1.0 - smoothstep(0.3, 0.9, dt));
        float pkx = (hash(vec2(R.w, 5.1)) - 0.5) * 0.9 + 0.4 * (hash(vec2(R.w, 6.3)) - 0.5) + (nz(vec2(dt * 0.6, R.w)).r - 0.5) * 0.3;
        d += 0.45 * exp(-abs(k - pkx) * hw / (1.2 * uPx + 0.8)) * smoothstep(0.02, 0.12, dt) * (1.0 - smoothstep(0.4, 0.9, dt + cut * 0.2));
        d += 0.45 * exp(-(p.y - topY) / (1.4 * uPx + 0.8));
        d += 0.12 * smoothstep(baseY - 0.3 * hh, baseY, p.y);
        d = max(d, dot1 * 1.05);
        col = mix(col, inkTone(d, SLATE), max(m, dot1));
        // water washes up, then drains off in streaks
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
    // foam around the foot
    {
      float fy = (p.y - baseY) / rS;
      float swell = exp(-age / 1.6) * smoothstep(0.0, 0.4, age) * power;
      float spread = hw * (1.15 + 0.6 * swell);
      float env = exp(-pow(abs(dx) / spread, 3.0)) * exp(-sq((fy * rS + 0.1 * hh) / (0.12 * hh + 3.0)));
      float f1 = nz(vec2(p.x / rS * 3.0 + R.w, fy * 12.0 - age * 0.03)).b;
      float f2 = nz(vec2(p.x / rS * 7.0 - R.w, fy * 26.0 + age * 0.02)).g;
      float lace = smoothstep(0.6, 0.68, env * (0.05 + 0.6 * f1 + 0.5 * f2 + 0.15 * swell));
      lace = max(lace, env * (1.0 - smoothstep(0.0, 0.05, abs(f2 - 0.5))) * 0.75);
      col = mix(col, PAPER, lace * 0.92);
    }
  }
  return col;
}

// spray thrown up behind a rock when a swell hits: lobed blob, fingers, drops and a veil drifting off
vec3 spray(vec3 col, vec2 p) {
  float rS = max(uS, 0.5 * uV);
  for (int i = 0; i < NR; i++) {
    vec4 R = ROCK[i];
    if (R.z < 0.06) continue;                  // only the bigger rocks throw spray
    float baseY = rockBase(i);
    float persp = mix(1.0, 0.5, ROCKOUT[i] * 2.0);
    float cx = rockX(R.x), hw = R.y * rS * persp, hh = R.z * rS * persp;
    if (p.y > baseY || p.y < baseY - hh * 3.2 || p.x < cx - hw - hh * 1.4 || p.x > cx + hw + hh * 2.4) continue;
    float wave;
    vec2 ap = rockWave(R, cx, baseY, wave);
    float age = ap.x, power = ap.y;
    float life = age / 4.2;
    if (life >= 1.0) continue;
    vec2 o = vec2(cx + hw * (hash(vec2(R.w, 4.0)) - 0.5) * 0.6, baseY - hh * 0.6);
    float shoot = 1.0 - pow(1.0 - sat(life * 2.4), 3.0);
    vec2 q = (p - o) / hh;
    q.x -= (0.2 + 0.7 * life) * max(-q.y, 0.0) * 0.45;      // wind pushes the higher parts further
    float r = length(q);
    float th = atan(q.x, -q.y);                             // 0 straight up, positive to the right
    float lob = nz(vec2(th * 0.3 + wave * 0.23 + R.w, 0.37)).r;
    float lob2 = nz(vec2(th * 1.2 + wave * 0.71, R.w)).g;
    float reach = (0.5 + 0.85 * power) * shoot * (0.45 + 0.7 * lob + 0.25 * lob2) * pow(max(cos(th * 1.15), 0.0), 0.8) + 1e-3;
    float rr = r / reach;
    vec2 vq = (q - vec2(0.25 + life * 0.9, -0.45 - 0.55 * shoot)) / vec2(0.7 + 0.8 * life, 0.5 + 0.35 * life);
    float vd = dot(vq, vq);
    if (rr > 1.7 && vd > 5.3) continue;
    float vn = vd < 5.3 ? nz(p / rS * vec2(2.0, 2.6) + vec2(-life * 0.12, wave * 0.13)).g : 0.0;
    float veil = exp(-vd) * smoothstep(0.35, 0.7, vn) * smoothstep(0.05, 0.3, life);
    float fade = (1.0 - smoothstep(0.6, 1.0, life)) * power;
    // main mass: white paper under a thin grey wash, breaking into clumps as it falls
    float pn = nz(p / rS * vec2(4.2, 3.4) + vec2(wave * 0.37 - life * 0.12, R.w + life * 0.2)).b;
    float pn2 = nz(p / rS * vec2(10.0, 8.0) + vec2(R.w, wave * 0.19)).r;
    float pn3 = nz(p / rS * vec2(18.0, 14.0) + vec2(wave * 0.11, R.w * 0.7 - life * 0.3)).g;
    // fine fraying, rim only
    float pn4 = rr > 0.4 && rr < 1.6 ? nz(p / rS * vec2(38.0, 30.0) + vec2(wave * 0.29, R.w * 0.4)).a : 0.5;
    float dens = (1.0 - rr) * 1.5 + (pn - 0.5) * 0.9 + (pn2 - 0.5) * 0.55 + (pn3 - 0.5) * 0.35
               + (pn4 - 0.5) * 0.3 * smoothstep(0.4, 0.9, rr);
    float thr = 0.15 + 1.0 * smoothstep(0.15, 1.0, life);
    float mass = smoothstep(thr, thr + 0.22, dens);
    float rim = smoothstep(thr - 0.15, thr + 0.05, dens) * (1.0 - smoothstep(thr + 0.05, thr + 0.3, dens));
    float wash = 0.7 + 0.3 * smoothstep(0.3, 0.75, pn2 * 0.6 + pn * 0.4);
    // fingers flung out past the rim
    float dth = 0.08;
    float thb = th - 0.16 * (0.3 + life) * max(rr - 0.7, 0.0);
    float j = floor(thb / dth);
    float hj = hash(vec2(j, wave + R.w)), hj2 = hash(vec2(j + 9.1, wave + R.w));
    float c = (j + 0.5 + (hj2 - 0.5) * 0.4) * dth;
    float tip = 1.0 + 0.25 * hj;
    float aw = dth * (0.4 + 0.3 * hj2) * (1.0 - 0.6 * smoothstep(0.85, tip, rr));
    float fe = abs(thb - c) + (pn3 - 0.5) * aw * 1.2 + (pn4 - 0.5) * aw * 0.5;
    float finger = 0.7 * smoothstep(aw, aw * 0.3, fe) * step(0.45, hj) * smoothstep(0.78, 0.9, rr)
                 * (1.0 - smoothstep(tip - 0.1, tip, rr)) * (1.0 - smoothstep(0.35, 0.8, life))
                 * smoothstep(0.3, 0.55, pn2) * (0.5 + 0.5 * smoothstep(0.35, 0.6, pn4));
    // drops and finer spatter, on two rotated grids so no grid shows
    float drop = 0.0, spat = 0.0;
    if (rr > 0.8 && rr < 1.65) {
      float ca = 0.9394, sa = 0.3429;                       // cos and sin of 0.35
      vec2 pd = p - o - vec2(life * life * hh * 0.2, 0.0);
      vec2 dq = vec2(ca * pd.x - sa * pd.y, sa * pd.x + ca * pd.y);
      vec2 di = floor(dq / 11.0);
      vec2 dp = (di + 0.15 + 0.7 * vec2(hash(di + 1.3 + wave), hash(di + 2.9))) * 11.0;
      float dr = 1.6 + 1.8 * hash(di + 4.4);
      drop = step(0.9, hash(di + wave * 7.1 + R.w)) * smoothstep(dr + uPx, dr - 0.6 * uPx, length((dq - dp) * vec2(0.55, 1.0)))
           * smoothstep(0.85, 1.0, rr) * (1.0 - smoothstep(1.25, 1.6, rr)) * step(q.y, 0.1);
      vec2 pd2 = pd - vec2(life * life * hh * 0.05, 0.0);
      vec2 sq2 = vec2(ca * pd2.x + sa * pd2.y, ca * pd2.y - sa * pd2.x);
      vec2 si2 = floor(sq2 / 7.0);
      vec2 sp2 = (si2 + 0.1 + 0.8 * vec2(hash(si2 + 0.7 + wave), hash(si2 + 1.9))) * 7.0;
      float sr = 0.9 + 1.1 * hash(si2 + 5.3);
      spat = step(0.87, hash(si2 + wave * 3.3 + R.w)) * smoothstep(sr + uPx, sr - 0.5 * uPx, length(sq2 - sp2))
           * smoothstep(0.95, 1.1, rr) * (1.0 - smoothstep(1.3, 1.6, rr)) * step(q.y, 0.15) * (1.0 - smoothstep(0.4, 0.9, life));
    }
    col *= 1.0 - 0.15 * rim * fade;
    col = mix(col, PAPER, sat((mass * wash * 0.9 + finger + drop * 0.85 + spat * 0.6) * fade + veil * 0.3 * fade));
  }
  return col;
}

// surf at the cliff foot: the breaking roller, plus foam lines sliding up the shore
vec3 surf(vec3 col, vec2 p) {
  float y = (p.y - uFoot) / uV;
  if (y < -0.05) return col;
  float z, xw;
  float ph = wavePhase(vec2(p.x, uFoot - 0.004 * uV), z, xw);
  float age = fract(ph) / WSPD;
  float surge = exp(-age / 2.0) * smoothstep(0.0, 0.4, age);
  float top = -0.004 - 0.01 * surge + (nz(vec2(p.x / uV * 2.6, 0.4)).r - 0.5) * 0.008;
  float zone = smoothstep(top - 0.004, top + 0.004, y);
  if (zone <= 0.0) return col;
  float l2 = nz(vec2(p.x / uV * 3.2 + uT * 0.004, y * 13.0 + 0.3)).g;
  float roll = exp(-sq((y - top - 0.004) / (0.004 + 0.006 * surge))) * (0.5 + 0.5 * smoothstep(0.3, 0.6, l2))
             * (0.65 + 0.35 * smoothstep(0.35 * uSize.x, 0.0, abs(p.x - rockX(0.25))));
  // foam lines. the line id doesn't jump when the swell does
  float ln = nz(vec2(p.x / uV * 0.9 - uT * 0.003, 0.55)).r;
  float ly = (y - top) / 0.026 + (ln - 0.5) * 1.6 - fract(ph);
  float li = floor(ly) - floor(ph);
  float hl = hash(vec2(li, 0.7)), hl2 = hash(vec2(li + 4.0, 0.3));
  float lw = 0.1 + 0.12 * hl;
  vec4 lnz = nzd(vec2(p.x / uV * 1.5 + hl * 5.0, li * 0.37 + 0.2), 1.5 * uPx / uV);
  float gate = smoothstep(0.35, 0.6, lnz.b);
  float line = exp(-sq((fract(ly + (lnz.r - 0.5) * 0.7) - 0.5) / lw)) * gate * (0.6 + 0.4 * smoothstep(0.3, 0.6, l2))
             * (0.45 + 0.55 * hl2) * step(0.4, hl2) * (1.0 - smoothstep(0.015, 0.085, y - top));
  float lace = sat(max(line, roll));
  vec3 water = inkTone(0.48 + 0.1 * l2, TEAL);
  return mix(col, mix(water, PAPER, lace * 0.95), zone);
}

// foreground: the cliff edge and grass
float edgeY(float x) {
  float u = x / uSize.x;
  // lod 0 by hand, this also gets called per stem where x jumps
  return uSize.y - uV * (0.155 + 0.085 * smoothstep(0.3, 1.0, u)) + (nzl(vec2(x / uV * 0.5, 0.77)).r - 0.5) * 0.05 * uV;
}

vec3 foreground(vec3 col, vec2 p) {
  float ye = edgeY(p.x);
  // turf: dark stroke along the lip, dry brush gaps, grass flicks fading into the paper
  if (p.y > ye - 2.0) {
    float dy = (p.y - ye) / uV;
    // keep these lookups roughly square, stretched mipmapped noise thresholds into blocks
    float s1 = nz(vec2(p.x / uV * 1.4, dy * 4.0) + 0.4).b;
    float s3 = nz(vec2(p.x / uV * 0.4, 0.2)).r;
    // grass flicks. rotated not sheared, so the noise grid doesn't show
    vec2 fq = vec2(dot(p, vec2(0.88, 0.48)), dot(p, vec2(-0.48, 0.88))) / uV;
    vec2 fq2 = vec2(dot(p, vec2(0.83, 0.56)), dot(p, vec2(-0.56, 0.83))) / uV;
    float flick = nz(fq * vec2(13.0, 2.2) + 0.33).b;
    float flick2 = nz(fq2 * vec2(24.0, 3.6) + 0.71).g;
    float mass = 1.0 - smoothstep(0.012 + 0.016 * s3, 0.075 + 0.045 * s3, dy + (s1 - 0.5) * 0.03);
    float d = (0.7 + 0.2 * smoothstep(0.4, 0.7, s1)) * mass;
    d *= 0.8 + 0.3 * smoothstep(0.45, 0.7, flick) + 0.08 * smoothstep(0.5, 0.7, flick2);
    d *= 1.0 - 0.7 * smoothstep(0.5, 0.64, flick2 * 0.6 + s1 * 0.4) * smoothstep(0.01, 0.07, dy);
    d += 0.3 * exp(-(p.y - ye) / (2.0 * uPx + 1.0));
    float m = smoothstep(-uPx, uPx, p.y - ye);
    col = mix(col, inkTone(d, SLATE), m);
  }
  // grass blades in tufts, leaning in the wind
  float gS = max(uS, 0.55 * uV);
  float gh = (0.075 + 0.045 * smoothstep(0.4, 0.9, p.x / uSize.x)) * gS;
  float sh = gh * 1.9;
  if (p.y < ye - sh * 1.05) return col;
  float gust = smoothstep(0.25, 0.8, nz(vec2(p.x / uV * 0.3 - uT * 0.045, 0.5)).r);
  if (p.y > ye - gh * 1.15 && p.y < ye + 4.0) {
    float cw = max(0.0055 * gS, 2.5);
    float cell = floor(p.x / cw);
    float ink = 0.0;
    for (int j = -14; j <= 1; j++) {     // blades lean up to 13 cells right
      float c = cell + float(j);
      float h1 = hash(vec2(c, 1.7)), h2 = hash(vec2(c, 9.1)), h3 = hash(vec2(c, 4.3));
      float tuft = smoothstep(0.3, 0.72, nzl(vec2(c * cw / uV * 2.4, 0.13)).r);
      float bh = gh * (0.22 + 0.78 * h2 * h2) * (0.35 + 0.8 * tuft);
      float v = (ye + 3.0 - p.y) / bh;
      if (v < 0.0 || v > 1.0) continue;
      float bx = (c + h1) * cw;
      float lean = min((0.18 + 0.2 * h3 + 0.22 * gust + 0.04 * tsin(1.1 + h1 * 0.8, h2 * 6.28)) * bh, 9.5 * cw);
      float x = bx + lean * v * v + (h1 - 0.5) * bh * 0.25 * v;
      float wt = max(1.4 * uPx, 0.0042 * gS) * (1.0 - v * 0.9) * (0.7 + 0.6 * h1);
      float w = max(wt, 1.1 * uPx);
      float blade = (1.0 - smoothstep(0.35, 1.0, abs(p.x - x) / w)) * (wt / w);
      ink = max(ink, blade * (h3 > 0.7 ? 0.45 : 0.7 + 0.3 * h2));
    }
    float tone = 0.92 - 0.3 * sat((ye - p.y) / gh);
    col = mix(col, inkTone(tone, SLATE), ink);
  }
  // silver grass: a few tall stems with plumes
  if (p.y < ye + 4.0) {
    float cw = 0.05 * gS * (1.0 + uNarrow);
    float cell = floor(p.x / cw);
    for (int j = -4; j <= 0; j++) {     // plumes reach up to 4 cells downwind
      float c = cell + float(j);
      float h1 = hash(vec2(c, 2.3)), h2 = hash(vec2(c, 7.9));
      if (h2 < 0.5) continue;
      float bx = (c + 0.2 + 0.6 * h1) * cw;
      float yb = edgeY(bx) + 3.0;
      float bh = sh * (0.7 + 0.3 * h2);
      float v = (yb - p.y) / bh;
      if (v < 0.0 || v > 1.12) continue;
      float sway = 0.04 * tsin(0.7 + 0.3 * h1, h2 * 6.28 + bx / uV * 3.0);
      float lean = (0.3 + 0.25 * gust + sway) * bh;
      float x = bx + lean * v * v;
      float sw = max(0.0025 * gS, 1.0 * uPx);
      float stem = (1.0 - smoothstep(0.3, 1.0, abs(p.x - x) / sw)) * step(v, 0.98);
      col = mix(col, inkTone(0.62, SLATE), stem * 0.8);
      // plume
      float pv = (v - 0.58) / 0.46;
      if (pv > 0.0 && pv < 1.2) {
        float slope = 2.0 * lean * v / bh;
        float pw = bh * 0.055 * sin(3.14159 * sat(pv / 1.1)) + uPx;
        float stream = (0.08 + 0.12 * gust + sway) * bh * pv * pv + pw * 0.4;
        float dxp = p.x - x - stream;
        float pm = exp(-sq(dxp / pw)) * smoothstep(1.15, 0.9, pv);
        float hair = nzd(vec2(dxp / bh * 30.0 - pv * slope * 6.0, pv * 1.5 + h1), 30.0 / bh * uPx).b;
        col = mix(col, inkTone(0.26 + 0.4 * smoothstep(0.52, 0.7, hair), SLATE), pm * 0.85);
      }
    }
  }
  return col;
}

// rain
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
  // fade into the page at the top and bottom
  float en = nz(px / uV * vec2(0.5, 0.3) + 0.21).r;
  float aTop = smoothstep(0.0, mix(0.3, 0.2, uNarrow) * uV, px.y + (en - 0.5) * mix(0.2, 0.12, uNarrow) * uV);
  float aBot = 1.0 - smoothstep(H - 0.12 * uV, H - 0.005 * uV, px.y + (en - 0.5) * 0.08 * uV);
  float alpha = aTop * aBot;
  if (alpha < 0.002) { o = vec4(0.0); return; }

  // keep it plain under the letter card, barely shows there anyway
  float inCard = min(min(px.x - uCard.x, uCard.z - px.x), min(px.y - uCard.y, uCard.w - px.y));
  vec3 plain = inkTone(0.12 + 0.2 * smoothstep(0.0, 0.6 * uV, px.y), SLATE);
  if (inCard > 90.0) { o = vec4(plain * alpha, alpha); return; }

  // parallax, nearer layers move more
  vec2 par = uPtr * vec2(1.0, 0.5);
  vec2 pSky = px + par * 5.0;
  vec2 pSea = px + par * 10.0;
  vec3 col = vec3(0.0);
  if (pSea.y < uHz + 2.0 * uPx) {
    col = sky(pSky, breakMask(pSky));
    if (px.y > uHz - 0.06 * uV) col = island(col, px + par * 7.0);
  }
  if (pSea.y > uHz) col = mix(col, sea(pSea), smoothstep(uHz, uHz + 1.5 * uPx, pSea.y));
  col = mistBand(col, px + par * 8.0, uHz - 0.004 * uV, 0.016, 0.5, 0.3);

  // headlands far to near, mist in between
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
    float nfx = W * mix(0.19, 0.22, uNarrow);
    float rx = nfx - 0.12 * uV;
    if (rx > 0.04 * uV) col = pine(col, pc, vec2(rx, uHz + (ridge(rx, nfx, 0.66, 7.7) + 0.006) * uV), 0.24 * uV, 3.7);
  }
  // mist at the cliff foot, thinner where the big rock throws spray
  col = mistBand(col, pc, uFoot - 0.1 * uV, 0.05, 0.3 * (0.45 + 0.55 * smoothstep(0.1 * uV, 0.45 * uV, abs(pc.x - rockX(BIGX)))), 6.1);
  {
    // cloud drifting across the near cliff
    float cxk = smoothstep(W * mix(0.19, 0.22, uNarrow) + 0.12 * uV, W * mix(0.19, 0.22, uNarrow) - 0.05 * uV, pc.x);
    vec3 mc = mistBand(col, pc + vec2(0.0, (nz(vec2(pc.x / uV * 0.9 - uT * 0.006, 0.61)).r - 0.5) * 0.12 * uV), uHz - 0.28 * uV, 0.055, 0.42, 8.3);
    col = mix(col, mc, cxk);
  }

  // far and mid rain. only below the clouds, and mostly on the paler bits
  float a1 = 0.2;
  float rainK = smoothstep(mix(0.4, 0.22, uNarrow) * uV, mix(0.75, 0.5, uNarrow) * uV, px.y);
  if (rainK > 0.0) {
    rainK *= 0.4 + 0.6 * smoothstep(0.25, 0.5, dot(col, vec3(0.3, 0.5, 0.2)));
    float rf = rainLayer(px + par * 6.0, a1, 7.0, 90.0, uRain.x, 0.33, 0.6, 1.0);
    float rm = rainLayer(px + par * 12.0, a1 + 0.02, 13.0, 160.0, uRain.y, 0.28, 0.9, 2.0);
    col = mix(col, inkTone(0.5, SLATE), rf * 0.22 * rainK);
    col = mix(col, inkTone(0.55, SLATE), rm * 0.3 * rainK);
  }

  vec2 pr = px + par * 18.0;
  if (pr.y > uFoot - 0.75 * uV && pr.y < uFoot + 0.1 * uV) {
    col = surf(col, pr);
    col = spray(col, pr);       // spray goes behind the rocks
    col = rocks(col, pr);
  }
  col = foreground(col, px + par * 26.0);

  if (rainK > 0.0) {
    float rn = rainLayer(px + par * 30.0, a1 + 0.04, 29.0, 260.0, uRain.z, 0.2, 1.4, 3.0);
    col = mix(col, inkTone(0.5, SLATE), rn * 0.26 * rainK);
  }

  col = mix(col, plain, smoothstep(30.0, 90.0, inCard));

  // paper texture: mottling and fibers
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
// stable random per integer
const h1 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const gauss = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (w * w));

// js copy of the shader's noise lookup at lod 0 (bilinear, wrapping), used to pick the still frame
function nzJ(u, v, c) {
  const { data, size } = noiseData(256);
  const at = (i, j) => data[((((j % size) + size) % size) * size + (((i % size) + size) % size)) * 4 + c] / 255;
  const x = u * size - 0.5, y = v * size - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
  const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
  return a + (b - a) * fy;
}
// same hash() as the shader, float32 so it matches
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

  // gl setup, redone after a context restore. KHR_parallel_shader_compile lets the big shader link without blocking
  let prog = null, vao = null, vb = null, tex = null, U = {}, layoutSent = false;
  let vs = null, fs = null, par = null, ready = false, linkWait = 0;
  let lost = false, destroyed = false;
  function init() {
    ready = false;
    par = gl.getExtension('KHR_parallel_shader_compile');
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    prog = gl.createProgram();
    vs = sh(gl.VERTEX_SHADER, VERT); fs = sh(gl.FRAGMENT_SHADER, FRAG);
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
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
    layoutSent = false;
  }
  // blocks until linked if it isn't yet
  function finishLink() {
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error([gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs), gl.getProgramInfoLog(prog)].filter(Boolean).join('\n'));
    }
    gl.deleteShader(vs); gl.deleteShader(fs);
    gl.useProgram(prog);
    U = {};
    for (let i = 0, n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS); i < n; i++) {
      const name = gl.getActiveUniform(prog, i).name;
      U[name] = gl.getUniformLocation(prog, name);
    }
    gl.uniform1i(U.uN, 0);
    ready = true;
  }
  try { init(); if (!par) finishLink(); } catch (e) {
    console.warn('storm: shader failed', e);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }

  // layout
  const maxRB = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 4096, gl.getParameter(gl.MAX_VIEWPORT_DIMS)?.[1] || 4096, 8192);
  const cardEl = card || canvas.parentElement?.querySelector('.letter') || null;
  let res = 0.5, W = 0, H = 0, V = 0, S = 0, lastIW = -1, lastIH = -1;
  let hz = 0, foot = 0, brkX = 0, brkR = 0, narrow = 0, stillT = 1.3;
  const cardR = [0, 0, 0, 0];
  let dirty = true, full = true;

  // returns true if the layout changed
  function measure() {
    dirty = false;
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    // V only follows width changes or big height changes, so the mobile url bar doesn't reflow the sky
    let v = V;
    if (innerWidth !== lastIW || Math.abs(innerHeight - lastIH) > 160 || !V) {
      v = clamp(innerHeight, 480, 1100); lastIW = innerWidth; lastIH = innerHeight;
    }
    let c0 = 0, c1 = 0, c2 = 0, c3 = 0;
    if (cardEl) {
      const c = cardEl.getBoundingClientRect();
      c0 = c.left - r.left; c1 = c.top - r.top; c2 = c.right - r.left; c3 = c.bottom - r.top;
    }
    // low res on purpose, it's all soft anyway
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    let rs = mobile ? Math.min(innerWidth < 500 ? 0.7 : 0.6, 0.45 * dpr) : Math.min(0.62, 0.5 * dpr);
    const area = w * h * rs * rs;
    const cap = mobile ? 1.6e6 : 3.2e6;
    if (area > cap) rs *= Math.sqrt(cap / area);
    if (h * rs > maxRB) rs = maxRB / h;
    const bw = Math.max(1, Math.round(w * rs)), bh = Math.max(1, Math.round(h * rs));
    if (w === W && h === H && v === V && c0 === cardR[0] && c1 === cardR[1] && c2 === cardR[2] && c3 === cardR[3]
        && bw === canvas.width && bh === canvas.height) return false;
    W = w; H = h; V = v; res = rs;
    cardR[0] = c0; cardR[1] = c1; cardR[2] = c2; cardR[3] = c3;
    S = Math.min(V, W * 0.95);
    hz = c3 > 0 ? c3 + 0.22 * V : H - 0.78 * V;
    hz = clamp(hz, Math.min(0.5 * V, H * 0.4), H - 0.5 * V);
    foot = Math.max(hz + 0.22 * V, H - 0.26 * V);     // waterline, high enough that the rocks clear the grass
    narrow = clamp((1.0 - W / V) / 0.5, 0, 1);
    brkX = W * (0.84 - 0.1 * narrow);
    brkR = Math.min(0.34 * V, 0.24 * W);
    stillT = chooseStill();
    if (bw !== canvas.width || bh !== canvas.height) { canvas.width = bw; canvas.height = bh; }
    full = true; layoutSent = false; prevTop = NaN;
    return true;
  }

  // still frame for reduced motion and renderAt(): about 1s after a big swell hits the big rock.
  // same maths as wavePhase() in the shader, at t = 0
  function chooseStill() {
    const x = rockX(BIG.x, narrow) * W, y = foot - 0.004 * V;
    const s = Math.max((y - hz) / V, 0), z = 0.1 / (s + 0.01), xw = ((x - 0.5 * W) / V) * z;
    const bend = (nzJ(xw * 0.04, z * 0.03 + 0.3, 1) - 0.5) * 1.3
      + (nzJ((x / V) * 0.45, z * 0.15 + 0.7, 0) - 0.5) * 0.28
      + (nzJ((x / V) * 1.3, z * 0.2 + 0.5, 0) - 0.5) * Math.min(0.2, (14 * WK * 0.1) / ((s + 0.01) * (s + 0.01) * V));
    const ph0 = z * WK + bend + ((BIG.seed * 0.37) % 1) * 0.6;
    const first = ((((1.1 * WSPD - ph0) % 1) + 1) % 1) / WSPD;
    // pick the harder of the first two hits (both before the first flash at 16s)
    const power = (tt) => hashJ(Math.floor(ph0 + tt * WSPD), BIG.seed);
    return power(first + 1 / WSPD) > power(first) ? first + 1 / WSPD : first;
  }

  // flash in the clouds every 25-40s, deterministic so renderAt(t) is repeatable
  const flash = [0, 0, 1, 0];
  let fT = 16, fK = 0;               // start time and index of the last flash
  function flashAt(t) {
    flash[3] = 0;
    if (t < fT - 0.1) { fT = 16; fK = 0; }
    while (fK < 1e6) {
      const next = fT + 25 + 15 * h1(fK);
      if (next > t + 0.1) break;
      fT = next; fK++;
    }
    const T = fT, k = fK;
    const dt = t - T;
    if (dt < -0.1 || dt > 2.5) return;    // fades in 0.1s early
    const e = Math.max(0.55 * gauss(dt, 0.06, 0.06), gauss(dt, 0.34, 0.09)) + 0.28 * Math.exp(-Math.max(0, dt - 0.34) / 0.55) * clamp((dt - 0.22) / 0.12, 0, 1);
    const left = h1(k + 0.31) < 0.5;
    flash[0] = W * (left ? 0.06 + 0.2 * h1(k + 0.7) : 0.74 + 0.2 * h1(k + 0.7));
    flash[1] = Math.max(0.35 * V, hz - V * (0.3 + 0.45 * h1(k + 0.9)));
    flash[2] = 0.4 * V;
    flash[3] = e * (0.65 + 0.35 * h1(k + 0.5));
  }

  // parallax
  const ptr = [0, 0], ptrT = [0, 0];
  const onPtr = (e) => {
    if (e.pointerType === 'touch') return;
    ptrT[0] = clamp((e.clientX / innerWidth) * 2 - 1, -1, 1);
    ptrT[1] = clamp((e.clientY / innerHeight) * 2 - 1, -1, 1);
  };
  if (!reduceMotion) addEventListener('pointermove', onPtr, { passive: true });

  let prevTop = NaN, prevM = 0, prevY0 = 0, prevY1 = 0;
  function draw(t, whole) {
    if (lost || !ready) return;
    if (dirty) measure();
    let y0 = 0, y1 = H;
    // only repaint what's on screen plus a margin
    if (!whole && !full) {
      const r = canvas.getBoundingClientRect();
      // margin grows with scroll speed so fast flings don't show stale paint, and a jump past the last band repaints the gap
      const dTop = Number.isNaN(prevTop) ? 0 : Math.abs(r.top - prevTop);
      const m = 0.3 * innerHeight + 2 * dTop;
      y0 = clamp(-r.top - m, 0, H); y1 = clamp(innerHeight - r.top + m, 0, H);
      if (!Number.isNaN(prevTop) && dTop > prevM) { y0 = Math.min(y0, prevY0); y1 = Math.max(y1, prevY1); }
      prevTop = r.top; prevM = m; prevY0 = y0; prevY1 = y1;
      if (y1 <= y0) return;
    } else prevTop = NaN;
    full = false;
    flashAt(t);
    const bh = canvas.height, sy = bh / H;
    gl.viewport(0, 0, canvas.width, bh);
    gl.enable(gl.SCISSOR_TEST);
    const g0 = Math.max(0, Math.floor((H - y1) * sy) - 1), g1 = Math.min(bh, Math.ceil((H - y0) * sy) + 1);
    gl.scissor(0, g0, canvas.width, g1 - g0);
    if (!layoutSent) {
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
    // rain speed px/s and drop spacing, wrapped here in doubles so the shader floats stay small
    gl.uniform3f(U.uRain, (t * 240) % (90 * 256), (t * 400) % (160 * 256), (t * 640) % (260 * 256));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.SCISSOR_TEST);
  }

  // loop, only while active and the tab is visible
  let raf = 0, active = false, t = 0, last = 0, stillQueued = false;
  const minGap = mobile ? 1000 / 34 : 1000 / 70; // heavy shader, cap at ~60fps (~30 on phones)
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
  // reduced motion: just the still frame, redrawn on relayout
  function still() {
    if (stillQueued) return;
    stillQueued = true;
    requestAnimationFrame(() => {
      stillQueued = false;
      if (destroyed) return;
      if (dirty) measure();
      if (full) draw(stillT, true);
    });
  }
  function start() {
    if (destroyed || lost || !ready || raf || !active || document.hidden) return;
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

  // shader broke after all (lost context etc), switch to the css wash
  function fail(e) {
    console.warn('storm: shader failed', e);
    canvas.classList.add('storm-fallback');
    api.destroy();
  }
  // draw the still frame right away so it's never blank when scrolled to
  function onReady() {
    lost = false; dirty = true;
    draw(stillT, true);
    if (t < stillT) t = stillT;
    start();
  }
  function awaitLink() {
    linkWait = 0;
    if (destroyed) return;
    if (par && !gl.getProgramParameter(prog, par.COMPLETION_STATUS_KHR)) { linkWait = requestAnimationFrame(awaitLink); return; }
    try { finishLink(); } catch (e) { fail(e); return; }
    onReady();
  }

  const onLost = (e) => { e.preventDefault(); lost = true; stop(); if (linkWait) cancelAnimationFrame(linkWait); linkWait = 0; };
  const onRestored = () => {
    try { init(); } catch (e) { fail(e); return; }
    awaitLink();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  // api has to exist before awaitLink, fail() calls api.destroy()
  const api = {
    setActive(on) {
      active = !!on;
      if (active) start(); else stop();
    },
    // draw one full frame at time t (secs), for stills and tests
    renderAt(seconds) {
      if (destroyed) return;
      if (!ready) {
        if (linkWait) cancelAnimationFrame(linkWait);
        linkWait = 0;
        try { finishLink(); } catch (e) { fail(e); return; }
        lost = false;
      }
      dirty = true;
      if (seconds === undefined) { measure(); seconds = stillT; }
      draw(seconds, true);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; active = false; stop();
      if (linkWait) cancelAnimationFrame(linkWait);
      linkWait = 0;
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

  measure();
  if (ready) onReady(); else awaitLink();
  return api;
}
