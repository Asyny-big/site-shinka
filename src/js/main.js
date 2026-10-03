/**
 * Точка входа «ОДИН ОБОРОТ».
 * Каждый модуль независим: если один упадёт, остальные продолжат работать.
 */
import { rt, startLoop } from './core/runtime.js';
import { initDirector } from './core/director.js';
import { initStage, runIntro, initWheelHit } from './scenes/boot.js';
import { initHero } from './scenes/hero.js';
import { initAnatomy } from './scenes/anatomy.js';
import { initPrices } from './scenes/prices.js';
import { initWorks } from './scenes/works.js';
import { initMileage, initCounters } from './scenes/mileage.js';
import { initAsk, initFinish } from './scenes/ask-finish.js';
import { initChrome } from './scenes/chrome.js';
import { initStatus } from './components/status.js';
import { initImages, initLightbox, initMap } from './components/media.js';
import { initReveal } from './components/reveal.js';
import { initChat, initPresence } from './components/chat.js';
import { emit } from './utils/dom.js';

const safe = (fn, ...a) => {
  try {
    return fn(...a);
  } catch (e) {
    if (window.console) console.error('[ydenisa]', fn.name, e);
  }
};

async function boot() {
  startLoop();
  [initImages, initStatus, initChat, initLightbox, initMap, initReveal, initCounters].forEach((f) => safe(f));
  safe(initPresence, rt);
  await safe(initStage);
  [initDirector, initWheelHit, initChrome, initHero, initAnatomy, initPrices, initWorks, initMileage, initAsk, initFinish].forEach((f) => safe(f));
  safe(runIntro);

  // звонки: событие для аналитики (подключите Метрику здесь)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="tel:"]');
    if (a) emit('phone', { href: a.href });
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
