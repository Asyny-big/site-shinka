import { $$ } from '../utils/dom.js';
import { shopStatus } from '../utils/time.js';
import { business } from '../../data/business.js';

/** Живой статус «открыто/закрыто» во всех [data-status] + подсветка сегодняшнего дня */
export function initStatus() {
  const els = $$('[data-status]');
  const week = $$('[data-week] li');
  if (!els.length) return;

  const update = () => {
    const s = shopStatus(business.hours);
    els.forEach((el) => {
      const t = el.querySelector('[data-status-text]');
      const inHeader = !!el.closest('.top');
      if (t) t.textContent = inHeader ? (s.open ? s.short : 'Закрыто') : s.long;
      el.classList.toggle('is-open', s.open);
      el.classList.toggle('is-closed', !s.open);
      el.title = `${s.long}. ${business.hours.text}, ${business.hours.dayOff}. Время местное (Сарапул).`;
    });
    week.forEach((li) => li.classList.toggle('is-today', Number(li.dataset.dow) === s.dow));
  };
  update();
  setInterval(update, 60 * 1000);
}
