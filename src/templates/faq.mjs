import { findPrice, priceText, serviceById } from '../data/business.js';

/** FAQ строится ТОЛЬКО из данных компании — используется и на странице, и в schema.org FAQPage */
export function buildFaq(b) {
  const p = (id) => priceText(findPrice(id).price);
  const list = (sid) =>
    serviceById(sid)
      .prices.map((x) => `${x.label} — ${priceText(x)}`)
      .join('; ');
  return [
    {
      q: 'Сколько стоит сезонная переобувка в Сарапуле?',
      a: `Комплект из 4 колёс: R13–R16 — ${p('r13')}, R17–R18 — ${p('r17')}, R19+ / внедорожник — ${p('r19')}.`,
    },
    {
      q: 'Сколько стоит дошиповка зимней резины?',
      a: `1 шип — ${p('stud')}. Колесо целиком (R14) — ${p('wheel')}.`,
    },
    {
      q: 'Правите ли вы литые диски?',
      a: `Да. Штампованные диски — ${p('steel')}, литые — ${p('alloy')}.`,
    },
    {
      q: 'Сколько стоит ремонт прокола или грыжи?',
      a: `${list('repair')}.`,
    },
    {
      q: 'Ремонтируете ли вы велосипеды?',
      a: `Да: ${list('bike')}. Также покупаем велосипеды в любом состоянии, оценка бесплатно.`,
    },
    {
      q: 'Когда работает шиномонтаж?',
      a: `${b.hours.text}. ${b.hours.dayOff}.`,
    },
    {
      q: 'Где находится шиномонтаж у Дениса?',
      a: `${b.address.full}. Телефон: ${b.phone.display}.`,
    },
  ];
}
