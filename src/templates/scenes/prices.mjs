import { esc, phoneIco, aiIco } from '../util.mjs';
import { priceText, minPrice, rub } from '../../data/business.js';

function bigPrice(p) {
  if (p.amount == null) return `<span class="big__text">${esc(p.text || 'уточняет мастер')}</span>`;
  return `${p.from ? '<span class="big__from">от</span>' : ''}<span class="big__num">${rub(p.amount)}</span><span class="big__cur">₽</span>`;
}

function panel(s, total, b, selected) {
  const first = s.prices[0];
  const opts = s.prices
    .map(
      (p, k) => `<label class="opt">
        <input type="radio" name="opt-${s.id}" value="${p.id}" ${k === 0 ? 'checked' : ''}
          data-amount="${p.amount ?? ''}" data-from="${p.from ? 1 : 0}" data-text="${esc(p.text || '')}" data-label="${esc(p.label)}">
        <span class="opt__l">${esc(p.label)}</span><i aria-hidden="true"></i><b class="opt__p">${esc(priceText(p))}</b>
      </label>`
    )
    .join('');
  const studs =
    s.control === 'studs'
      ? `<div class="studcalc" data-studcalc>
        <label class="studcalc__l mono" for="stud-n">Сколько шипов восстановить</label>
        <div class="studcalc__row">
          <button type="button" class="studcalc__b" data-stud-step="-1" aria-label="Меньше шипов">−</button>
          <input id="stud-n" type="number" inputmode="numeric" min="1" max="200" value="20" data-stud-n>
          <button type="button" class="studcalc__b" data-stud-step="1" aria-label="Больше шипов">+</button>
          <output class="studcalc__out" for="stud-n" data-stud-out>20 × 18 ₽ = 360 ₽</output>
        </div>
        <input class="studcalc__range" type="range" min="1" max="120" value="20" data-stud-range aria-label="Количество шипов">
        <p class="studcalc__note">Ориентир по цене «1 шип — 18 ₽». Колесо R14 целиком — от 1&nbsp;500&nbsp;₽. Итог называет мастер.</p>
      </div>`
      : '';
  const hint =
    s.control === 'diameter'
      ? '<p class="pnl__hint mono">↺ Выберите диаметр — колесо слева поменяет посадку диска</p>'
      : s.control === 'rimtype'
        ? '<p class="pnl__hint mono">↺ Выберите тип — колесо покажет штампованный или литой диск</p>'
        : '';
  return `
<article class="pnl" role="tabpanel" id="panel-${s.id}" aria-labelledby="tab-${s.id}" data-panel="${s.id}" ${selected ? '' : 'hidden'}>
  <p class="pnl__n mono"><span>${s.num}</span> / ${String(total).padStart(2, '0')} · ${s.group === 'bike' ? 'велосипеды' : 'автомобили'}</p>
  <h3 class="pnl__t">${esc(s.title)}</h3>
  <p class="pnl__d">${esc(s.desc)}</p>
  <p class="big" data-big aria-live="polite"><span class="big__label mono" data-big-label>${esc(first.label)}</span><span class="big__val" data-big-val>${bigPrice(first)}</span></p>
  ${hint}
  <fieldset class="opts">
    <legend class="sr-only">Варианты услуги «${esc(s.title)}»</legend>
    ${opts}
  </fieldset>
  ${studs}
  <p class="pnl__note">Где указано «от» — окончательную стоимость называет мастер.</p>
  <div class="pnl__cta">
    <a class="btn btn--ink btn--sm" href="${b.phone.href}" data-phone data-magnetic><span class="btn__in">${phoneIco}<span>Уточнить по телефону</span></span></a>
    <button class="btn btn--line-ink btn--sm" type="button" data-ai-ask="Расскажите про услугу «${esc(s.title)}»: что входит и сколько стоит?" data-magnetic><span class="btn__in">${aiIco}<span>Спросить ИИ</span></span></button>
  </div>
</article>`;
}

export function prices(b) {
  const total = b.services.length;
  const def = 'season';
  const labels = b.services
    .map((s, i) => {
      const m = minPrice(s);
      const p0 = s.prices[0];
      const tag = m ? priceText(m) : p0.text === 'уточняет мастер' ? 'цена — у мастера' : `${p0.label.toLowerCase()} ${p0.text}`;
      return `<button class="dl" role="tab" type="button" id="tab-${s.id}" aria-controls="panel-${s.id}" aria-selected="${s.id === def}" tabindex="${s.id === def ? 0 : -1}" data-service="${s.id}" data-i="${i}" data-cursor="Выбрать">
        <span class="dl__n mono">${s.num}</span><span class="dl__t">${esc(s.short)}</span><span class="dl__p mono">${esc(tag)}</span>
      </button>`;
    })
    .join('');
  const table = b.services
    .map(
      (s) => `<tbody><tr class="all__h"><th colspan="2" scope="rowgroup">${esc(s.title)}</th></tr>${s.prices
        .map((p) => `<tr><td>${esc(p.label)}</td><td>${esc(priceText(p))}</td></tr>`)
        .join('')}</tbody>`
    )
    .join('');

  return `
<section class="sc prices" id="prices" data-scene="prices" aria-labelledby="prices-title">
  <div class="prices__in">
    <header class="prices__head">
      <p class="mono prices__kick">Сцена 02 · колесо — это переключатель</p>
      <h2 class="prices__h" id="prices-title">Услуги<br>и&nbsp;цены</h2>
      <p class="prices__lead">${esc(b.about.servicesIntro)}</p>
    </header>

    <div class="dialsel" data-dialsel>
      <svg class="dialsel__ring" data-ring aria-hidden="true" viewBox="-100 -100 200 200"><circle r="98"/><g data-ring-ticks></g></svg>
      <div class="dialsel__labels" role="tablist" aria-label="Услуги" data-labels>${labels}</div>
      <p class="dialsel__hint mono" aria-hidden="true">↻ Крутите колесо — или выберите услугу</p>
    </div>

    <div class="board" data-px>
      ${b.services.map((s) => panel(s, total, b, s.id === def)).join('')}
    </div>
  </div>

  <details class="all">
    <summary><span class="mono">Таблица</span><span>Весь прайс одним списком</span></summary>
    <table class="all__t"><caption class="sr-only">Полный прайс «${esc(b.name)}»</caption>${table}</table>
  </details>
</section>`;
}
