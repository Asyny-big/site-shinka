import { $$, reducedMotion } from '../utils/dom.js';

/** Появление блоков, которые не управляются сценами напрямую */
export function initReveal() {
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
