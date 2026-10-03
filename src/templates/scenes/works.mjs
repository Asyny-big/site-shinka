import { esc, closeIco } from '../util.mjs';

export function works(b) {
  const n = b.photos.length;
  const faces = b.photos
    .map((p, i) => {
      const k = String(i + 1).padStart(2, '0');
      return `
      <figure class="face" style="--i:${i}" data-face="${i}">
        <button class="face__btn" type="button" data-lb-open="${i}" aria-label="Открыть фото: ${esc(p.caption)}" data-cursor="Смотреть">
          <span class="face__img">
            <img src="${p.src}" data-fallback="${b.remoteImageBase}${p.src}" alt="${esc(p.alt)}" loading="lazy" decoding="async" width="${p.w || 1200}" height="${p.h || 900}">
            <span class="face__ph" aria-hidden="true"><span class="mono">Кадр ${k}</span><b>${esc(p.tag)}</b><span>${esc(p.caption)}</span></span>
          </span>
          <span class="face__n mono" aria-hidden="true">К-${k}</span>
        </button>
        <figcaption class="face__cap"><span class="mono">К-${k} / ${esc(p.tag)}</span> ${esc(p.caption)}${i === 0 ? ` <span class="mono face__geo">${b.geo.lat.toFixed(4)}° N · ${b.geo.lon.toFixed(4)}° E</span>` : ''}</figcaption>
      </figure>`;
    })
    .join('');

  return `
<section class="sc works" id="works" data-scene="works" style="--n:${n}" aria-labelledby="works-title">
  <div class="works__pin">
    <header class="works__head">
      <p class="mono works__kick"><span class="accent">Сцена 03</span> · не сток, не рендер</p>
      <h2 class="works__h" id="works-title">Шиномонтаж у&nbsp;Дениса — наша мастерская</h2>
      <p class="works__lead">Реальные фотографии входа, оборудования и&nbsp;рабочего процесса. ${esc(b.address.full)}.</p>
    </header>
    <div class="drum" data-drum>
      <div class="drum__cyl" data-drum-cyl>${faces}</div>
    </div>
    <div class="works__ctrl">
      <button class="rbtn" type="button" data-drum-prev aria-label="Предыдущий кадр">←</button>
      <p class="works__count mono" aria-live="polite"><b data-drum-n>01</b> / ${String(n).padStart(2, '0')}</p>
      <button class="rbtn" type="button" data-drum-next aria-label="Следующий кадр">→</button>
    </div>
  </div>

  <dialog class="lb" data-lb aria-label="Просмотр фотографии">
    <div class="lb__frame">
      <img data-lb-img alt="">
      <p class="lb__cap"><span class="mono" data-lb-n></span><span data-lb-cap></span></p>
    </div>
    <button class="lb__btn lb__prev" type="button" data-lb-prev aria-label="Предыдущее фото">←</button>
    <button class="lb__btn lb__next" type="button" data-lb-next aria-label="Следующее фото">→</button>
    <button class="lb__btn lb__close" type="button" data-lb-close aria-label="Закрыть">${closeIco}</button>
  </dialog>
</section>`;
}
