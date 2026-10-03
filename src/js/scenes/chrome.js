/**
 * Оболочка: лимб-навигация (градусы = прогресс страницы), HUD, меню,
 * курсор-спутник, «магнитные» кнопки, логотип-колесо в шапке.
 */
import { rt, onFrame, clamp } from '../core/runtime.js';
import { sceneNav } from '../../data/scenes.js';

export function initChrome() {
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

/** Курсор-спутник: кольцо догоняет указатель, над активными элементами — подпись */
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

/** «Магнитные» кнопки: тянутся к курсору, внутренняя надпись — сильнее */
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
