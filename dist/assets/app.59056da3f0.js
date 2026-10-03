(() => {
'use strict';
/* src/js/core/runtime.js */
const __m0 = (() => {
const rt = {
stage: null,          // WheelStage или null (нет WebGL)
vw: 0, vh: 0,
y: 0, vel: 0,         // прокрутка и её скорость (px/кадр, сглаженная)
px: -1, py: -1,       // указатель (px)
mobile: false,
reduced: false,
hover: false,         // есть точный указатель
t: 0,
scenes: [],           // [{id, el, top, h}]
active: 'hero',
weights: {},          // присутствие сцены 0..1
progress: {},         // прогресс сцены 0..1
wheel: { x: 0, y: 0, r: 0 }, // экранные координаты колеса
intro: 1,             // 0 → 1 во время въезда колеса
mods: [],             // функции (state, rt) → корректировка целевого состояния колеса
};
const subs = [];
function onFrame(fn) { subs.push(fn); }
function addMod(fn) { rt.mods.push(fn); }
let last = 0;
let lastY = 0;
function loop(now) {
const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
last = now;
rt.t += dt;
rt.y = window.scrollY;
const v = rt.y - lastY;
lastY = rt.y;
rt.vel += (v - rt.vel) * 0.2;
for (let i = 0; i < subs.length; i++) {
try { subs[i](dt, now); } catch (e) { if (window.console) console.error('[frame]', e); subs.splice(i--, 1); }
}
requestAnimationFrame(loop);
}
function startLoop() {
const mqm = matchMedia('(max-width: 899px)');
const mqr = matchMedia('(prefers-reduced-motion: reduce)');
const mqh = matchMedia('(hover: hover) and (pointer: fine)');
const sync = () => {
rt.mobile = mqm.matches;
rt.reduced = mqr.matches;
rt.hover = mqh.matches;
document.documentElement.classList.toggle('rm', rt.reduced);
if (rt.stage) rt.stage.reduced = rt.reduced;
};
sync();
[mqm, mqr, mqh].forEach((m) => m.addEventListener && m.addEventListener('change', sync));
const size = () => { rt.vw = innerWidth; rt.vh = innerHeight; };
size();
addEventListener('resize', size);
addEventListener('pointermove', (e) => { rt.px = e.clientX; rt.py = e.clientY; if (rt.stage) rt.stage.setPointer(e.clientX, e.clientY); }, { passive: true });
lastY = window.scrollY;
requestAnimationFrame(loop);
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
return { rt, onFrame, addMod, startLoop, clamp, lerp, smooth, easeOut };
})();
/* src/js/gl/shaders.js */
const __m1 = (() => {
const VERT = `
attribute vec3 aPos;
attribute vec3 aNor;
attribute vec2 aUV;
uniform mat4 uModel;
uniform mat4 uVP;
uniform mat3 uNM;
uniform float uMat;
uniform float uRimR;
uniform float uDent;
uniform float uDentA;
uniform float uBulge;
uniform float uBulgeA;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vW;
varying vec2 vUV;
float angd(float a, float b) { float d = a - b; return atan(sin(d), cos(d)); }
void main() {
vec3 p = aPos;
float r = length(p.xy);
float th = atan(p.x, p.y);
if (uMat > 0.5 && uMat < 1.5 && r > uRimR - 0.07) {
float d = angd(th, uDentA);
float k = uDent * 0.075 * exp(-d * d / 0.05) * smoothstep(uRimR - 0.07, uRimR, r);
p.xy *= (r - k) / max(r, 0.0001);
}
if (uMat < 0.5 && p.z > 0.0) {
float d = angd(th, uBulgeA);
float rr = (r - 0.82) / 0.075;
p.z += uBulge * 0.075 * exp(-d * d / 0.01) * exp(-rr * rr);
}
vObj = p;
vec4 w = uModel * vec4(p, 1.0);
vW = w.xyz;
vN = uNM * aNor;
vUV = aUV;
gl_Position = uVP * w;
}
`;
const FRAG = `
precision highp float;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vW;
varying vec2 vUV;
uniform float uMat;
uniform vec3 uCam;
uniform vec3 uKey;
uniform vec3 uMouse;
uniform float uMouseK;
uniform float uBlur;
uniform float uSteel;
uniform float uStuds;
uniform float uNail;
uniform float uNailA;
uniform float uWeight;
uniform float uWeightA;
uniform float uBulge;
uniform float uBulgeA;
uniform float uCut;
uniform vec4 uHi;
uniform float uTime;
uniform vec3 uAcc;
uniform sampler2D uSide;
uniform float uRimR;
uniform float uAlpha;
uniform float uScale;
const float TAU = 6.2831853;
float angd(float a, float b) { float d = a - b; return atan(sin(d), cos(d)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 bumpN(vec3 N, vec3 P, float h, float k) {
vec3 dpx = dFdx(P);
vec3 dpy = dFdy(P);
float dhx = dFdx(h);
float dhy = dFdy(h);
vec3 r1 = cross(dpy, N);
vec3 r2 = cross(N, dpx);
float det = dot(dpx, r1);
vec3 g = sign(det) * (dhx * r1 + dhy * r2);
return normalize(abs(det) * N - k * uScale * g);
}
vec3 env(vec3 R) {
float y = R.y;
vec3 c = mix(vec3(0.03), vec3(0.42), smoothstep(-0.25, 0.95, y));
float sb = 1.0 - smoothstep(0.0, 0.05, abs(y - 0.5) - 0.13);
float sb2 = (1.0 - smoothstep(0.0, 0.06, abs(R.x + 0.6) - 0.09)) * smoothstep(-0.2, 0.4, y);
float sb3 = (1.0 - smoothstep(0.0, 0.04, abs(R.x - 0.15) - 0.03)) * smoothstep(0.2, 0.7, y) * 0.6;
c += vec3(1.25) * sb + vec3(0.85) * sb2 + vec3(0.7) * sb3;
c += uAcc * smoothstep(0.35, 0.95, R.x) * 1.1;
c *= mix(0.18, 1.0, smoothstep(-0.55, 0.05, y));
return c;
}
float treadH(float t, float v) {
float u = t * 60.0;
float g = fract(u + abs(v) * 1.15);
float lat = smoothstep(0.0, 0.035, g) * (1.0 - smoothstep(0.1, 0.135, g)) * step(abs(v), 0.94);
float circ = 1.0 - smoothstep(0.025, 0.05, abs(abs(v) - 0.44));
float cen = 1.0 - smoothstep(0.02, 0.04, abs(v));
float sipe = (1.0 - smoothstep(0.0, 0.025, abs(fract(u * 2.0 + 0.5 + v * 0.6) - 0.5))) * step(abs(v), 0.86) * 0.6;
return 1.0 - max(max(lat, circ), max(cen, sipe));
}
vec2 spokeCov(float th, float r) {
float R = uRimR;
if (r < 0.155) return vec2(1.0, 1.0);
if (r > R - 0.075) return vec2(1.0, 1.0 - smoothstep(R - 0.075, R - 0.06, r) * 0.0);
if (uSteel > 0.5) {
float seg = TAU / 8.0;
float a = mod(th, seg) - seg * 0.5;
float rc = 0.5 * R;
float e = pow((r - rc) / 0.085, 2.0) + pow(a * r / 0.055, 2.0);
float hole = 1.0 - smoothstep(0.9, 1.0, e);
float seg2 = TAU / 24.0;
float a2 = mod(th + seg2 * 0.5, seg2) - seg2 * 0.5;
float dv = length(vec2(r - (R - 0.115), a2 * r));
float vent = 1.0 - smoothstep(0.011, 0.014, dv);
float h = smoothstep(1.0, 1.9, e) * smoothstep(0.012, 0.03, dv);
return vec2(1.0 - max(hole, vent), h);
}
float seg = TAU / 5.0;
float a = mod(th + seg * 0.5, seg) - seg * 0.5;
float k = clamp((r - 0.16) / (R - 0.24), 0.0, 1.0);
float hw = mix(0.078, 0.044, k);
float off = 0.105 * smoothstep(0.16, 0.42, r);
float d1 = abs(a - off) * r;
float d2 = abs(a + off) * r;
float d = min(d1, d2);
float aa = 0.0035;
float cov = 1.0 - smoothstep(hw - aa, hw + aa, d);
float h = 1.0 - pow(clamp(d / hw, 0.0, 1.0), 2.0);
return vec2(cov, h);
}
vec3 shadeRubber(vec3 N, vec3 V, vec3 base, float gloss) {
vec3 L = normalize(uKey);
vec3 H = normalize(L + V);
float diff = max(dot(N, L), 0.0) * 0.9 + 0.06;
float spec = pow(max(dot(N, H), 0.0), 16.0 + gloss * 30.0) * (0.035 + gloss * 0.15);
vec3 Lm = normalize(uMouse - vW);
float d2 = max(dot(N, Lm), 0.0) * uMouseK;
float s2 = pow(max(dot(N, normalize(Lm + V)), 0.0), 26.0) * 0.25 * uMouseK;
float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
vec3 c = base * (diff + d2 * 0.5) + vec3(spec + s2 * 0.35) + fr * vec3(0.018);
c += uAcc * fr * smoothstep(0.1, 0.9, N.x) * 0.1;
return c;
}
vec3 shadeMetal(vec3 N, vec3 V, vec3 base, float rough) {
vec3 L = normalize(uKey);
vec3 H = normalize(L + V);
vec3 R = reflect(-V, N);
float ndv = max(dot(N, V), 0.0);
float F = 0.55 + 0.45 * pow(1.0 - ndv, 5.0);
float diff = max(dot(N, L), 0.0);
float spec = pow(max(dot(N, H), 0.0), mix(120.0, 20.0, rough)) * mix(1.6, 0.4, rough);
vec3 Lm = normalize(uMouse - vW);
float s2 = pow(max(dot(N, normalize(Lm + V)), 0.0), 60.0) * 0.9 * uMouseK;
vec3 e = env(R);
vec3 c = base * (diff * 0.35 + 0.08) + base * e * F * mix(1.0, 0.45, rough) + vec3(spec + s2);
return c;
}
void main() {
vec3 o = vObj;
float r = length(o.xy);
float th = atan(o.x, o.y);
float t = th / TAU + 0.5;
vec3 N = normalize(vN);
vec3 V = normalize(uCam - vW);
if (dot(N, V) < 0.0) N = -N;
float pulse = 0.5 + 0.5 * sin(uTime * 5.0);
vec3 col;
if (uMat < 0.5) {
float isTread = smoothstep(0.962, 0.985, r);
float v = o.z / 0.235;
float h = 1.0;
float letters = 0.0;
if (isTread > 0.0) {
if (uBlur > 0.002) {
h = 0.0;
for (int i = 0; i < 6; i++) h += treadH(t + (float(i) / 5.0 - 0.5) * uBlur / TAU, v);
h /= 6.0;
} else {
h = treadH(t, v);
}
h = mix(1.0, h, isTread);
}
float q = (r - uRimR - 0.02) / (0.925 - uRimR - 0.02);
if (q > 0.0 && q < 1.0 && isTread < 0.5) {
float tt = o.z > 0.0 ? t : 1.0 - t;
if (uBlur > 0.002) {
for (int i = 0; i < 6; i++) letters += texture2D(uSide, vec2(tt + (float(i) / 5.0 - 0.5) * uBlur / TAU, 1.0 - q)).r;
letters /= 6.0;
} else {
letters = texture2D(uSide, vec2(tt, 1.0 - q)).r;
}
}
float height = h * 0.8 + letters * 0.5;
N = bumpN(N, vW, height, 0.012);
vec3 base = vec3(0.016, 0.016, 0.017) * mix(0.35, 1.0, h);
base += vec3(0.006) * letters;
float ring = 1.0 - smoothstep(0.0, 0.004, abs(r - (uRimR + 0.035)));
base += vec3(0.006) * ring;
col = shadeRubber(N, V, base, letters * 0.6);
if (uStuds > 0.01) {
float row = step(0.0, o.z);
float ax = (fract(t * 30.0 + row * 0.5) - 0.5) * TAU / 30.0;
float ay = abs(o.z) - 0.155;
float d = length(vec2(ax, ay));
float stud = (1.0 - smoothstep(0.011, 0.014, d)) * isTread * uStuds;
float ringS = (1.0 - smoothstep(0.0, 0.004, abs(d - 0.019))) * isTread * uStuds;
col *= 1.0 - ringS * 0.6;
vec3 sc = shadeMetal(N, V, vec3(0.8), 0.2);
col = mix(col, sc, stud);
col += uAcc * (stud + ringS) * uHi.w * pulse * 0.8;
}
if (uNail > 0.01) {
float dn = length(vec2(angd(th, uNailA) * r, o.z - 0.06));
float head = (1.0 - smoothstep(0.03, 0.036, dn)) * isTread;
col = mix(col, shadeMetal(N, V, vec3(0.8), 0.3), head * uNail);
float glow = (1.0 - smoothstep(0.0, 0.012, abs(dn - (0.07 + pulse * 0.03)))) * isTread;
col += uAcc * glow * uNail * 1.4;
}
if (uBulge > 0.01 && o.z > 0.0) {
float d = length(vec2(angd(th, uBulgeA) * r, (r - 0.82) * 1.0));
float g = (1.0 - smoothstep(0.0, 0.016, abs(d - (0.11 + pulse * 0.02))));
col += uAcc * g * uBulge * 1.3;
}
if (uCut > 0.01 && o.z > 0.0) {
float a = angd(th, -1.1);
float cut = (1.0 - smoothstep(0.0, 0.006, abs(a * r * 0.6 - (r - 0.8) * 0.25))) * step(abs(r - 0.8), 0.07);
col = mix(col, vec3(0.0), cut * uCut);
float g = 1.0 - smoothstep(0.0, 0.014, abs(length(vec2(a * r, r - 0.8)) - (0.12 + pulse * 0.02)));
col += uAcc * g * uCut * 1.2;
}
float fr = pow(1.0 - max(dot(N, V), 0.0), 2.0);
col += uAcc * (uHi.x * isTread + uHi.y * (1.0 - isTread) * step(0.0, o.z)) * (0.25 + fr * 0.8) * (0.6 + 0.4 * pulse);
} else if (uMat < 1.5) {
bool face = o.z > 0.03 && r < uRimR - 0.03;
float faceH = 1.0;
if (face && r > 0.15) {
vec2 sc;
if (uBlur > 0.002) {
sc = vec2(0.0);
for (int i = 0; i < 6; i++) sc += spokeCov(th + (float(i) / 5.0 - 0.5) * uBlur, r);
sc /= 6.0;
} else {
sc = spokeCov(th, r);
}
float cov = sc.x;
faceH = sc.y;
float thr = uBlur > 0.002 ? hash(gl_FragCoord.xy + fract(uTime) * 7.0) * 0.98 + 0.01 : 0.5;
if (cov < thr) discard;
}
N = bumpN(N, vW, faceH, 0.05);
vec3 base = uSteel > 0.5 ? vec3(0.3, 0.31, 0.33) : vec3(0.56, 0.56, 0.58);
float rough = uSteel > 0.5 ? 0.75 : 0.3;
if (r > uRimR - 0.035 && o.z > 0.03) { base = vec3(0.8); rough = 0.1; }
if (o.z < 0.035 && r > uRimR - 0.04) { base = vec3(0.16); rough = 0.6; }
if (r < 0.14) {
float seg = TAU / 5.0;
float a = mod(th, seg) - seg * 0.5;
float dn = length(vec2(r - 0.108, a * r));
float nut = 1.0 - smoothstep(0.019, 0.023, dn);
base = mix(base, vec3(0.3), nut);
rough = mix(rough, 0.15, nut);
if (r < 0.068) { base = vec3(0.04); rough = 0.08; }
}
col = shadeMetal(N, V, base, rough);
if (r < 0.068 && r > 0.05) col = mix(col, uAcc * 1.2, 1.0 - smoothstep(0.0, 0.003, abs(r - 0.058) - 0.004));
if (uWeight > 0.01 && r > uRimR - 0.06 && o.z > 0.02) {
float d = abs(angd(th, uWeightA)) * r;
float w = (1.0 - smoothstep(0.045, 0.05, d)) * (1.0 - smoothstep(uRimR - 0.03, uRimR - 0.025, r));
col = mix(col, shadeRubber(N, V, uAcc * 0.6, 0.6), w * uWeight);
col += uAcc * w * uWeight * pulse * 0.4;
}
float fr = pow(1.0 - max(dot(N, V), 0.0), 2.0);
col += uAcc * uHi.z * (0.15 + fr * 0.9) * (0.6 + 0.4 * pulse) * smoothstep(uRimR - 0.08, uRimR, r);
col += uAcc * uHi.z * 0.08 * (0.6 + 0.4 * pulse);
} else if (uMat < 2.5) {
float seg = TAU / 30.0;
float a = mod(th + floor(r * 40.0) * 0.07, seg) - seg * 0.5;
float row = abs(fract((r - 0.27) / 0.06) - 0.5);
float hole = (1.0 - smoothstep(0.008, 0.011, length(vec2(a * r, row * 0.06)))) * step(0.25, r) * step(r, 0.45);
float brushed = 0.85 + 0.15 * hash(vec2(floor(r * 260.0), 1.0));
vec3 base = vec3(0.3) * brushed * (1.0 - hole * 0.85);
if (r < 0.2) base = vec3(0.12);
col = shadeMetal(N, V, base, 0.55);
} else if (uMat < 3.5) {
col = shadeRubber(N, V, uAcc * 0.55, 1.0);
col += shadeMetal(N, V, uAcc * 0.5, 0.2) * 0.5;
} else if (uMat < 4.5) {
float knob = step(0.5, fract(t * 140.0)) * step(0.5, fract(o.z * 30.0 + 0.25)) * smoothstep(0.985, 0.995, r);
float h = 1.0 - knob * 0.5;
N = bumpN(N, vW, h, 0.006);
col = shadeRubber(N, V, vec3(0.04) * (0.7 + 0.3 * h), 0.2);
float fr = pow(1.0 - max(dot(N, V), 0.0), 2.0);
col += uAcc * uHi.x * (0.25 + fr) * (0.6 + 0.4 * pulse);
} else {
vec3 base = vec3(0.8);
float rough = 0.25;
if (r > 0.85) {
base = abs(o.z) > 0.012 ? vec3(0.7) : vec3(0.05);
rough = abs(o.z) > 0.012 ? 0.35 : 0.3;
}
col = shadeMetal(N, V, base, rough);
col += uAcc * uHi.z * 0.5 * (0.6 + 0.4 * pulse) * step(0.85, r);
}
col = 1.0 - exp(-col * 1.55);
col = pow(col, vec3(1.0 / 2.2));
gl_FragColor = vec4(col * uAlpha, uAlpha);
}
`;
return { VERT, FRAG };
})();
/* src/js/gl/geometry.js */
const __m2 = (() => {
const TAU = Math.PI * 2;
function profileNormals(pts, outward = 1) {
const n = pts.length;
return pts.map((p, i) => {
const a = pts[Math.max(0, i - 1)];
const b = pts[Math.min(n - 1, i + 1)];
let tr = b.r - a.r, tz = b.z - a.z;
const l = Math.hypot(tr, tz) || 1;
tr /= l; tz /= l;
return { r: p.r, z: p.z, nr: tz * outward, nz: -tr * outward };
});
}
function lathe(profile, segs, a0 = 0, a1 = TAU) {
const P = profile.length;
const pos = new Float32Array((segs + 1) * P * 3);
const nor = new Float32Array((segs + 1) * P * 3);
const uv = new Float32Array((segs + 1) * P * 2);
let k = 0, q = 0;
for (let i = 0; i <= segs; i++) {
const th = a0 + ((a1 - a0) * i) / segs;
const s = Math.sin(th), c = Math.cos(th);
for (let j = 0; j < P; j++) {
const p = profile[j];
pos[k] = p.r * s; pos[k + 1] = p.r * c; pos[k + 2] = p.z;
nor[k] = p.nr * s; nor[k + 1] = p.nr * c; nor[k + 2] = p.nz;
k += 3;
uv[q] = i / segs; uv[q + 1] = j / (P - 1);
q += 2;
}
}
const idx = new Uint32Array(segs * (P - 1) * 6);
let t = 0;
for (let i = 0; i < segs; i++) {
for (let j = 0; j < P - 1; j++) {
const a = i * P + j, b = (i + 1) * P + j;
idx[t++] = a; idx[t++] = b; idx[t++] = a + 1;
idx[t++] = a + 1; idx[t++] = b; idx[t++] = b + 1;
}
}
return { pos, nor, uv, idx };
}
function tireProfile(rim) {
const W = 0.3;     // половина ширины по протектору
const c = 0.075;   // радиус плечевой зоны
const Wb = 0.235;  // половина ширины у борта
const pts = [];
const n1 = 22;
for (let i = 0; i <= n1; i++) {
const t = i / n1;
const r = rim + (1 - c - rim) * t;
const bulge = Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5);
const z = Wb + (W + 0.012 - Wb) * bulge - 0.012 * t * t;
pts.push({ r, z });
}
for (let i = 1; i <= 8; i++) {
const a = (i / 8) * Math.PI * 0.5;
pts.push({ r: 1 - c + c * Math.sin(a), z: W - c + c * Math.cos(a) });
}
const n2 = 16;
for (let i = 1; i < n2; i++) pts.push({ r: 1, z: (W - c) * (1 - (2 * i) / n2) });
const front = pts.slice(0, n1 + 1 + 8);
for (let i = front.length - 1; i >= 0; i--) pts.push({ r: front[i].r, z: -front[i].z });
return profileNormals(pts, -1);
}
function rimProfile(R) {
const pts = [
{ r: 0.0, z: 0.215 },
{ r: 0.035, z: 0.214 },
{ r: 0.06, z: 0.205 },
{ r: 0.072, z: 0.185 },
{ r: 0.1, z: 0.178 },
{ r: 0.14, z: 0.17 },
{ r: 0.175, z: 0.158 },
];
const n = 18;
for (let i = 1; i <= n; i++) {
const t = i / n;
const r = 0.175 + (R - 0.07 - 0.175) * t;
const z = 0.158 - 0.085 * Math.pow(t, 0.8); // вогнутая «спица»
pts.push({ r, z });
}
pts.push({ r: R - 0.045, z: 0.07 });
pts.push({ r: R - 0.02, z: 0.08 });
pts.push({ r: R - 0.004, z: 0.1 });
pts.push({ r: R + 0.012, z: 0.098 });
pts.push({ r: R + 0.02, z: 0.08 });
pts.push({ r: R + 0.018, z: 0.055 });
pts.push({ r: R - 0.005, z: 0.04 });
pts.push({ r: R - 0.02, z: 0.0 });
pts.push({ r: R - 0.025, z: -0.12 });
pts.push({ r: R - 0.028, z: -0.25 });
return profileNormals(pts, 1);
}
function discProfile() {
return profileNormals(
[
{ r: 0.16, z: -0.02 },
{ r: 0.2, z: -0.055 },
{ r: 0.3, z: -0.06 },
{ r: 0.4, z: -0.06 },
{ r: 0.47, z: -0.06 },
],
1
);
}
function caliperProfile() {
const r0 = 0.39, r1 = 0.535, z0 = -0.12, z1 = 0.02, b = 0.012;
const raw = [
{ r: r0 + b, z: z1 }, { r: r1 - b, z: z1 },
{ r: r1, z: z1 - b }, { r: r1, z: z0 + b },
{ r: r1 - b, z: z0 }, { r: r0 + b, z: z0 },
{ r: r0, z: z0 + b }, { r: r0, z: z1 - b },
{ r: r0 + b, z: z1 },
];
return profileNormals(raw, -1);
}
function bikeTireProfile() {
const pts = [];
const n = 20, rc = 0.955, rad = 0.045;
for (let i = 0; i <= n; i++) {
const a = -0.82 * Math.PI + (i / n) * 1.64 * Math.PI; // a=0 — наружу; открыт к центру
pts.push({ r: rc + rad * Math.cos(a), z: rad * Math.sin(a) });
}
return profileNormals(pts, -1);
}
function bikeRimProfile() {
return profileNormals(
[
{ r: 0.915, z: 0.022 }, { r: 0.875, z: 0.016 }, { r: 0.86, z: 0.0 },
{ r: 0.875, z: -0.016 }, { r: 0.915, z: -0.022 },
],
-1
);
}
function bikeHubProfile() {
return profileNormals(
[
{ r: 0.0, z: 0.12 }, { r: 0.03, z: 0.12 }, { r: 0.035, z: 0.09 }, { r: 0.085, z: 0.085 }, { r: 0.085, z: 0.07 },
{ r: 0.04, z: 0.065 }, { r: 0.036, z: -0.065 }, { r: 0.085, z: -0.07 }, { r: 0.085, z: -0.085 },
{ r: 0.035, z: -0.09 }, { r: 0.03, z: -0.12 }, { r: 0.0, z: -0.12 },
],
-1
);
}
function bikeSpokes(count = 32) {
const pos = [], nor = [], uv = [], idx = [];
const w = 0.0055;
for (let i = 0; i < count; i++) {
const side = i % 2 ? 1 : -1;
const aRim = (i / count) * TAU;
const aHub = aRim + side * 0.42;
const A = [0.08 * Math.sin(aHub), 0.08 * Math.cos(aHub), side * 0.075];
const B = [0.865 * Math.sin(aRim), 0.865 * Math.cos(aRim), side * 0.006];
const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
const L = Math.hypot(...d);
const t = d.map((x) => x / L);
let u = [-t[1], t[0], 0];
const ul = Math.hypot(...u) || 1;
u = u.map((x) => (x / ul) * w);
const v = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]].map((x) => (x / w) * w);
const corners = [
[u, v], [u.map((x) => -x), v], [u.map((x) => -x), v.map((x) => -x)], [u, v.map((x) => -x)],
];
const base = pos.length / 3;
for (const P of [A, B]) {
for (const [cu, cv] of corners) {
pos.push(P[0] + cu[0] + cv[0], P[1] + cu[1] + cv[1], P[2] + cu[2] + cv[2]);
const n = [cu[0] + cv[0], cu[1] + cv[1], cu[2] + cv[2]];
const nl = Math.hypot(...n) || 1;
nor.push(n[0] / nl, n[1] / nl, n[2] / nl);
uv.push(i / count, P === A ? 0 : 1);
}
}
for (let s = 0; s < 4; s++) {
const a = base + s, b = base + ((s + 1) % 4), c = base + 4 + s, e = base + 4 + ((s + 1) % 4);
idx.push(a, c, b, b, c, e);
}
}
return { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), idx: new Uint32Array(idx) };
}
return { lathe, tireProfile, rimProfile, discProfile, caliperProfile, bikeTireProfile, bikeRimProfile, bikeHubProfile, bikeSpokes };
})();
/* src/js/gl/math.js */
const __m3 = (() => {
function m4() {
const m = new Float32Array(16);
m[0] = m[5] = m[10] = m[15] = 1;
return m;
}
function mul(a, b, out) {
const o = out || new Float32Array(16);
for (let c = 0; c < 4; c++) {
for (let r = 0; r < 4; r++) {
o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
}
}
return o;
}
function perspective(fovy, aspect, near, far) {
const f = 1 / Math.tan(fovy / 2);
const m = new Float32Array(16);
m[0] = f / aspect;
m[5] = f;
m[10] = (far + near) / (near - far);
m[11] = -1;
m[14] = (2 * far * near) / (near - far);
return m;
}
function translate(x, y, z) {
const m = m4();
m[12] = x; m[13] = y; m[14] = z;
return m;
}
function scale(s) {
const m = m4();
m[0] = m[5] = m[10] = s;
return m;
}
function rotX(a) {
const m = m4(), c = Math.cos(a), s = Math.sin(a);
m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
return m;
}
function rotY(a) {
const m = m4(), c = Math.cos(a), s = Math.sin(a);
m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
return m;
}
function rotZ(a) {
const m = m4(), c = Math.cos(a), s = Math.sin(a);
m[0] = c; m[1] = s; m[4] = -s; m[5] = c;
return m;
}
function chain(...ms) {
let r = ms[0];
for (let i = 1; i < ms.length; i++) r = mul(r, ms[i]);
return r;
}
function mat3From(m) {
return new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]);
}
function transformPoint(m, p) {
const x = p[0], y = p[1], z = p[2];
const w = m[3] * x + m[7] * y + m[11] * z + m[15];
return [
(m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
(m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
(m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
];
}
return { m4, mul, perspective, translate, scale, rotX, rotY, rotZ, chain, mat3From, transformPoint };
})();
/* src/js/gl/stage.js */
const __m4 = (() => {
const { VERT, FRAG } = __m1;
const { lathe, tireProfile, rimProfile, discProfile, caliperProfile, bikeTireProfile, bikeRimProfile, bikeHubProfile, bikeSpokes } = __m2;
const { perspective, translate, scale, rotX, rotY, rotZ, chain, mat3From, mul, transformPoint } = __m3;
const DEG = Math.PI / 180;
const FOV = 30 * DEG;
const CAM_Z = 8;
const DEFAULT_STATE = {
x: 0.42, y: -0.02, s: 0.9, yaw: -16, pitch: 4, alpha: 1,
mode: 0, rimR: 0.64, studs: 0, nail: 0, bulge: 0, cut: 0, dent: 0, weight: 0, wobble: 0,
hiTread: 0, hiSide: 0, hiRim: 0, hiStud: 0, idle: 0.12, mouseK: 1, tilt: 1,
};
const RATE = { x: 4.2, y: 4.2, s: 3.6, yaw: 3.6, pitch: 3.6, alpha: 4, mode: 2.4, rimR: 3, dent: 1.6, wobble: 1.4, idle: 2.5 };
function toWebGL2(src, isVert) {
let s = '#version 300 es\n' + src;
if (isVert) {
s = s.replace(/\battribute\b/g, 'in').replace(/\bvarying\b/g, 'out');
} else {
s = s.replace(/\bvarying\b/g, 'in').replace(/\btexture2D\b/g, 'texture').replace(/gl_FragColor/g, 'fragColor');
s = s.replace('precision highp float;', 'precision highp float;\nout vec4 fragColor;');
}
return s;
}
class WheelStage {
constructor(canvas, opts = {}) {
this.canvas = canvas;
this.opts = opts;
this.ok = false;
this.state = { ...DEFAULT_STATE, ...(opts.state || {}) };
this.target = { ...this.state };
this.spin = 0;
this.spinVel = 0;          // рад/с
this.extraSpin = 0;        // импульсы (селектор, drag)
this.pointer = { x: 0, y: 0, nx: 0, ny: 0, moved: 0 };
this.tiltCur = { x: 0, y: 0 };
this.time = 0;
this.dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr || 1.75);
this.frameTimes = [];
this.lastXw = null;
this.dragging = false;
this.listeners = [];
this.screen = { x: 0, y: 0, r: 0 };
this.builtRim = null;
this.steel = 0;
try {
this.init();
this.ok = true;
} catch (e) {
if (window.console) console.warn('[wheel] WebGL недоступен:', e.message);
this.ok = false;
}
}
init() {
const attrs = { alpha: true, premultipliedAlpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false };
let gl = this.canvas.getContext('webgl2', attrs);
this.gl2 = !!gl;
if (!gl) {
gl = this.canvas.getContext('webgl', attrs) || this.canvas.getContext('experimental-webgl', attrs);
if (!gl) throw new Error('no context');
if (!gl.getExtension('OES_standard_derivatives')) throw new Error('no derivatives');
this.uint = !!gl.getExtension('OES_element_index_uint');
} else this.uint = true;
this.gl = gl;
const vs = this.gl2 ? toWebGL2(VERT, true) : VERT;
const fs = this.gl2 ? toWebGL2(FRAG, false) : '#extension GL_OES_standard_derivatives : enable\n' + FRAG;
this.prog = this.program(vs, fs);
gl.useProgram(this.prog);
this.loc = {
aPos: gl.getAttribLocation(this.prog, 'aPos'),
aNor: gl.getAttribLocation(this.prog, 'aNor'),
aUV: gl.getAttribLocation(this.prog, 'aUV'),
};
this.u = {};
const names = ['uModel', 'uVP', 'uNM', 'uMat', 'uRimR', 'uDent', 'uDentA', 'uBulge', 'uBulgeA', 'uCam', 'uKey', 'uMouse', 'uMouseK', 'uBlur', 'uSteel', 'uStuds', 'uNail', 'uNailA', 'uWeight', 'uWeightA', 'uCut', 'uHi', 'uTime', 'uAcc', 'uSide', 'uAlpha', 'uScale'];
names.forEach((n) => (this.u[n] = gl.getUniformLocation(this.prog, n)));
gl.enable(gl.DEPTH_TEST);
gl.enable(gl.BLEND);
gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
gl.clearColor(0, 0, 0, 0);
const lowRes = this.opts.lowRes;
this.segs = lowRes ? 160 : 240;
this.meshes = {
disc: this.mesh(lathe(discProfile(), this.segs)),
caliper: this.mesh(lathe(caliperProfile(), 24, 0.42, 1.12)),
bTire: this.mesh(lathe(bikeTireProfile(), this.segs)),
bRim: this.mesh(lathe(bikeRimProfile(), this.segs)),
bHub: this.mesh(lathe(bikeHubProfile(), 48)),
bSpokes: this.mesh(bikeSpokes(32)),
};
this.buildRim(this.state.rimR);
this.sideTex = gl.createTexture();
this.drawSidewall();
this.resize();
}
program(vsSrc, fsSrc) {
const gl = this.gl;
const sh = (type, src) => {
const s = gl.createShader(type);
gl.shaderSource(s, src);
gl.compileShader(s);
if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
return s;
};
const p = gl.createProgram();
gl.attachShader(p, sh(gl.VERTEX_SHADER, vsSrc));
gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fsSrc));
gl.linkProgram(p);
if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
return p;
}
mesh(g, old) {
const gl = this.gl;
const m = old || { vbo: gl.createBuffer(), nbo: gl.createBuffer(), tbo: gl.createBuffer(), ibo: gl.createBuffer() };
gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo);
gl.bufferData(gl.ARRAY_BUFFER, g.pos, gl.DYNAMIC_DRAW);
gl.bindBuffer(gl.ARRAY_BUFFER, m.nbo);
gl.bufferData(gl.ARRAY_BUFFER, g.nor, gl.DYNAMIC_DRAW);
gl.bindBuffer(gl.ARRAY_BUFFER, m.tbo);
gl.bufferData(gl.ARRAY_BUFFER, g.uv, gl.DYNAMIC_DRAW);
const small = g.pos.length / 3 < 65536;
const idx = small ? new Uint16Array(g.idx) : g.idx;
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ibo);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.DYNAMIC_DRAW);
m.count = g.idx.length;
m.type = small ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT;
return m;
}
buildRim(R) {
this.meshes.tire = this.mesh(lathe(tireProfile(R), this.segs), this.meshes.tire);
this.meshes.rim = this.mesh(lathe(rimProfile(R), this.segs), this.meshes.rim);
this.builtRim = R;
}
drawSidewall() {
const gl = this.gl;
const W = this.opts.lowRes ? 2048 : 4096;
const H = W / 16;
const c = document.createElement('canvas');
c.width = W;
c.height = H;
const x = c.getContext('2d');
x.fillStyle = '#000';
x.fillRect(0, 0, W, H);
x.fillStyle = '#fff';
x.textBaseline = 'alphabetic';
const brand = this.opts.brand || 'ШИНОМОНТАЖ У ДЕНИСА';
const spec = this.opts.spec || 'САРАПУЛ · ЛЕНИНГРАДСКАЯ 2/1';
const spec2 = this.opts.spec2 || 'ПН–СБ 9:00–18:00';
const big = (txt, cx, size) => {
x.font = `900 ${size}px "YD Display", "Inter", Arial, sans-serif`;
if ('letterSpacing' in x) x.letterSpacing = `${size * 0.12}px`;
const w = x.measureText(txt).width;
x.fillText(txt, cx - w / 2, H * 0.62);
};
const small = (txt, cx, size, y) => {
x.font = `700 ${size}px "YD Mono", monospace`;
if ('letterSpacing' in x) x.letterSpacing = `${size * 0.3}px`;
const w = x.measureText(txt).width;
x.fillText(txt, cx - w / 2, y);
};
big(brand, W * 0.5, H * 0.46);
big(brand, W * 0.0, H * 0.46);
big(brand, W * 1.0, H * 0.46);
small(spec, W * 0.25, H * 0.15, H * 0.86);
small(spec2, W * 0.75, H * 0.15, H * 0.86);
small('R13–R19+  ·  TUBELESS  ·  M+S', W * 0.5, H * 0.12, H * 0.86);
x.fillRect(0, H * 0.94, W, H * 0.015);
gl.bindTexture(gl.TEXTURE_2D, this.sideTex);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
gl.generateMipmap(gl.TEXTURE_2D);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
const ext = gl.getExtension('EXT_texture_filter_anisotropic');
if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8);
}
resize() {
if (!this.gl) return;
const w = window.innerWidth;
const h = window.innerHeight;
this.vw = w;
this.vh = h;
this.canvas.width = Math.round(w * this.dpr);
this.canvas.height = Math.round(h * this.dpr);
this.canvas.style.width = w + 'px';
this.canvas.style.height = h + 'px';
this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
this.aspect = w / h;
this.proj = perspective(FOV, this.aspect, 0.1, 60);
this.view = translate(0, 0, -CAM_Z);
this.vp = mul(this.proj, this.view);
this.halfH = CAM_Z * Math.tan(FOV / 2);
this.halfW = this.halfH * this.aspect;
this.dirty = true;
}
set(partial) {
Object.assign(this.target, partial);
}
jump(partial) {
Object.assign(this.target, partial);
Object.assign(this.state, partial);
}
model(withSpin = true) {
const st = this.state;
const sc = st.s * this.halfH;
const flip = Math.sin(st.mode * Math.PI) * (Math.PI / 2 - st.yaw * DEG);
const yaw = st.yaw * DEG + flip + this.tiltCur.x;
const pitch = st.pitch * DEG + this.tiltCur.y;
const wob = st.wobble * 0.11;
const parts = [translate(st.x * this.halfW, st.y * this.halfH, 0), scale(sc), rotY(yaw), rotX(pitch)];
if (wob > 0.0005) parts.push(rotX(Math.sin(this.spin) * wob), rotY(Math.cos(this.spin) * wob));
if (withSpin) parts.push(rotZ(-this.spin));
return { m: chain(...parts), rot: chain(rotY(yaw), rotX(pitch), withSpin ? rotZ(-this.spin) : rotZ(0)), sc };
}
project(p, withSpin = true) {
const { m } = this.model(withSpin);
const c = transformPoint(mul(this.vp, m), p);
return { x: (c[0] * 0.5 + 0.5) * this.vw, y: (0.5 - c[1] * 0.5) * this.vh, z: c[2] };
}
update(dt) {
const st = this.state;
const tg = this.target;
let moving = false;
for (const k in tg) {
if (typeof tg[k] !== 'number') continue;
const d = tg[k] - st[k];
if (Math.abs(d) < 1e-4) { st[k] = tg[k]; continue; }
const rate = RATE[k] || 4;
st[k] += d * (1 - Math.exp(-dt * rate * (this.reduced ? 50 : 1)));
moving = true;
}
if (Math.abs(st.rimR - this.builtRim) > 0.0015) this.buildRim(st.rimR);
const p = this.pointer;
const tx = st.tilt * p.nx * 0.16;
const ty = st.tilt * -p.ny * 0.1;
this.tiltCur.x += (tx - this.tiltCur.x) * (1 - Math.exp(-dt * 3));
this.tiltCur.y += (ty - this.tiltCur.y) * (1 - Math.exp(-dt * 3));
if (Math.abs(tx - this.tiltCur.x) > 1e-4 || Math.abs(ty - this.tiltCur.y) > 1e-4) moving = true;
const xw = st.x * this.halfW;
const R = st.s * this.halfH;
let roll = 0;
if (this.lastXw != null && R > 0.01 && !this.reduced) roll = (xw - this.lastXw) / R;
this.lastXw = xw;
if (!this.dragging) {
this.spinVel *= Math.exp(-dt * 1.6);
if (Math.abs(this.spinVel) < 0.002) this.spinVel = 0;
}
const idle = this.reduced ? 0 : st.idle;
const dSpin = (idle + this.spinVel) * dt + roll + this.extraSpin;
this.extraSpin = 0;
this.spin += dSpin;
this.angVel = dt > 0 ? dSpin / dt : 0;
if (Math.abs(dSpin) > 1e-5) moving = true;
this.time += dt;
return moving;
}
render() {
const gl = this.gl;
const st = this.state;
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
if (st.alpha < 0.003) return;
gl.useProgram(this.prog);
const u = this.u;
const { m, rot, sc } = this.model(true);
const cal = this.model(false);
this.screen = { x: (st.x * 0.5 + 0.5) * this.vw, y: (0.5 - st.y * 0.5) * this.vh, r: (st.s * this.vh) / 2 };
gl.uniformMatrix4fv(u.uVP, false, this.vp);
gl.uniform3f(u.uCam, 0, 0, CAM_Z);
gl.uniform3f(u.uKey, -0.45, 0.75, 0.6);
gl.uniform3f(u.uMouse, this.pointer.nx * this.halfW * 1.2, this.pointer.ny * this.halfH * 1.2, 3.2);
gl.uniform1f(u.uMouseK, st.mouseK * (this.pointer.active ? 1 : 0.35));
const blur = Math.min(0.7, Math.abs(this.angVel || 0) * 0.028);
gl.uniform1f(u.uBlur, this.reduced ? 0 : blur);
gl.uniform1f(u.uSteel, this.steel);
gl.uniform1f(u.uStuds, st.studs);
gl.uniform1f(u.uNail, st.nail);
gl.uniform1f(u.uNailA, 0.0 - this.spin);
gl.uniform1f(u.uWeight, st.weight);
gl.uniform1f(u.uWeightA, 2.6);
gl.uniform1f(u.uBulge, st.bulge);
gl.uniform1f(u.uBulgeA, 1.15 - this.spin);
gl.uniform1f(u.uCut, st.cut);
gl.uniform1f(u.uDent, st.dent);
gl.uniform1f(u.uDentA, 2.2 - this.spin);
gl.uniform4f(u.uHi, st.hiTread, st.hiSide, st.hiRim, st.hiStud);
gl.uniform1f(u.uTime, this.time);
gl.uniform3f(u.uAcc, 1.0, 0.31, 0.07);
gl.uniform1f(u.uRimR, this.builtRim);
gl.uniform1f(u.uAlpha, st.alpha);
gl.uniform1f(u.uScale, sc);
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, this.sideTex);
gl.uniform1i(u.uSide, 0);
const draw = (mesh, mat, model, rotm) => {
gl.uniform1f(u.uMat, mat);
gl.uniformMatrix4fv(u.uModel, false, model);
gl.uniformMatrix3fv(u.uNM, false, mat3From(rotm));
gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
gl.enableVertexAttribArray(this.loc.aPos);
gl.vertexAttribPointer(this.loc.aPos, 3, gl.FLOAT, false, 0, 0);
gl.bindBuffer(gl.ARRAY_BUFFER, mesh.nbo);
gl.enableVertexAttribArray(this.loc.aNor);
gl.vertexAttribPointer(this.loc.aNor, 3, gl.FLOAT, false, 0, 0);
if (this.loc.aUV >= 0) {
gl.bindBuffer(gl.ARRAY_BUFFER, mesh.tbo);
gl.enableVertexAttribArray(this.loc.aUV);
gl.vertexAttribPointer(this.loc.aUV, 2, gl.FLOAT, false, 0, 0);
}
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
gl.drawElements(gl.TRIANGLES, mesh.count, mesh.type, 0);
};
const M = this.meshes;
if (st.mode < 0.5) {
draw(M.disc, 2, m, rot);
draw(M.caliper, 3, cal.m, cal.rot);
draw(M.rim, 1, m, rot);
draw(M.tire, 0, m, rot);
} else {
draw(M.bHub, 5, m, rot);
draw(M.bSpokes, 5, m, rot);
draw(M.bRim, 5, m, rot);
draw(M.bTire, 4, m, rot);
}
}
frame(dt) {
if (!this.ok) return;
const t0 = performance.now();
const moving = this.update(dt);
if (moving || this.dirty || this.pointer.moved) {
this.render();
this.dirty = false;
this.pointer.moved = 0;
this.frameTimes.push(dt);
if (this.frameTimes.length > 40) {
const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
this.frameTimes.length = 0;
if (avg > 0.028 && this.dpr > 1) {
this.dpr = Math.max(1, this.dpr - 0.25);
this.resize();
}
}
}
this.cost = performance.now() - t0;
}
setPointer(clientX, clientY) {
this.pointer.nx = (clientX / this.vw) * 2 - 1;
this.pointer.ny = 1 - (clientY / this.vh) * 2;
this.pointer.moved = 1;
this.pointer.active = true;
}
dragBy(dAngle) {
this.extraSpin += dAngle;
}
fling(vel) {
this.spinVel = Math.max(-30, Math.min(30, vel));
}
setSteel(on) {
this.steel = on ? 1 : 0;
this.dirty = true;
}
}
return { DEFAULT_STATE, WheelStage };
})();
/* src/data/scenes.js */
const __m5 = (() => {
const anatomySteps = [
{
id: 'tread', part: 'Протектор', title: 'Прокол',
text: 'Колесо спускает, в протекторе гвоздь или саморез.',
priceIds: ['plug', 'patch'], service: 'repair',
note: 'Жгут или заплатка — мастер скажет после осмотра.',
callout: 'Гвоздь',
},
{
id: 'side', part: 'Боковина', title: 'Грыжа и порез',
text: 'Удар о бордюр или яму — и на боковине вздутие или порез.',
priceIds: ['bulge', 'cut'], service: 'repair',
note: 'Грыжа — повреждение каркаса шины. Решение — после осмотра мастером.',
callout: 'Грыжа',
},
{
id: 'rim', part: 'Диск', title: 'Погнутый диск',
text: 'Восстанавливаем геометрию штампованных и литых дисков.',
priceIds: ['steel', 'alloy'], service: 'rims',
note: 'Можно ли выправить конкретный диск, мастер скажет после осмотра.',
callout: 'Биение',
},
{
id: 'balance', part: 'Баланс', title: 'Бьёт руль',
text: 'Вибрация на скорости — чаще всего помогает балансировка колёс на современном оборудовании.',
priceIds: ['bal'], service: 'balance',
note: 'Цены на балансировку в прайсе нет — стоимость называет мастер.',
callout: 'Грузик',
},
{
id: 'studs', part: 'Шипы', title: 'Вылетели шипы',
text: 'Восстанавливаем шипы в зимних шинах любой сложности.',
priceIds: ['stud', 'wheel'], service: 'studs',
note: 'По прайсу: 1 шип — 18 ₽. Итог зависит от количества шипов.',
callout: 'Шип',
},
{
id: 'bike', part: 'Велосипед', title: 'Восьмёрка',
text: 'Полное обслуживание и ремонт велосипедов. А ненужный велосипед купим в любом состоянии.',
priceIds: ['true', 'brakes', 'gears', 'hub', 'eval'], service: 'bike',
note: 'Скупка: оценка бесплатно, выкуп на месте — договорная.',
callout: 'Обод',
},
];
const passWords = {
anatomy: 'Анатомия колеса',
prices: 'Прозрачные цены',
works: 'Настоящая мастерская',
mileage: '15 000+ авто',
ask: 'Спросите ИИ',
finish: 'Ленинградская, 2/1',
};
const sceneNav = [
{ id: 'top', label: 'Старт' },
{ id: 'help', label: 'Анатомия' },
{ id: 'prices', label: 'Цены' },
{ id: 'works', label: 'Мастерская' },
{ id: 'about', label: 'Пробег' },
{ id: 'assistant', label: 'ИИ' },
{ id: 'contacts', label: 'Контакты' },
];
return { anatomySteps, passWords, sceneNav };
})();
/* src/js/core/director.js */
const __m6 = (() => {
const { rt, onFrame, clamp, lerp, smooth, easeOut } = __m0;
const { DEFAULT_STATE } = __m4;
const { passWords } = __m5;
const C = { ink: '#0d0d0c', acc: '#ff4f12', paper: '#ebe8e1' };
const DARK = { ink: true, acc: false, paper: false };
const BG = { hero: 'ink', anatomy: 'ink', prices: 'acc', works: 'ink', mileage: 'paper', ask: 'ink', finish: 'paper' };
const HERO = { x: 0.5, y: -0.04, s: 0.76, yaw: -20, pitch: 5, idle: 0.14, tilt: 1, mouseK: 1, alpha: 1, mode: 0, nail: 0, bulge: 0, cut: 0, studs: 0, weight: 0, hiTread: 0, hiSide: 0, hiRim: 0, hiStud: 0, wobble: 0 };
const HERO_M = { ...HERO, x: 0.3, y: -0.78, s: 0.82, yaw: -16 };
function anatomyStates(m) {
const base = { idle: 0.02, tilt: 0.25, nail: 0, bulge: 0, cut: 0, studs: 0, weight: 0, mode: 0, hiTread: 0, hiSide: 0, hiRim: 0, hiStud: 0 };
const d = [
{ ...base, x: 0.3, y: -0.98, s: 2.4, yaw: -6, pitch: 62, nail: 1 },
{ ...base, x: 0.4, y: -0.06, s: 1.5, yaw: -44, pitch: 8, bulge: 1, cut: 1, hiSide: 0.25 },
{ ...base, x: 0.36, y: 0, s: 1.1, yaw: -10, pitch: 2, hiRim: 1 },
{ ...base, x: 0.36, y: 0, s: 1.0, yaw: -28, pitch: 12, weight: 1, idle: 5 },
{ ...base, x: 0.3, y: -0.98, s: 2.4, yaw: -6, pitch: 62, studs: 1, hiStud: 1 },
{ ...base, x: 0.36, y: 0, s: 1.05, yaw: -14, pitch: 4, mode: 1, idle: 0.35 },
];
if (!m) return d;
return [
{ ...d[0], x: 0.05, y: -0.12, s: 1.45 },
{ ...d[1], x: 0.25, y: 0.32, s: 0.95 },
{ ...d[2], x: 0, y: 0.36, s: 0.78 },
{ ...d[3], x: 0, y: 0.36, s: 0.7 },
{ ...d[4], x: 0.05, y: -0.12, s: 1.45 },
{ ...d[5], x: 0, y: 0.36, s: 0.74 },
];
}
const SCENES = {
hero: (g, m) => [
{ y: g.top, s: m ? HERO_M : HERO },
{ y: g.top + g.vh * 0.7, s: m ? { x: 0.05, y: -0.5, s: 1.2, yaw: 0, pitch: 45, idle: 0.04, tilt: 0.2 } : { x: 0.12, y: -0.6, s: 1.8, yaw: 0, pitch: 46, idle: 0.04, tilt: 0.2 } },
],
anatomy: (g, m) => {
const st = anatomyStates(m);
const a = g.top + g.vh * 0.3;
const L = Math.max(1, g.top + g.h - g.vh - a);
const k = [];
st.forEach((s, i) => {
k.push({ y: a + (L / st.length) * (i + 0.12), s });
k.push({ y: a + (L / st.length) * (i + 0.82), s });
});
return k;
},
prices: (g, m) => {
const s = m
? { x: 0.56, y: 0.5, s: 0.34, yaw: -14, pitch: 6, idle: 0.1, tilt: 0, mode: 0, nail: 0, bulge: 0, cut: 0, studs: 0, weight: 0, hiTread: 0, hiSide: 0, hiRim: 0, hiStud: 0, alpha: 1 }
: { x: -0.56, y: -0.02, s: 0.58, yaw: -14, pitch: 6, idle: 0, tilt: 0.45, mode: 0, nail: 0, bulge: 0, cut: 0, studs: 0, weight: 0, hiTread: 0, hiSide: 0, hiRim: 0, hiStud: 0, alpha: 1 };
return [
{ y: g.top + g.vh * 0.05, s },
{ y: g.top + g.h - g.vh * 0.95, s },
];
},
works: (g, m) => [
{ y: g.top - g.vh * 0.25, s: { x: 0, y: 0, s: m ? 0.6 : 0.85, yaw: 0, pitch: 0, idle: 1.2, tilt: 0, mode: 0, rimR: 0.64, studs: 0, weight: 0, alpha: 1 } },
{ y: g.top + g.vh * 0.12, s: { s: 10, idle: 2, alpha: 1 } },
{ y: g.top + g.vh * 0.24, s: { s: 16, alpha: 0 } },
],
mileage: (g) => [{ y: g.top, s: { x: 0, y: -1.5, s: 0.5, alpha: 0, idle: 0 } }],
ask: (g, m) => [
{ y: g.top - g.vh * 0.3, s: { x: 0, y: -1.4, s: m ? 0.42 : 0.52, alpha: 0, yaw: -12, pitch: 10, idle: 0.3, tilt: 0.6 } },
{ y: g.top + g.vh * 0.2, s: { x: 0, y: 0, s: m ? 0.42 : 0.52, alpha: 1 } },
{ y: g.top + g.h - g.vh * 0.85, s: { x: 0, y: 0, alpha: 1 } },
],
finish: (g, m) => [
{ y: g.top - g.vh * 0.35, s: { x: m ? -0.2 : -0.35, y: 0.12, s: m ? 0.42 : 0.5, alpha: 1, idle: 0, tilt: 0 } },
{ y: g.top + g.vh * 0.25, s: { x: m ? 1.8 : 1.6, y: 0.12, alpha: 1 } },
{ y: g.top + g.vh * 0.4, s: { alpha: 0 } },
],
};
let timeline = [];
let zones = [];
function build() {
const vh = rt.vh;
rt.scenes = [...document.querySelectorAll('[data-scene]')].map((el) => {
const r = el.getBoundingClientRect();
return { id: el.dataset.scene, el, top: r.top + window.scrollY, h: r.height };
});
let keys = [];
rt.scenes.forEach((sc) => {
const f = SCENES[sc.id];
if (f) keys = keys.concat(f({ top: sc.top, h: sc.h, vh }, rt.mobile));
});
keys.sort((a, b) => a.y - b.y);
let acc = { ...DEFAULT_STATE, ...HERO };
timeline = keys.map((k) => {
acc = { ...acc, ...k.s };
return { y: k.y, s: acc };
});
zones = [];
for (let i = 1; i < rt.scenes.length; i++) {
const a = rt.scenes[i - 1];
const b = rt.scenes[i];
const from = BG[a.id];
const to = BG[b.id];
const isWorks = b.id === 'works';
zones.push({
id: b.id, from, to,
y0: b.top - vh * (isWorks ? 0.2 : 0.8),
y1: b.top + vh * (isWorks ? 0.16 : 0.02),
w0: Math.max(b.top - vh * 1.05, a.top + vh * 0.35),
w1: b.top + vh * 0.12,
word: passWords[b.id] || '',
fromWheel: ['prices', 'works', 'finish'].includes(b.id),
});
}
rt.timelineReady = true;
}
function sample(y) {
const n = timeline.length;
if (!n) return { ...DEFAULT_STATE, ...HERO };
if (y <= timeline[0].y) return timeline[0].s;
if (y >= timeline[n - 1].y) return timeline[n - 1].s;
let i = 1;
while (i < n && timeline[i].y < y) i++;
const A = timeline[i - 1], B = timeline[i];
const t = smooth(clamp((y - A.y) / Math.max(1, B.y - A.y), 0, 1));
const out = {};
for (const k in B.s) out[k] = typeof B.s[k] === 'number' ? lerp(A.s[k], B.s[k], t) : B.s[k];
return out;
}
function screenOf(s) {
return { x: (s.x * 0.5 + 0.5) * rt.vw, y: (0.5 - s.y * 0.5) * rt.vh, r: (s.s * rt.vh) / 2, a: s.alpha };
}
function initDirector() {
const root = document.documentElement;
const bg = document.querySelector('[data-bg]');
const flood = document.querySelector('[data-flood]');
const word = document.querySelector('[data-word]');
const wordT = document.querySelector('[data-word-t]');
const shadow = document.querySelector('[data-shadow]');
const svgWrap = document.querySelector('[data-svg-wheel]');
const svgSpin = document.querySelector('[data-svg-spin]');
const grid = document.querySelector('.stage__grid');
let svgSpinA = 0;
let lastWord = '';
let wordW = 0;
let lastTopDark = null;
build();
let rb;
const rebuild = () => { clearTimeout(rb); rb = setTimeout(build, 120); };
addEventListener('resize', rebuild);
addEventListener('load', build);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
if ('ResizeObserver' in window) new ResizeObserver(rebuild).observe(document.querySelector('main'));
onFrame((dt) => {
const y = rt.y;
const vh = rt.vh;
let active = rt.scenes[0] && rt.scenes[0].id;
rt.scenes.forEach((sc) => {
const p = clamp((y - sc.top) / Math.max(1, sc.h - vh), 0, 1);
rt.progress[sc.id] = p;
const vis = clamp(Math.min(y + vh - sc.top, sc.top + sc.h - y) / (vh * 0.5), 0, 1);
rt.weights[sc.id] = vis;
if (y + vh * 0.45 >= sc.top) active = sc.id;
});
rt.active = active;
const st = { ...sample(y) };
if (rt.intro < 1) {
const e = easeOut(rt.intro);
st.x = lerp(-1.9, st.x, e);
st.alpha = Math.min(st.alpha, clamp(rt.intro * 6, 0, 1));
}
for (const m of rt.mods) m(st, rt);
rt.target = st;
rt.wheel = screenOf(rt.stage && rt.stage.ok ? rt.stage.state : st);
if (rt.stage && rt.stage.ok) {
if (!rt.jumped) { rt.stage.jump(st); rt.jumped = true; }
rt.stage.set(st);
rt.stage.frame(dt);
} else if (svgWrap) {
const w = screenOf(st);
rt.wheel = w;
svgWrap.style.setProperty('--svx', w.x + 'px');
svgWrap.style.setProperty('--svy', w.y + 'px');
svgWrap.style.setProperty('--svs', w.r * 2 + 'px');
svgWrap.style.opacity = st.alpha;
if (!rt.reduced) svgSpinA += (st.idle * dt + rt.vel * 0.003) * 57.3;
svgSpin.setAttribute('transform', `rotate(${svgSpinA.toFixed(1)})`);
}
if (shadow) {
const w = rt.wheel;
const grounded = rt.active === 'hero' || rt.active === 'finish' || rt.active === 'ask' ? 1 : 0;
shadow.style.setProperty('--sx', w.x + 'px');
shadow.style.setProperty('--sy', w.y + w.r * 0.98 + 'px');
shadow.style.setProperty('--sw', w.r * 1.9 + 'px');
shadow.style.setProperty('--so', (grounded * clamp(w.a, 0, 1) * 0.9).toFixed(2));
}
let base = BG[rt.scenes[0] ? rt.scenes[0].id : 'hero'] || 'ink';
let fr = 0, fx = rt.vw / 2, fy = rt.vh, floodC = null, topDark;
let zoneNow = null;
for (const z of zones) {
if (y >= z.y0 && y < z.y1) { zoneNow = z; break; }
if (y >= z.y1) base = z.to;
}
if (zoneNow) {
base = zoneNow.from;
floodC = zoneNow.to;
const p = clamp((y - zoneNow.y0) / (zoneNow.y1 - zoneNow.y0), 0, 1);
const w = rt.wheel;
if (zoneNow.fromWheel && w.a > 0.2) { fx = w.x; fy = w.y; } else { fx = rt.vw / 2; fy = rt.vh * 1.05; }
const maxR = Math.hypot(Math.max(fx, rt.vw - fx), Math.max(fy, rt.vh - fy));
fr = (zoneNow.id === 'works' ? Math.pow(p, 2.2) : easeOut(p)) * maxR * 1.02;
topDark = DARK[p > 0.5 ? floodC : base];
} else topDark = DARK[base];
bg.style.background = C[base];
flood.style.setProperty('--flood', floodC ? C[floodC] : 'transparent');
flood.style.setProperty('--fr', fr.toFixed(1) + 'px');
flood.style.setProperty('--fx', fx.toFixed(1) + 'px');
flood.style.setProperty('--fy', fy.toFixed(1) + 'px');
if (topDark !== lastTopDark) {
lastTopDark = topDark;
root.style.setProperty('--top-c', topDark ? '#f2f0eb' : '#0d0d0c');
root.style.setProperty('--top-bg', topDark ? 'rgba(13,13,12,0.72)' : 'rgba(235,232,225,0.78)');
if (grid) grid.style.setProperty('--grid-c', topDark ? 'rgba(242,240,235,0.06)' : 'rgba(13,13,12,0.07)');
}
root.style.setProperty('--top-bg-o', y > vh * 0.5 ? '1' : '0');
if (grid) grid.style.setProperty('--grid-y', (-(y * 0.15) % (rt.vw / 12)).toFixed(1) + 'px');
let wz = null;
for (const z of zones) if (z.word && y >= z.w0 && y <= z.w1) { wz = z; break; }
if (wz && !rt.reduced) {
if (lastWord !== wz.word) {
lastWord = wz.word;
wordT.textContent = wz.word;
wordW = word.offsetWidth;
}
const p = (y - wz.w0) / (wz.w1 - wz.w0);
const x = lerp(rt.vw * 1.02, -wordW - rt.vw * 0.05, p);
const col = DARK[p > 0.35 ? wz.to : wz.from] ? 'rgba(242,240,235,0.95)' : 'rgba(13,13,12,0.92)';
word.style.setProperty('--wx', x.toFixed(1) + 'px');
word.style.setProperty('--wo', clamp(Math.min(p * 8, (1 - p) * 8), 0, 1).toFixed(2));
word.style.setProperty('--word-c', col);
word.style.setProperty('--wskew', clamp(-rt.vel * 0.25, -14, 14).toFixed(1) + 'deg');
} else {
word.style.setProperty('--wo', '0');
}
});
}
function sceneTop(id) {
const s = rt.scenes.find((x) => x.id === id);
return s ? s.top : 0;
}
return { initDirector, sceneTop };
})();
/* src/data/business.js */
const __m7 = (() => {
const business = {
name: 'Шиномонтаж у Дениса',
shortName: 'У Дениса',
kind: 'частная мастерская',
city: 'Сарапул',
siteUrl: 'https://ydenisa.ru/',
address: {
full: 'г. Сарапул, ул. Ленинградская, 2/1',
street: 'ул. Ленинградская, 2/1',
streetShort: 'Ленинградская, 2/1',
locality: 'Сарапул',
region: 'Удмуртская Республика', // из meta geo.region = RU-UD
regionCode: 'RU-UD',
country: 'RU',
},
geo: { lat: 56.4692, lon: 53.7987 },
phone: {
display: '+7 (950) 172-55-14',
compact: '+7 950 172-55-14',
href: 'tel:+79501725514',
e164: '+79501725514',
},
hours: {
timezone: 'Europe/Samara', // Удмуртия, UTC+4
open: '09:00',
close: '18:00',
workdays: [1, 2, 3, 4, 5, 6], // Пн..Сб (0 = Вс)
text: 'Пн–Сб: 9:00–18:00',
dayOff: 'Вс — выходной',
short: 'Пн–Сб 9–18',
},
links: {
avito: 'https://www.avito.ru/sarapul/predlozheniya_uslug/shinomontazh_uslugi_remont_velosipedov_4037703591',
yandexMaps: 'https://yandex.ru/maps/org/shinomontazh_u_denisa/56075353436/',
yandexWidget: 'https://yandex.ru/map-widget/v1/?z=12&ol=biz&oid=56075353436',
yandexRoute: 'https://yandex.ru/maps/?rtext=~56.4692%2C53.7987&rtt=auto',
},
promises: [
{ key: 'Быстро', value: 'от 15 минут' },
{ key: 'Честно', value: 'прозрачные цены' },
{ key: 'Надёжно', value: 'гарантия на работы' },
{ key: 'Работаем', value: 'сами' },
],
facts: [
{ value: 15000, suffix: '+', label: 'обслуженных авто', display: '15 000+' },
{ value: 10, suffix: '+', label: 'лет опыта', display: '10+' },
{ value: 500, suffix: '+', label: 'велосипедов', display: '500+' },
{ value: 6, suffix: '/7', label: 'дней в неделю', display: '6/7' },
],
about: {
lead: '«Шиномонтаж у Дениса» — сервис в Сарапуле для автомобилей и велосипедов: шиномонтаж, балансировка, ремонт шин и обслуживание велосипедов.',
text: 'Работаем аккуратно, быстро и по понятным ценам. Даем гарантию на выполненные работы.',
why: [
'Опыт работы более 10 лет',
'Современное оборудование',
'Гарантия на все виды работ',
'Работаем 6 дней в неделю',
],
servicesIntro: '«Шиномонтаж у Дениса» — полный спектр услуг по ремонту и обслуживанию колёс и велосипедов в Сарапуле. Работаем на профессиональном оборудовании.',
},
services: [
{
id: 'season',
num: '01',
title: 'Сезонная переобувка',
short: 'Переобувка',
group: 'auto',
desc: 'Комплексная замена зимней/летней резины',
prices: [
{ id: 'r13', label: 'R13–R16 (4 колеса)', amount: 1600, from: true, scale: 0.84 },
{ id: 'r17', label: 'R17–R18 (4 колеса)', amount: 1800, from: true, scale: 0.92 },
{ id: 'r19', label: 'R19+ / Внедорожник', amount: 2200, from: true, scale: 1 },
],
control: 'diameter',
},
{
id: 'repair',
num: '02',
title: 'Ремонт шин',
short: 'Ремонт шин',
group: 'auto',
desc: 'Ремонт проколов и порезов любой сложности',
prices: [
{ id: 'plug', label: 'Жгут', amount: 100, from: true, mark: 'puncture' },
{ id: 'patch', label: 'Заплатка', amount: 150, from: true, mark: 'puncture' },
{ id: 'cut', label: 'Боковой порез', amount: 800, from: true, mark: 'cut' },
{ id: 'bulge', label: 'Грыжа', amount: 600, from: true, mark: 'bulge' },
],
control: 'damage',
},
{
id: 'rims',
num: '03',
title: 'Правка дисков',
short: 'Правка дисков',
group: 'auto',
desc: 'Восстановление геометрии штампованных и литых дисков',
prices: [
{ id: 'steel', label: 'Штампованные диски', amount: 300, from: true },
{ id: 'alloy', label: 'Литые диски', amount: 700, from: true },
],
control: 'rimtype',
},
{
id: 'balance',
num: '04',
title: 'Балансировка колёс',
short: 'Балансировка',
group: 'auto',
desc: 'Балансировка колёс на современном оборудовании',
prices: [
{ id: 'bal', label: 'Балансировка', amount: null, from: false, text: 'уточняет мастер' },
],
control: null,
},
{
id: 'studs',
num: '05',
title: 'Дошиповка зимней резины',
short: 'Дошиповка',
group: 'auto',
desc: 'Восстановление шипов в зимних шинах любой сложности',
prices: [
{ id: 'stud', label: '1 шип', amount: 18, from: false },
{ id: 'wheel', label: 'Колесо целиком (R14)', amount: 1500, from: true },
],
control: 'studs',
},
{
id: 'bike',
num: '06',
title: 'Ремонт велосипедов',
short: 'Велоремонт',
group: 'bike',
desc: 'Полное обслуживание и ремонт велосипедов',
prices: [
{ id: 'true', label: 'Исправление восьмёрки', amount: 300, from: true },
{ id: 'brakes', label: 'Настройка тормозов', amount: 150, from: true },
{ id: 'gears', label: 'Настройка переключателей', amount: 150, from: true },
{ id: 'hub', label: 'Переборка втулки', amount: 400, from: true },
{ id: 'tube', label: 'Замена камер', amount: null, from: false, text: 'уточняет мастер' },
],
control: null,
},
{
id: 'buyout',
num: '07',
title: 'Скупка велосипедов',
short: 'Скупка велосипедов',
group: 'bike',
desc: 'Покупаем велосипеды в любом состоянии',
prices: [
{ id: 'eval', label: 'Оценка', amount: null, from: false, text: 'бесплатно' },
{ id: 'cash', label: 'Выкуп на месте', amount: null, from: false, text: 'договорная' },
{ id: 'consign', label: 'Принимаем на продажу', amount: null, from: false, text: 'комиссия' },
],
control: null,
},
],
symptoms: [
{ id: 'puncture', title: 'Прокол, колесо спускает', service: 'repair', priceIds: ['plug', 'patch'],
note: 'Какой способ подойдёт — жгут или заплатка, — мастер скажет после осмотра.' },
{ id: 'cut', title: 'Порез на боковине', service: 'repair', priceIds: ['cut'],
note: 'Можно ли ремонтировать конкретный порез, определяет мастер.' },
{ id: 'bulge', title: 'Грыжа на шине', service: 'repair', priceIds: ['bulge'],
note: 'Грыжа — повреждение каркаса шины. Решение — после осмотра мастером.' },
{ id: 'rim', title: 'Погнул диск', service: 'rims', priceIds: ['steel', 'alloy'],
note: 'Восстанавливаем геометрию штампованных и литых дисков.' },
{ id: 'shake', title: 'Бьёт руль, вибрация', service: 'balance', priceIds: ['bal'],
note: 'Чаще всего помогает балансировка. Стоимость — у мастера по телефону.' },
{ id: 'studs', title: 'Вылетели шипы', service: 'studs', priceIds: ['stud', 'wheel'],
note: 'Восстанавливаем шипы в зимних шинах любой сложности.' },
{ id: 'season', title: 'Пора переобуваться', service: 'season', priceIds: ['r13', 'r17', 'r19'],
note: 'Цена за комплект из 4 колёс.' },
{ id: 'bike', title: 'Восьмёрка, тормоза, переключатели', service: 'bike', priceIds: ['true', 'brakes', 'gears', 'hub'],
note: 'Полное обслуживание и ремонт велосипедов.' },
{ id: 'sell', title: 'Хочу продать велосипед', service: 'buyout', priceIds: ['eval', 'cash', 'consign'],
note: 'Покупаем велосипеды в любом состоянии.' },
],
photos: [
{ src: '/images/gallery/shop-1.jpg', alt: 'Вход в шиномонтаж в Сарапуле на ул. Ленинградская', caption: 'Вход и вывеска шиномонтажа', tag: 'ВХОД', w: 1806, h: 1285 },
{ src: '/images/gallery/shop-2.jpg', alt: 'Мастерская шиномонтажа в Сарапуле — зона велоремонта', caption: 'Вход в мастерскую, зона велоремонта', tag: 'ВЕЛОЗОНА', w: 1791, h: 1291 },
{ src: '/images/gallery/shop-3.jpg', alt: 'Балансировочный станок в шиномонтаже Сарапула', caption: 'Балансировочный станок и правка дисков', tag: 'СТАНОК', w: 1792, h: 1299 },
{ src: '/images/gallery/shop-4.jpg', alt: 'Рабочее место мастера шиномонтажа в Сарапуле', caption: 'Рабочее место мастера', tag: 'ВЕРСТАК', w: 1170, h: 877 },
{ src: '/images/gallery/shop-5.jpg', alt: 'Мастерская шиномонтажа в Сарапуле — общий вид', caption: 'Общий вид мастерской', tag: 'ОБЩИЙ ПЛАН', w: 1200, h: 844 },
{ src: '/images/gallery/shop-6.jpg', alt: 'Оборудование шиномонтажа в Сарапуле', caption: 'Оборудование для ремонта и балансировки', tag: 'ОБОРУДОВАНИЕ', w: 1792, h: 1287 },
],
remoteImageBase: 'https://ydenisa.ru',
ogImage: 'https://ydenisa.ru/images/og-image.jpg',
reviews: [
{ initials: 'АП', name: 'Алексей Петров', date: '2025-03-15', dateText: '15 марта 2025', rating: 5,
text: 'Отличный шиномонтаж! Переобули машину за 30 минут, цены адекватные. Рекомендую всем в Сарапуле!' },
{ initials: 'МС', name: 'Марина Сидорова', date: '2025-02-20', dateText: '20 февраля 2025', rating: 5,
text: 'Приехала с проколом, отремонтировали быстро и недорого. Денис — настоящий профессионал!' },
{ initials: 'ИВ', name: 'Игорь Волков', date: '2025-01-10', dateText: '10 января 2025', rating: 5,
text: 'Балансировку сделали идеально, руль больше не бьёт. Спасибо!' },
{ initials: 'ОК', name: 'Ольга Кузнецова', date: '2024-12-05', dateText: '5 декабря 2024', rating: 5,
text: 'Всегда обслуживаюсь только здесь. Качество на высоте, цены честные.' },
{ initials: 'ДИ', name: 'Дмитрий Иванов', date: '2024-11-18', dateText: '18 ноября 2024', rating: 4,
text: 'Хороший сервис, быстро и качественно. Единственный минус — иногда бывает очередь в сезон.' },
],
seo: {
title: 'Шиномонтаж у Дениса в Сарапуле — дошиповка, правка дисков, велоремонт',
description: 'Шиномонтаж у Дениса в Сарапуле. Дошиповка зимней резины от 18 ₽, правка дисков, балансировка, ремонт шин и велосипедов. Адрес: ул. Ленинградская, 2/1. ☎ +7 (950) 172-55-14',
ogTitle: 'Шиномонтаж в Сарапуле — у Дениса',
ogDescription: 'Дошиповка зимней резины, правка дисков, балансировка, ремонт шин. Ремонт и скупка велосипедов. Пн-Сб 9:00-18:00',
twitterDescription: 'Дошиповка, правка дисков, ремонт велосипедов в Сарапуле',
keywords: 'шиномонтаж Сарапул, дошиповка зимней резины Сарапул, правка дисков Сарапул, балансировка колёс, ремонт шин, ремонт велосипедов Сарапул, скупка велосипедов, шиномонтаж у Дениса',
yandexVerification: '58be815ee1a4e164',
themeColor: '#0d0d0c',
textHeading: 'Шиномонтаж в Сарапуле — качественный сервис для вашего автомобиля',
textHtml: [
'<strong>«Шиномонтаж у Дениса»</strong> — это профессиональная мастерская в городе Сарапул, предоставляющая полный спектр услуг по обслуживанию колёс и велосипедов. Мы работаем с 2018 года и за это время обслужили более 15&nbsp;000 автомобилей. Наш адрес: <strong>г. Сарапул, ул. Ленинградская, 2/1</strong>.',
'Основные услуги шиномонтажа в Сарапуле: <strong>дошиповка зимней резины</strong> всего от 18 рублей за шип (полная дошиповка колеса R14 от 1500 ₽), <strong>правка дисков</strong> — штампованных от 300 ₽, литых от 700 ₽, <strong>балансировка</strong> колёс на современном оборудовании, <strong>сезонная переобувка</strong> и ремонт шин любой сложности.',
'Также в нашей мастерской в Сарапуле вы можете <strong>отремонтировать велосипед</strong>: исправление восьмёрок, настройка тормозов и переключателей, переборка втулок, замена камер. Осуществляем <strong>скупку велосипедов</strong> в любом состоянии. Работаем шесть дней в неделю: Пн–Сб с 9:00 до 18:00.',
],
},
};
const rub = (n) => n.toLocaleString('ru-RU').replace(/ | /g, ' ');
function priceText(p) {
if (p.amount == null) return p.text || 'уточняет мастер';
return (p.from ? 'от ' : '') + rub(p.amount) + ' ₽';
}
const serviceById = (id) => business.services.find((s) => s.id === id);
function findPrice(id) {
for (const s of business.services) {
const p = s.prices.find((x) => x.id === id);
if (p) return { service: s, price: p };
}
return null;
}
function minPrice(service) {
const nums = service.prices.filter((p) => p.amount != null);
if (!nums.length) return null;
return nums.reduce((a, b) => (b.amount < a.amount ? b : a));
}
return { business, rub, priceText, serviceById, findPrice, minPrice };
})();
/* src/js/scenes/boot.js */
const __m8 = (() => {
const { rt, onFrame, clamp, easeOut } = __m0;
const { WheelStage } = __m4;
const { business } = __m7;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function initStage() {
const canvas = document.querySelector('[data-gl]');
const root = document.documentElement;
if (!canvas) return;
try {
await Promise.race([
Promise.all([document.fonts.load('900 64px "YD Display"'), document.fonts.load('700 24px "YD Mono"')]),
wait(1200),
]);
} catch (e) {  }
let stage = null;
try {
stage = new WheelStage(canvas, {
lowRes: rt.mobile,
maxDpr: /[?&]lowgl/.test(location.search) ? 0.5 : rt.mobile ? 1.5 : 1.75,
brand: business.name.toUpperCase(),
spec: `${business.city.toUpperCase()} · ${business.address.streetShort.toUpperCase()}`,
spec2: `${business.hours.text.toUpperCase()} · ${business.phone.compact}`,
});
} catch (e) { stage = null; }
if (stage && stage.ok) {
rt.stage = stage;
if (/[?&](lowgl|rec)/.test(location.search)) {
window.__yd = rt;
window.__ff = (sec = 3) => { for (let i = 0; i < sec * 20; i++) stage.update(0.05); stage.render(); };
}
stage.reduced = rt.reduced;
addEventListener('resize', () => stage.resize());
document.addEventListener('visibilitychange', () => { stage.dirty = true; });
} else {
root.classList.add('no-gl');
}
}
async function runIntro() {
const root = document.documentElement;
const loader = document.querySelector('[data-loader]');
const seen = root.classList.contains('seen');
const atTop = window.scrollY < rt.vh * 0.5;
try { sessionStorage.setItem('yd-intro', '1'); } catch (e) {  }
if (loader && !seen && !rt.reduced) {
const v = loader.querySelector('[data-loader-v]');
const t0 = performance.now();
const dur = 1100;
await new Promise((res) => {
const step = (t) => {
const p = clamp((t - t0) / dur, 0, 1);
const e = easeOut(p);
const bar = (2.2 * e).toFixed(1);
v.textContent = bar;
loader.style.setProperty('--lo', (245 * (1 - e)).toFixed(1));
loader.style.setProperty('--ln', (-135 + 270 * e * 0.82).toFixed(1) + 'deg');
if (p < 1) requestAnimationFrame(step);
else res();
};
requestAnimationFrame(step);
});
await wait(180);
loader.classList.add('is-out');
setTimeout(() => loader.remove(), 950);
} else if (loader) {
loader.remove();
}
if (rt.reduced || !atTop) {
rt.intro = 1;
return;
}
rt.intro = 0;
const t0 = performance.now();
const dur = seen ? 1100 : 1700;
await new Promise((res) => {
const step = (t) => {
rt.intro = clamp((t - t0) / dur, 0, 1);
if (rt.intro < 1) requestAnimationFrame(step);
else res();
};
requestAnimationFrame(step);
});
}
function initWheelHit() {
const hit = document.querySelector('[data-wheelhit]');
if (!hit) return;
let on = false;
let drag = null;
rt.dragHandlers = [];
const hint = document.querySelector('[data-wheel-hint]');
onFrame(() => {
const w = rt.wheel;
const allowed = (rt.active === 'hero' || rt.active === 'prices') && w.a > 0.6 && w.r > 40 && !(rt.mobile && rt.active === 'prices');
if (allowed !== on) {
on = allowed;
hit.classList.toggle('is-on', on);
}
if (on) {
const r = w.r * 0.98;
hit.style.transform = `translate3d(${(w.x - r).toFixed(1)}px, ${(w.y - r).toFixed(1)}px, 0)`;
hit.style.width = hit.style.height = (r * 2).toFixed(1) + 'px';
}
});
hit.setAttribute('data-cursor', 'Крутить ↻');
const ang = (e) => Math.atan2(e.clientX - rt.wheel.x, -(e.clientY - rt.wheel.y));
hit.addEventListener('pointerdown', (e) => {
if (e.button !== 0) return;
drag = { a: ang(e), t: performance.now(), v: 0 };
hit.setPointerCapture(e.pointerId);
hit.classList.add('is-grab');
if (rt.stage) rt.stage.dragging = true;
rt.dragHandlers.forEach((f) => f(0, 'start'));
if (hint) hint.style.setProperty('--hint-o', '0');
});
hit.addEventListener('pointermove', (e) => {
if (!drag) return;
const a = ang(e);
let d = a - drag.a;
if (d > Math.PI) d -= Math.PI * 2;
if (d < -Math.PI) d += Math.PI * 2;
const now = performance.now();
const dt = Math.max(8, now - drag.t) / 1000;
drag.v = drag.v * 0.6 + (d / dt) * 0.4;
drag.a = a;
drag.t = now;
if (rt.stage) rt.stage.dragBy(d);
rt.dragHandlers.forEach((f) => f(d, 'move'));
});
const end = () => {
if (!drag) return;
hit.classList.remove('is-grab');
if (rt.stage) {
rt.stage.dragging = false;
if (rt.active === 'hero' && !rt.reduced) rt.stage.fling(drag.v);
}
rt.dragHandlers.forEach((f) => f(drag.v, 'end'));
drag = null;
};
hit.addEventListener('pointerup', end);
hit.addEventListener('pointercancel', end);
hit.addEventListener('lostpointercapture', end);
}
return { initStage, runIntro, initWheelHit };
})();
/* src/js/scenes/hero.js */
const __m9 = (() => {
const { rt, onFrame, clamp } = __m0;
function initHero() {
const hero = document.querySelector('.hero');
if (!hero) return;
const chars = [...hero.querySelectorAll('.hero__st .ch')];
const st = chars.map((el, i) => ({
el,
i,
x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0,
ox: (Math.random() - 0.5) * 30,
oy: (Math.sin(i * 1.7) * 0.5 + (Math.random() - 0.5) * 0.6) * 46,
or: (Math.random() - 0.5) * 34,
trued: false,
cx: 0, cy: 0,
}));
const measure = () => {
st.forEach((s) => {
const r = s.el.getBoundingClientRect();
s.cx = r.left + r.width / 2;
s.cy = r.top + r.height / 2 + window.scrollY;
});
};
measure();
addEventListener('resize', measure);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
if (rt.reduced) {
st.forEach((s) => (s.trued = true));
} else {
st.forEach((s) => { s.x = s.ox; s.y = s.oy; s.r = s.or; });
}
let allTrue = rt.reduced;
let started = performance.now();
onFrame((dt) => {
if (rt.y > rt.vh * 1.6) return;
if (rt.reduced) {
if (!allTrue) { st.forEach((s) => (s.el.style.transform = '')); allTrue = true; }
return;
}
const w = rt.wheel;
const since = (performance.now() - started) / 1000;
const exitP = clamp(rt.y / (rt.vh * 0.75), 0, 1);
for (const s of st) {
if (!s.trued && ((rt.intro > 0.02 && w.x + w.r * 0.2 > s.cx) || since > 3.4 || rt.intro >= 1)) {
s.trued = true;
s.vy -= 260; // «щелчок»
}
let tx = s.trued ? 0 : s.ox;
let ty = s.trued ? 0 : s.oy;
let tr = s.trued ? 0 : s.or;
if (rt.hover && rt.px >= 0) {
const dx = s.cx - rt.px;
const dy = s.cy - window.scrollY - rt.py;
const d = Math.hypot(dx, dy);
const R = 150;
if (d < R) {
const k = (1 - d / R) ** 2;
tx += (dx / (d || 1)) * k * 34;
ty += (dy / (d || 1)) * k * 34;
tr += (dx > 0 ? 1 : -1) * k * 16;
}
}
if (exitP > 0) {
const line = s.el.parentElement.classList.contains('hero__ln--2') ? 1 : s.el.parentElement.classList.contains('hero__ln--3') ? 2 : 0;
const k = clamp(exitP * 1.6 - (s.i % 7) * 0.04 - line * 0.08, 0, 1);
ty -= k * k * rt.vh * 0.5;
tx += (s.i % 2 ? 1 : -1) * k * 40;
tr += (s.i % 3 - 1) * k * 40;
}
const K = 120, D = 14;
s.vx += ((tx - s.x) * K - s.vx * D) * dt;
s.vy += ((ty - s.y) * K - s.vy * D) * dt;
s.vr += ((tr - s.r) * K - s.vr * D) * dt;
s.x += s.vx * dt;
s.y += s.vy * dt;
s.r += s.vr * dt;
s.el.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0) rotate(${s.r.toFixed(1)}deg)`;
}
});
initTags();
}
function initTags() {
const box = document.querySelector('[data-tags]');
if (!box) return;
const items = [...box.querySelectorAll('[data-anchor]')];
const P = {
tread: [0.42, 1.0, 0.05],
stud: [-0.45, 0.995, 0.1],
rim: [-2.05, 0.66, 0.1],
set: [2.75, 1.0, 0.12],
};
const OFF = { tread: 64, stud: 84, rim: 96, set: 84 };
const obstacles = [...document.querySelectorAll('.hero__kicker, .hero__eyebrow, .hero__ln, .hero__lead, .hero__where, .hero__cta > *, .hero__hint, .hero__promises, .top')];
const collide = () => {
const obst = obstacles.map((el) => el.getBoundingClientRect());
return items.map((li) => {
const r = li.querySelector('a').getBoundingClientRect();
return obst.some((o) => o.width > 0 && r.left < o.right + 10 && r.right > o.left - 10 && r.top < o.bottom + 8 && r.bottom > o.top - 8);
});
};
onFrame(() => {
if (rt.mobile) { box.style.removeProperty('--tags-o'); return; }
const vis = rt.active === 'hero' && rt.intro >= 1 && rt.y < rt.vh * 0.35;
box.style.setProperty('--tags-o', vis ? '1' : '0');
box.classList.toggle('is-on', vis);
if (!vis || !rt.stage || !rt.stage.ok) {
if (!rt.stage || !rt.stage.ok) {
const hits = rt.active === 'hero' && rt.y < rt.vh * 0.35 ? collide() : [];
items.forEach((li, k) => {
const [a, r] = P[li.dataset.anchor];
const w = rt.wheel;
li.style.setProperty('--tx', (w.x + Math.sin(a) * w.r * r).toFixed(1) + 'px');
li.style.setProperty('--ty', (w.y - Math.cos(a) * w.r * r).toFixed(1) + 'px');
li.classList.toggle('is-hid', !!hits[k]);
});
box.style.setProperty('--tags-o', rt.active === 'hero' && rt.y < rt.vh * 0.35 ? '1' : '0');
}
return;
}
const hits = collide();
items.forEach((li, k) => {
const [a, r, z] = P[li.dataset.anchor];
const p = rt.stage.project([Math.sin(a) * r, Math.cos(a) * r, z], false);
li.style.setProperty('--tx', p.x.toFixed(1) + 'px');
li.style.setProperty('--ty', p.y.toFixed(1) + 'px');
li.style.setProperty('--tl', OFF[li.dataset.anchor] + 'px');
li.classList.toggle('is-hid', hits[k]);
});
});
}
return { initHero };
})();
/* src/js/scenes/anatomy.js */
const __m10 = (() => {
const { rt, onFrame, addMod, clamp } = __m0;
const { anatomySteps } = __m5;
function initAnatomy() {
const sec = document.querySelector('.anat');
if (!sec) return;
const steps = [...sec.querySelectorAll('.step')];
const nav = [...sec.querySelectorAll('[data-step-go]')];
const title = document.querySelector('[data-stage-title]');
const call = sec.querySelector('[data-callout]');
const callT = sec.querySelector('[data-callout-t]');
const callPath = sec.querySelector('[data-callout-path]');
const callDot = sec.querySelector('.callout__dot');
const n = steps.length;
const pin = sec.querySelector('.anat__pin');
let cur = -1;
let enterT = 0;
const range = () => {
const sc = rt.scenes.find((s) => s.id === 'anatomy');
if (!sc) return null;
const a = sc.top + rt.vh * 0.3;
const b = sc.top + sc.h - rt.vh;
return { a, b, L: Math.max(1, b - a) };
};
const setStep = (i) => {
if (i === cur) return;
const prev = cur;
cur = i;
enterT = performance.now();
steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
nav.forEach((a, k) => a.classList.toggle('is-active', k === i));
if (title) {
title.innerHTML = `<span>${anatomySteps[i].part}</span>`;
}
if (callT) callT.textContent = anatomySteps[i].callout;
const s = rt.stage;
if (s && s.ok) {
const id = anatomySteps[i].id;
if (id === 'rim') s.state.dent = 1;
if (id === 'balance') s.state.wobble = 1;
if (id === 'bike' && prev !== -1) s.state.wobble = 0.8;
}
};
addMod((st) => {
if (rt.active !== 'anatomy' || cur < 0) { st.dent = 0; st.wobble = 0; return; }
const id = anatomySteps[cur].id;
const t = (performance.now() - enterT) / 1000;
st.dent = id === 'rim' && t < 0.8 ? 1 : 0;
st.wobble = (id === 'balance' && t < 1.4) || (id === 'bike' && t < 0.9) ? 1 : 0;
if (id === 'balance' && t > 1.4) st.idle = 1.2;
});
onFrame(() => {
const r = range();
if (!r) return;
const y = rt.y;
const inPin = y >= r.a - rt.vh * 0.2 && y <= r.b + rt.vh * 0.1;
const p = clamp((y - r.a) / r.L, 0, 0.9999);
const i = Math.floor(p * n);
if (inPin || cur === -1) setStep(clamp(i, 0, n - 1));
nav.forEach((a, k) => a.style.setProperty('--p', clamp(p * n - k, 0, 1).toFixed(3)));
if (title) document.querySelector('.stage').style.setProperty('--st-o', inPin && !rt.mobile && y < r.b ? '1' : '0');
const fade = clamp(1 - (y - r.b) / (rt.vh * 0.25), 0, 1);
pin.style.opacity = fade.toFixed(3);
const show = inPin && rt.stage && rt.stage.ok && y > r.a - rt.vh * 0.05;
call.classList.toggle('is-on', !!show);
if (!show) return;
const id = anatomySteps[cur].id;
const R = rt.stage.builtRim || 0.64;
let pt;
if (id === 'tread') pt = rt.stage.project([0, 1.0, 0.06], false);
else if (id === 'side') pt = rt.stage.project([Math.sin(1.15) * 0.82, Math.cos(1.15) * 0.82, 0.31], false);
else if (id === 'rim') pt = rt.stage.project([Math.sin(2.2) * R, Math.cos(2.2) * R, 0.09], false);
else if (id === 'balance') pt = rt.stage.project([Math.sin(2.6) * (R - 0.03), Math.cos(2.6) * (R - 0.03), 0.07], true);
else if (id === 'studs') pt = rt.stage.project([Math.sin(-0.07) * 1.0, Math.cos(-0.07) * 1.0, 0.155], false);
else pt = rt.stage.project([Math.sin(0.8) * 0.9, Math.cos(0.8) * 0.9, 0], false);
const dx = pt.x > rt.vw * 0.62 ? -1 : 1;
const lx = pt.x + dx * (rt.mobile ? 50 : 110);
const ly = pt.y - (rt.mobile ? 40 : 80);
callDot.style.setProperty('--cx', pt.x.toFixed(1) + 'px');
callDot.style.setProperty('--cy', pt.y.toFixed(1) + 'px');
callPath.setAttribute('d', `M${pt.x.toFixed(1)} ${pt.y.toFixed(1)}L${lx.toFixed(1)} ${ly.toFixed(1)}H${(lx + dx * 24).toFixed(1)}`);
const tw = callT.offsetWidth;
callT.style.setProperty('--lx', (dx > 0 ? lx + 28 : lx - 28 - tw).toFixed(1) + 'px');
callT.style.setProperty('--ly', (ly - 12).toFixed(1) + 'px');
});
nav.forEach((a, k) =>
a.addEventListener('click', (e) => {
const r = range();
if (!r) return;
e.preventDefault();
window.scrollTo({ top: r.a + (r.L / n) * (k + 0.45), behavior: rt.reduced ? 'auto' : 'smooth' });
})
);
}
return { initAnatomy };
})();
/* src/js/scenes/prices.js */
const __m11 = (() => {
const { rt, onFrame, addMod, clamp } = __m0;
const { business, rub, findPrice, serviceById } = __m7;
const RIM = { r13: 0.6, r17: 0.67, r19: 0.74 };
function initPrices() {
const sec = document.querySelector('.prices');
if (!sec) return;
const dial = sec.querySelector('[data-dialsel]');
const tabs = [...sec.querySelectorAll('.dl')];
const panels = [...sec.querySelectorAll('[role="tabpanel"]')];
const ticksG = sec.querySelector('[data-ring-ticks]');
const n = tabs.length;
const STEP = 360 / n;
let cur = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
if (cur < 0) cur = 0;
let opt = {};
let ringA = -cur * STEP;
let ringT = ringA;
let dragging = false;
if (ticksG) {
let s = '';
for (let i = 0; i < n * 6; i++) {
const a = (i / (n * 6)) * Math.PI * 2;
const mj = i % 6 === 0;
const r1 = mj ? 88 : 93;
s += `<line class="${mj ? 'mj' : ''}" x1="${(Math.sin(a) * r1).toFixed(2)}" y1="${(-Math.cos(a) * r1).toFixed(2)}" x2="${(Math.sin(a) * 98).toFixed(2)}" y2="${(-Math.cos(a) * 98).toFixed(2)}"/>`;
}
ticksG.innerHTML = s;
ticksG.insertAdjacentHTML('afterend', '<path class="ptr" d="M100 0 l10 -6 v12z"/>');
}
function renderBig(panel, input) {
const box = panel.querySelector('[data-big-val]');
const label = panel.querySelector('[data-big-label]');
if (!box || !input) return;
label.textContent = input.dataset.label;
const amount = input.dataset.amount ? Number(input.dataset.amount) : null;
const from = input.dataset.from === '1';
const plain = amount == null ? input.dataset.text || 'уточняет мастер' : (from ? 'от ' : '') + rub(amount) + ' ₽';
if (amount == null) {
box.innerHTML = `<span class="big__text">${input.dataset.text || 'уточняет мастер'}</span>`;
return;
}
const str = rub(amount);
const digits = [...str]
.map((ch) =>
/\d/.test(ch)
? `<span class="odo"><span data-d="${ch}" style="transform:translateY(-${rt.reduced ? ch : (Number(ch) + 5) % 10}em)">${'0123456789'
.split('')
.map((d) => `<span>${d}</span>`)
.join('')}</span></span>`
: `<span>${ch}</span>`
)
.join('');
box.innerHTML = `<span class="sr-only">${plain}</span><span class="big__from" aria-hidden="true" ${from ? '' : 'hidden'}>от</span><span class="big__num" aria-hidden="true">${digits}</span><span class="big__cur" aria-hidden="true">₽</span>`;
if (!rt.reduced) {
requestAnimationFrame(() =>
requestAnimationFrame(() =>
box.querySelectorAll('.odo > span').forEach((s, k) => {
s.classList.add('is-moving');
s.style.transitionDelay = k * 60 + 'ms';
s.style.transform = `translateY(-${s.dataset.d}em)`;
setTimeout(() => s.classList.remove('is-moving'), 650 + k * 60);
})
)
);
}
}
const calc = sec.querySelector('[data-studcalc]');
let studN = 20;
if (calc) {
const nIn = calc.querySelector('[data-stud-n]');
const rIn = calc.querySelector('[data-stud-range]');
const out = calc.querySelector('[data-stud-out]');
const per = findPrice('stud').price.amount;
const sync = (v) => {
studN = clamp(parseInt(v, 10) || 1, 1, 200);
nIn.value = studN;
rIn.value = Math.min(120, studN);
out.textContent = `${studN} × ${per} ₽ = ${rub(studN * per)} ₽`;
};
nIn.addEventListener('input', () => sync(nIn.value));
rIn.addEventListener('input', () => sync(rIn.value));
calc.querySelectorAll('[data-stud-step]').forEach((b) => b.addEventListener('click', () => sync(studN + Number(b.dataset.studStep))));
}
function select(i, optId, { focus = false, fromDrag = false, user = false } = {}) {
i = ((i % n) + n) % n;
const tab = tabs[i];
const sid = tab.dataset.service;
const panel = panels.find((p) => p.dataset.panel === sid);
const apply = () => {
tabs.forEach((t, k) => {
t.setAttribute('aria-selected', k === i);
t.tabIndex = k === i ? 0 : -1;
});
panels.forEach((p) => (p.hidden = p !== panel));
let input = optId ? panel.querySelector(`input[value="${optId}"]`) : panel.querySelector('input:checked');
if (!input) input = panel.querySelector('input');
input.checked = true;
opt[sid] = input.value;
renderBig(panel, input);
};
const changed = i !== cur;
cur = i;
const target = -i * STEP;
let d = target - ringT;
d = ((d % 360) + 540) % 360 - 180;
if (!fromDrag) ringT += d;
if (changed && document.startViewTransition && !rt.reduced && !rt.mobile) document.startViewTransition(apply);
else apply();
if (focus) tab.focus();
if (rt.mobile) {
const strip = tab.parentElement;
strip.scrollTo({ left: tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2, behavior: rt.reduced ? 'auto' : 'smooth' });
if (user) {
const sb = strip.closest('.dialsel') || strip;
const edge = sb.getBoundingClientRect().bottom + 8;
const top = panel.getBoundingClientRect().top;
if (top < edge) window.scrollTo({ top: window.scrollY + top - edge, behavior: rt.reduced ? 'auto' : 'smooth' });
}
}
}
tabs.forEach((t, i) => {
t.addEventListener('click', () => select(i, null, { user: true }));
t.addEventListener('keydown', (e) => {
const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
let j = null;
if (e.key in keys) j = i + keys[e.key];
if (e.key === 'Home') j = 0;
if (e.key === 'End') j = n - 1;
if (j != null) { e.preventDefault(); select(j, null, { focus: true }); }
});
});
panels.forEach((p) =>
p.addEventListener('change', (e) => {
if (e.target.matches('input[type="radio"]')) {
opt[p.dataset.panel] = e.target.value;
renderBig(p, e.target);
}
})
);
(rt.dragHandlers || (rt.dragHandlers = [])).push((d, phase) => {
if (rt.active !== 'prices' || rt.mobile) return;
if (phase === 'start') dragging = true;
if (phase === 'move') { ringT += (d * 180) / Math.PI; ringA = ringT; }
if (phase === 'end') {
dragging = false;
const i = Math.round(-ringT / STEP);
ringT = -i * STEP;
select(i, null, { fromDrag: true });
}
});
addMod((st) => {
if (rt.active !== 'prices') { if (rt.stage && rt.stage.steel) rt.stage.setSteel(false); st.rimR = 0.64; return; }
const sid = tabs[cur].dataset.service;
const o = opt[sid] || serviceById(sid).prices[0].id;
st.rimR = sid === 'season' ? RIM[o] || 0.64 : 0.64;
if (rt.stage) rt.stage.setSteel(sid === 'rims' && o === 'steel');
st.studs = sid === 'studs' ? 1 : 0;
st.hiStud = sid === 'studs' ? 0.6 : 0;
st.weight = sid === 'balance' ? 1 : 0;
st.hiRim = sid === 'rims' ? 0.6 : 0;
st.mode = sid === 'bike' || sid === 'buyout' ? 1 : 0;
if (sid === 'studs' && !rt.mobile) { st.pitch = 30; }
});
let lastRing = ringA;
onFrame((dt) => {
if (rt.mobile || !dial) return;
const on = rt.active === 'prices' && rt.weights.prices > 0.6 && rt.wheel.a > 0.5;
dial.style.setProperty('--dial-o', on ? '1' : '0');
dial.classList.toggle('is-live', on);
if (!dragging) ringA += (ringT - ringA) * (1 - Math.exp(-dt * 7));
const dA = ringA - lastRing;
lastRing = ringA;
if (rt.stage && Math.abs(dA) > 0.001 && !dragging) rt.stage.dragBy((-dA * Math.PI) / 180);
if (!on) return;
const w = rt.wheel;
const R = w.r * 1.16;
dial.style.transform = `translate3d(${w.x.toFixed(1)}px, ${w.y.toFixed(1)}px, 0)`;
dial.style.setProperty('--rr', R.toFixed(1) + 'px');
if (ticksG) ticksG.setAttribute('transform', `rotate(${ringA.toFixed(2)})`);
const ARC = 21;
tabs.forEach((t, i) => {
const rel = i + ringA / STEP; // 0 — выбранная
const deg = 90 + rel * ARC;
const a = (deg * Math.PI) / 180;
const sx = Math.sin(a), cy = -Math.cos(a);
t.style.setProperty('--lx', (sx * R).toFixed(1) + 'px');
t.style.setProperty('--ly', (cy * R).toFixed(1) + 'px');
t.style.setProperty('--ax', '0%');
const k = clamp(1 - Math.abs(rel) / 3.6, 0, 1);
t.style.opacity = k.toFixed(2);
t.style.pointerEvents = k > 0.15 ? 'auto' : 'none';
});
});
const goto = (sid, optId) => {
const i = tabs.findIndex((t) => t.dataset.service === sid);
if (i < 0) return;
select(i, optId);
const target = rt.mobile ? sec.querySelector('.board') : sec.querySelector('.prices__in');
const y = target.getBoundingClientRect().top + window.scrollY - (rt.mobile ? 120 : rt.vh * 0.08);
window.scrollTo({ top: y, behavior: rt.reduced ? 'auto' : 'smooth' });
};
document.addEventListener('click', (e) => {
const a = e.target.closest('[data-goto-service]');
if (!a) return;
e.preventDefault();
goto(a.dataset.gotoService, a.dataset.gotoOption);
});
document.addEventListener('yd:service', (e) => goto(e.detail.service, e.detail.option));
select(cur);
}
return { initPrices };
})();
/* src/js/scenes/works.js */
const __m12 = (() => {
const { rt, onFrame, clamp } = __m0;
function initWorks() {
const sec = document.querySelector('.works');
const cyl = sec && sec.querySelector('[data-drum-cyl]');
if (!cyl) return;
const faces = [...cyl.querySelectorAll('.face')];
const n = faces.length;
const STEP = 360 / n;
const num = sec.querySelector('[data-drum-n]');
const pin = sec.querySelector('.works__pin');
let rot = 0;
let tilt = 0;
let shown = -1;
const range = () => {
const sc = rt.scenes.find((s) => s.id === 'works');
if (!sc) return null;
const a = sc.top + rt.vh * 0.6;
const b = sc.top + sc.h - rt.vh;
return { a, b, L: Math.max(1, b - a) };
};
onFrame((dt) => {
if (rt.reduced) return;
const r = range();
if (!r) return;
if (rt.y < r.a - rt.vh * 1.2 || rt.y > r.b + rt.vh) return;
pin.style.opacity = clamp(1 - (rt.y - r.b) / (rt.vh * 0.25), 0, 1).toFixed(3);
const p = clamp((rt.y - r.a) / r.L, 0, 1);
const target = -p * (n - 1) * STEP;
rot += (target - rot) * (1 - Math.exp(-dt * 8));
const tTilt = rt.hover && rt.py >= 0 ? (rt.py / rt.vh - 0.5) * -8 : 0;
tilt += (tTilt - tilt) * (1 - Math.exp(-dt * 4));
cyl.style.setProperty('--rot', rot.toFixed(2) + 'deg');
cyl.style.setProperty('--tilt-x', tilt.toFixed(2) + 'deg');
const front = Math.round(-rot / STEP);
faces.forEach((f, i) => {
let d = ((i * STEP + rot) % 360 + 540) % 360 - 180; // −180..180
const k = clamp(1 - Math.abs(d) / 90, 0, 1);
f.style.setProperty('--fo', (0.15 + k * 0.85).toFixed(2));
f.style.setProperty('--fg', (1 - k).toFixed(2));
f.style.setProperty('--fb', (0.45 + k * 0.5).toFixed(2));
f.style.setProperty('--cap-o', i === front ? '1' : '0');
f.style.setProperty('--px', (d * -0.6).toFixed(1) + 'px');
});
if (front !== shown && num) {
shown = front;
num.textContent = String(clamp(front, 0, n - 1) + 1).padStart(2, '0');
}
});
const go = (dir) => {
const r = range();
if (!r) return;
const k = clamp(Math.round(-rot / STEP) + dir, 0, n - 1);
window.scrollTo({ top: r.a + (r.L * k) / (n - 1), behavior: rt.reduced ? 'auto' : 'smooth' });
};
sec.querySelector('[data-drum-prev]')?.addEventListener('click', () => go(-1));
sec.querySelector('[data-drum-next]')?.addEventListener('click', () => go(1));
}
return { initWorks };
})();
/* src/js/scenes/mileage.js */
const __m13 = (() => {
const { rt, onFrame, clamp } = __m0;
function initMileage() {
const dash = document.querySelector('[data-dash]');
if (dash) {
const fire = () => {
dash.querySelectorAll('[data-gauge]').forEach((g) => {
const v = Number(g.dataset.value), m = Number(g.dataset.max);
g.querySelector('[data-needle]').style.setProperty('--a', (-120 + 240 * clamp(v / m, 0, 1)).toFixed(1) + 'deg');
});
dash.querySelectorAll('.lcd__bar i').forEach((b) => b.style.setProperty('--bar', '1'));
dash.querySelectorAll('.lamps li').forEach((li, i) => setTimeout(() => li.classList.add('is-on'), rt.reduced ? 0 : 500 + i * 260));
};
if ('IntersectionObserver' in window && !rt.reduced) {
const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { fire(); io.disconnect(); } }, { threshold: 0.35 });
io.observe(dash);
} else fire();
}
const revs = [...document.querySelectorAll('.rv')];
onFrame(() => {
if (rt.reduced || !revs.length || rt.active !== 'mileage') return;
const lim = rt.mobile ? 2 : 4;
const sk = clamp(-rt.vel * 0.12, -lim, lim);
revs.forEach((el) => {
const r = el.getBoundingClientRect();
if (r.bottom < 0 || r.top > rt.vh) return;
const c = clamp((r.top + r.height / 2) / rt.vh, 0, 1);
const dx = rt.mobile ? 0 : (1 - c) * Number(el.dataset.drift) * rt.vw * 0.04;
el.style.setProperty('--dx', dx.toFixed(1) + 'px');
el.style.setProperty('--sk', sk.toFixed(2) + 'deg');
});
});
}
function initCounters() {
const els = [...document.querySelectorAll('[data-count]')];
if (rt.reduced || !('IntersectionObserver' in window)) return;
const fmt = (n) => n.toLocaleString('ru-RU').replace(/ /g, ' ');
const io = new IntersectionObserver(
(es) =>
es.forEach((e) => {
if (!e.isIntersecting) return;
io.unobserve(e.target);
const el = e.target;
const to = Number(el.dataset.count);
const suf = el.dataset.suffix || '';
const final = el.textContent;
const t0 = performance.now();
const step = (t) => {
const p = Math.min(1, (t - t0) / 1800);
el.textContent = p < 1 ? fmt(Math.round(to * (1 - Math.pow(1 - p, 4)))) + suf : final;
if (p < 1) requestAnimationFrame(step);
};
requestAnimationFrame(step);
}),
{ threshold: 0.5 }
);
els.forEach((c) => io.observe(c));
}
return { initMileage, initCounters };
})();
/* src/js/scenes/ask-finish.js */
const __m14 = (() => {
const { rt, onFrame, addMod, clamp, lerp } = __m0;
function initAsk() {
const orbit = document.querySelector('[data-orbit]');
if (!orbit) return;
const items = [...orbit.querySelectorAll('li')];
let a = 0;
let paused = false;
orbit.addEventListener('pointerenter', () => (paused = true));
orbit.addEventListener('pointerleave', () => (paused = false));
orbit.addEventListener('focusin', () => (paused = true));
orbit.addEventListener('focusout', () => (paused = false));
let center = null;
addMod((st) => {
if (!center || rt.active !== 'ask') return;
const w = clamp(rt.weights.ask, 0, 1);
st.x = lerp(st.x, (center.x / rt.vw) * 2 - 1, w);
st.y = lerp(st.y, 1 - (center.y / rt.vh) * 2, w);
});
onFrame((dt) => {
const r = orbit.getBoundingClientRect();
if (r.bottom < -200 || r.top > rt.vh + 200) { center = null; return; }
center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
if (!paused && !rt.reduced) a += dt * 0.22;
const rx = Math.min(rt.vw * (rt.mobile ? 0.36 : 0.34), 560);
const ry = rt.mobile ? Math.min(r.height * 0.42, rt.vh * 0.22) : Math.min(r.height * 0.42, rx * 0.42);
items.forEach((li, i) => {
const t = a + (i / items.length) * Math.PI * 2;
const depth = Math.sin(t); // −1 сзади … 1 спереди
const x = Math.cos(t) * rx;
const y = Math.sin(t) * ry;
const hw = (li.offsetWidth || 160) / 2;
const lim = Math.max(0, rt.vw / 2 - hw - 10);
const off = center.x - rt.vw / 2; // орбита не выходит за края экрана
li.style.setProperty('--ox', clamp(x, -lim - off, lim - off).toFixed(1) + 'px');
li.style.setProperty('--oy', y.toFixed(1) + 'px');
li.style.setProperty('--os', (0.82 + 0.22 * (depth * 0.5 + 0.5)).toFixed(3));
li.style.setProperty('--oz', depth > 0 ? '3' : '1');
li.style.setProperty('--oo', (0.5 + 0.5 * (depth * 0.5 + 0.5)).toFixed(2));
});
});
}
function initFinish() {
const sec = document.querySelector('.finish');
if (!sec) return;
const track = sec.querySelector('[data-track]');
onFrame(() => {
if (!track || rt.active === 'hero') return;
const sc = rt.scenes.find((s) => s.id === 'finish');
if (!sc) return;
const p = rt.reduced ? 1 : clamp((rt.y - (sc.top - rt.vh * 0.4)) / (rt.vh * 0.62), 0, 1);
track.style.setProperty('--td', (1 - p).toFixed(4));
});
const ph = sec.querySelector('[data-phone-roll]');
if (ph && !rt.reduced) {
const txt = ph.textContent;
ph.setAttribute('aria-hidden', 'true');
ph.innerHTML = [...txt].map((c, i) => `<span class="pcw"><span class="pc" style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</span></span>`).join('');
const link = ph.closest('.bigphone');
if ('IntersectionObserver' in window) {
const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { link.classList.add('is-in'); io.disconnect(); } }, { threshold: 0.4 });
io.observe(link);
} else link.classList.add('is-in');
}
}
return { initAsk, initFinish };
})();
/* src/js/scenes/chrome.js */
const __m15 = (() => {
const { rt, onFrame, clamp } = __m0;
const { sceneNav } = __m5;
function initChrome() {
const dial = document.querySelector('[data-dial]');
const deg = document.querySelector('[data-deg]');
const lab = document.querySelector('[data-dial-label]');
const needle = document.querySelector('[data-dial-needle]');
const ticks = document.querySelector('[data-dial-ticks]');
const hudN = document.querySelector('[data-hud-n]');
const hudT = document.querySelector('[data-hud-t]');
const mark = document.querySelector('[data-brand-mark]');
const links = [...document.querySelectorAll('[data-dial-link]')];
const byScene = { hero: 'top', anatomy: 'help', prices: 'prices', works: 'works', mileage: 'about', ask: 'assistant', finish: 'contacts' };
let lastDeg = -1;
let lastActive = '';
const layoutTicks = () => {
if (!ticks) return;
const max = Math.max(1, document.documentElement.scrollHeight - rt.vh);
let s = '';
rt.scenes.forEach((sc) => {
const a = clamp(sc.top / max, 0, 1) * Math.PI * 2;
s += `<line data-tick="${sc.id}" x1="${(Math.sin(a) * 34).toFixed(1)}" y1="${(-Math.cos(a) * 34).toFixed(1)}" x2="${(Math.sin(a) * 44).toFixed(1)}" y2="${(-Math.cos(a) * 44).toFixed(1)}"/>`;
const at = document.querySelector(`[data-dial-at="${byScene[sc.id]}"]`);
if (at) at.textContent = String(Math.round((sc.top / max) * 360)).padStart(3, '0') + '°';
});
ticks.innerHTML = s;
};
setTimeout(layoutTicks, 300);
addEventListener('resize', () => setTimeout(layoutTicks, 200));
addEventListener('load', layoutTicks);
onFrame(() => {
const max = Math.max(1, document.documentElement.scrollHeight - rt.vh);
const p = clamp(rt.y / max, 0, 1);
const d = Math.round(p * 360);
if (d !== lastDeg) {
lastDeg = d;
if (deg) deg.textContent = String(d).padStart(3, '0');
if (needle) needle.setAttribute('transform', `rotate(${(p * 360).toFixed(1)})`);
if (mark && !rt.reduced) mark.style.transform = `rotate(${(p * 720).toFixed(1)}deg)`;
}
if (rt.active !== lastActive) {
lastActive = rt.active;
document.documentElement.dataset.act = rt.active;
const id = byScene[rt.active];
const i = sceneNav.findIndex((s) => s.id === id);
if (i >= 0) {
if (lab) lab.textContent = sceneNav[i].label;
if (hudN) hudN.textContent = String(i).padStart(2, '0');
if (hudT) hudT.textContent = sceneNav[i].label;
}
links.forEach((a) => a.classList.toggle('is-active', a.dataset.dialLink === id));
ticks && ticks.querySelectorAll('line').forEach((l) => l.classList.toggle('is-on', l.dataset.tick === rt.active));
}
});
const knob = document.querySelector('[data-dial-knob]');
if (knob && dial) {
knob.addEventListener('click', () => {
const open = !dial.classList.contains('is-open');
dial.classList.toggle('is-open', open);
knob.setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', (e) => { if (!dial.contains(e.target)) { dial.classList.remove('is-open'); knob.setAttribute('aria-expanded', 'false'); } });
}
initMenu();
initCursor();
initMagnetic();
}
function initMenu() {
const menu = document.querySelector('[data-menu]');
const openBtn = document.querySelector('[data-menu-open]');
const closeBtn = document.querySelector('[data-menu-close]');
if (!menu || !openBtn) return;
const open = () => {
menu.hidden = false;
requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
openBtn.setAttribute('aria-expanded', 'true');
document.documentElement.style.overflow = 'hidden';
setTimeout(() => closeBtn && closeBtn.focus(), 50);
};
const close = (restore = true) => {
menu.classList.remove('is-open');
openBtn.setAttribute('aria-expanded', 'false');
document.documentElement.style.overflow = '';
setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, rt.reduced ? 0 : 650);
if (restore) openBtn.focus();
};
openBtn.addEventListener('click', open);
closeBtn && closeBtn.addEventListener('click', () => close());
menu.querySelectorAll('[data-menu-link]').forEach((a) => a.addEventListener('click', () => close(false)));
menu.addEventListener('keydown', (e) => {
if (e.key === 'Escape') close();
if (e.key === 'Tab') {
const f = [...menu.querySelectorAll('a, button')].filter((x) => x.offsetParent !== null);
if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
}
});
}
function initCursor() {
const cur = document.querySelector('[data-cur]');
if (!cur || !rt.hover) return;
document.documentElement.classList.add('has-cursor');
const t = cur.querySelector('[data-cur-t]');
let x = -100, y = -100;
let label = '';
onFrame((dt) => {
if (rt.px < 0) return;
const k = 1 - Math.exp(-dt * 18);
x += (rt.px - x) * k;
y += (rt.py - y) * k;
cur.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
});
document.addEventListener('pointerover', (e) => {
const el = e.target.closest('[data-cursor]');
const l = el ? el.dataset.cursor : '';
if (l !== label) {
label = l;
t.textContent = l;
cur.classList.toggle('is-on', !!l);
}
});
document.addEventListener('pointerdown', () => cur.classList.add('is-down'));
document.addEventListener('pointerup', () => cur.classList.remove('is-down'));
document.addEventListener('pointerleave', () => cur.classList.remove('is-on'));
}
function initMagnetic() {
if (!rt.hover || rt.reduced) return;
document.querySelectorAll('[data-magnetic]').forEach((el) => {
const inner = el.querySelector('.btn__in');
el.addEventListener('pointermove', (e) => {
const r = el.getBoundingClientRect();
const dx = e.clientX - (r.left + r.width / 2);
const dy = e.clientY - (r.top + r.height / 2);
el.style.transform = `translate(${(dx * 0.22).toFixed(1)}px, ${(dy * 0.32).toFixed(1)}px)`;
if (inner) inner.style.transform = `translate(${(dx * 0.12).toFixed(1)}px, ${(dy * 0.16).toFixed(1)}px)`;
});
el.addEventListener('pointerleave', () => {
el.style.transform = '';
if (inner) inner.style.transform = '';
});
});
}
return { initChrome };
})();
/* src/js/utils/dom.js */
const __m16 = (() => {
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rmq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const reducedMotion = () => !!(rmq && rmq.matches);
function onReducedMotionChange(fn) {
if (rmq && rmq.addEventListener) rmq.addEventListener('change', fn);
}
const isDesktop = () => matchMedia('(min-width: 900px)').matches;
const isTouch = () => matchMedia('(hover: none)').matches;
function ssGet(k) {
try { return sessionStorage.getItem(k); } catch (e) { return null; }
}
function ssSet(k, v) {
try { sessionStorage.setItem(k, v); } catch (e) {  }
}
function scrollToEl(el, offset) {
if (!el) return;
const hh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hh')) || 64;
const y = el.getBoundingClientRect().top + window.scrollY - hh - (offset == null ? 12 : offset);
window.scrollTo({ top: y, behavior: reducedMotion() ? 'auto' : 'smooth' });
}
const emit = (name, detail) => document.dispatchEvent(new CustomEvent('yd:' + name, { detail }));
const listen = (name, fn) => document.addEventListener('yd:' + name, (e) => fn(e.detail));
return { $, $$, clamp, lerp, reducedMotion, onReducedMotionChange, isDesktop, isTouch, ssGet, ssSet, scrollToEl, emit, listen };
})();
/* src/js/utils/time.js */
const __m17 = (() => {
const DAY_ACC = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function shopNow(tz, date) {
const d = date || new Date();
try {
const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
const get = (t) => (parts.find((p) => p.type === t) || {}).value;
return { dow: WD[get('weekday')], minutes: parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10) };
} catch (e) {
const u = new Date(d.getTime() + 4 * 3600 * 1000);
return { dow: u.getUTCDay(), minutes: u.getUTCHours() * 60 + u.getUTCMinutes() };
}
}
const toMin = (hhmm) => {
const [h, m] = hhmm.split(':').map(Number);
return h * 60 + m;
};
const fmt = (hhmm) => hhmm.replace(/^0/, '');
function shopStatus(hours, date) {
const { dow, minutes } = shopNow(hours.timezone, date);
const o = toMin(hours.open);
const c = toMin(hours.close);
const isWork = (d) => hours.workdays.includes(d);
if (isWork(dow) && minutes >= o && minutes < c) {
const left = c - minutes;
return {
open: true, dow,
long: `Сейчас открыто · до ${fmt(hours.close)}`,
short: `Открыто до ${fmt(hours.close)}`,
soon: left <= 60,
};
}
let when;
if (isWork(dow) && minutes < o) when = `сегодня в ${fmt(hours.open)}`;
else {
let k = 1;
while (k < 8 && !isWork((dow + k) % 7)) k++;
const nd = (dow + k) % 7;
when = k === 1 ? `завтра в ${fmt(hours.open)}` : `в ${DAY_ACC[nd]} в ${fmt(hours.open)}`;
}
return { open: false, dow, long: `Сейчас закрыто · откроемся ${when}`, short: `Закрыто · откроемся ${when}`, when };
}
return { shopNow, shopStatus };
})();
/* src/js/components/status.js */
const __m18 = (() => {
const { $$ } = __m16;
const { shopStatus } = __m17;
const { business } = __m7;
function initStatus() {
const els = $$('[data-status]');
const week = $$('[data-week] li');
if (!els.length) return;
const update = () => {
const s = shopStatus(business.hours);
els.forEach((el) => {
const t = el.querySelector('[data-status-text]');
const inHeader = !!el.closest('.top');
if (t) t.textContent = inHeader ? (s.open ? s.short : 'Закрыто') : s.long;
el.classList.toggle('is-open', s.open);
el.classList.toggle('is-closed', !s.open);
el.title = `${s.long}. ${business.hours.text}, ${business.hours.dayOff}. Время местное (Сарапул).`;
});
week.forEach((li) => li.classList.toggle('is-today', Number(li.dataset.dow) === s.dow));
};
update();
setInterval(update, 60 * 1000);
}
return { initStatus };
})();
/* src/js/components/media.js */
const __m19 = (() => {
const { $, $$ } = __m16;
const { business } = __m7;
function initImages() {
const handle = (img) => {
const fb = img.dataset.fallback;
if (fb && !img.dataset.triedFallback && img.getAttribute('src') !== fb) {
img.dataset.triedFallback = '1';
img.src = fb;
return;
}
const f = img.closest('.frame, .face');
if (f) f.classList.add('is-missing');
};
$$('img[data-fallback]').forEach((img) => {
img.addEventListener('error', () => handle(img));
if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) handle(img);
});
}
function initLightbox() {
const dlg = $('[data-lb]');
if (!dlg || typeof dlg.showModal !== 'function') return;
const img = $('[data-lb-img]', dlg);
const capN = $('[data-lb-n]', dlg);
const cap = $('[data-lb-cap]', dlg);
const photos = business.photos;
let i = 0;
let opener = null;
const show = (k) => {
i = (k + photos.length) % photos.length;
const p = photos[i];
const thumb = $$('[data-lb-open] img')[i];
img.src = thumb && thumb.currentSrc ? thumb.currentSrc : p.src;
img.alt = p.alt;
capN.textContent = `К-${String(i + 1).padStart(2, '0')} / ${p.tag}`;
cap.textContent = p.caption;
};
document.addEventListener('click', (e) => {
const b = e.target.closest('[data-lb-open]');
if (!b) return;
if (b.closest('.frame, .face')?.classList.contains('is-missing')) return;
opener = b;
show(Number(b.dataset.lbOpen));
dlg.showModal();
});
$('[data-lb-prev]', dlg).addEventListener('click', () => show(i - 1));
$('[data-lb-next]', dlg).addEventListener('click', () => show(i + 1));
$('[data-lb-close]', dlg).addEventListener('click', () => dlg.close());
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
dlg.addEventListener('keydown', (e) => {
if (e.key === 'ArrowRight') show(i + 1);
if (e.key === 'ArrowLeft') show(i - 1);
});
dlg.addEventListener('close', () => opener && opener.focus());
}
function initMap() {
const box = $('[data-map]');
if (!box) return;
let done = false;
const load = () => {
if (done) return;
done = true;
const f = document.createElement('iframe');
f.src = box.dataset.src;
f.title = `Карта: ${business.name}, ${business.address.full}`;
f.loading = 'lazy';
f.allowFullscreen = true;
f.referrerPolicy = 'no-referrer-when-downgrade';
box.appendChild(f);
};
$('[data-map-load]', box)?.addEventListener('click', load);
if ('IntersectionObserver' in window) {
const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { load(); io.disconnect(); } }, { rootMargin: '300px 0px' });
io.observe(box);
}
}
return { initImages, initLightbox, initMap };
})();
/* src/js/components/reveal.js */
const __m20 = (() => {
const { $$, reducedMotion } = __m16;
function initReveal() {
const sel = '.prices__head > *, .board, .mileage__head, .dash, .mileage__about > *, .revs__head > *, .ask__head, .ask__foot, .finish__head > *, .cbox, .faq, .seo, .all';
const els = $$(sel);
els.forEach((el, i) => {
el.dataset.reveal = '';
el.style.setProperty('--rd', `${(i % 4) * 80}ms`);
});
if (!('IntersectionObserver' in window) || reducedMotion()) {
els.forEach((el) => el.classList.add('is-in'));
return;
}
const io = new IntersectionObserver(
(es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }),
{ rootMargin: '0px 0px -6% 0px', threshold: 0.01 }
);
els.forEach((el) => io.observe(el));
}
return { initReveal };
})();
/* src/js/services/knowledge.js */
const __m21 = (() => {
const { business: b, priceText, serviceById, findPrice, rub } = __m7;
const { shopStatus } = __m17;
const norm = (s) =>
String(s || '')
.toLowerCase()
.replace(/ё/g, 'е')
.replace(/[«»"“”„!?.,;:()]/g, ' ')
.replace(/\s+/g, ' ')
.trim();
const P = (id) => priceText(findPrice(id).price);
const list = (sid) => serviceById(sid).prices.map((p) => `• ${p.label} — ${priceText(p)}`).join('\n');
const CALL = { type: 'call', label: 'Позвонить' };
const MAP = { type: 'map', label: 'Маршрут' };
const svc = (service, option, label = 'Показать в прайсе') => ({ type: 'service', service, option, label });
function diameter(t) {
const m =
t.match(/(?<![a-zа-я])[rр]\s?-?(\d{2})(?!\d)/) ||
t.match(/(?<!\d)(\d{2})\s?(?:радиус|дюйм|-?(?:м|х|ый|ые|ых|й)(?![а-я]))/) ||
t.match(/радиус[а-я]*\s?(\d{2})(?!\d)/);
if (m) return Number(m[1]);
if (/внедорожн|джип/.test(t)) return 19;
return null;
}
function seasonOption(d) {
if (d == null) return null;
if (d >= 13 && d <= 16) return 'r13';
if (d >= 17 && d <= 18) return 'r17';
if (d >= 19) return 'r19';
return 'small';
}
const INTENTS = [
{
id: 'payment',
re: /оплат|картой|наличн|перевод|сбп|\bqr\b|безнал/,
answer: () => ({
text: `Точной информации о способах оплаты у меня нет. Лучше уточнить у мастера по телефону ${b.phone.display}.`,
actions: [CALL],
}),
},
{
id: 'bulge',
re: /грыж|шишк|вздут/,
answer: () => ({
text:
`Ремонт грыжи — ${P('bulge')} (по прайсу).\n` +
'Грыжа — это повреждение каркаса шины, поэтому сначала её должен осмотреть мастер: он скажет, что можно сделать именно в вашем случае.\n' +
`Лучше позвонить заранее: ${b.phone.display}.`,
actions: [CALL, svc('repair', 'bulge')],
}),
},
{
id: 'cut',
re: /порез|боков|разрез|пропорол/,
answer: () => ({
text: `Боковой порез — ${P('cut')}.\nМожно ли ремонтировать конкретный порез, определяет мастер после осмотра.`,
actions: [svc('repair', 'cut'), CALL],
}),
},
{
id: 'puncture',
re: /прокол|спуска|спустил|сдува|гвозд|саморез|шуруп|дырк|жгут|заплат|травит|не держ|колесо село|спущ/,
answer: () => ({
text: `Проколы ремонтируем:\n• Жгут — ${P('plug')}\n• Заплатка — ${P('patch')}\nКакой способ подойдёт, мастер скажет после осмотра.`,
actions: [svc('repair', 'plug'), CALL, MAP],
}),
},
{
id: 'studs',
re: /шип|дошип/,
answer: (t) => {
const m = t.match(/(\d{1,3})\s*шип/);
let text = `Да, дошиповка есть — восстановление шипов в зимних шинах любой сложности.\n• 1 шип — ${P('stud')}\n• Колесо целиком (R14) — ${P('wheel')}`;
if (m) {
const n = Number(m[1]);
const per = findPrice('stud').price.amount;
text += `\n\nОриентир для ${n} шт.: ${n} × ${per} ₽ = ${rub(n * per)} ₽. Итог называет мастер.`;
}
return { text, actions: [svc('studs', 'stud'), CALL] };
},
},
{
id: 'bike',
re: /велос|вело(?![а-я])|велик|восьмерк|переключ|втулк|камер|спиц|цеп[ьи]|тормоз/,
answer: (t) => {
const tube = /камер/.test(t) ? '\nЗамена камер — тоже делаем, стоимость уточняет мастер.' : '';
return { text: `Ремонт велосипедов:\n${list('bike').replace(/\n• Замена камер — уточняет мастер/, '')}${tube}`, actions: [svc('bike', /восьм/.test(t) ? 'true' : /тормоз/.test(t) ? 'brakes' : /переключ/.test(t) ? 'gears' : /втулк/.test(t) ? 'hub' : 'true'), CALL] };
},
},
{
id: 'buyout',
re: /продат|продам|скупк|выкуп|купит|купите|комисс|оценит|оценка/,
answer: () => ({ text: `Покупаем велосипеды в любом состоянии:\n${list('buyout')}`, actions: [svc('buyout', 'eval'), CALL] }),
},
{
id: 'rims',
re: /диск|правк|выправ|погну|лит(ой|ые|ого|ых|ье|ья)|штамп|геометр|вмятин|кривой/,
answer: () => ({
text: `Правим штампованные и литые диски — восстанавливаем геометрию.\n• Штампованные — ${P('steel')}\n• Литые — ${P('alloy')}\nМожно ли восстановить конкретный диск, мастер скажет после осмотра.`,
actions: [svc('rims', 'alloy'), CALL],
}),
},
{
id: 'balance',
re: /баланс|бьет|бьёт|вибрац|трясет|трясёт|дрожит|руль/,
answer: () => ({
text: `Балансировку колёс делаем на современном оборудовании. Цены на балансировку в прайсе сайта нет — стоимость уточняет мастер по телефону ${b.phone.display}.`,
actions: [CALL, svc('balance', 'bal')],
}),
},
{
id: 'season',
re: /переоб|сезон|смен[а-яa-z]* (резин|колес|шин)|замен[а-яa-z]* (резин|колес|шин)|поменя[а-яa-z]* (резин|колес|шин)|переставит|летн[а-яa-z]+ (резин|шин)|зимн[а-яa-z]+ (резин|шин)|переобу/,
answer: (t) => {
const d = diameter(t);
const opt = seasonOption(d);
if (opt === 'small') {
return { text: `Для таких дисков отдельной цены в прайсе нет. Лучше уточнить у мастера по телефону ${b.phone.display}.\n\nПрайс переобувки (4 колеса):\n${list('season')}`, actions: [CALL, svc('season', 'r13')] };
}
if (opt) {
const p = findPrice(opt).price;
const what = d >= 19 && /внедорожн|джип/.test(t) && !/[rр]\s?-?\d/.test(t) ? 'Внедорожник' : `R${d}`;
return { text: `Переобувка: ${what} — это категория «${p.label}», ${priceText(p)} за комплект.\nТочную сумму назовёт мастер.`, actions: [svc('season', opt), CALL] };
}
return { text: `Сезонная переобувка, комплект из 4 колёс:\n${list('season')}`, actions: [svc('season', 'r13'), CALL] };
},
},
{
id: 'repair',
re: /ремонт[а-яa-z]* (шин|колес|резин)|почин/,
answer: () => ({ text: `Ремонт шин:\n${list('repair')}`, actions: [svc('repair', 'plug'), CALL] }),
},
{
id: 'hours',
re: /когда|график|работает|работаете|часы|время работы|открыт|закрыт|выходн|воскрес|суббот|сегодня|до скольки|во сколько|праздник/,
answer: (t) => {
const s = shopStatus(b.hours);
let text = `Мы работаем:\n${b.hours.text}\n${b.hours.dayOff}.\n\n${s.long}.`;
if (/праздник/.test(t)) text += `\nО праздничных днях точной информации у меня нет — лучше уточнить по телефону.`;
return { text, actions: [CALL, MAP] };
},
},
{
id: 'address',
re: /(?<![а-я])где(?![а-я])|адрес|найти|доехат|проехат|добрат|на карте|карту|карта(?![а-я])|карты(?![а-я])|маршрут|находит|ленинград|как вас/,
answer: () => ({ text: `Мы находимся по адресу:\n${b.address.full}.`, actions: [MAP, { type: 'link', href: b.links.yandexMaps, label: 'Яндекс Карты' }, CALL] }),
},
{
id: 'phone',
re: /телефон|позвон|номер|связат|звонит/,
answer: () => ({ text: `Наш телефон: ${b.phone.display}`, actions: [CALL] }),
},
{
id: 'warranty',
re: /гарант/,
answer: () => ({ text: `Да, на выполненные работы даём гарантию. Условия лучше уточнить у мастера: ${b.phone.display}.`, actions: [CALL] }),
},
{
id: 'booking',
re: /запис|очеред|бронь|заран|ждать|долго|сколько времени|как быстро/,
answer: () => ({
text: `Онлайн-записи на сайте нет — проще всего позвонить: ${b.phone.display}.\nОбычно работаем быстро — от 15 минут; в сезон бывает очередь, поэтому лучше позвонить заранее.`,
actions: [CALL],
}),
},
{
id: 'avito',
re: /авито|avito|отзыв/,
answer: () => ({ text: 'Наши услуги и отзывы есть на Авито и на Яндекс Картах.', actions: [{ type: 'link', href: b.links.avito, label: 'Авито' }, { type: 'link', href: b.links.yandexMaps, label: 'Яндекс Карты' }] }),
},
{
id: 'price',
re: /цен|стоим|сколько|прайс|почем|стоит/,
answer: () => ({
text:
'Коротко по прайсу:\n' +
`• Переобувка R13–R16 (4 колеса) — ${P('r13')}\n` +
`• Ремонт прокола (жгут) — ${P('plug')}\n` +
`• Правка дисков — ${P('steel')}\n` +
`• Дошиповка — ${P('stud')} за шип\n` +
`• Велоремонт — ${P('brakes')}\n` +
'Уточните услугу — подскажу точнее.',
actions: [{ type: 'section', target: '#prices', label: 'Весь прайс' }],
}),
},
{
id: 'hello',
re: /^(привет|здравств|добр[а-яa-z]* (день|утро|вечер)|hello|hi\b|хай)/,
answer: () => ({ text: 'Здравствуйте! Подскажу по услугам, ценам и графику работы. Что случилось с колесом?', actions: [] }),
},
{
id: 'thanks',
re: /спасиб|благодар/,
answer: () => ({ text: `Пожалуйста! Если что — звоните: ${b.phone.display}.`, actions: [CALL] }),
},
];
const FALLBACK = () => ({
text: `Точной информации у меня нет. Лучше уточнить у мастера по телефону ${b.phone.display} — он ответит точно.`,
actions: [CALL],
});
function detect(question) {
const t = norm(question);
let found = INTENTS.filter((i) => i.re.test(t)).map((i) => i.id);
if (!found.some((id) => ['season', 'studs', 'rims', 'repair', 'bike'].includes(id)) && diameter(t) != null) found.unshift('season');
if (found.includes('buyout')) found = found.filter((id) => id !== 'bike');
const specific = found.filter((id) => !['price', 'hello', 'thanks'].includes(id));
if (specific.length) return specific;
return found;
}
function answerLocally(question) {
const t = norm(question);
const ids = detect(question).slice(0, 2);
if (!ids.length) return { ...FALLBACK(), matched: false };
const parts = ids.map((id) => INTENTS.find((i) => i.id === id).answer(t));
const actions = [];
const seen = new Set();
parts.forEach((p) =>
p.actions.forEach((a) => {
const k = a.type + (a.service || a.href || a.target || '');
if (!seen.has(k)) { seen.add(k); actions.push(a); }
})
);
return { text: parts.map((p) => p.text).join('\n\n'), actions: actions.slice(0, 3), matched: true };
}
function actionsFor(question) {
const r = answerLocally(question);
return r.matched ? r.actions : [CALL];
}
return { detect, answerLocally, actionsFor };
})();
/* src/js/services/assistant.js */
const __m22 = (() => {
const { answerLocally, actionsFor } = __m21;
const meta = typeof document !== 'undefined' ? document.querySelector('meta[name="yd-assistant-endpoint"]') : null;
const ASSISTANT_CONFIG = {
endpoint: (meta && meta.content) || '/api/chat',
timeoutMs: 25000,
maxLength: 500, // как в старом интерфейсе
};
const SESSION_KEY = 'yd-chat-session';
let sessionId = null;
try { sessionId = sessionStorage.getItem(SESSION_KEY); } catch (e) {  }
const serverEnabled = () => {
const ep = ASSISTANT_CONFIG.endpoint;
if (!ep || ep === 'off') return false;
if (location.protocol === 'file:' && !/^https?:/.test(ep)) return false;
return true;
};
async function askServer(message) {
const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
const timer = ctrl ? setTimeout(() => ctrl.abort(), ASSISTANT_CONFIG.timeoutMs) : null;
try {
const res = await fetch(ASSISTANT_CONFIG.endpoint, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ message, sessionId }),
signal: ctrl ? ctrl.signal : undefined,
});
const data = await res.json().catch(() => ({}));
if (data && data.sessionId) {
sessionId = data.sessionId;
try { sessionStorage.setItem(SESSION_KEY, sessionId); } catch (e) {  }
}
if (!res.ok || !data || typeof data.reply !== 'string' || !data.reply.trim()) {
throw new Error('bad response ' + res.status);
}
return data.reply.trim();
} finally {
if (timer) clearTimeout(timer);
}
}
async function ask(message) {
const text = String(message || '').slice(0, ASSISTANT_CONFIG.maxLength).trim();
if (!text) return null;
if (serverEnabled()) {
try {
const reply = await askServer(text);
return { text: reply, actions: actionsFor(text), source: 'ai' };
} catch (e) {
}
}
const local = answerLocally(text);
return { text: local.text, actions: local.actions, source: 'local' };
}
return { ASSISTANT_CONFIG, ask };
})();
/* src/data/assistant.js */
const __m23 = (() => {
const assistantCopy = {
idle: 'Я здесь.',
hover: 'Спросите меня о шинах, ремонте или цене.',
title: 'ИИ-консультант',
subtitle: 'Справка по услугам и графику',
greeting: 'Привет. Что случилось с колесом?',
disclaimer: 'Ответы справочные, а точные детали лучше уточнить по телефону: +7 (950) 172-55-14.',
placeholder: 'Например: сколько стоит переобуть R16?',
typing: 'Печатает…',
quick: [
'Сколько стоит переобуть R16?',
'Можно ли восстановить диск?',
'У вас есть дошиповка?',
'Когда вы работаете?',
'Как вас найти?',
'У меня грыжа — что делать?',
],
};
return { assistantCopy };
})();
/* src/js/components/chat.js */
const __m24 = (() => {
const { $, $$, isDesktop, isTouch, ssGet, ssSet, emit, scrollToEl } = __m16;
const { ask } = __m22;
const { assistantCopy: c } = __m23;
const { business: b } = __m7;
function initChat() {
const root = $('[data-ai]');
if (!root) return;
const pill = $('[data-ai-toggle]', root);
const panel = $('#ai-panel');
const log = $('[data-ai-log]', root);
const form = $('[data-ai-form]', root);
const input = $('textarea', form);
const send = $('.ai__send', form);
const mode = $('[data-ai-mode]', root);
let started = false;
let busy = false;
let lastFocus = null;
const time = () => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const linkify = (s) => esc(s).replace(/\+7\s?\(?950\)?\s?172-55-14/g, (m) => `<a href="${b.phone.href}">${m}</a>`);
function bubble(role, text, { actions = [], meta } = {}) {
const m = document.createElement('div');
m.className = `msg msg--${role}`;
let acts = '';
if (actions.length) {
acts =
'<div class="msg__acts">' +
actions
.map((a, i) => {
if (a.type === 'call') return `<a class="is-call" href="${b.phone.href}" data-phone>☎ ${esc(a.label)}</a>`;
if (a.type === 'map') return `<a href="${b.links.yandexRoute}" target="_blank" rel="noopener">⌖ ${esc(a.label)}</a>`;
if (a.type === 'link') return `<a href="${a.href}" target="_blank" rel="noopener">${esc(a.label)} ↗</a>`;
return `<button type="button" data-act="${i}">→ ${esc(a.label)}</button>`;
})
.join('') +
'</div>';
}
m.innerHTML = `<p class="msg__meta">${role === 'user' ? 'Вы' : 'ИИ'} · ${meta || time()}</p><div class="msg__b">${linkify(text)}</div>${acts}`;
$$('[data-act]', m).forEach((btn) =>
btn.addEventListener('click', () => {
const a = actions[Number(btn.dataset.act)];
if (!isDesktop()) close(false);
if (a.type === 'service') emit('service', { service: a.service, option: a.option });
if (a.type === 'section') scrollToEl(document.querySelector(a.target));
})
);
log.appendChild(m);
log.scrollTop = log.scrollHeight;
return m;
}
function typing(on) {
let t = $('.typing', log);
if (on && !t) {
t = document.createElement('p');
t.className = 'typing';
t.innerHTML = `<svg viewBox="-12 -12 24 24" aria-hidden="true"><circle r="9"/><path d="M0-9V9M-9 0H9"/></svg>${esc(c.typing)}`;
log.appendChild(t);
log.scrollTop = log.scrollHeight;
} else if (!on && t) t.remove();
}
function start() {
if (started) return;
started = true;
bubble('bot', `${c.greeting}\n\n${c.disclaimer}`, { meta: 'онлайн' });
}
function open(focusInput = true) {
if (root.classList.contains('is-open')) return;
lastFocus = document.activeElement;
panel.hidden = false;
panel.classList.remove('is-closing');
root.classList.add('is-opening');
requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('is-opening')));
root.classList.add('is-open');
hideBubble();
root.classList.remove('is-hint');
pill.setAttribute('aria-expanded', 'true');
start();
if (!isDesktop()) document.documentElement.style.overflow = 'hidden';
if (focusInput && !isTouch()) setTimeout(() => input.focus(), 60);
else setTimeout(() => $('.ai__close', panel).focus({ preventScroll: true }), 60);
}
function close(restore = true) {
if (!root.classList.contains('is-open')) return;
root.classList.remove('is-open');
panel.classList.add('is-closing');
setTimeout(() => { if (!root.classList.contains('is-open')) panel.hidden = true; panel.classList.remove('is-closing'); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 560);
pill.setAttribute('aria-expanded', 'false');
document.documentElement.style.overflow = '';
if (restore && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}
async function submit(text) {
text = String(text || '').trim();
if (!text || busy) return;
open(false);
busy = true;
send.disabled = true;
root.dataset.state = 'busy';
bubble('user', text);
input.value = '';
autosize();
typing(true);
const t0 = performance.now();
let r;
try {
r = await ask(text);
} catch (e) {
r = { text: `Произошла ошибка. Позвоните нам: ${b.phone.display}`, actions: [{ type: 'call', label: 'Позвонить' }], source: 'local' };
}
const wait = Math.max(0, 450 - (performance.now() - t0));
await new Promise((res) => setTimeout(res, wait));
typing(false);
bubble('bot', r.text, { actions: r.actions });
mode.textContent = r.source === 'ai' ? c.subtitle : 'Ответ из справочника сайта';
mode.classList.toggle('is-local', r.source !== 'ai');
busy = false;
send.disabled = false;
root.dataset.state = 'idle';
}
function autosize() {
input.style.height = 'auto';
input.style.height = Math.min(140, input.scrollHeight) + 'px';
}
pill.addEventListener('click', () => (root.classList.contains('is-open') ? close() : open()));
$('[data-ai-close]', root).addEventListener('click', () => close());
form.addEventListener('submit', (e) => {
e.preventDefault();
submit(input.value);
});
input.addEventListener('input', autosize);
input.addEventListener('keydown', (e) => {
if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
e.preventDefault();
submit(input.value);
}
});
$$('[data-ai-q]', root).forEach((btn) => btn.addEventListener('click', () => submit(btn.dataset.aiQ)));
root.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
document.addEventListener('pointerdown', (e) => {
if (!isDesktop() || !root.classList.contains('is-open')) return;
if (root.contains(e.target) || e.target.closest('[data-ai-open],[data-ai-ask]')) return;
close(false);
});
document.addEventListener('click', (e) => {
const o = e.target.closest('[data-ai-open]');
if (o) { e.preventDefault(); open(); return; }
const q = e.target.closest('[data-ai-ask]');
if (q) { e.preventDefault(); submit(q.dataset.aiAsk); }
});
const inline = $('[data-ai-inline]');
if (inline) {
inline.addEventListener('submit', (e) => {
e.preventDefault();
const f = inline.querySelector('input');
const v = f.value;
f.value = '';
if (v.trim()) submit(v);
else open();
});
}
const pupil = root.querySelector('[data-ai-pupil]');
const eye = pupil && pupil.parentElement;
if (pupil) {
addEventListener('pointermove', (e) => {
const r = eye.getBoundingClientRect();
const dx = e.clientX - (r.left + r.width / 2);
const dy = e.clientY - (r.top + r.height / 2);
const d = Math.hypot(dx, dy) || 1;
const k = Math.min(1, d / 300) * 9;
pupil.style.setProperty('--ex', ((dx / d) * k).toFixed(1) + 'px');
pupil.style.setProperty('--ey', ((dy / d) * k).toFixed(1) + 'px');
}, { passive: true });
}
const bub = root.querySelector('[data-ai-bubble]');
const bubT = root.querySelector('[data-ai-bubble-t]');
const bubA = root.querySelector('[data-ai-bubble-acts]');
let bubTimer = 0;
function hideBubble() {
if (!bub) return;
bub.hidden = true;
root.classList.remove('is-ping');
}
function showBubble(text, acts) {
if (!bub || root.classList.contains('is-open')) return;
bubT.textContent = text;
bubA.innerHTML = '';
acts.forEach((a, i) => {
let el;
if (a.href) { el = document.createElement('a'); el.href = a.href; if (/^https?:/.test(a.href)) { el.target = '_blank'; el.rel = 'noopener'; } }
else { el = document.createElement('button'); el.type = 'button'; }
el.textContent = a.label;
if (i === 0) el.className = 'is-main';
el.addEventListener('click', (e) => {
hideBubble();
if (a.ask) { e.preventDefault(); submit(a.ask); }
else if (a.open) { e.preventDefault(); open(); }
});
bubA.appendChild(el);
});
bub.hidden = false;
root.classList.add('is-ping');
clearTimeout(bubTimer);
bubTimer = setTimeout(hideBubble, 9000);
}
root.querySelector('[data-ai-bubble-x]')?.addEventListener('click', hideBubble);
window.ydShowBubble = showBubble;
window.ydHideBubble = hideBubble;
}
function initPresence(rt) {
const HINTS = {
hero: { delay: 6500, text: 'Привет! Я ИИ-консультант мастерской. Подсказать цену или график?', acts: [{ label: 'Сколько стоит переобуть R16?', ask: 'Сколько стоит переобуть R16?' }, { label: 'Открыть чат', open: true }] },
anatomy: { delay: 4000, text: 'Не уверены, что с колесом? Опишите словами — подскажу услугу и цену.', acts: [{ label: 'Спросить', open: true }] },
prices: { delay: 3500, text: 'Назовите диаметр — скажу цену переобувки. Например: «R17».', acts: [{ label: 'R16?', ask: 'Сколько стоит переобуть R16?' }, { label: 'R17?', ask: 'Сколько стоит переобуть R17?' }] },
finish: { delay: 2500, text: `Проложить маршрут до ул. Ленинградская, 2/1?`, acts: [{ label: 'Маршрут', href: b.links.yandexRoute }, { label: 'Позвонить', href: b.phone.href }] },
};
const shown = new Set();
try { (sessionStorage.getItem('yd-hints') || '').split(',').filter(Boolean).forEach((x) => shown.add(x)); } catch (e) {  }
let cur = '';
let timer = 0;
let hideT = 0;
let shownAt = -1;
const hide = () => { clearTimeout(hideT); shownAt = -1; if (window.ydHideBubble) window.ydHideBubble(); };
setInterval(() => {
if (shownAt >= 0 && rt.mobile && Math.abs(window.scrollY - shownAt) > innerHeight * 0.6) hide();
if (rt.active === cur) return;
cur = rt.active;
clearTimeout(timer);
hide();
const h = HINTS[cur];
if (!h || shown.has(cur)) return;
if (rt.mobile && (cur === 'anatomy' || cur === 'prices')) return;
const id = cur;
timer = setTimeout(() => {
if (rt.active !== id || !window.ydShowBubble) return;
shown.add(id);
try { sessionStorage.setItem('yd-hints', [...shown].join(',')); } catch (e) {  }
window.ydShowBubble(h.text, h.acts);
shownAt = window.scrollY;
clearTimeout(hideT);
hideT = setTimeout(hide, rt.mobile ? 7000 : 12000);
}, h.delay);
}, 500);
}
return { initChat, initPresence };
})();
/* src/js/main.js */
const __m25 = (() => {
const { rt, startLoop } = __m0;
const { initDirector } = __m6;
const { initStage, runIntro, initWheelHit } = __m8;
const { initHero } = __m9;
const { initAnatomy } = __m10;
const { initPrices } = __m11;
const { initWorks } = __m12;
const { initMileage, initCounters } = __m13;
const { initAsk, initFinish } = __m14;
const { initChrome } = __m15;
const { initStatus } = __m18;
const { initImages, initLightbox, initMap } = __m19;
const { initReveal } = __m20;
const { initChat, initPresence } = __m24;
const { emit } = __m16;
const safe = (fn, ...a) => {
try {
return fn(...a);
} catch (e) {
if (window.console) console.error('[ydenisa]', fn.name, e);
}
};
async function boot() {
startLoop();
[initImages, initStatus, initChat, initLightbox, initMap, initReveal, initCounters].forEach((f) => safe(f));
safe(initPresence, rt);
await safe(initStage);
[initDirector, initWheelHit, initChrome, initHero, initAnatomy, initPrices, initWorks, initMileage, initAsk, initFinish].forEach((f) => safe(f));
safe(runIntro);
document.addEventListener('click', (e) => {
const a = e.target.closest('a[href^="tel:"]');
if (a) emit('phone', { href: a.href });
});
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
return {  };
})();
})();
