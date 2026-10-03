import { esc, phoneIco, pinIco, extIco, arrow, aiIco } from '../util.mjs';
import { buildFaq } from '../faq.mjs';

const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function finish(b) {
  const faq = buildFaq(b);
  const week = days
    .map((d, i) => {
      const dow = (i + 1) % 7;
      const open = b.hours.workdays.includes(dow);
      return `<li data-dow="${dow}" class="${open ? '' : 'off'}"><span>${d}</span><b>${open ? `${b.hours.open.replace(/^0/, '')}–${b.hours.close}` : 'выходной'}</b></li>`;
    })
    .join('');
  const trackPath = 'M -80 180 C 260 170, 420 60, 720 90 S 1180 250, 1520 150';
  return `
<section class="sc finish" id="contacts" data-scene="finish" aria-labelledby="contacts-title">
  <svg class="track" viewBox="0 0 1440 300" preserveAspectRatio="none" aria-hidden="true" data-track>
    <defs>
      <mask id="track-mask" maskUnits="userSpaceOnUse"><path d="${trackPath}" class="track__mask" data-track-mask pathLength="1"/></mask>
    </defs>
    <g mask="url(#track-mask)">
      <path d="${trackPath}" class="track__edge" transform="translate(0,-26)"/>
      <path d="${trackPath}" class="track__tread"/>
      <path d="${trackPath}" class="track__edge" transform="translate(0,26)"/>
    </g>
  </svg>

  <header class="finish__head">
    <p class="mono finish__kick"><span class="accent">Сцена 06</span> · след ведёт сюда</p>
    <h2 class="finish__h" id="contacts-title">Контакты</h2>
    <p class="finish__lead">Приезжайте в&nbsp;«Шиномонтаж у&nbsp;Дениса» в&nbsp;Сарапуле</p>
  </header>

  <a class="bigphone" href="${b.phone.href}" data-phone data-cursor="Звонить" aria-label="Позвонить: ${esc(b.phone.display)}">
    <span class="bigphone__k mono">Телефон · звонок в одно касание</span>
    <span class="bigphone__n" data-phone-roll>${esc(b.phone.display)}</span>
  </a>

  <div class="cgrid">
    <address class="cbox cbox--addr">
      <span class="cbox__k mono">${pinIco} Адрес</span>
      <span class="cbox__v">${esc(b.address.full)}</span>
      <span class="cbox__acts">
        <a class="btn btn--ink btn--sm" href="${b.links.yandexRoute}" target="_blank" rel="noopener" data-magnetic><span class="btn__in"><span>Маршрут</span>${extIco}</span></a>
        <a class="btn btn--line-ink btn--sm" href="${b.links.yandexMaps}" target="_blank" rel="noopener" data-magnetic><span class="btn__in"><span>Яндекс Карты</span>${extIco}</span></a>
      </span>
    </address>
    <div class="cbox cbox--hours">
      <span class="cbox__k mono">Время работы</span>
      <p class="cbox__v">${esc(b.hours.text)}<br><span class="muted">${esc(b.hours.dayOff)}</span></p>
      <ul class="week" data-week aria-label="График по дням">${week}</ul>
      <p class="status status--lg" data-status><i class="status__dot" aria-hidden="true"></i><span data-status-text>${esc(b.hours.text)}</span></p>
    </div>
    <div class="cbox cbox--ai">
      <span class="cbox__k mono">${aiIco} ИИ-ассистент</span>
      <p class="cbox__v cbox__v--sm">Подскажет по&nbsp;услугам, ценам и&nbsp;графику. Кнопка «ИИ» всегда под рукой.</p>
      <button class="btn btn--line-ink btn--sm" type="button" data-ai-open data-magnetic><span class="btn__in"><span>Открыть чат</span>${arrow}</span></button>
    </div>
    <a class="cbox cbox--avito" href="${b.links.avito}" target="_blank" rel="noopener" data-cursor="Авито">
      <span class="cbox__k mono">Мы на Авито</span>
      <span class="cbox__v cbox__v--sm">Смотрите наши услуги и&nbsp;отзывы</span>
      <span class="cbox__go">Перейти ${extIco}</span>
    </a>
    <div class="map" data-map data-src="${esc(b.links.yandexWidget)}">
      <div class="map__ph">
        <svg class="map__grid" viewBox="0 0 400 260" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
          <path d="M0 40H400M0 100H400M0 160H400M0 220H400M60 0V260M150 0V260M240 0V260M330 0V260"/>
          <path class="map__road" d="M-10 190 C 90 170, 160 120, 210 130 S 330 90, 410 60"/>
          <circle class="map__pin" cx="210" cy="130" r="9"/><circle class="map__ring" cx="210" cy="130" r="22"/>
        </svg>
        <button class="btn btn--ink btn--sm map__load" type="button" data-map-load><span class="btn__in">${pinIco}<span>Показать карту</span></span></button>
      </div>
    </div>
  </div>

  <div class="faq">
    <h2 class="faq__title">Частые вопросы</h2>
    <div class="faq__list">
      ${faq.map((f) => `<details class="faq__i"><summary>${esc(f.q)}<span class="pm" aria-hidden="true"></span></summary><p>${esc(f.a)}</p></details>`).join('')}
    </div>
  </div>

  <article class="seo" id="seo-text" aria-labelledby="seo-title">
    <p class="mono seo__k">О компании</p>
    <h2 class="seo__title" id="seo-title">${esc(b.seo.textHeading)}</h2>
    <div class="seo__cols">${b.seo.textHtml.map((t) => `<p>${t}</p>`).join('')}
      <p>Звоните: <a href="${b.phone.href}" data-phone><strong>${esc(b.phone.display)}</strong></a>.</p>
    </div>
  </article>
</section>`;
}

export function footer(b) {
  const year = new Date().getFullYear();
  return `
<footer class="foot">
  <div class="stamp" aria-label="Реквизиты">
    <div class="stamp__c stamp__name"><span class="mono">Объект</span><b>${esc(b.name)}</b></div>
    <div class="stamp__c"><span class="mono">Адрес</span>${esc(b.address.full)}</div>
    <div class="stamp__c"><span class="mono">Телефон</span><a href="${b.phone.href}" data-phone>${esc(b.phone.display)}</a></div>
    <div class="stamp__c"><span class="mono">График</span>${esc(b.hours.text)}<br>${esc(b.hours.dayOff)}</div>
    <div class="stamp__c stamp__s"><span class="mono">Оборот</span>360°</div>
    <div class="stamp__c stamp__s"><span class="mono">Сцен</span>07</div>
    <div class="stamp__c stamp__s"><span class="mono">Масштаб</span>1:1</div>
    <div class="stamp__c stamp__copy">© ${year} ${esc(b.name)} · ${esc(b.city)}</div>
  </div>
  <p class="foot__links mono">
    <a href="${b.links.avito}" target="_blank" rel="noopener">Авито ↗</a>
    <a href="${b.links.yandexMaps}" target="_blank" rel="noopener">Яндекс Карты ↗</a>
    <a href="#top">Наверх ↑</a>
  </p>
</footer>`;
}
