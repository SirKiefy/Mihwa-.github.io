// ─────────────────────────────────────────────────────────────────────────────
//  Ink in water, revealing her portrait.
//  A GPU "stable fluids" simulation (advection, vorticity, pressure projection)
//  carries ink across hanji paper. Where the ink gathers, her photo shows
//  through, toned like an ink wash, with pigment pooling at the bloom's rim.
// ─────────────────────────────────────────────────────────────────────────────
import { noiseData } from './noise.js?v=5484e3cdd9';

const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
uniform vec2 texelSize;
out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0); vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y); vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 o;
`;

const FRAG = {
  clear: HEAD + `uniform sampler2D uTexture; uniform float value;
    void main() { o = value * texture(uTexture, vUv); }`,
  splat: HEAD + `uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color; uniform vec2 point; uniform float radius;
    void main() {
      vec2 p = vUv - point; p.x *= aspectRatio;
      vec3 s = exp(-dot(p, p) / radius) * color;
      o = vec4(texture(uTarget, vUv).xyz + s, 1.0);
    }`,
  advection: HEAD + `uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 texelSize; uniform float dt; uniform float dissipation;
    void main() {
      vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize;
      o = texture(uSource, coord) / (1.0 + dissipation * dt);
    }`,
  divergence: HEAD + `uniform sampler2D uVelocity;
    void main() {
      float L = texture(uVelocity, vL).x, R = texture(uVelocity, vR).x;
      float T = texture(uVelocity, vT).y, B = texture(uVelocity, vB).y;
      vec2 C = texture(uVelocity, vUv).xy;
      if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x;
      if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
      o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
    }`,
  curl: HEAD + `uniform sampler2D uVelocity;
    void main() {
      float L = texture(uVelocity, vL).y, R = texture(uVelocity, vR).y;
      float T = texture(uVelocity, vT).x, B = texture(uVelocity, vB).x;
      o = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
    }`,
  vorticity: HEAD + `uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;
    void main() {
      float L = texture(uCurl, vL).x, R = texture(uCurl, vR).x, T = texture(uCurl, vT).x, B = texture(uCurl, vB).x;
      float C = texture(uCurl, vUv).x;
      vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      f /= length(f) + 0.0001;
      f *= curl * C; f.y *= -1.0;
      vec2 v = texture(uVelocity, vUv).xy + f * dt;
      o = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
    }`,
  pressure: HEAD + `uniform sampler2D uPressure; uniform sampler2D uDivergence;
    void main() {
      float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x, T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
      o = vec4((L + R + B + T - texture(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);
    }`,
  gradient: HEAD + `uniform sampler2D uPressure; uniform sampler2D uVelocity;
    void main() {
      float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x, T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
      vec2 v = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
      o = vec4(v, 0.0, 1.0);
    }`,
  display: HEAD + `
    uniform sampler2D uDye; uniform sampler2D uPhoto; uniform sampler2D uNoise; uniform sampler2D uVel;
    uniform vec2 uRes; uniform float uTime; uniform float uBloom; uniform float uColor; uniform float uPhotoAspect;
    uniform vec4 uRect; uniform vec2 uBlob; uniform vec2 uBlobR; uniform float uFluid; uniform vec2 uDyeTexel;
    const vec3 PAPER = vec3(0.945, 0.922, 0.878);
    const vec3 INK = vec3(0.07, 0.058, 0.055);
    float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main() {
      float asp = uRes.x / uRes.y;
      vec2 uv = vUv;
      vec2 q = vec2(uv.x * asp, uv.y);
      // hanji: fibres and soft mottling
      float fib = texture(uNoise, q * 2.4).b;
      float mott = texture(uNoise, q * 0.55).a;
      vec3 paper = PAPER * (0.972 + 0.04 * fib) * (0.985 + 0.03 * mott);

      float ink = 0.0;
      vec2 grad = vec2(0.0);
      vec2 flow = vec2(0.0);
      if (uFluid > 0.5) {
        ink = texture(uDye, uv).r;
        vec2 e = uDyeTexel * 1.5;
        grad = vec2(texture(uDye, uv + vec2(e.x, 0.0)).r - texture(uDye, uv - vec2(e.x, 0.0)).r,
                    texture(uDye, uv + vec2(0.0, e.y)).r - texture(uDye, uv - vec2(0.0, e.y)).r);
        flow = texture(uVel, uv).xy;
      }
      // the bloom that frames her: an organic blot whose edge the water can push around
      vec2 bu = uv - flow * 0.00022;
      vec2 bq = vec2(bu.x * asp, bu.y);
      vec2 p = (bu - uBlob) * vec2(asp, 1.0) / uBlobR;
      float n1 = texture(uNoise, bq * 0.8 + vec2(uTime * 0.005, -uTime * 0.004)).r;
      float n2 = texture(uNoise, bq * 2.4 - vec2(uTime * 0.004, 0.0)).g;
      float n3 = texture(uNoise, bq * 7.0).b;
      float r = length(p) + (n1 - 0.5) * 0.5 + (n2 - 0.5) * 0.1 + (n3 - 0.5) * 0.018;
      float blob = 1.0 - smoothstep(uBloom - 0.22, uBloom + 0.02, r);

      // her photo, cover-fitted into its rectangle, gently refracted by the ink
      vec2 rs = uRect.zw - uRect.xy;
      vec2 pr = (uv - uRect.xy) / rs;
      float rectAsp = rs.x * asp / rs.y;
      vec2 sc = rectAsp > uPhotoAspect ? vec2(1.0, uPhotoAspect / rectAsp) : vec2(rectAsp / uPhotoAspect, 1.0);
      vec2 puv = (pr - 0.5) * sc + 0.5 + grad * 0.006;
      vec3 ph = texture(uPhoto, puv).rgb;
      vec2 ed = min(pr, 1.0 - pr) * vec2(rs.x * asp, rs.y);
      float inRect = smoothstep(0.0, 0.06, min(ed.x, ed.y));
      // film grade: soft S-curve, a little faded, warm highlights
      ph = mix(ph, ph * ph * (3.0 - 2.0 * ph), 0.3);
      ph = mix(vec3(dot(ph, vec3(0.3, 0.59, 0.11))), ph, 0.86);
      ph = ph * vec3(1.03, 1.0, 0.93) + vec3(0.035, 0.025, 0.02);
      float lum = dot(ph, vec3(0.3, 0.59, 0.11));
      vec3 inked = mix(INK * 1.25, paper, smoothstep(0.02, 0.98, lum));
      // the heart of the bloom is in colour; its edges fade to ink tones
      vec3 photo = mix(inked, ph, uColor * smoothstep(0.1, 0.7, blob));

      float show = smoothstep(0.02, 0.5, blob) * inRect;
      vec3 col = mix(paper, photo, show);
      // pigment pools in a thin line at the edge of the bloom
      float rim = smoothstep(0.0, 0.1, blob) * (1.0 - smoothstep(0.1, 0.32, blob)) * inRect;
      float gran = texture(uNoise, q * 8.0).b;
      col = mix(col, INK, rim * (0.45 + 0.25 * gran) * 0.75);
      // loose ink in the water: a soft wash, darker where it pools at its edges
      float dens = 1.0 - exp(-ink * 2.2);
      float edgeInk = smoothstep(0.03, 0.3, length(grad)) * smoothstep(0.02, 0.25, ink);
      dens = clamp(dens * 0.78 + edgeInk * 0.35, 0.0, 0.92);
      col = mix(col, INK, dens);
      // film grain + vignette
      float g = hash(gl_FragCoord.xy + fract(uTime * 13.0) * 97.0) - 0.5;
      col += g * 0.045;
      vec2 vc = uv - 0.5; vc.x *= asp * 0.7;
      col *= 1.0 - dot(vc, vc) * 0.22;
      o = vec4(col, 1.0);
    }`,
};

export function createInkHero(canvas, { source, reduceMotion = false, mobile = false, color = 0.62 } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: false, depth: false, stencil: false, antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const fluidOK = !!gl.getExtension('EXT_color_buffer_float');

  // ── programs ──
  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const vs = shader(gl.VERTEX_SHADER, VERT);
  const P = {};
  for (const [k, src] of Object.entries(FRAG)) {
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, src));
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    const u = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(prog, i).name; u[name] = gl.getUniformLocation(prog, name); }
    P[k] = { prog, u };
  }
  const use = (p) => { gl.useProgram(p.prog); return p.u; };

  // ── fullscreen quad ──
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  function blit(target) {
    if (target) { gl.viewport(0, 0, target.w, target.h); gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); }
    else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ── textures & framebuffers ──
  function texture(w, h, internal, format, type, filter, data = null) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
    return t;
  }
  function fbo(w, h, internal, format) {
    const tex = texture(w, h, internal, format, gl.HALF_FLOAT, gl.LINEAR);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fbo: f, w, h, texel: [1 / w, 1 / h], bind(unit) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); return unit; } };
  }
  function double(w, h, internal, format) {
    let a = fbo(w, h, internal, format), b = fbo(w, h, internal, format);
    return { w, h, texel: a.texel, get read() { return a; }, get write() { return b; }, swap() { const t = a; a = b; b = t; } };
  }
  function res(r) {
    let ar = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (ar < 1) ar = 1 / ar;
    const mn = Math.round(r), mx = Math.round(r * ar);
    return gl.drawingBufferWidth > gl.drawingBufferHeight ? { w: mx, h: mn } : { w: mn, h: mx };
  }

  // noise texture (tileable) for paper, bloom edges and granulation
  const nd = noiseData(256);
  const noiseTex = texture(256, 256, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR, nd.data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);

  // her photo
  const photoTex = gl.createTexture();
  let photoAspect = 0.8;
  function setPhoto(src) {
    gl.bindTexture(gl.TEXTURE_2D, photoTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    photoAspect = (src.naturalWidth || src.width) / (src.naturalHeight || src.height);
  }
  if (source) setPhoto(source);

  // ── simulation state ──
  const CFG = {
    sim: mobile ? 96 : 128,
    dye: mobile ? 512 : 1024,
    curl: 12,
    velDiss: 0.6,
    dyeDiss: 0.55,
    pressureIters: mobile ? 14 : 20,
    radius: 0.0035,
  };
  let dye, vel, divergence, curlF, pressure;
  function initFBOs() {
    if (!fluidOK) return;
    const s = res(CFG.sim), d = res(CFG.dye);
    dye = double(d.w, d.h, gl.RGBA16F, gl.RGBA);
    vel = double(s.w, s.h, gl.RG16F, gl.RG);
    divergence = fbo(s.w, s.h, gl.R16F, gl.RED);
    curlF = fbo(s.w, s.h, gl.R16F, gl.RED);
    pressure = double(s.w, s.h, gl.R16F, gl.RED);
  }

  let dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0;
  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (w === W && h === H) return;
    W = canvas.width = w; H = canvas.height = h;
    initFBOs();
    seeded = false;
  }

  function splat(x, y, dx, dy, amount, radius = CFG.radius) {
    if (!fluidOK) return;
    const ar = W / H;
    let u = use(P.splat);
    gl.uniform1i(u.uTarget, vel.read.bind(0));
    gl.uniform1f(u.aspectRatio, ar);
    gl.uniform2f(u.point, x, y);
    gl.uniform3f(u.color, dx, dy, 0);
    gl.uniform1f(u.radius, radius * (ar > 1 ? ar : 1));
    blit(vel.write); vel.swap();
    gl.uniform1i(u.uTarget, dye.read.bind(0));
    gl.uniform3f(u.color, amount, 0, 0);
    blit(dye.write); dye.swap();
  }

  function step(dt) {
    if (!fluidOK) return;
    gl.disable(gl.BLEND);
    let u = use(P.curl);
    gl.uniform2f(u.texelSize, ...vel.texel);
    gl.uniform1i(u.uVelocity, vel.read.bind(0));
    blit(curlF);

    u = use(P.vorticity);
    gl.uniform2f(u.texelSize, ...vel.texel);
    gl.uniform1i(u.uVelocity, vel.read.bind(0));
    gl.uniform1i(u.uCurl, curlF.bind(1));
    gl.uniform1f(u.curl, CFG.curl);
    gl.uniform1f(u.dt, dt);
    blit(vel.write); vel.swap();

    u = use(P.divergence);
    gl.uniform2f(u.texelSize, ...vel.texel);
    gl.uniform1i(u.uVelocity, vel.read.bind(0));
    blit(divergence);

    u = use(P.clear);
    gl.uniform1i(u.uTexture, pressure.read.bind(0));
    gl.uniform1f(u.value, 0.8);
    blit(pressure.write); pressure.swap();

    u = use(P.pressure);
    gl.uniform2f(u.texelSize, ...vel.texel);
    gl.uniform1i(u.uDivergence, divergence.bind(0));
    for (let i = 0; i < CFG.pressureIters; i++) {
      gl.uniform1i(u.uPressure, pressure.read.bind(1));
      blit(pressure.write); pressure.swap();
    }

    u = use(P.gradient);
    gl.uniform2f(u.texelSize, ...vel.texel);
    gl.uniform1i(u.uPressure, pressure.read.bind(0));
    gl.uniform1i(u.uVelocity, vel.read.bind(1));
    blit(vel.write); vel.swap();

    u = use(P.advection);
    gl.uniform2f(u.texelSize, ...vel.texel);
    gl.uniform1i(u.uVelocity, vel.read.bind(0));
    gl.uniform1i(u.uSource, vel.read.bind(0));
    gl.uniform1f(u.dt, dt);
    gl.uniform1f(u.dissipation, CFG.velDiss);
    blit(vel.write); vel.swap();

    gl.uniform1i(u.uVelocity, vel.read.bind(0));
    gl.uniform1i(u.uSource, dye.read.bind(1));
    gl.uniform1f(u.dissipation, CFG.dyeDiss);
    blit(dye.write); dye.swap();
  }

  // ── layout: where the portrait sits ──
  let rect = [0.42, 0.06, 0.94, 0.94], blob = [0.68, 0.5], blobR = [0.46, 0.46];
  function setLayout(l) { rect = l.rect; blob = l.blob; blobR = l.blobR; }

  function render(t, bloom) {
    const u = use(P.display);
    gl.uniform2f(u.texelSize, 1 / W, 1 / H);
    gl.uniform1i(u.uNoise, 2); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.uniform1i(u.uPhoto, 3); gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, photoTex);
    if (fluidOK) { gl.uniform1i(u.uDye, dye.read.bind(0)); gl.uniform2f(u.uDyeTexel, ...dye.read.texel); gl.uniform1i(u.uVel, vel.read.bind(1)); }
    else { gl.uniform1i(u.uDye, 2); gl.uniform1i(u.uVel, 2); gl.uniform2f(u.uDyeTexel, 0.001, 0.001); }
    gl.uniform1f(u.uFluid, fluidOK ? 1 : 0);
    gl.uniform2f(u.uRes, W, H);
    gl.uniform1f(u.uTime, t);
    gl.uniform1f(u.uBloom, bloom);
    gl.uniform1f(u.uColor, color);
    gl.uniform1f(u.uPhotoAspect, photoAspect);
    gl.uniform4f(u.uRect, ...rect);
    gl.uniform2f(u.uBlob, ...blob);
    gl.uniform2f(u.uBlobR, ...blobR);
    blit(null);
  }

  // ── pointer stirring ──
  const ptr = { x: 0, y: 0, px: 0, py: 0, moved: false, has: false };
  function pointer(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const x = (clientX - r.left) / r.width, y = 1 - (clientY - r.top) / r.height;
    if (!ptr.has) { ptr.px = x; ptr.py = y; ptr.has = true; }
    ptr.x = x; ptr.y = y; ptr.moved = true;
  }

  // ── seeding: ink drops into the water around her ──
  let seeded = false, lastAuto = 0;
  function seed(t) {
    const ar = W / H;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4 + Math.random() * 0.4;
      const rr = blobR[0] * 1.02;
      const x = blob[0] + (Math.cos(a) * rr) / ar, y = blob[1] + Math.sin(a) * blobR[1] * 1.02;
      const tang = a + (Math.PI / 2) * (i % 2 ? 1 : -1);
      const f = 90 + Math.random() * 70;
      splat(x, y, Math.cos(tang) * f + Math.cos(a) * f * 0.6, Math.sin(tang) * f + Math.sin(a) * f * 0.6, 0.45, CFG.radius * 0.9);
    }
    seeded = true; lastAuto = t;
  }

  // ── loop ──
  let raf = 0, active = true, t = 0, last = performance.now(), start = null;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (!active || document.hidden) return;
    resize();
    t += dt;
    if (start === null) start = t;
    const age = t - start;
    const bloom = Math.min(1, 1 - Math.pow(1 - Math.min(1, age / 2.8), 3)) * 1.02 + (reduceMotion ? 0 : Math.sin(t * 0.45) * 0.015);
    if (fluidOK) {
      if (!seeded && age > 0.35) seed(t);
      if (!reduceMotion && t - lastAuto > 4.5) {
        lastAuto = t;
        const a = Math.random() * Math.PI * 2, ar = W / H;
        const x = blob[0] + (Math.cos(a) * blobR[0] * 1.05) / ar, y = blob[1] + Math.sin(a) * blobR[1] * 1.05;
        splat(x, y, Math.cos(a + 1.6) * 110 + Math.cos(a) * 50, Math.sin(a + 1.6) * 110 + Math.sin(a) * 50, 0.3, CFG.radius * 0.8);
      }
      if (ptr.moved) {
        const dx = (ptr.x - ptr.px) * 4200, dy = (ptr.y - ptr.py) * 4200;
        const sp = Math.hypot(dx, dy);
        if (sp > 1) splat(ptr.x, ptr.y, dx, dy, Math.min(0.12, 0.015 + sp * 0.00008), CFG.radius * 0.7);
        ptr.px = ptr.x; ptr.py = ptr.y; ptr.moved = false;
      }
      step(dt);
    }
    render(t, bloom);
  }

  resize();
  raf = requestAnimationFrame(frame);

  return {
    fluid: fluidOK,
    setActive(v) { active = v; if (v) last = performance.now(); },
    setPhoto,
    setLayout,
    pointer,
    burst(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      const x = (clientX - r.left) / r.width, y = 1 - (clientY - r.top) / r.height;
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2, f = 160 + Math.random() * 160;
        splat(x, y, Math.cos(a) * f, Math.sin(a) * f, 0.4, CFG.radius * 0.6);
      }
    },
    resize,
  };
}
