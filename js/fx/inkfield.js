// paper and all the ink marks, one webgl layer behind the page. each mark is an
// <i class="ink" data-ink="bloom|arc|line|range"> and paints in when it scrolls into view
import { noiseData } from './noise.js?v=e0590b5d34';

const MAX = 16;
const TYPES = { bloom: 0, arc: 1, line: 2, range: 3 };

const VERT = `#version 300 es
layout(location = 0) in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uView;          // viewport, css px
uniform float uDpr;
uniform float uTime;
uniform sampler2D uNoise;
uniform int uCount;
uniform vec4 uA[${MAX}];     // x, y, size, type
uniform vec4 uB[${MAX}];     // seed, growth, darkness, red
uniform vec4 uC[${MAX}];
out vec4 o;

const float TAU = 6.2831853;
const vec3 PAPER = vec3(0.945, 0.922, 0.878);
const vec3 INK = vec3(0.075, 0.062, 0.058);
const vec3 SEAL = vec3(0.72, 0.2, 0.165);

float N(vec2 p, int c) { vec4 t = texture(uNoise, p); return c == 0 ? t.r : c == 1 ? t.g : c == 2 ? t.b : t.a; }
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

float press(float u) { return (0.62 + 0.38 * sin(3.14159 * pow(clamp(u, 0.0, 1.0), 0.65))) * (1.0 - 0.72 * smoothstep(0.78, 1.0, u)) * (0.75 + 0.25 * smoothstep(0.0, 0.06, u)); }

// u runs along 0..1, v across -0.5..0.5, len in px
float strokeInk(float u, float v, float len, float seed, float grow, float dryness) {
  if (u < 0.0 || u > 1.0) return 0.0;
  float edgeN = (N(vec2(u * len * 0.004 + seed, 0.3), 2) - 0.5) * 0.12;
  float inside = 1.0 - smoothstep(0.4, 0.5, abs(v) + edgeN);
  float br = N(vec2(u * len * 0.0007 + seed * 3.1, v * 2.4 + seed), 2);
  float br2 = N(vec2(u * len * 0.0003 + seed, v * 1.1 + 0.5), 1);
  float dryZone = smoothstep(0.35, 1.0, u) * dryness * 1.2 + smoothstep(0.22, 0.5, abs(v)) * 0.5 + 0.12;
  float gaps = smoothstep(0.4, 0.72, br * 0.75 + br2 * 0.25) * clamp(dryZone, 0.0, 1.0);
  float dens = inside * (0.95 - gaps);
  dens *= 0.86 + 0.14 * br2;
  float head = smoothstep(grow + 0.004, grow - 0.02, u);
  return clamp(dens, 0.0, 1.0) * head;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uView.y * uDpr - gl_FragCoord.y) / uDpr;
  float asp = uView.x / uView.y;
  vec2 pq = px / 900.0;
  float mott = N(pq * 1.2, 3);
  float fib = N(vec2(pq.x * 7.0, pq.y * 7.0) + 0.3, 2);
  float fib2 = N(vec2(pq.x * 22.0, pq.y * 5.0), 2);
  vec3 paper = PAPER * (0.975 + 0.035 * mott) * (0.985 + 0.02 * fib) + (smoothstep(0.62, 0.8, fib2) * 0.02);

  float ink = 0.0, red = 0.0;
  for (int i = 0; i < ${MAX}; i++) {
    if (i >= uCount) break;
    vec4 A = uA[i], B = uB[i], C = uC[i];
    float seed = B.x, grow = B.y, dark = B.z;
    float d = 0.0;
    int type = int(A.w + 0.5);
    if (type == 0) {
      vec2 p = (px - A.xy) / A.z;
      float cr = cos(C.y), sr = sin(C.y);
      p = mat2(cr, -sr, sr, cr) * p;
      p.x /= C.x;
      vec2 q = p * 1.1 + seed * 7.13;
      vec2 warp = vec2(N(q * 0.16 + uTime * 0.0015, 0), N(q * 0.16 + 0.5 - uTime * 0.001, 1)) - 0.5;
      vec2 dw = p + warp * 0.95;
      float rr = length(dw);
      float edge = 0.2 + 0.8 * grow;
      float en = (N(q * 0.55, 2) - 0.5) * 0.14 + (N(q * 1.8, 2) - 0.5) * 0.04;
      float body = 1.0 - smoothstep(edge - 0.32, edge, rr + en);
      float conc = N(q * 0.3 + 2.1, 3);
      float rim = smoothstep(edge - 0.2, edge - 0.03, rr + en) * (1.0 - smoothstep(edge - 0.03, edge + 0.005, rr + en));
      float gran = 0.9 + 0.2 * hash(floor(px));
      d = (body * (0.14 + 0.62 * conc * conc) + rim * 0.34) * gran;
    } else if (type == 1) {
      // arc: centre A.xy, radius A.z, start angle C.x, span C.y, width C.z px
      vec2 dd = px - A.xy;
      float r = length(dd);
      float ang = atan(dd.y, dd.x);
      float a = mod(ang - C.x + TAU * 8.0, TAU);
      float span = C.y;
      float u = a / span;
      // a full circle overlaps its own start, use the second pass
      if (span > TAU && u + TAU / span <= 1.0) u += TAU / span;
      float len = A.z * span;
      float w = C.z * press(u);
      float v = (r - A.z + (N(vec2(u * len * 0.002 + seed, 1.7), 0) - 0.5) * C.z * 0.35) / w;
      d = strokeInk(u, v, len, seed, grow, C.w);
    } else if (type == 2) {
      // line: from A.xy to C.xy, width C.z
      vec2 ab = C.xy - A.xy;
      float len = length(ab);
      vec2 t = ab / len, nrm = vec2(-t.y, t.x);
      vec2 dd = px - A.xy;
      float u = dot(dd, t) / len;
      float bow = sin(u * 3.14159) * A.z;
      float w = C.z * press(u);
      float v = (dot(dd, nrm) - bow + (N(vec2(u * len * 0.002 + seed, 3.1), 0) - 0.5) * C.z * 0.3) / w;
      d = strokeInk(u, v, len, seed, grow, C.w);
    } else {
      // range: centred on A.x and A.z wide, crest near A.y, peak height C.x, depth C.y
      float x = (px.x - (A.x - A.z * 0.5)) / A.z;
      if (x > -0.02 && x < 1.02) {
        float h = N(vec2(x * 0.5 + seed, seed * 0.37), 0) * 0.66 + N(vec2(x * 0.9 + seed, seed), 1) * 0.3 + N(vec2(x * 1.4, seed), 2) * 0.04;
        h = pow(h, 1.8) * 2.1;
        float crest = A.y - h * C.x * grow;
        float dq = (px.y - crest);
        float inside = smoothstep(-1.2, 1.2, dq);
        float fade = exp(-max(dq, 0.0) / (C.y * (0.55 + 0.9 * N(vec2(x * 2.0, px.y / 400.0) + seed, 3))));
        float line = 1.0 - smoothstep(1.5, 5.5 + 4.0 * N(vec2(x * 3.0, seed), 0), dq);
        float streak = smoothstep(0.5, 0.8, N(vec2(x * 40.0 + seed, px.y / 260.0), 2)) * fade;
        float side = smoothstep(0.0, 0.08, x) * smoothstep(1.0, 0.92, x);
        d = inside * (line * 0.5 + fade * 0.42 + streak * 0.12) * side * min(1.0, grow * 1.4);
      }
    }
    d = clamp(d * dark, 0.0, 1.0);
    if (B.w > 0.5) red = 1.0 - (1.0 - red) * (1.0 - d);
    else ink = 1.0 - (1.0 - ink) * (1.0 - d);
  }
  vec3 col = mix(paper, INK, ink);
  col = mix(col, mix(paper, SEAL, 0.9), red * (1.0 - ink * 0.5));
  col += (hash(gl_FragCoord.xy) - 0.5) * 0.012;
  o = vec4(col, 1.0);
}`;

export function createInkField(canvas, { reduceMotion = false } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false });
  if (!gl) return null;
  const sh = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const U = (n) => gl.getUniformLocation(prog, n);
  const u = { view: U('uView'), dpr: U('uDpr'), time: U('uTime'), noise: U('uNoise'), count: U('uCount'), A: U('uA'), B: U('uB'), C: U('uC') };

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const nd = noiseData(256);
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, nd.data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.uniform1i(u.noise, 0);

  const collect = () => [...document.querySelectorAll('i.ink')].map((el, i) => {
    const ds = el.dataset;
    return {
      el,
      type: TYPES[ds.ink] ?? 0,
      seed: Number(ds.seed ?? i * 1.37 + 0.2),
      dark: Number(ds.dark ?? 0.6),
      red: ds.color === 'red' ? 1 : 0,
      dur: Number(ds.dur ?? (ds.ink === 'bloom' ? 2.6 : ds.ink === 'range' ? 2.2 : 1.6)),
      delay: Number(ds.delay ?? 0),
      a0: (Number(ds.a0 ?? -100) * Math.PI) / 180,
      span: (Number(ds.span ?? 320) * Math.PI) / 180,
      width: Number(ds.w ?? 0.14),
      dry: Number(ds.dry ?? 0.8),
      angle: (Number(ds.angle ?? 0) * Math.PI) / 180,
      bow: Number(ds.bow ?? 0),
      height: Number(ds.h ?? 0.8),
      dir: ds.dir || null,
      px: Number(ds.px ?? 14),
      start: null,
      grow: reduceMotion ? 1 : 0,
    };
  });
  let marks = collect();

  const A = new Float32Array(MAX * 4), B = new Float32Array(MAX * 4), C = new Float32Array(MAX * 4);
  let dpr = Math.min(1.5, window.devicePixelRatio || 1);
  let vw = 0, vh = 0, t = 0, last = performance.now(), dirty = true, raf = 0;

  function resize() {
    vw = innerWidth; vh = innerHeight;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    dirty = true;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (document.hidden) return;
    t += dt;
    let n = 0, animating = false;
    for (const m of marks) {
      const r = m.el.getBoundingClientRect();
      const pad = Math.max(r.width, r.height) * 0.6 + 40;
      if (r.bottom < -pad || r.top > vh + pad || r.right < -pad || r.left > vw + pad) continue;
      if (m.start === null && r.top < vh * 0.92 && r.bottom > vh * 0.05) m.start = t + m.delay;
      if (m.start !== null && m.grow < 1) {
        const k = Math.max(0, Math.min(1, (t - m.start) / m.dur));
        m.grow = 1 - Math.pow(1 - k, 3);
        animating = true;
      }
      if (n >= MAX) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const o = n * 4;
      if (m.type === 0) {
        A.set([cx, cy, r.height / 2, 0], o);
        C.set([r.width / Math.max(1, r.height), m.angle, 0, 0], o);
      } else if (m.type === 1) {
        const R = Math.min(r.width, r.height) / 2;
        A.set([cx, cy, R, 1], o);
        C.set([m.a0, m.span, m.width * R, m.dry], o);
      } else if (m.type === 2) {
        // across the box, or corner to corner if data-dir is set
        let x0 = r.left, x1 = r.right, y0, y1, w, bow;
        if (m.dir === 'down') { y0 = r.top; y1 = r.bottom; w = m.px; bow = m.bow * 60; }
        else if (m.dir === 'up') { y0 = r.bottom; y1 = r.top; w = m.px; bow = m.bow * 60; }
        else if (m.dir === 'back') { x0 = r.right; x1 = r.left; y0 = r.top; y1 = r.bottom; w = m.px; bow = m.bow * 60; }
        else { const dy = Math.tan(m.angle) * r.width; y0 = cy - dy / 2; y1 = cy + dy / 2; w = Math.max(4, r.height); bow = m.bow * r.height; }
        A.set([x0, y0, bow, 2], o);
        C.set([x1, y1, w, m.dry], o);
      } else {
        A.set([cx, r.bottom - r.height * 0.18, r.width, 3], o);
        C.set([r.height * m.height, r.height * 0.28, 0, 0], o);
      }
      B.set([m.seed, m.grow, m.dark, m.red], o);
      n++;
    }
    const moving = !reduceMotion; // washes drift slowly, so keep redrawing
    if (!dirty && !animating && !moving) return;
    dirty = false;
    gl.uniform2f(u.view, vw, vh);
    gl.uniform1f(u.dpr, dpr);
    gl.uniform1f(u.time, t);
    gl.uniform1i(u.count, n);
    gl.uniform4fv(u.A, A);
    gl.uniform4fv(u.B, B);
    gl.uniform4fv(u.C, C);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  resize();
  addEventListener('resize', resize);
  addEventListener('scroll', () => { dirty = true; }, { passive: true });
  raf = requestAnimationFrame(frame);
  return {
    refresh() { dirty = true; },
    // for marks added after startup
    scan() {
      const old = new Map(marks.map((m) => [m.el, m]));
      marks = collect().map((m) => old.get(m.el) || m);
      dirty = true;
    },
  };
}
