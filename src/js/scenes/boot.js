/**
 * Запуск сцены: 3D-колесо (или запасной SVG), загрузчик «накачка», въезд колеса,
 * захват колеса мышью/пальцем.
 */
import { rt, onFrame, clamp, easeOut } from '../core/runtime.js';
import { WheelStage } from '../gl/stage.js';
import { business } from '../../data/business.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function initStage() {
  const canvas = document.querySelector('[data-gl]');
  const root = document.documentElement;
  if (!canvas) return;
  // шрифты нужны для надписей на боковине — ждём, но не дольше 1.2 с
  try {
    await Promise.race([
      Promise.all([document.fonts.load('900 64px "YD Display"'), document.fonts.load('700 24px "YD Mono"')]),
      wait(1200),
    ]);
  } catch (e) { /* noop */ }
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
      // тестовый режим: перемотка анимации колеса (для скриншотов на медленном GL)
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

/** Загрузчик «накачиваем колесо» + въезд колеса */
export async function runIntro() {
  const root = document.documentElement;
  const loader = document.querySelector('[data-loader]');
  const seen = root.classList.contains('seen');
  const atTop = window.scrollY < rt.vh * 0.5;
  try { sessionStorage.setItem('yd-intro', '1'); } catch (e) { /* noop */ }

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
  // колесо въезжает слева и катится на место (вращение — от качения)
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

/** Зона захвата колеса: крутить можно мышью и пальцем */
export function initWheelHit() {
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
