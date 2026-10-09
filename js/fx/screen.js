// folding screen of the ink portraits. unfolds on scroll, hover a panel and its colour comes back
import * as THREE from '../../vendor/three/three.module.min.js?v=9ff5ee8a7c';
import { makeNoiseTexture } from '../scene/glsl.js?v=9ff5ee8a7c';
import { sealStamp } from '../ink/brush.js?v=9ff5ee8a7c';

const NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const PW = 1, PH = 2.75;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

function captionCanvas(text, i, lang) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 300;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(28,22,20,0.92)';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (lang === 'ko') g.font = '96px "Nanum Brush Script", "Gowun Batang", cursive';
  else g.font = 'italic 64px "Instrument Serif", "Cormorant Garamond", serif';
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > 400 && line) { lines.push(line); line = w; } else line = test;
  }
  lines.push(line);
  const lh = lang === 'ko' ? 92 : 66;
  lines.slice(0, 2).forEach((l, k) => g.fillText(l, 256, 110 + (k - (Math.min(2, lines.length) - 1) / 2) * lh));
  sealStamp(g, 256, 240, 62, NUM[i % NUM.length], { seed: 11 + i * 7, rot: ((i % 3) - 1) * 0.05 });
  return c;
}

export function createScreen(canvas, photos, { reduceMotion = false, onOpen } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch { return null; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const noise = makeNoiseTexture();
  const U = { uTime: { value: 0 }, uNoise: { value: noise } };

  const tex = (src) => {
    const t = new THREE.Texture(src);
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = aniso;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.needsUpdate = true;
    return t;
  };

  const panelMat = (inkTex, colTex, capTex, aspect, seed) => new THREE.ShaderMaterial({
    uniforms: {
      ...U,
      uInk: { value: inkTex }, uCol: { value: colTex }, uCap: { value: capTex },
      uImgAspect: { value: aspect }, uReveal: { value: 0 }, uSeed: { value: seed },
      uSilk: { value: new THREE.Vector3(0.16, 0.2, 0.3) },
    },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN;
      void main() { vUv = uv; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uInk; uniform sampler2D uCol; uniform sampler2D uCap; uniform sampler2D uNoise;
      uniform float uImgAspect; uniform float uReveal; uniform float uSeed; uniform vec3 uSilk;
      varying vec2 vUv; varying vec3 vN;
      float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      vec3 silk(vec2 uv) {
        // silk weave with a faint brocade pattern
        float weave = sin(uv.x * 900.0) * sin(uv.y * 900.0 * 2.75) * 0.5 + 0.5;
        vec2 cell = fract(uv * vec2(6.0, 16.5)) - 0.5;
        float motif = smoothstep(0.26, 0.24, abs(length(cell) - 0.22)) * 0.5 + smoothstep(0.06, 0.04, length(cell)) * 0.4;
        vec3 c = uSilk * (0.9 + 0.08 * weave) + vec3(0.1, 0.085, 0.05) * motif;
        return c * (0.92 + 0.12 * texture2D(uNoise, uv * vec2(1.0, 2.75) * 2.0).a);
      }
      void main() {
        vec3 N = normalize(gl_FrontFacing ? vN : -vN);
        float light = 0.74 + 0.26 * max(dot(N, normalize(vec3(-0.45, 0.35, 0.82))), 0.0);
        vec2 uv = vUv;
        float rim = step(uv.x, 0.012) + step(0.988, uv.x) + step(uv.y, 0.005) + step(0.995, uv.y);
        if (!gl_FrontFacing) {
          vec3 c = mix(silk(uv) * 0.85, vec3(0.12, 0.08, 0.06), clamp(rim, 0.0, 1.0));
          gl_FragColor = vec4(c * light, 1.0);
          return;
        }
        vec2 m = vec2(0.085, 0.05);
        vec2 inner = (uv - m) / (1.0 - 2.0 * m);
        vec3 col = silk(uv);
        if (inner.x > 0.0 && inner.x < 1.0 && inner.y > 0.0 && inner.y < 1.0) {
          vec3 paper = vec3(0.945, 0.925, 0.885) * (0.975 + 0.04 * texture2D(uNoise, inner * vec2(1.0, 2.6) * 3.0 + uSeed).b);
          col = paper;
          // photo area inside the paper, ragged edges
          vec2 ir = (inner - vec2(0.07, 0.27)) / vec2(0.86, 0.69);
          float n1 = texture2D(uNoise, ir * vec2(1.6, 2.4) + uSeed).r;
          float n2 = texture2D(uNoise, ir * vec2(5.0, 7.0) + uSeed * 2.0).b;
          float e = min(min(ir.x, 1.0 - ir.x), min(ir.y, 1.0 - ir.y)) + (n1 - 0.5) * 0.08 + (n2 - 0.5) * 0.025;
          float mask = smoothstep(0.0, 0.07, e);
          float ra = (0.86 * (1.0 - 2.0 * m.x)) / (0.69 * (1.0 - 2.0 * m.y) * ${PH.toFixed(2)});
          vec2 sc = ra > uImgAspect ? vec2(1.0, uImgAspect / ra) : vec2(ra / uImgAspect, 1.0);
          vec2 puv = (clamp(ir, 0.0, 1.0) - 0.5) * sc + 0.5;
          vec3 inkC = texture2D(uInk, puv).rgb;
          vec3 colC = texture2D(uCol, puv).rgb;
          colC = mix(colC, colC * colC * (3.0 - 2.0 * colC), 0.25) * vec3(1.02, 1.0, 0.95) + 0.02;
          // on hover the colour spreads out from the middle
          float rr = length((ir - 0.5) * vec2(1.0, 1.5)) + (texture2D(uNoise, ir * 2.2 + uSeed * 3.0).g - 0.5) * 0.35;
          float rev = 1.0 - smoothstep(uReveal * 1.25 - 0.28, uReveal * 1.25, rr);
          vec3 img = mix(inkC, colC, rev);
          float front = smoothstep(0.0, 0.08, rev) * (1.0 - smoothstep(0.08, 0.3, rev)) * uReveal * (1.0 - uReveal);
          img *= 1.0 - front * 0.45;
          col = mix(col, img, mask);
          // caption and seal strip at the bottom
          vec2 cu = (inner - vec2(0.05, 0.02)) / vec2(0.9, 0.22);
          if (cu.x > 0.0 && cu.x < 1.0 && cu.y > 0.0 && cu.y < 1.0) {
            float ar = (0.9 * (1.0 - 2.0 * m.x)) / (0.22 * (1.0 - 2.0 * m.y) * ${PH.toFixed(2)}) / (512.0 / 300.0);
            vec2 cuv = vec2(cu.x, (cu.y - 0.5) * ar + 0.5);
            if (cuv.y > 0.0 && cuv.y < 1.0) { vec4 cap = texture2D(uCap, cuv); col = mix(col, cap.rgb, cap.a); }
          }
          vec2 ed = min(inner, 1.0 - inner);
          col = mix(col, vec3(0.55, 0.45, 0.32), (1.0 - smoothstep(0.0, 0.006, min(ed.x, ed.y * 2.75))) * 0.6);
        }
        col = mix(col, vec3(0.12, 0.08, 0.06), clamp(rim, 0.0, 1.0));
        col *= light;
        col += (hash(gl_FragCoord.xy) - 0.5) * 0.02;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

  const group = new THREE.Group();
  scene.add(group);
  const list = photos.slice(0, 8);
  const panels = list.map((ph, i) => {
    const inkT = tex(ph.inkCanvas);
    const colT = tex(ph.image || ph.canvas);
    const capT = new THREE.CanvasTexture(captionCanvas('', i, 'en'));
    capT.colorSpace = THREE.NoColorSpace;
    const mat = panelMat(inkT, colT, capT, ph.width / ph.height, i * 0.173 + 0.11);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat);
    mesh.userData = { i, reveal: 0, capT };
    group.add(mesh);
    return mesh;
  });

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; void main(){ vec2 p = (vUv - 0.5) * 2.0; float a = exp(-dot(p * vec2(1.0, 2.4), p * vec2(1.0, 2.4)) * 2.2); gl_FragColor = vec4(0.25, 0.18, 0.12, a * 0.32); }',
  }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -PH / 2 - 0.005;
  scene.add(shadow);

  let progress = 0, sp = 0, portrait = false;
  function fold(theta) {
    let x = 0, z = 0;
    const pts = [];
    panels.forEach((p, i) => {
      const a = i % 2 === 0 ? theta : -theta;
      const dx = Math.cos(a) * PW, dz = -Math.sin(a) * PW;
      p.position.set(x + dx / 2, 0, z + dz / 2);
      p.rotation.y = a;
      pts.push([x, z]);
      x += dx; z += dz;
    });
    pts.push([x, z]);
    const cx = x / 2, cz = pts.reduce((s, q) => s + q[1], 0) / pts.length;
    panels.forEach((p) => { p.position.x -= cx; p.position.z -= cz; });
    shadow.scale.set(x * 1.25 + 0.6, 2.2, 1);
    return x;
  }

  function setCaptions(lang) {
    panels.forEach((p, i) => {
      const c = captionCanvas(list[i].meta.caption?.[lang] ?? '', i, lang);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.NoColorSpace;
      t.anisotropy = aniso;
      p.userData.capT.dispose();
      p.userData.capT = t;
      p.material.uniforms.uCap.value = t;
    });
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let hovered = null;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const pick = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(panels, false)[0];
    return h ? h.object : null;
  };
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    if (e.pointerType === 'mouse') { hovered = pick(e); canvas.style.cursor = hovered ? 'zoom-in' : ''; }
  });
  canvas.addEventListener('pointerleave', () => { hovered = null; });
  canvas.addEventListener('click', (e) => { const p = pick(e); if (p && onOpen) onOpen(p.userData.i, e); });

  function size() {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(Math.max(2, r.width), Math.max(2, r.height), false);
    camera.aspect = r.width / Math.max(1, r.height);
    camera.updateProjectionMatrix();
    portrait = camera.aspect < 0.9;
  }
  new ResizeObserver(size).observe(canvas);
  size();

  let active = false, t = 0, last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!active || document.hidden) return;
    t += dt;
    U.uTime.value = t;
    sp = lerp(sp, progress, 1 - Math.exp(-dt * (reduceMotion ? 30 : 3.5)));
    pointer.sx = lerp(pointer.sx, pointer.x, 1 - Math.exp(-dt * 3));
    pointer.sy = lerp(pointer.sy, pointer.y, 1 - Math.exp(-dt * 3));
    const open = ease(clamp(sp * 1.6));
    const theta = lerp(1.38, 0.42, open);
    const width = fold(theta);
    group.rotation.y = lerp(-0.42, 0.18, ease(clamp(sp))) + pointer.sx * 0.08;
    const tanH = Math.tan((camera.fov * Math.PI) / 360);
    let dist, camX = 0;
    if (portrait) {
      dist = (PH * 0.75) / tanH;
      camX = lerp(-width * 0.42, width * 0.42, clamp((sp - 0.2) / 0.8));
    } else {
      dist = Math.max((PH * 0.72) / tanH, ((width * 0.5 + 0.4) / (tanH * camera.aspect)));
    }
    // look a bit above centre so the screen sits low in the frame
    const lift = portrait ? 0.1 : 0.34;
    camera.position.set(camX + pointer.sx * 0.2, lift + 0.5 + pointer.sy * 0.15, dist);
    camera.lookAt(camX, lift, 0);
    panels.forEach((p) => {
      const u = p.userData;
      u.reveal = lerp(u.reveal, hovered === p ? 1 : 0, 1 - Math.exp(-dt * (hovered === p ? 1.6 : 2.4)));
      p.material.uniforms.uReveal.value = u.reveal;
    });
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return {
    setProgress(p) { progress = clamp(p); },
    setActive(v) { active = v; if (v) last = performance.now(); },
    setCaptions,
  };
}
