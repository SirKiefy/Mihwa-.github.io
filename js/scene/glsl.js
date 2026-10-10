// shared glsl bits, plus one baked noise texture every wash samples. much cheaper than per-pixel noise on phones
import * as THREE from '../../vendor/three/three.module.min.js?v=13fb58fc16';
import { noiseData } from '../fx/noise.js?v=13fb58fc16';

export function makeNoiseTexture(size = 256) {
  const { data } = noiseData(size);
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export const NOISE = /* glsl */ `
uniform sampler2D uNoise;
// fbm, unit sized features, 0..1
float fbm(vec2 p) {
  float a = texture2D(uNoise, p * 0.25).r;
  float b = texture2D(uNoise, p * 0.125 + vec2(0.37, 0.71)).g;
  return clamp((a + b - 1.0) * 1.35 + 0.5, 0.0, 1.0);
}
float fbmL(vec2 p) { return texture2D(uNoise, p * 0.5).a; }
// finer, -1..1, for streaks and dots
float snz(vec2 p) { return texture2D(uNoise, p * 0.0625).b * 2.0 - 1.0; }
// triplanar version for spheres
float fbm3(vec3 p, vec3 n) {
  vec3 w = abs(n); w = w * w; w /= (w.x + w.y + w.z);
  return fbm(p.yz) * w.x + fbm(p.zx + 3.1) * w.y + fbm(p.xy + 7.7) * w.z;
}
`;

// painted sky. the sky quad uses it, and so does anything fading into mist
export const SKY = /* glsl */ `
uniform vec2 uRes;
uniform float uTime;
uniform float uWash;
uniform float uDusk;
uniform float uCloud;
uniform vec3 uPaper;

vec3 skyColor(vec2 s) {
  vec3 col = uPaper;
  float n = fbmL(vec2(s.x * 0.9 + uTime * 0.002, s.y * 1.3));
  float n2 = fbm(vec2(s.x * 4.0 - uTime * 0.006, s.y * 2.5 + 4.0));
  float top = smoothstep(0.4, 1.15, s.y + (n - 0.5) * 0.3);
  float wash = top * (0.1 + 0.1 * n2) * uWash;
  float sea = smoothstep(0.6, 0.0, s.y) * uCloud;
  float cl = fbm(vec2(s.x * 3.2 + uTime * 0.01, s.y * 8.0 - uTime * 0.004));
  wash += sea * smoothstep(0.4, 0.8, cl) * 0.11;
  col = mix(col, vec3(0.36, 0.33, 0.31), wash);
  col = mix(col, col * vec3(1.0, 0.935, 0.905) + vec3(0.018, 0.0, 0.0), uDusk * smoothstep(0.15, 0.95, s.y));
  return col;
}
`;
