/**
 * Шейдеры колеса. Пишутся в стиле GLSL ES 1.00 и при WebGL2
 * автоматически переводятся в 300 es (см. engine).
 * Протектор, спицы и буквы на боковине — процедурные в полярных
 * координатах, поэтому «настоящий» motion blur вращения получается
 * усреднением по углу (uBlur — ширина окна в радианах).
 */
export const VERT = `
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

export const FRAG = `
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

// x — покрытие (есть металл), y — «высота» для фаски/скругления
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
    // ---------- ШИНА ----------
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
    // кромка у борта и «ободок»
    float ring = 1.0 - smoothstep(0.0, 0.004, abs(r - (uRimR + 0.035)));
    base += vec3(0.006) * ring;
    col = shadeRubber(N, V, base, letters * 0.6);

    // шипы
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
    // гвоздь (прокол)
    if (uNail > 0.01) {
      float dn = length(vec2(angd(th, uNailA) * r, o.z - 0.06));
      float head = (1.0 - smoothstep(0.03, 0.036, dn)) * isTread;
      col = mix(col, shadeMetal(N, V, vec3(0.8), 0.3), head * uNail);
      float glow = (1.0 - smoothstep(0.0, 0.012, abs(dn - (0.07 + pulse * 0.03)))) * isTread;
      col += uAcc * glow * uNail * 1.4;
    }
    // грыжа
    if (uBulge > 0.01 && o.z > 0.0) {
      float d = length(vec2(angd(th, uBulgeA) * r, (r - 0.82) * 1.0));
      float g = (1.0 - smoothstep(0.0, 0.016, abs(d - (0.11 + pulse * 0.02))));
      col += uAcc * g * uBulge * 1.3;
    }
    // боковой порез
    if (uCut > 0.01 && o.z > 0.0) {
      float a = angd(th, -1.1);
      float cut = (1.0 - smoothstep(0.0, 0.006, abs(a * r * 0.6 - (r - 0.8) * 0.25))) * step(abs(r - 0.8), 0.07);
      col = mix(col, vec3(0.0), cut * uCut);
      float g = 1.0 - smoothstep(0.0, 0.014, abs(length(vec2(a * r, r - 0.8)) - (0.12 + pulse * 0.02)));
      col += uAcc * g * uCut * 1.2;
    }
    // подсветки зон
    float fr = pow(1.0 - max(dot(N, V), 0.0), 2.0);
    col += uAcc * (uHi.x * isTread + uHi.y * (1.0 - isTread) * step(0.0, o.z)) * (0.25 + fr * 0.8) * (0.6 + 0.4 * pulse);
  } else if (uMat < 1.5) {
    // ---------- ДИСК ----------
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
    // гайки и колпачок
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
    // балансировочный грузик
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
    // ---------- ТОРМОЗНОЙ ДИСК ----------
    float seg = TAU / 30.0;
    float a = mod(th + floor(r * 40.0) * 0.07, seg) - seg * 0.5;
    float row = abs(fract((r - 0.27) / 0.06) - 0.5);
    float hole = (1.0 - smoothstep(0.008, 0.011, length(vec2(a * r, row * 0.06)))) * step(0.25, r) * step(r, 0.45);
    float brushed = 0.85 + 0.15 * hash(vec2(floor(r * 260.0), 1.0));
    vec3 base = vec3(0.3) * brushed * (1.0 - hole * 0.85);
    if (r < 0.2) base = vec3(0.12);
    col = shadeMetal(N, V, base, 0.55);
  } else if (uMat < 3.5) {
    // ---------- СУППОРТ ----------
    col = shadeRubber(N, V, uAcc * 0.55, 1.0);
    col += shadeMetal(N, V, uAcc * 0.5, 0.2) * 0.5;
  } else if (uMat < 4.5) {
    // ---------- ВЕЛО-ШИНА ----------
    float knob = step(0.5, fract(t * 140.0)) * step(0.5, fract(o.z * 30.0 + 0.25)) * smoothstep(0.985, 0.995, r);
    float h = 1.0 - knob * 0.5;
    N = bumpN(N, vW, h, 0.006);
    col = shadeRubber(N, V, vec3(0.04) * (0.7 + 0.3 * h), 0.2);
    float fr = pow(1.0 - max(dot(N, V), 0.0), 2.0);
    col += uAcc * uHi.x * (0.25 + fr) * (0.6 + 0.4 * pulse);
  } else {
    // ---------- ВЕЛО-МЕТАЛЛ (обод / спицы / втулка) ----------
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
