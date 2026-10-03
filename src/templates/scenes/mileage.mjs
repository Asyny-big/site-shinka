import { esc } from '../util.mjs';

/** Аналоговый прибор (SVG): шкала 240°, стрелка, цифры по кругу */
function gauge({ id, value, max, display, label, ticks = 10, big = false }) {
  const R = 100;
  const a0 = -120, a1 = 120;
  let marks = '';
  for (let i = 0; i <= ticks * 5; i++) {
    const a = ((a0 + ((a1 - a0) * i) / (ticks * 5)) * Math.PI) / 180;
    const major = i % 5 === 0;
    const r1 = major ? R - 16 : R - 9;
    marks += `<line class="${major ? 'mj' : ''}" x1="${(Math.sin(a) * r1).toFixed(1)}" y1="${(-Math.cos(a) * r1).toFixed(1)}" x2="${(Math.sin(a) * R).toFixed(1)}" y2="${(-Math.cos(a) * R).toFixed(1)}"/>`;
    if (major) {
      const n = Math.round((max * i) / (ticks * 5));
      const t = n >= 1000 ? `${n / 1000}k` : n;
      marks += `<text x="${(Math.sin(a) * (R - 30)).toFixed(1)}" y="${(-Math.cos(a) * (R - 30) + 4).toFixed(1)}">${t}</text>`;
    }
  }
  const redA = ((a0 + (a1 - a0) * 0.85) * Math.PI) / 180;
  const redB = (a1 * Math.PI) / 180;
  const arc = `M${(Math.sin(redA) * (R - 4)).toFixed(1)} ${(-Math.cos(redA) * (R - 4)).toFixed(1)} A${R - 4} ${R - 4} 0 0 1 ${(Math.sin(redB) * (R - 4)).toFixed(1)} ${(-Math.cos(redB) * (R - 4)).toFixed(1)}`;
  return `
  <figure class="gauge ${big ? 'gauge--big' : ''}" data-gauge data-value="${value}" data-max="${max}" id="${id}">
    <svg viewBox="-110 -110 220 190" aria-hidden="true">
      <path class="gauge__red" d="${arc}"/>
      <g class="gauge__marks">${marks}</g>
      <g class="gauge__needle" data-needle style="--a:${a0}deg"><path d="M-3 12 L0 -86 L3 12 Z"/></g>
      <circle class="gauge__hub" r="9"/>
    </svg>
    <figcaption>
      <span class="gauge__v" data-count="${value}" data-suffix="+">${esc(display)}</span>
      <span class="gauge__l mono">${esc(label)}</span>
    </figcaption>
  </figure>`;
}

export function mileage(b) {
  const f = Object.fromEntries(b.facts.map((x) => [x.label, x]));
  const cars = f['обслуженных авто'];
  const bikes = f['велосипедов'];
  const years = f['лет опыта'];
  const week = f['дней в неделю'];
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  return `
<section class="sc mileage" id="about" data-scene="mileage" aria-labelledby="about-title">
  <header class="mileage__head">
    <p class="mono mileage__kick"><span class="accent">Сцена 04</span> · приборная панель мастерской</p>
    <h2 class="mileage__h" id="about-title">О&nbsp;нас</h2>
  </header>

  <div class="dash" data-dash>
    ${gauge({ id: 'g-cars', value: cars.value, max: 20000, display: cars.display, label: 'обслуженных авто · пробег мастерской', ticks: 4, big: true })}
    <div class="dash__mid">
      <div class="lcd">
        <p class="lcd__k mono">Опыт</p>
        <p class="lcd__v"><b data-count="${years.value}" data-suffix="+">${esc(years.display)}</b> <span>лет</span></p>
        <div class="lcd__bar" aria-hidden="true"><i style="--w:100%"></i></div>
      </div>
      <div class="lcd">
        <p class="lcd__k mono">Работаем</p>
        <p class="lcd__v"><b>${esc(week.display)}</b> <span>${esc(week.label)}</span></p>
        <ol class="lcd__days" aria-label="${esc(b.hours.text)}, ${esc(b.hours.dayOff)}">${dayNames.map((d, i) => `<li class="${i < 6 ? 'on' : ''}">${d}</li>`).join('')}</ol>
      </div>
      <ul class="lamps" aria-label="Почему выбирают нас">
        ${b.about.why.map((w) => `<li><i aria-hidden="true"></i>${esc(w)}</li>`).join('')}
      </ul>
    </div>
    ${gauge({ id: 'g-bikes', value: bikes.value, max: 600, display: bikes.display, label: 'велосипедов', ticks: 6 })}
  </div>

  <div class="mileage__about">
    <p class="mileage__lead">${esc(b.about.lead)}</p>
    <p>${esc(b.about.text)}</p>
  </div>

  <div class="revs" id="reviews">
    <header class="revs__head">
      <p class="mono"><span class="accent">Отзывы</span> · что говорят в Сарапуле</p>
      <h2 class="revs__h">Отзывы клиентов «Шиномонтажа у&nbsp;Дениса»</h2>
      <p class="revs__lead">Что говорят о&nbsp;нас жители Сарапула и&nbsp;близлежащих районов</p>
    </header>
    <ol class="revs__list">
      ${b.reviews
        .map(
          (r, i) => `<li class="rv" data-drift="${i % 2 ? -1 : 1}">
        <figure>
          <blockquote class="rv__q"><p>${esc(r.text)}</p></blockquote>
          <figcaption class="rv__by mono">
            <span class="rv__name">${esc(r.name)}</span>
            <time datetime="${r.date}">${esc(r.dateText)}</time>
            <span class="stars" role="img" aria-label="Оценка ${r.rating} из 5">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= r.rating ? 'on' : ''}"></i>`).join('')}</span>
          </figcaption>
        </figure>
      </li>`
        )
        .join('')}
    </ol>
    <p class="revs__more">
      <a class="btn btn--line-ink btn--sm" href="${b.links.avito}" target="_blank" rel="noopener" data-magnetic><span class="btn__in">Мы на Авито — услуги и отзывы ↗</span></a>
      <a class="btn btn--line-ink btn--sm" href="${b.links.yandexMaps}" target="_blank" rel="noopener" data-magnetic><span class="btn__in">Мы на Яндекс Картах ↗</span></a>
    </p>
  </div>
</section>`;
}
