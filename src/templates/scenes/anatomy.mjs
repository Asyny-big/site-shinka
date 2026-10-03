import { esc, phoneIco, aiIco, arrow } from '../util.mjs';
import { findPrice, priceText } from '../../data/business.js';
import { anatomySteps } from '../../data/scenes.js';

export function anatomy(b) {
  const n = anatomySteps.length;
  const steps = anatomySteps
    .map((s, i) => {
      const rows = s.priceIds
        .map((id) => findPrice(id))
        .map(({ price }) => `<li><span>${esc(price.label)}</span><i aria-hidden="true"></i><b>${esc(priceText(price))}</b></li>`)
        .join('');
      return `
      <li class="step" data-step="${i}" id="step-${s.id}">
        <p class="step__k mono"><b>0${i + 1}</b> / 0${n} · ${esc(s.part)}</p>
        <h3 class="step__t">${esc(s.title)}</h3>
        <p class="step__d">${esc(s.text)}</p>
        <ul class="rows step__rows">${rows}</ul>
        <p class="step__n">${esc(s.note)}</p>
        <div class="step__acts">
          <a class="btn btn--accent btn--sm" href="#prices" data-goto-service="${s.service}" data-goto-option="${s.priceIds[0]}" data-magnetic><span class="btn__in"><span>В прайс</span>${arrow}</span></a>
          <button class="btn btn--line btn--sm" type="button" data-ai-ask="${esc(s.title)} — что делать и сколько стоит?" data-magnetic><span class="btn__in">${aiIco}<span>Спросить ИИ</span></span></button>
          <a class="btn btn--line btn--sm btn--icon" href="${b.phone.href}" data-phone aria-label="Позвонить" data-magnetic><span class="btn__in">${phoneIco}</span></a>
        </div>
      </li>`;
    })
    .join('');

  return `
<section class="sc anat" id="help" data-scene="anatomy" style="--steps:${n}" aria-labelledby="anat-title">
  <span class="alias" id="services" aria-hidden="true"></span>
  <div class="anat__pin">
    <header class="anat__head">
      <p class="mono anat__kick"><span class="accent">Сцена 01</span> · путешествие вокруг колеса</p>
      <h2 class="anat__h" id="anat-title">Что случилось<br>с&nbsp;колесом?</h2>
    </header>
    <ol class="anat__steps" data-steps>${steps}</ol>
    <nav class="anat__nav" aria-label="Части колеса">
      ${anatomySteps.map((s, i) => `<a href="#step-${s.id}" data-step-go="${i}"><span class="mono">0${i + 1}</span><span>${esc(s.part)}</span></a>`).join('')}
    </nav>
    <div class="callout" data-callout aria-hidden="true"><svg class="callout__l"><path data-callout-path/></svg><i class="callout__dot"></i><span class="callout__t mono" data-callout-t></span></div>
  </div>
</section>`;
}
