/**
 * РЕЖИССЁР. Связывает прокрутку со сценой:
 *  — ключевые кадры колеса (позиция, масштаб, ракурс, режим) по всей странице;
 *  — фон павильона и заливки-«диафрагмы» на стыках сцен;
 *  — огромные слова, проходящие через экран за колесом;
 *  — цвет шапки/HUD под текущий фон.
 * Всё — чистые функции от scrollY, поэтому прокрутка назад работает так же.
 */
import { rt, onFrame, clamp, lerp, smooth, easeOut } from './runtime.js';
import { DEFAULT_STATE } from '../gl/stage.js';
import { passWords } from '../../data/scenes.js';

const C = { ink: '#0d0d0c', acc: '#ff4f12', paper: '#ebe8e1' };
const DARK = { ink: true, acc: false, paper: false };
const BG = { hero: 'ink', anatomy: 'ink', prices: 'acc', works: 'ink', mileage: 'paper', ask: 'ink', finish: 'paper' };

const HERO = { x: 0.5, y: -0.04, s: 0.76, yaw: -20, pitch: 5, idle: 0.14, tilt: 1, mouseK: 1, alpha: 1, mode: 0, nail: 0, bulge: 0, cut: 0, studs: 0, weight: 0, hiTread: 0, hiSide: 0, hiRim: 0, hiStud: 0, wobble: 0 };
const HERO_M = { ...HERO, x: 0.3, y: -0.78, s: 0.82, yaw: -16 };

/** Состояния шагов «анатомии» */
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

/** Ключевые кадры по сценам: g = {top, h, vh}. Возвращают [{y, s}] */
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
  // ключевые кадры
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
  // стыки сцен: заливка и проходящее слово
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

/** Экранная позиция колеса по состоянию (без перспективы — достаточно для HTML-привязок) */
function screenOf(s) {
  return { x: (s.x * 0.5 + 0.5) * rt.vw, y: (0.5 - s.y * 0.5) * rt.vh, r: (s.s * rt.vh) / 2, a: s.alpha };
}

export function initDirector() {
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
    // --- присутствие и прогресс сцен
    let active = rt.scenes[0] && rt.scenes[0].id;
    rt.scenes.forEach((sc) => {
      const p = clamp((y - sc.top) / Math.max(1, sc.h - vh), 0, 1);
      rt.progress[sc.id] = p;
      const vis = clamp(Math.min(y + vh - sc.top, sc.top + sc.h - y) / (vh * 0.5), 0, 1);
      rt.weights[sc.id] = vis;
      if (y + vh * 0.45 >= sc.top) active = sc.id;
    });
    rt.active = active;

    // --- целевое состояние колеса
    const st = { ...sample(y) };
    // въезд колеса в начале (интро)
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
      // запасной SVG: только позиция, масштаб и вращение
      const w = screenOf(st);
      rt.wheel = w;
      svgWrap.style.setProperty('--svx', w.x + 'px');
      svgWrap.style.setProperty('--svy', w.y + 'px');
      svgWrap.style.setProperty('--svs', w.r * 2 + 'px');
      svgWrap.style.opacity = st.alpha;
      if (!rt.reduced) svgSpinA += (st.idle * dt + rt.vel * 0.003) * 57.3;
      svgSpin.setAttribute('transform', `rotate(${svgSpinA.toFixed(1)})`);
    }

    // --- тень под колесом (когда оно «на земле»)
    if (shadow) {
      const w = rt.wheel;
      const grounded = rt.active === 'hero' || rt.active === 'finish' || rt.active === 'ask' ? 1 : 0;
      shadow.style.setProperty('--sx', w.x + 'px');
      shadow.style.setProperty('--sy', w.y + w.r * 0.98 + 'px');
      shadow.style.setProperty('--sw', w.r * 1.9 + 'px');
      shadow.style.setProperty('--so', (grounded * clamp(w.a, 0, 1) * 0.9).toFixed(2));
    }

    // --- фон и заливка
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

    // --- проходящее слово
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

export function sceneTop(id) {
  const s = rt.scenes.find((x) => x.id === id);
  return s ? s.top : 0;
}
