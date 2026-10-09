// seoul and paris on a live globe, staged like the old sun, moon and five peaks screen.
// globe is lit from where the sun actually is right now. scroll moves the camera between the two cities
import * as THREE from '../../vendor/three/three.module.min.js?v=9ff5ee8a7c';
import { makeNoiseTexture, NOISE } from '../scene/glsl.js?v=9ff5ee8a7c';
import { makeLandTexture } from '../scene/inktex.js?v=9ff5ee8a7c';
import { CITIES } from '../data/cities.js?v=9ff5ee8a7c';
import { sunPosition, moonPhase } from './live.js?v=9ff5ee8a7c';

const DEG = Math.PI / 180;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const damp = (dt, rate) => 1 - Math.exp(-dt * rate);

const PAPER = new THREE.Vector3(0.945, 0.922, 0.878);
const PAPER_LIGHT = new THREE.Vector3(0.985, 0.972, 0.94);
const INK = new THREE.Vector3(0.075, 0.062, 0.058);
const NIGHT = new THREE.Vector3(0.115, 0.145, 0.245);
const SEAL = new THREE.Vector3(0.72, 0.2, 0.165);
const GOLD = new THREE.Vector3(0.86, 0.68, 0.34);

export function latLonToVec3(lat, lon, r = 1) {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) / 180) * Math.PI;
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta) * r, Math.cos(theta) * r, Math.sin(phi) * Math.sin(theta) * r);
}
function slerpUnit(a, b, t) {
  const om = Math.acos(clamp(a.dot(b), -1, 1));
  if (om < 1e-5) return a.clone();
  const s = Math.sin(om);
  return a.clone().multiplyScalar(Math.sin((1 - t) * om) / s).add(b.clone().multiplyScalar(Math.sin(t * om) / s));
}

const VS_UV = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const OVER = /* glsl */ `
vec4 over(vec4 s, vec4 d) {
  float a = s.a + d.a * (1.0 - s.a);
  return vec4((s.rgb * s.a + d.rgb * d.a * (1.0 - s.a)) / max(a, 1e-4), a);
}`;

const GLOBE_FS = NOISE + /* glsl */ `
uniform sampler2D uLand; uniform vec3 uSun; uniform float uTime;
uniform vec3 uPaper; uniform vec3 uPaperLight; uniform vec3 uInk; uniform vec3 uNight; uniform vec3 uSeal;
varying vec3 vObj; varying vec3 vN; varying vec2 vUv; varying vec3 vView;
void main() {
  vec3 N = normalize(vN); vec3 V = normalize(vView); vec3 nrm = normalize(vObj);
  float facing = clamp(dot(N, V), 0.0, 1.0);
  vec4 L = texture2D(uLand, vUv);
  float land = smoothstep(0.3, 0.7, L.r);
  float coast = smoothstep(0.1, 0.42, L.r) * (1.0 - smoothstep(0.52, 0.9, L.r));
  float n = fbm3(vObj * 7.0, nrm);
  float nb = fbm3(vObj * 2.1 + 5.0, nrm);
  float inkLand = land * (0.14 + 0.22 * n + 0.15 * nb);
  float bleed = L.g * (1.0 - land) * 0.14;
  float lat = vUv.y * 180.0;
  float waves = sin(lat * 2.4 + sin(vUv.x * 50.0 + lat * 0.13) * 1.4);
  float ocean = (1.0 - land) * smoothstep(0.86, 1.0, waves) * 0.08 * smoothstep(0.35, 0.7, fbm3(vObj * 4.0 + 1.0, nrm));
  vec2 g = vec2(vUv.x * 24.0, vUv.y * 12.0);
  vec2 gf = abs(fract(g - 0.5) - 0.5) / fwidth(g);
  float grid = (1.0 - min(min(gf.x, gf.y), 1.0)) * 0.07;
  float dens = clamp(inkLand + coast * 0.62 + bleed + ocean + grid, 0.0, 1.0);
  vec3 day = mix(uPaper, uInk, dens);
  // day/night from the real sun
  float sd = dot(nrm, uSun);
  float edge = sd + (fbm3(vObj * 3.0 + 11.0, nrm) - 0.5) * 0.18 + (fbm3(vObj * 9.0, nrm) - 0.5) * 0.05;
  float night = 1.0 - smoothstep(-0.12, 0.05, edge);
  vec3 nightCol = mix(uNight, uInk, clamp(dens * 0.9 + 0.12, 0.0, 1.0));
  nightCol = mix(nightCol, uNight * 1.35, (1.0 - land) * smoothstep(0.86, 1.0, waves) * 0.5);
  vec3 col = mix(day, nightCol, night * 0.94);
  // thin red wash along the terminator
  float dusk = smoothstep(-0.08, 0.01, edge) * (1.0 - smoothstep(0.01, 0.2, edge));
  col = mix(col, mix(uSeal, uPaperLight, 0.4), dusk * 0.3);
  col = mix(col, uPaperLight, smoothstep(0.55, 1.0, sd) * (1.0 - dens) * 0.6);
  float rimN = fbm3(vObj * 4.5 + uTime * 0.04, nrm);
  float rim = smoothstep(0.62 + 0.16 * rimN, 0.985, 1.0 - facing);
  col = mix(col, uInk, rim * 0.62);
  gl_FragColor = vec4(col, 1.0);
}`;

const SKY_FS = NOISE + OVER + /* glsl */ `
uniform float uAspect; uniform float uCover; uniform float uTime; uniform float uPhase;
uniform vec2 uSunPos; uniform vec2 uMoonPos; uniform float uR;
uniform vec3 uPaper; uniform vec3 uPaperLight; uniform vec3 uInk; uniform vec3 uSeal;
varying vec2 vUv;
void main() {
  vec2 s = (vUv - 0.5) * uCover + 0.5;
  vec2 a = vec2(uAspect, 1.0);
  float wn = fbmL(vec2(s.x * 1.2 + uTime * 0.002, s.y * 1.6));
  vec4 col = vec4(uInk, smoothstep(0.55, 1.1, s.y + (wn - 0.5) * 0.35) * 0.07);
  // moon stays bare paper, only the sky around it gets washed
  vec2 pm = (s - uMoonPos) * a / uR;
  float rm = length(pm);
  float hn = fbm(pm * 0.8 + vec2(uTime * 0.01, 0.0));
  float halo = smoothstep(1.0, 1.1, rm) * exp(-(rm - 1.0) * 1.1) * (0.5 + 0.5 * hn);
  col = over(vec4(uInk, halo * 0.2), col);
  float inMoon = 1.0 - smoothstep(0.975, 1.0, rm);
  float xt = cos(6.2831853 * uPhase) * sqrt(max(0.0, 1.0 - pm.y * pm.y));
  float lit = uPhase < 0.5 ? smoothstep(-0.03, 0.03, pm.x - xt) : smoothstep(-0.03, 0.03, -pm.x - xt);
  vec3 moon = mix(mix(uPaper, uInk, 0.14), uPaperLight, lit);
  moon = mix(moon, uInk, smoothstep(0.52, 0.78, fbm(pm * 1.5 + 5.0)) * 0.07);
  moon = mix(moon, uInk, smoothstep(0.88, 0.99, rm) * 0.28);
  col = over(vec4(moon, inMoon), col);
  vec2 ps = (s - uSunPos) * a / uR;
  float en = (fbm(ps * 2.2 + 3.0) - 0.5) * 0.07;
  float rs = length(ps) + en;
  float sun = 1.0 - smoothstep(0.97, 1.0, rs);
  float soak = (1.0 - smoothstep(1.0, 1.3, rs)) * 0.16;
  vec3 sunCol = uSeal * (0.9 + 0.2 * fbm(ps * 1.4 + 9.0));
  col = over(vec4(sunCol, max(sun * 0.93, soak)), col);
  gl_FragColor = col;
}`;

const PEAKS_FS = NOISE + OVER + /* glsl */ `
uniform float uAspect; uniform float uCover; uniform float uTime;
uniform vec4 uP[5];   // x, height, half width, tone
uniform vec3 uPaper; uniform vec3 uInk;
varying vec2 vUv;
vec4 peak(vec2 s, vec4 P, float seed) {
  float dx = (s.x - P.x) / P.z;
  if (abs(dx) > 1.3) return vec4(0.0);
  float prof = pow(max(0.0, 1.0 - abs(dx)), 1.35);
  float ridge = (fbm(vec2(s.x * 9.0 + seed, seed)) - 0.5) * 0.05 + (fbm(vec2(s.x * 30.0 + seed, 2.0 * seed)) - 0.5) * 0.012;
  float crest = 0.1 + P.y * prof + ridge * prof;
  float dq = crest - s.y;                       // depth below crest
  float px = fwidth(s.y);
  float body = smoothstep(-px, px, dq);
  float line = 1.0 - smoothstep(px * 1.5, px * 1.5 + 0.004 + 0.004 * fbm(vec2(s.x * 20.0, seed)), dq);
  float wash = exp(-dq / (0.07 + 0.08 * fbm(vec2(s.x * 3.0, s.y * 2.0 + seed))));
  // cun = texture strokes down the slopes, like in ink landscapes
  float cun = smoothstep(0.55, 0.8, fbm(vec2(s.x * 70.0 + dx * 8.0, s.y * 4.0 + seed))) * wash;
  float d = clamp(line * 0.55 + wash * 0.34 + cun * 0.2, 0.0, 1.0) * P.w;
  vec3 c = mix(uPaper, uInk, d);
  c = mix(c, vec3(0.2, 0.31, 0.3), wash * 0.18 * P.w);
  float mist = smoothstep(0.03, 0.2, s.y + (fbm(vec2(s.x * 4.0 + uTime * 0.004, seed)) - 0.5) * 0.08);
  return vec4(c, body * mist);
}
void main() {
  vec2 s = (vUv - 0.5) * uCover + 0.5;
  vec4 col = vec4(0.0);
  for (int i = 0; i < 5; i++) col = over(peak(s, uP[i], float(i) * 3.7 + 1.3), col);
  gl_FragColor = col;
}`;

const WAVES_FS = NOISE + OVER + /* glsl */ `
uniform float uAspect; uniform float uCover; uniform float uTime; uniform float uTop;
uniform vec3 uPaper; uniform vec3 uInk;
varying vec2 vUv;
void main() {
  vec2 s = (vUv - 0.5) * uCover + 0.5;
  if (s.y > uTop * 1.6) { gl_FragColor = vec4(0.0); return; }
  vec4 col = vec4(0.0);
  vec3 sea = vec3(0.17, 0.22, 0.34);
  const int ROWS = 5;
  for (int r = 0; r < ROWS; r++) {
    float fr = float(r);
    float base = uTop * (1.0 - fr / float(ROWS)) - uTop * 0.08;
    float f = (5.0 + fr * 1.3) * uAspect;
    float ph = fr * 1.7 + uTime * (mod(fr, 2.0) < 0.5 ? 0.05 : -0.04);
    float w = 0.5 + 0.5 * cos(s.x * f * 6.2831853 + ph);
    float amp = uTop * (0.22 + 0.05 * fr);
    float crest = base + amp * pow(w, 2.2) + (fbm(vec2(s.x * 12.0 + fr, fr)) - 0.5) * 0.006;
    float dq = crest - s.y;
    float px = fwidth(s.y);
    float body = smoothstep(-px, px, dq);
    float k = dq / (amp * 0.9);
    float lines = smoothstep(0.42, 0.5, abs(fract(k * 5.0) - 0.5)) * (1.0 - smoothstep(0.6, 1.2, k));
    float outline = 1.0 - smoothstep(px, px * 2.5 + 0.002, dq);
    float foam = smoothstep(0.82, 0.96, w) * (1.0 - smoothstep(0.0, 0.012, dq)) * step(0.0, dq);
    float d = clamp(outline * 0.5 + lines * 0.16, 0.0, 1.0);
    vec3 c = mix(uPaper, mix(uInk, sea, 0.62), d);
    c = mix(c, uPaper * 1.04, foam);
    col = over(vec4(c, body), col);
  }
  col.a *= smoothstep(uTop * 1.35, uTop * 0.9, s.y);
  gl_FragColor = col;
}`;

const CLOUD_FS = NOISE + /* glsl */ `
uniform float uTime; uniform float uSeed; uniform float uOpacity; uniform vec3 uPaperLight;
varying vec2 vUv;
void main() {
  vec2 p = vUv;
  float n = fbm(vec2(p.x * 2.6 + uSeed + uTime * 0.01, uSeed));
  float n2 = fbm(vec2(p.x * 7.0 - uTime * 0.012, p.y * 3.0 + uSeed * 2.0));
  float y = (p.y - 0.5 - (n - 0.5) * 0.4) / (0.16 + 0.1 * n2);
  float band = exp(-y * y * 2.0);
  float ends = smoothstep(0.0, 0.35, p.x) * smoothstep(1.0, 0.65, p.x);
  gl_FragColor = vec4(uPaperLight, band * ends * (0.45 + 0.55 * n2) * uOpacity);
}`;

function makeCrane() {
  const V = (x, y, z) => [x, y, z];
  const geo = (tris) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
    return g;
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPaper: { value: new THREE.Vector3(0.975, 0.962, 0.93) }, uInk: { value: INK } },
    side: THREE.DoubleSide,
    vertexShader: `varying vec3 vP; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vP = mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uPaper; uniform vec3 uInk; varying vec3 vP;
      void main() {
        vec3 n = normalize(cross(dFdx(vP), dFdy(vP)));
        float l = abs(dot(n, normalize(vec3(-0.4, 0.8, 0.5))));
        gl_FragColor = vec4(mix(uInk, uPaper, 0.72 + 0.28 * l), 1.0);
      }`,
  });
  const red = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.72, 0.2, 0.165), side: THREE.DoubleSide });
  const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.2, 0.17, 0.16), transparent: true, opacity: 0.8 });
  const withEdges = (g, m) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), lineMat));
    return mesh;
  };
  const crane = new THREE.Group();
  const B0 = V(0, 0.05, 0.3), B1 = V(0, 0.05, -0.3), KL = V(-0.07, -0.2, 0), KR = V(0.07, -0.2, 0);
  const NT = V(0, 0.46, 0.6), HT = V(0, 0.38, 0.78), TT = V(0, 0.42, -0.66);
  crane.add(withEdges(geo([B0, KL, B1, B0, B1, KR, B0, V(0, 0.05, 0.12), NT, B1, V(0, 0.05, -0.12), TT]), mat));
  crane.add(new THREE.Mesh(geo([NT, V(0, 0.41, 0.64), HT]), red)); // red crown, it's a red-crowned crane
  const wingL = withEdges(geo([V(0, 0.05, 0.2), V(0, 0.05, -0.16), V(-0.82, 0.1, -0.08)]), mat);
  const wingR = withEdges(geo([V(0, 0.05, 0.2), V(0.82, 0.1, -0.08), V(0, 0.05, -0.16)]), mat);
  crane.add(wingL, wingR);
  crane.userData = { wingL, wingR };
  return crane;
}

function sealTexture(chars, seed) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 208;
  const g = c.getContext('2d');
  let x = seed * 9301 + 49297;
  const rand = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  g.fillStyle = '#b8322a';
  g.beginPath();
  g.roundRect ? g.roundRect(10, 10, 108, 188, 8) : g.rect(10, 10, 108, 188);
  g.fill();
  g.strokeStyle = 'rgba(248,242,230,0.9)';
  g.lineWidth = 3;
  g.strokeRect(19, 19, 90, 170);
  g.fillStyle = '#f8f2e6';
  g.font = '900 70px "Noto Serif KR", "Songti SC", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  [...chars].forEach((ch, i) => g.fillText(ch, 64, 64 + i * 80));
  // chip the edges and speckle it so it looks stamped
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 140; i++) {
    g.globalAlpha = 0.3 + rand() * 0.7;
    g.beginPath();
    const e = rand() < 0.5;
    const px = e ? 10 + rand() * 108 : (rand() < 0.5 ? 10 : 118);
    const py = e ? (rand() < 0.5 ? 10 : 198) : 10 + rand() * 188;
    g.arc(i < 90 ? px : 12 + rand() * 104, i < 90 ? py : 12 + rand() * 184, rand() * 2.6 + 0.4, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

export function createHomes(canvas, places, { mobile = false, reduceMotion = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch { return null; }
  const dpr = Math.min(mobile ? 1.75 : 2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const FOV = 30, TAN = Math.tan((FOV / 2) * DEG), D = 10;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 80);
  camera.position.set(0, 0, D);
  const U = { uTime: { value: 0 }, uNoise: { value: makeNoiseTexture() } };

  const layers = [];
  function layer(z, fs, extra = {}) {
    const u = {
      uTime: U.uTime, uNoise: U.uNoise, uAspect: { value: 1 }, uCover: { value: 1.3 },
      uPaper: { value: PAPER }, uPaperLight: { value: PAPER_LIGHT }, uInk: { value: INK }, uSeal: { value: SEAL }, ...extra,
    };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false, vertexShader: VS_UV, fragmentShader: fs,
    }));
    m.position.z = z;
    scene.add(m);
    layers.push(m);
    return m;
  }
  // layers that never move get baked to a texture once (and on resize), not every frame
  const bakeCam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
  const bakeScene = new THREE.Scene();
  const bakeQuad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
  bakeScene.add(bakeQuad);
  function makeBaked(m) {
    const paint = m.material;
    const rt = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false });
    m.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: rt.texture } }, vertexShader: VS_UV,
      fragmentShader: 'uniform sampler2D uMap; varying vec2 vUv; void main(){ gl_FragColor = texture2D(uMap, vUv); }',
      transparent: true, depthWrite: false,
      // baked texture is premultiplied
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    m.userData.bake = { paint, rt, w: 2, h: 2 };
    return paint;
  }
  function bake(m, w, h) {
    const b = m.userData.bake;
    if (w) { b.w = Math.max(2, Math.round(w)); b.h = Math.max(2, Math.round(h)); b.rt.setSize(b.w, b.h); }
    bakeQuad.material = b.paint;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(b.rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(bakeScene, bakeCam);
    renderer.setRenderTarget(prev);
  }

  const sky = layer(-16, SKY_FS, {
    uPhase: { value: moonPhase(new Date()) }, uSunPos: { value: new THREE.Vector2(0.9, 0.8) },
    uMoonPos: { value: new THREE.Vector2(0.12, 0.8) }, uR: { value: 0.07 },
  });
  const peaks = layer(-7, PEAKS_FS, { uP: { value: [0, 1, 2, 3, 4].map(() => new THREE.Vector4()) } });
  const waves = layer(2.6, WAVES_FS, { uTop: { value: 0.2 } });
  const skyU = makeBaked(sky).uniforms;
  const peaksU = makeBaked(peaks).uniforms;
  let bakedPhase = -1;

  const clouds = [0, 1, 2].map((i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uNoise: U.uNoise, uSeed: { value: i * 7.3 + 1.1 }, uOpacity: { value: 1 }, uPaperLight: { value: PAPER_LIGHT } },
      transparent: true, depthWrite: false, vertexShader: VS_UV, fragmentShader: CLOUD_FS,
    }));
    m.position.z = [4.2, 3.4, 1.4][i];
    m.userData = { i, speed: [0.012, -0.009, 0.008][i], x: 0 };
    m.renderOrder = 2;
    scene.add(m);
    return m;
  });

  const FLECKS = mobile ? 70 : 130;
  const fPos = new Float32Array(FLECKS * 3), fSeed = new Float32Array(FLECKS);
  for (let i = 0; i < FLECKS; i++) {
    fPos[i * 3] = (Math.random() - 0.5) * 16;
    fPos[i * 3 + 1] = (Math.random() - 0.5) * 9;
    fPos[i * 3 + 2] = -8 + Math.random() * 12;
    fSeed[i] = Math.random();
  }
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  fGeo.setAttribute('aSeed', new THREE.BufferAttribute(fSeed, 1));
  const flecks = new THREE.Points(fGeo, new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uPx: { value: dpr }, uGold: { value: GOLD } },
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime; uniform float uPx; varying float vSeed; varying float vRot;
      void main() {
        vec3 p = position;
        p.y = mod(position.y - uTime * (0.03 + aSeed * 0.05) + 4.5, 9.0) - 4.5;
        p.x += sin(uTime * 0.3 + aSeed * 20.0) * 0.12;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vSeed = aSeed; vRot = uTime * (0.4 + aSeed) + aSeed * 6.0;
        gl_PointSize = (3.0 + aSeed * 7.0) * uPx * (10.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uGold; varying float vSeed; varying float vRot;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float c = cos(vRot), s = sin(vRot);
        p = mat2(c, -s, s, c) * p;
        p.y *= 1.0 + 0.8 * abs(sin(vRot * 0.7));     // tumbling
        float ang = atan(p.y, p.x);
        float edge = 0.6 + 0.25 * sin(ang * 3.0 + vSeed * 20.0) + 0.12 * sin(ang * 7.0 + vSeed * 9.0);
        float a = 1.0 - smoothstep(edge - 0.08, edge, length(p));
        float glint = 0.75 + 0.35 * sin(vRot * 1.7 + vSeed * 30.0);
        gl_FragColor = vec4(uGold * glint, a * 0.85);
        if (gl_FragColor.a < 0.02) discard;
      }`,
  }));
  scene.add(flecks);

  const world = new THREE.Group();
  const spin = new THREE.Group();
  spin.rotation.order = 'XYZ';
  world.add(spin);
  scene.add(world);
  const sunU = { value: new THREE.Vector3(1, 0, 0) };
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(1, mobile ? 96 : 144, mobile ? 64 : 96),
    new THREE.ShaderMaterial({
      uniforms: {
        uLand: { value: makeLandTexture(mobile ? 0.6 : 1) }, uSun: sunU, uTime: U.uTime, uNoise: U.uNoise,
        uPaper: { value: PAPER }, uPaperLight: { value: PAPER_LIGHT }, uInk: { value: INK }, uNight: { value: NIGHT }, uSeal: { value: SEAL },
      },
      vertexShader: /* glsl */ `
        varying vec3 vObj; varying vec3 vN; varying vec2 vUv; varying vec3 vView;
        void main() {
          vUv = uv; vObj = position;
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: GLOBE_FS,
    }),
  );
  spin.add(globe);

  // mist ring so the peaks behind the globe fall away
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uNoise: U.uNoise, uPaper: { value: PAPER }, uInk: { value: INK } },
    transparent: true, depthWrite: false, vertexShader: VS_UV,
    fragmentShader: NOISE + /* glsl */ `
      uniform float uTime; uniform vec3 uPaper; uniform vec3 uInk; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p) / 0.6;       // 1.0 at the globe edge
        float n = fbm(p * 2.0 + uTime * 0.01);
        float glow = exp(-max(r - 1.0, 0.0) * (3.2 - n)) * step(0.98, r);
        float ring = (1.0 - smoothstep(1.0, 1.06, r)) * step(0.99, r);
        gl_FragColor = vec4(mix(uPaper * 1.02, uInk, ring * 0.3), glow * 0.8 * (1.0 - smoothstep(0.85, 1.0, length(p))));
      }`,
  }));
  world.add(mist);
  // order set by hand: sky, peaks, mist, globe stuff, waves, clouds
  sky.renderOrder = -3; peaks.renderOrder = -2; mist.renderOrder = -1; waves.renderOrder = 1;

  const lightPts = [], lightSize = [], lightSeed = [];
  const addLight = (lat, lon, size) => {
    const v = latLonToVec3(lat, lon, 1.004);
    lightPts.push(v.x, v.y, v.z); lightSize.push(size); lightSeed.push(Math.random());
  };
  CITIES.forEach(([lat, lon]) => {
    addLight(lat, lon, 4.2);
    const k = 2 + Math.floor(Math.random() * 3);
    for (let j = 0; j < k; j++) addLight(lat + (Math.random() - 0.5) * 2.2, lon + (Math.random() - 0.5) * 2.8, 1.8 + Math.random() * 1.6);
  });
  places.forEach((p) => addLight(p.lat, p.lon, 7));
  const lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.Float32BufferAttribute(lightPts, 3));
  lGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(lightSize, 1));
  lGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(lightSeed, 1));
  const lightsU = { uTime: U.uTime, uSun: sunU, uPx: { value: dpr }, uGold: { value: GOLD } };
  spin.add(new THREE.Points(lGeo, new THREE.ShaderMaterial({
    uniforms: lightsU, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aSize; attribute float aSeed; uniform vec3 uSun; uniform float uTime; uniform float uPx;
      varying float vA;
      void main() {
        vec3 n = normalize(position);
        float night = 1.0 - smoothstep(-0.14, 0.02, dot(n, uSun));
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float facing = dot(normalize(normalMatrix * n), normalize(-mv.xyz));
        vA = night * smoothstep(0.04, 0.3, facing);
        gl_PointSize = aSize * uPx * (0.8 + 0.25 * sin(uTime * (1.1 + aSeed * 2.0) + aSeed * 40.0));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uGold; varying float vA;
      void main() {
        float r = length(gl_PointCoord * 2.0 - 1.0);
        float a = (1.0 - smoothstep(0.15, 1.0, r)) * vA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(mix(uGold, vec3(1.0, 0.96, 0.82), 1.0 - smoothstep(0.0, 0.4, r)), a * 0.9);
      }`,
  })));

  // city markers: a seal on a stem plus a ripple on the ground
  const HANJA = { seoul: '首爾', paris: '巴里' };
  const markers = places.map((p, i) => {
    const n = latLonToVec3(p.lat, p.lon);
    const stemH = 0.2;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, stemH, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.12, 0.1, 0.09) }));
    stem.position.copy(n.clone().multiplyScalar(1 + stemH / 2));
    stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    const seal = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1625), new THREE.ShaderMaterial({
      uniforms: { uMap: { value: sealTexture(HANJA[p.id] || p.name.ko, 7 + i * 5) }, uOpacity: { value: 1 } },
      transparent: true, depthWrite: false, vertexShader: VS_UV,
      fragmentShader: `uniform sampler2D uMap; uniform float uOpacity; varying vec2 vUv; void main(){ vec4 c = texture2D(uMap, vUv); gl_FragColor = vec4(c.rgb, c.a * uOpacity); }`,
    }));
    const top = n.clone().multiplyScalar(1 + stemH + 0.075);
    seal.position.copy(top);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 48), new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uSeal: { value: SEAL } }, transparent: true, depthWrite: false, vertexShader: VS_UV,
      fragmentShader: `uniform float uT; uniform vec3 uSeal; void main(){ gl_FragColor = vec4(uSeal, (1.0 - uT) * 0.7); }`,
    }));
    ring.position.copy(n.clone().multiplyScalar(1.003));
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    spin.add(stem, seal, ring);
    return { place: p, n, seal, ring, top, phase: i * 0.5 };
  });

  // red thread between the two, and its dashed shadow on the ground
  const vS = latLonToVec3(places[0].lat, places[0].lon), vP = latLonToVec3(places[1].lat, places[1].lon);
  const arcPts = [], groundPts = [], flightPts = [];
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const dir = slerpUnit(vS, vP, t);
    const lift = Math.sin(Math.PI * t);
    arcPts.push(dir.clone().multiplyScalar(1.01 + 0.3 * lift));
    groundPts.push(dir.clone().multiplyScalar(1.003));
    flightPts.push(dir.clone().multiplyScalar(1.06 + 0.3 * lift));
  }
  const threadMat = (col, dashed) => new THREE.ShaderMaterial({
    uniforms: { uCol: { value: col }, uTime: U.uTime, uDraw: { value: 0 }, uSun: sunU, uNightCol: { value: new THREE.Vector3(0.93, 0.86, 0.72) } },
    transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; varying float vNight; uniform vec3 uSun;
      void main(){ vUv = uv; vNight = 1.0 - smoothstep(-0.1, 0.05, dot(normalize(position), uSun)); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; uniform vec3 uNightCol; uniform float uTime; uniform float uDraw; varying vec2 vUv; varying float vNight;
      void main() {
        if (vUv.x > uDraw) discard;
        float a = ${dashed ? 'step(0.5, fract(vUv.x * 70.0)) * 0.6' : '0.75 + 0.25 * sin(vUv.x * 80.0 - uTime * 3.0)'};
        gl_FragColor = vec4(${dashed ? 'mix(uCol, uNightCol, vNight)' : 'uCol'}, a);
      }`,
  });
  const thread = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcPts), 200, 0.0075, 8, false), threadMat(SEAL, false));
  const ground = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(groundPts), 200, 0.003, 5, false), threadMat(INK, true));
  spin.add(thread, ground);
  const flight = new THREE.CatmullRomCurve3(flightPts);

  const crane = makeCrane();
  crane.scale.setScalar(0.13);
  spin.add(crane);
  const craneState = { u: 0, dir: 1, hold: 0 };

  let vw = 1, vh = 1, aspect = 1, portrait = false;
  const lay = { fx: 0.62, fy: 0.5, R: 300 };
  function size() {
    const r = canvas.getBoundingClientRect();
    vw = Math.max(2, r.width); vh = Math.max(2, r.height);
    renderer.setSize(vw, vh, false);
    aspect = vw / vh;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    portrait = aspect < 0.9;
    lay.fx = portrait ? 0.5 : 0.63;
    lay.fy = portrait ? 0.46 : 0.5;
    lay.R = portrait ? Math.min(vw * 0.41, vh * 0.25) : Math.min(vh * 0.37, vw * 0.25);
    for (const m of layers) {
      const dist = D - m.position.z;
      const h = 2 * dist * TAN;
      m.scale.set(h * aspect * 1.3, h * 1.3, 1);
      (m.userData.bake ? m.userData.bake.paint : m.material).uniforms.uAspect.value = aspect;
    }
    skyU.uSunPos.value.set(portrait ? 0.84 : 0.9, portrait ? 0.8 : 0.74);
    skyU.uMoonPos.value.set(portrait ? 0.14 : 0.1, portrait ? 0.83 : 0.8);
    lightsU.uPx.value = dpr * clamp(lay.R / 330, 0.55, 1.2);
    skyU.uR.value = portrait ? 0.042 : 0.068;
    const P = peaksU.uP.value;
    const cx = lay.fx;
    // [x, height, half width, tone], back to front. tallest goes last, right behind the globe
    const spec = portrait
      ? [[0.0, 0.1, 0.42, 0.45], [1.0, 0.11, 0.42, 0.45], [0.22, 0.15, 0.4, 0.6], [0.78, 0.16, 0.4, 0.6], [0.5, 0.22, 0.46, 0.8]]
      : [[cx - 0.55, 0.22, 0.2, 0.45], [cx + 0.36, 0.24, 0.18, 0.45], [cx - 0.33, 0.32, 0.2, 0.6], [cx + 0.2, 0.36, 0.2, 0.6], [cx - 0.04, 0.5, 0.24, 0.8]];
    spec.forEach((s, i) => P[i].set(...s));
    const q = Math.min(dpr, 1.25) * 1.3;
    bake(peaks, vw * q, vh * q);
    bake(sky, vw * q * 0.75, vh * q * 0.75);
    waves.material.uniforms.uTop.value = portrait ? 0.12 : 0.16;
    clouds.forEach((c) => {
      const dist = D - c.position.z;
      const h = 2 * dist * TAN;
      const w = h * aspect;
      const cw = (portrait ? 0.7 : 0.34) * w * [1, 0.8, 0.7][c.userData.i];
      c.scale.set(cw, cw / 3, 1);
      c.userData.w = w; c.userData.cw = cw;
      c.position.y = h * (portrait ? [-0.2, 0.2, -0.02][c.userData.i] : [-0.24, 0.26, -0.08][c.userData.i]);
    });
  }
  new ResizeObserver(size).observe(canvas);
  size();

  // scroll tour: both cities, paris, along the thread to seoul, then both again
  const BOTH = latLonToVec3(46, 62);
  const KEYS = [
    { p: 0.0, v: BOTH, s: 0.88 },
    { p: 0.12, v: BOTH, s: 1 },
    { p: 0.36, v: vP, s: 1.34 },
    { p: 0.64, v: vS, s: 1.34 },
    { p: 0.88, v: BOTH, s: 1 },
  ];
  function keyAt(p) {
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = ease(clamp((p - a.p) / (b.p - a.p)));
    return { v: slerpUnit(a.v, b.v, t), s: lerp(a.s, b.s, t) };
  }
  let progress = 0, focus = null;
  const cur = { rx: 0, ry: 0, s: 1, init: false };

  // drag to spin, it eases back to the tour after you let go
  const dragOff = { x: 0, y: 0, idle: 0 };
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; canvas.setPointerCapture(e.pointerId); canvas.classList.add('is-dragging'); });
  canvas.addEventListener('pointermove', (e) => {
    if (drag && e.pointerId === drag.id) {
      dragOff.x = clamp(dragOff.x + (e.clientX - drag.x) * 0.006, -Math.PI, Math.PI);
      dragOff.y = clamp(dragOff.y + (e.clientY - drag.y) * 0.004, -0.8, 0.8);
      drag.x = e.clientX; drag.y = e.clientY;
      dragOff.idle = 0;
    }
  });
  const endDrag = () => { drag = null; canvas.classList.remove('is-dragging'); };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // whole stage leans a bit towards the mouse (parallax)
  const lean = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => {
    if (reduceMotion || e.pointerType !== 'mouse') return;
    lean.tx = (e.clientX / innerWidth - 0.5) * 2;
    lean.ty = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });

  let timeOffset = 0, sunClock = 0;
  const tmp = new THREE.Vector3(), camDir = new THREE.Vector3(), q = new THREE.Quaternion(), m4 = new THREE.Matrix4();
  const proj = places.map((p) => ({ place: p, x: 0, y: 0, gx: 0, gy: 0, facing: 0 }));
  let active = false, t = 0, last = performance.now(), onFrame = null;

  function updateSun(force) {
    if (!force && sunClock > 0) return;
    sunClock = 1;
    const now = new Date(Date.now() + timeOffset);
    const s = sunPosition(now);
    sunU.value.copy(latLonToVec3(s.lat, s.lon));
    skyU.uPhase.value = moonPhase(now);
    if (Math.abs(skyU.uPhase.value - bakedPhase) > 0.004) { bakedPhase = skyU.uPhase.value; if (sky.userData.bake.w > 2) bake(sky); }
  }
  updateSun(true);

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!active || document.hidden) return;
    t += dt;
    U.uTime.value = t;
    sunClock -= dt;
    updateSun(false);

    const k = keyAt(progress);
    if (!drag) {
      dragOff.idle += dt;
      if (dragOff.idle > 1.6) { const e = damp(dt, 1.4); dragOff.x *= 1 - e; dragOff.y *= 1 - e; }
    }
    const lat = Math.asin(clamp(k.v.y, -1, 1));
    const tRx = lat * 0.88 + dragOff.y;
    const tRy = -Math.atan2(k.v.x, k.v.z) + dragOff.x + (reduceMotion ? 0 : Math.sin(t * 0.13) * 0.035);
    if (!cur.init) { cur.rx = tRx; cur.ry = tRy; cur.s = k.s; cur.init = true; }
    const e = reduceMotion ? 1 : damp(dt, drag ? 12 : 3.2);
    cur.rx = lerp(cur.rx, tRx, e);
    cur.ry += Math.atan2(Math.sin(tRy - cur.ry), Math.cos(tRy - cur.ry)) * e;
    cur.s = lerp(cur.s, k.s, reduceMotion ? 1 : damp(dt, 3));
    spin.rotation.set(cur.rx, cur.ry, 0);

    const H0 = 2 * D * TAN;
    const gs = (lay.R / vh) * H0 * cur.s;
    world.scale.setScalar(gs);
    world.position.set((lay.fx - 0.5) * H0 * aspect, (0.5 - lay.fy) * H0, 0);
    mist.scale.setScalar(1 / 0.6 * 2);
    mist.quaternion.copy(camera.quaternion);

    lean.x = lerp(lean.x, lean.tx, damp(dt, 2.5));
    lean.y = lerp(lean.y, lean.ty, damp(dt, 2.5));
    camera.position.set(lean.x * 0.45, -lean.y * 0.28 - (progress - 0.5) * 0.7, D);
    camera.lookAt(0, 0, 0);

    clouds.forEach((c) => {
      const d = c.userData;
      d.x += d.speed * dt * (reduceMotion ? 0.2 : 1);
      const span = d.w * 1.3 + d.cw;
      const x = ([0.25, -0.3, 0.42][d.i] + d.x) * d.w;
      c.position.x = ((((x + span / 2) % span) + span) % span) - span / 2;
      c.material.uniforms.uOpacity.value = 0.75;
    });

    markers.forEach((m) => {
      m.seal.quaternion.copy(spin.getWorldQuaternion(q).invert().multiply(camera.quaternion));
      const rt = ((t * 0.5 + m.phase) % 1);
      m.ring.scale.setScalar(0.02 + rt * 0.09);
      m.ring.material.uniforms.uT.value = rt;
    });

    const draw = thread.material.uniforms.uDraw;
    draw.value = Math.min(1, draw.value + dt * 0.5);
    ground.material.uniforms.uDraw.value = draw.value;
    const cs = craneState;
    if (cs.hold > 0) cs.hold -= dt;
    else {
      cs.u += cs.dir * dt / (reduceMotion ? 22 : 11);
      if (cs.u >= 1 || cs.u <= 0) { cs.u = clamp(cs.u); cs.dir *= -1; cs.hold = 1.4; }
    }
    const u = ease(cs.u);
    const pos = flight.getPointAt(u);
    const up = pos.clone().normalize();
    const fwd = flight.getTangentAt(u).multiplyScalar(cs.hold > 0 ? -cs.dir : cs.dir);
    fwd.sub(up.clone().multiplyScalar(fwd.dot(up))).normalize();
    const side = new THREE.Vector3().crossVectors(up, fwd).normalize();
    m4.makeBasis(side, up, fwd);
    q.setFromRotationMatrix(m4);
    crane.quaternion.slerp(q, damp(dt, 5));
    crane.position.copy(pos).addScaledVector(up, Math.sin(t * 2.4) * 0.008);
    const flap = reduceMotion ? 0.2 : Math.sin(t * 5.5) * 0.55;
    crane.userData.wingL.rotation.z = -flap;
    crane.userData.wingR.rotation.z = flap;

    renderer.render(scene, camera);

    if (onFrame) {
      camera.getWorldDirection(camDir);
      markers.forEach((m, i) => {
        tmp.copy(m.top); spin.localToWorld(tmp);
        const nW = m.n.clone().applyQuaternion(spin.getWorldQuaternion(q));
        const toCam = camera.position.clone().sub(tmp).normalize();
        proj[i].facing = nW.dot(toCam);
        tmp.project(camera);
        proj[i].x = (tmp.x * 0.5 + 0.5) * vw;
        proj[i].y = (-tmp.y * 0.5 + 0.5) * vh;
      });
      onFrame(proj, focus);
    }
  }
  requestAnimationFrame(frame);

  return {
    setActive(v) { active = v; if (v) last = performance.now(); },
    setProgress(p) {
      progress = clamp(p);
      focus = progress > 0.26 && progress < 0.48 ? places[1].id : progress > 0.52 && progress < 0.76 ? places[0].id : null;
    },
    setTimeOffset(ms) { timeOffset = ms; updateSun(true); },
    onFrame(fn) { onFrame = fn; },
  };
}
