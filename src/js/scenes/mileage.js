/**
 * ПРОБЕГ: стрелки приборов, счётчики, «лампы» на панели; отзывы дрейфуют
 * в разные стороны и наклоняются от скорости прокрутки.
 */
import { rt, onFrame, clamp } from '../core/runtime.js';

export function initMileage() {
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
    // наклон и дрейф — только «внутрь» экрана, чтобы текст отзыва никогда не уезжал за край
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

/** Счётчики 0 → значение (в HTML уже финальный текст — для SEO и без JS) */
export function initCounters() {
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
