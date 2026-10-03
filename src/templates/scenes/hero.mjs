import { esc, phoneIco, aiIco, arrow } from '../util.mjs';
import { findPrice, priceText } from '../../data/business.js';

/** Слова → буквы (для кинетики). Пробелы сохраняются. */
function letters(word) {
  return [...word].map((ch) => `<span class="ch" aria-hidden="true">${ch}</span>`).join('');
}

export function hero(b) {
  const p = (id) => priceText(findPrice(id).price);
  // подписи, привязанные к точкам 3D-колеса (якоря задаёт JS)
  const tags = [
    { anchor: 'tread', service: 'repair', option: 'plug', k: 'Протектор', v: `ремонт ${p('plug')}` },
    { anchor: 'stud', service: 'studs', option: 'stud', k: 'Шипы', v: `${p('stud')} / шип` },
    { anchor: 'rim', service: 'rims', option: 'steel', k: 'Диск', v: `правка ${p('steel')}` },
    { anchor: 'set', service: 'season', option: 'r13', k: 'Комплект', v: `переобувка ${p('r13')}` },
  ];
  const lines = ['Делаем', 'круглое', 'ровным.'];
  return `
<section class="sc hero" id="top" data-scene="hero" aria-labelledby="hero-title">
  <div class="hero__in">
    <p class="hero__kicker mono" aria-hidden="true"><span class="accent">Сцена 00</span><span>Один оборот колеса = весь сайт</span></p>
    <h1 class="hero__h" id="hero-title">
      <span class="hero__eyebrow">Шиномонтаж в&nbsp;Сарапуле — у&nbsp;Дениса</span>
      <span class="hero__st" data-true>
        <span class="sr-only">Делаем круглое ровным.</span>
        ${lines.map((l, i) => `<span class="hero__ln hero__ln--${i + 1}" aria-hidden="true">${letters(l)}</span>`).join('')}
      </span>
    </h1>
    <p class="hero__lead">Обслуживание автомобилей и&nbsp;велосипедов. Качественно, быстро, с&nbsp;гарантией. Работаем 6&nbsp;дней в&nbsp;неделю.</p>
    <p class="hero__where mono">
      <span>${esc(b.address.full)}</span>
      <span class="status" data-status><i class="status__dot" aria-hidden="true"></i><span data-status-text>${esc(b.hours.text)}</span></span>
    </p>
    <div class="hero__cta">
      <a class="btn btn--accent btn--xl" href="${b.phone.href}" data-phone data-magnetic data-cursor="Звонить"><span class="btn__in">${phoneIco}<span>Позвонить</span><span class="btn__aux">${esc(b.phone.display)}</span></span></a>
      <a class="btn btn--line" href="#prices" data-magnetic data-cursor="Цены"><span class="btn__in"><span>Все цены</span>${arrow}</span></a>
      <button class="btn btn--line btn--ai" type="button" data-ai-open data-magnetic data-cursor="Спросить"><span class="btn__in">${aiIco}<span>Спросить ИИ</span></span></button>
    </div>
  </div>

  <ul class="tags" data-tags aria-label="Цены коротко">
    ${tags
      .map(
        (t) => `<li class="tag" data-anchor="${t.anchor}">
      <a href="#prices" data-goto-service="${t.service}" data-goto-option="${t.option}" data-cursor="В прайс">
        <span class="tag__k mono">${esc(t.k)}</span><span class="tag__v">${esc(t.v)}</span>
      </a>
    </li>`
      )
      .join('')}
  </ul>
  <p class="hero__hint mono" data-wheel-hint aria-hidden="true"><span>↻</span> Колесо можно крутить</p>
  <ul class="hero__promises mono" aria-label="Коротко о мастерской">
    ${b.promises.map((x, i) => `<li><span>0${i + 1}</span><b>${esc(x.key)}</b> ${esc(x.value)}</li>`).join('')}
  </ul>
</section>`;
}
