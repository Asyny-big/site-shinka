// «Оболочка» опыта: сцена с колесом, шапка, лимб-навигация, HUD, загрузчик, курсор, меню
import { esc, phoneIco, aiIco, closeIco } from '../util.mjs';
import { sceneNav } from '../../data/scenes.js';
import { carWheelSVG } from '../../js/components/wheel-svg.js';

const mark = `<svg class="mark" viewBox="-50 -50 100 100" aria-hidden="true">
  <circle r="42" class="mark__tire"/><circle r="26" class="mark__rim"/>
  <path class="mark__spokes" d="M0-24V-9M22.8-7.4L8.6-2.8M14.1 19.4L5.3 7.3M-14.1 19.4L-5.3 7.3M-22.8-7.4L-8.6-2.8"/>
  <circle r="6" class="mark__hub"/><circle cx="0" cy="-34" r="3.4" class="mark__dot"/>
</svg>`;

export function stage() {
  return `
<div class="stage" aria-hidden="true">
  <div class="stage__bg" data-bg></div>
  <div class="stage__flood" data-flood></div>
  <div class="stage__grid"></div>
  <div class="stage__title" data-stage-title></div>
  <div class="stage__word" data-word><span data-word-t></span></div>
  <div class="stage__shadow" data-shadow></div>
  <canvas class="stage__gl" data-gl></canvas>
  <div class="stage__svg" data-svg-wheel>
    <svg class="wheel" viewBox="-520 -520 1040 1040"><g data-svg-spin>${carWheelSVG({ id: 'fw' })}</g></svg>
  </div>
</div>
<div class="wheelhit" data-wheelhit aria-hidden="true"></div>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><filter id="vblur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="0 6"/></filter></svg>`;
}

export function chrome(b) {
  return `
<a class="skip" href="#main">Перейти к содержимому</a>

<div class="loader" data-loader aria-hidden="true">
  <svg class="loader__g" viewBox="-60 -60 120 120">
    <circle class="loader__track" r="52"/>
    <circle class="loader__arc" r="52" data-loader-arc/>
    <g class="loader__ticks">${Array.from({ length: 23 }, (_, i) => {
      const a = (-135 + (i * 270) / 22) * (Math.PI / 180);
      const r1 = i % 5 === 0 ? 40 : 44;
      return `<line x1="${(Math.sin(a) * r1).toFixed(1)}" y1="${(-Math.cos(a) * r1).toFixed(1)}" x2="${(Math.sin(a) * 47).toFixed(1)}" y2="${(-Math.cos(a) * 47).toFixed(1)}"/>`;
    }).join('')}</g>
    <line class="loader__needle" x1="0" y1="6" x2="0" y2="-38" data-loader-needle/>
    <circle r="4" class="loader__hub"/>
  </svg>
  <p class="loader__v"><b data-loader-v>0.0</b><span>бар</span></p>
  <p class="loader__k">Накачиваем колесо · ${esc(b.name)}</p>
</div>

<header class="top" data-top>
  <a class="brand" href="#top" aria-label="${esc(b.name)} — в начало">
    <span class="brand__mark" data-brand-mark>${mark}</span>
    <span class="brand__t"><b>${esc(b.shortName)}</b><small>шиномонтаж · ${esc(b.city)}</small></span>
  </a>
  <p class="top__status status" data-status title="${esc(b.hours.text)}, ${esc(b.hours.dayOff)}">
    <i class="status__dot" aria-hidden="true"></i><span data-status-text>${esc(b.hours.short)}</span>
  </p>
  <a class="top__phone" href="${b.phone.href}" data-phone data-magnetic data-cursor="Звонить">${phoneIco}<span>${esc(b.phone.display)}</span></a>
  <button class="top__ai" type="button" data-ai-open aria-label="Открыть ИИ-ассистента" data-magnetic>${aiIco}<span>ИИ</span></button>
  <button class="top__menu" type="button" data-menu-open aria-expanded="false" aria-controls="menu"><span class="top__menu-t">Меню</span><span class="top__burger" aria-hidden="true"><i></i><i></i></span></button>
</header>

<nav class="dial" data-dial aria-label="Сцены страницы">
  <button class="dial__knob" type="button" data-dial-knob aria-expanded="false" aria-controls="dial-list" aria-label="Список сцен">
    <svg viewBox="-50 -50 100 100" aria-hidden="true">
      <circle class="dial__ring" r="44"/>
      <g class="dial__ticks" data-dial-ticks></g>
      <g data-dial-needle><line class="dial__needle" x1="0" y1="0" x2="0" y2="-36"/><circle class="dial__tip" cy="-44" r="4"/></g>
      <circle class="dial__hub" r="3"/>
    </svg>
  </button>
  <p class="dial__read"><span class="dial__deg"><b data-deg>000</b>°</span><span class="dial__lab" data-dial-label>Старт</span></p>
  <ol class="dial__list" id="dial-list" data-dial-list>
    ${sceneNav.map((s, i) => `<li><a href="#${s.id}" data-dial-link="${s.id}"><span class="mono" data-dial-at="${s.id}">${String(i).padStart(2, '0')}</span>${esc(s.label)}</a></li>`).join('')}
  </ol>
</nav>

<div class="hud" aria-hidden="true">
  <i class="hud__c hud__c--tl"></i><i class="hud__c hud__c--tr"></i><i class="hud__c hud__c--bl"></i><i class="hud__c hud__c--br"></i>
  <span class="hud__coord mono">${b.geo.lat.toFixed(4)}° N · ${b.geo.lon.toFixed(4)}° E</span>
  <span class="hud__scene mono"><b data-hud-n>00</b> / 07 · <span data-hud-t>Старт</span></span>
</div>

<div class="cur" data-cur aria-hidden="true"><i></i><span data-cur-t></span></div>

<div class="menu" id="menu" data-menu hidden>
  <div class="menu__top">
    <span class="mono">Один оборот · 7 сцен</span>
    <button type="button" class="menu__close" data-menu-close aria-label="Закрыть меню">${closeIco}</button>
  </div>
  <nav aria-label="Меню">
    <ol class="menu__list">
      ${sceneNav.map((s, i) => `<li style="--i:${i}"><a href="#${s.id}" data-menu-link><span class="mono">0${i}</span>${esc(s.label)}</a></li>`).join('')}
    </ol>
  </nav>
  <div class="menu__foot">
    <a class="btn btn--ink btn--block" href="${b.phone.href}" data-phone>${phoneIco}<span>${esc(b.phone.display)}</span></a>
    <p class="mono">${esc(b.address.full)}<br>${esc(b.hours.text)} · ${esc(b.hours.dayOff)}</p>
  </div>
</div>`;
}
