/**
 * Общее состояние «фильма»: окно, прокрутка, указатель, сцена с колесом,
 * подписчики на кадр. Один requestAnimationFrame на весь сайт.
 */
export const rt = {
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
export function onFrame(fn) { subs.push(fn); }
export function addMod(fn) { rt.mods.push(fn); }

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

export function startLoop() {
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

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
