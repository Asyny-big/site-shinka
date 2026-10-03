// DOM-помощники
export const $ = (sel, root) => (root || document).querySelector(sel);
export const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

const rmq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
export const reducedMotion = () => !!(rmq && rmq.matches);
export function onReducedMotionChange(fn) {
  if (rmq && rmq.addEventListener) rmq.addEventListener('change', fn);
}

export const isDesktop = () => matchMedia('(min-width: 900px)').matches;
export const isTouch = () => matchMedia('(hover: none)').matches;

/** Безопасные обёртки над sessionStorage (может быть недоступен) */
export function ssGet(k) {
  try { return sessionStorage.getItem(k); } catch (e) { return null; }
}
export function ssSet(k, v) {
  try { sessionStorage.setItem(k, v); } catch (e) { /* noop */ }
}

/** Плавная прокрутка к элементу с учётом шапки и reduced motion */
export function scrollToEl(el, offset) {
  if (!el) return;
  const hh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hh')) || 64;
  const y = el.getBoundingClientRect().top + window.scrollY - hh - (offset == null ? 12 : offset);
  window.scrollTo({ top: y, behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/** Событийная шина между компонентами */
export const emit = (name, detail) => document.dispatchEvent(new CustomEvent('yd:' + name, { detail }));
export const listen = (name, fn) => document.addEventListener('yd:' + name, (e) => fn(e.detail));
