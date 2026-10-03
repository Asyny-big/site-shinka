import { $, $$ } from '../utils/dom.js';
import { business } from '../../data/business.js';

/**
 * Фото: если локальной копии нет (например, сайт ещё не получил /images),
 * берём оригинал с живого ydenisa.ru; если и его нет — показываем
 * аккуратную «пустую плёнку» с подписью, а не битую картинку.
 */
export function initImages() {
  const handle = (img) => {
    const fb = img.dataset.fallback;
    if (fb && !img.dataset.triedFallback && img.getAttribute('src') !== fb) {
      img.dataset.triedFallback = '1';
      img.src = fb;
      return;
    }
    const f = img.closest('.frame, .face');
    if (f) f.classList.add('is-missing');
  };
  $$('img[data-fallback]').forEach((img) => {
    img.addEventListener('error', () => handle(img));
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) handle(img);
  });
}

/** Лайтбокс на <dialog> */
export function initLightbox() {
  const dlg = $('[data-lb]');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  const img = $('[data-lb-img]', dlg);
  const capN = $('[data-lb-n]', dlg);
  const cap = $('[data-lb-cap]', dlg);
  const photos = business.photos;
  let i = 0;
  let opener = null;

  const show = (k) => {
    i = (k + photos.length) % photos.length;
    const p = photos[i];
    const thumb = $$('[data-lb-open] img')[i];
    img.src = thumb && thumb.currentSrc ? thumb.currentSrc : p.src;
    img.alt = p.alt;
    capN.textContent = `К-${String(i + 1).padStart(2, '0')} / ${p.tag}`;
    cap.textContent = p.caption;
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lb-open]');
    if (!b) return;
    if (b.closest('.frame, .face')?.classList.contains('is-missing')) return;
    opener = b;
    show(Number(b.dataset.lbOpen));
    dlg.showModal();
  });
  $('[data-lb-prev]', dlg).addEventListener('click', () => show(i - 1));
  $('[data-lb-next]', dlg).addEventListener('click', () => show(i + 1));
  $('[data-lb-close]', dlg).addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') show(i + 1);
    if (e.key === 'ArrowLeft') show(i - 1);
  });
  dlg.addEventListener('close', () => opener && opener.focus());
}

/** Яндекс-карта: iframe подгружается только при приближении или по кнопке */
export function initMap() {
  const box = $('[data-map]');
  if (!box) return;
  let done = false;
  const load = () => {
    if (done) return;
    done = true;
    const f = document.createElement('iframe');
    f.src = box.dataset.src;
    f.title = `Карта: ${business.name}, ${business.address.full}`;
    f.loading = 'lazy';
    f.allowFullscreen = true;
    f.referrerPolicy = 'no-referrer-when-downgrade';
    box.appendChild(f);
  };
  $('[data-map-load]', box)?.addEventListener('click', load);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { load(); io.disconnect(); } }, { rootMargin: '300px 0px' });
    io.observe(box);
  }
}
