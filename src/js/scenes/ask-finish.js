/**
 * ИИ-сцена: колесо «прилипает» к центру орбиты, вопросы вращаются вокруг.
 * Финиш: колесо укатывается и оставляет след протектора; телефон «въезжает» цифрами.
 */
import { rt, onFrame, addMod, clamp, lerp } from '../core/runtime.js';

export function initAsk() {
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

  // колесо следует за центром орбиты (едет вместе с контентом)
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

export function initFinish() {
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

  // телефон «въезжает» по цифрам
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
