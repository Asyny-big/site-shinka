import { esc, aiIco, closeIco, phoneIco, arrow } from '../util.mjs';
import { assistantCopy as c } from '../../data/assistant.js';

export function ask(b) {
  return `
<section class="sc ask" id="assistant" data-scene="ask" aria-labelledby="ask-title">
  <header class="ask__head">
    <p class="mono ask__kick"><span class="accent">Сцена 05</span> · ИИ-консультант</p>
    <h2 class="ask__h" id="ask-title">Мастерская отдыхает в&nbsp;воскресенье. <em>Ассистент — нет.</em></h2>
  </header>
  <ul class="orbit" data-orbit aria-label="Быстрые вопросы">
    ${c.quick.map((q, i) => `<li style="--i:${i}"><button type="button" class="chip chip--orbit" data-ai-ask="${esc(q)}" data-cursor="Спросить">${esc(q)}</button></li>`).join('')}
  </ul>
  <div class="ask__foot">
    <form class="ask__form" data-ai-inline>
      <label class="sr-only" for="ask-input">Вопрос ИИ-ассистенту</label>
      <input id="ask-input" name="q" type="text" maxlength="500" autocomplete="off" placeholder="${esc(c.placeholder)}">
      <button class="btn btn--accent" type="submit" data-magnetic><span class="btn__in">${aiIco}<span>Спросить</span></span></button>
    </form>
    <p class="ask__lead">Подскажет по&nbsp;услугам, ценам и&nbsp;графику — по&nbsp;данным этого сайта. Чего не&nbsp;знает — так и&nbsp;скажет и&nbsp;предложит позвонить мастеру.</p>
  </div>
</section>`;
}

/** Живой ассистент: «орб» + реплики + панель, раскрывающаяся диафрагмой */
export function dock(b) {
  return `
<div class="ai" data-ai data-state="idle">
  <div class="ai__bubble" data-ai-bubble role="status" aria-live="polite" hidden>
    <p data-ai-bubble-t></p>
    <div class="ai__bubble-acts" data-ai-bubble-acts></div>
    <button type="button" class="ai__bubble-x" data-ai-bubble-x aria-label="Скрыть подсказку">${closeIco}</button>
  </div>
  <button class="ai__orb" type="button" data-ai-toggle aria-expanded="false" aria-controls="ai-panel" data-cursor="ИИ">
    <span class="ai__eye" aria-hidden="true"><i data-ai-pupil></i></span>
    <span class="ai__ring" aria-hidden="true"></span>
    <span class="ai__say"><span class="ai__idle">${esc(c.idle)}</span><span class="ai__hover">${esc(c.hover)}</span></span>
    <span class="sr-only">Открыть ИИ-консультанта</span>
  </button>

  <section class="ai__panel" id="ai-panel" role="dialog" aria-modal="false" aria-labelledby="ai-title" hidden>
    <header class="ai__head">
      <span class="ai__eye ai__eye--sm" aria-hidden="true"><i></i></span>
      <div>
        <h2 class="ai__title" id="ai-title">${esc(c.title)}</h2>
        <p class="ai__sub mono" data-ai-mode>${esc(c.subtitle)}</p>
      </div>
      <button class="ai__close" type="button" data-ai-close aria-label="Закрыть чат">${closeIco}</button>
    </header>
    <div class="ai__log" data-ai-log role="log" aria-live="polite" aria-relevant="additions" tabindex="0"></div>
    <div class="ai__quick" data-ai-quick>
      ${c.quick.map((q) => `<button type="button" class="chip chip--sm" data-ai-q="${esc(q)}">${esc(q)}</button>`).join('')}
    </div>
    <form class="ai__form" data-ai-form>
      <label class="sr-only" for="ai-input">Ваш вопрос</label>
      <textarea id="ai-input" name="q" rows="1" maxlength="500" placeholder="${esc(c.placeholder)}" enterkeyhint="send"></textarea>
      <button class="ai__send" type="submit" aria-label="Отправить">${arrow}</button>
    </form>
    <p class="ai__foot mono">${esc(c.disclaimer)}</p>
  </section>
</div>

<nav class="mbar" aria-label="Быстрые действия">
  <a class="mbar__call" href="${b.phone.href}" data-phone>${phoneIco}<span>Позвонить</span></a>
  <a href="#prices"><b>₽</b><span>Цены</span></a>
  <button type="button" data-ai-open>${aiIco}<span>ИИ</span></button>
</nav>`;
}
