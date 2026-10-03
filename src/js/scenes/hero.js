/**
 * HERO: буквы «ДЕЛАЕМ КРУГЛОЕ РОВНЫМ.» сначала кривые (как погнутый диск),
 * выправляются, когда колесо проезжает мимо. Курсор их снова «толкает»,
 * а при прокрутке строки разлетаются. Ценники привязаны к точкам 3D-колеса.
 */
import { rt, onFrame, clamp } from '../core/runtime.js';

export function initHero() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const chars = [...hero.querySelectorAll('.hero__st .ch')];
  const st = chars.map((el, i) => ({
    el,
    i,
    x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0,
    // «кривизна»: строки 1–3 по-разному
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
      // колесо проехало мимо буквы (или прошло время) → выправить
      if (!s.trued && ((rt.intro > 0.02 && w.x + w.r * 0.2 > s.cx) || since > 3.4 || rt.intro >= 1)) {
        s.trued = true;
        s.vy -= 260; // «щелчок»
      }
      let tx = s.trued ? 0 : s.ox;
      let ty = s.trued ? 0 : s.oy;
      let tr = s.trued ? 0 : s.or;
      // курсор толкает
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
      // выход при прокрутке: строки разлетаются вверх
      if (exitP > 0) {
        const line = s.el.parentElement.classList.contains('hero__ln--2') ? 1 : s.el.parentElement.classList.contains('hero__ln--3') ? 2 : 0;
        const k = clamp(exitP * 1.6 - (s.i % 7) * 0.04 - line * 0.08, 0, 1);
        ty -= k * k * rt.vh * 0.5;
        tx += (s.i % 2 ? 1 : -1) * k * 40;
        tr += (s.i % 3 - 1) * k * 40;
      }
      // пружина
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

/** Ценники, привязанные к точкам 3D-колеса (desktop) */
function initTags() {
  const box = document.querySelector('[data-tags]');
  if (!box) return;
  const items = [...box.querySelectorAll('[data-anchor]')];
  // точки в системе колеса без вращения: [угол φ от «12 часов» по часовой, радиус, z]
  const P = {
    tread: [0.42, 1.0, 0.05],
    stud: [-0.45, 0.995, 0.1],
    rim: [-2.05, 0.66, 0.1],
    set: [2.75, 1.0, 0.12],
  };
  // где подпись относительно точки (смещение по экрану)
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
        // без WebGL — простое расположение вокруг круга
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
    // сначала читаем геометрию (текст героя + подписи), потом пишем — без лишних перерасчётов раскладки
    const hits = collide();
    items.forEach((li, k) => {
      const [a, r, z] = P[li.dataset.anchor];
      const p = rt.stage.project([Math.sin(a) * r, Math.cos(a) * r, z], false);
      li.style.setProperty('--tx', p.x.toFixed(1) + 'px');
      li.style.setProperty('--ty', p.y.toFixed(1) + 'px');
      li.style.setProperty('--tl', OFF[li.dataset.anchor] + 'px');
      // подпись никогда не ложится поверх заголовка, текста и кнопок (низкие экраны ноутбуков)
      li.classList.toggle('is-hid', hits[k]);
    });
  });
}
