/**
 * ЛОКАЛЬНЫЙ СПРАВОЧНИК ассистента.
 * Работает, когда ИИ-сервер недоступен (или выключен), и всегда —
 * для подбора кнопок-действий («Показать в прайсе», «Позвонить», «Маршрут»).
 *
 * Правило: отвечает ТОЛЬКО данными из business.js. Чего нет в данных —
 * честно говорит, что точной информации нет, и предлагает позвонить.
 */
import { business as b, priceText, serviceById, findPrice, rub } from '../../data/business.js';
import { shopStatus } from '../utils/time.js';

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"“”„!?.,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const P = (id) => priceText(findPrice(id).price);
const list = (sid) => serviceById(sid).prices.map((p) => `• ${p.label} — ${priceText(p)}`).join('\n');
const CALL = { type: 'call', label: 'Позвонить' };
const MAP = { type: 'map', label: 'Маршрут' };
const svc = (service, option, label = 'Показать в прайсе') => ({ type: 'service', service, option, label });

/** Диаметр из вопроса: «R16», «р 17», «16 радиус», «на 18 дисках» */
function diameter(t) {
  // \b в JS не работает с кириллицей — используем просмотр назад/вперёд
  const m =
    t.match(/(?<![a-zа-я])[rр]\s?-?(\d{2})(?!\d)/) ||
    t.match(/(?<!\d)(\d{2})\s?(?:радиус|дюйм|-?(?:м|х|ый|ые|ых|й)(?![а-я]))/) ||
    t.match(/радиус[а-я]*\s?(\d{2})(?!\d)/);
  if (m) return Number(m[1]);
  if (/внедорожн|джип/.test(t)) return 19;
  return null;
}
function seasonOption(d) {
  if (d == null) return null;
  if (d >= 13 && d <= 16) return 'r13';
  if (d >= 17 && d <= 18) return 'r17';
  if (d >= 19) return 'r19';
  return 'small';
}

const INTENTS = [
  {
    id: 'payment',
    re: /оплат|картой|наличн|перевод|сбп|\bqr\b|безнал/,
    answer: () => ({
      text: `Точной информации о способах оплаты у меня нет. Лучше уточнить у мастера по телефону ${b.phone.display}.`,
      actions: [CALL],
    }),
  },
  {
    id: 'bulge',
    re: /грыж|шишк|вздут/,
    answer: () => ({
      text:
        `Ремонт грыжи — ${P('bulge')} (по прайсу).\n` +
        'Грыжа — это повреждение каркаса шины, поэтому сначала её должен осмотреть мастер: он скажет, что можно сделать именно в вашем случае.\n' +
        `Лучше позвонить заранее: ${b.phone.display}.`,
      actions: [CALL, svc('repair', 'bulge')],
    }),
  },
  {
    id: 'cut',
    re: /порез|боков|разрез|пропорол/,
    answer: () => ({
      text: `Боковой порез — ${P('cut')}.\nМожно ли ремонтировать конкретный порез, определяет мастер после осмотра.`,
      actions: [svc('repair', 'cut'), CALL],
    }),
  },
  {
    id: 'puncture',
    re: /прокол|спуска|спустил|сдува|гвозд|саморез|шуруп|дырк|жгут|заплат|травит|не держ|колесо село|спущ/,
    answer: () => ({
      text: `Проколы ремонтируем:\n• Жгут — ${P('plug')}\n• Заплатка — ${P('patch')}\nКакой способ подойдёт, мастер скажет после осмотра.`,
      actions: [svc('repair', 'plug'), CALL, MAP],
    }),
  },
  {
    id: 'studs',
    re: /шип|дошип/,
    answer: (t) => {
      const m = t.match(/(\d{1,3})\s*шип/);
      let text = `Да, дошиповка есть — восстановление шипов в зимних шинах любой сложности.\n• 1 шип — ${P('stud')}\n• Колесо целиком (R14) — ${P('wheel')}`;
      if (m) {
        const n = Number(m[1]);
        const per = findPrice('stud').price.amount;
        text += `\n\nОриентир для ${n} шт.: ${n} × ${per} ₽ = ${rub(n * per)} ₽. Итог называет мастер.`;
      }
      return { text, actions: [svc('studs', 'stud'), CALL] };
    },
  },
  {
    id: 'bike',
    re: /велос|вело(?![а-я])|велик|восьмерк|переключ|втулк|камер|спиц|цеп[ьи]|тормоз/,
    answer: (t) => {
      const tube = /камер/.test(t) ? '\nЗамена камер — тоже делаем, стоимость уточняет мастер.' : '';
      return { text: `Ремонт велосипедов:\n${list('bike').replace(/\n• Замена камер — уточняет мастер/, '')}${tube}`, actions: [svc('bike', /восьм/.test(t) ? 'true' : /тормоз/.test(t) ? 'brakes' : /переключ/.test(t) ? 'gears' : /втулк/.test(t) ? 'hub' : 'true'), CALL] };
    },
  },
  {
    id: 'buyout',
    re: /продат|продам|скупк|выкуп|купит|купите|комисс|оценит|оценка/,
    answer: () => ({ text: `Покупаем велосипеды в любом состоянии:\n${list('buyout')}`, actions: [svc('buyout', 'eval'), CALL] }),
  },
  {
    id: 'rims',
    re: /диск|правк|выправ|погну|лит(ой|ые|ого|ых|ье|ья)|штамп|геометр|вмятин|кривой/,
    answer: () => ({
      text: `Правим штампованные и литые диски — восстанавливаем геометрию.\n• Штампованные — ${P('steel')}\n• Литые — ${P('alloy')}\nМожно ли восстановить конкретный диск, мастер скажет после осмотра.`,
      actions: [svc('rims', 'alloy'), CALL],
    }),
  },
  {
    id: 'balance',
    re: /баланс|бьет|бьёт|вибрац|трясет|трясёт|дрожит|руль/,
    answer: () => ({
      text: `Балансировку колёс делаем на современном оборудовании. Цены на балансировку в прайсе сайта нет — стоимость уточняет мастер по телефону ${b.phone.display}.`,
      actions: [CALL, svc('balance', 'bal')],
    }),
  },
  {
    id: 'season',
    re: /переоб|сезон|смен[а-яa-z]* (резин|колес|шин)|замен[а-яa-z]* (резин|колес|шин)|поменя[а-яa-z]* (резин|колес|шин)|переставит|летн[а-яa-z]+ (резин|шин)|зимн[а-яa-z]+ (резин|шин)|переобу/,
    answer: (t) => {
      const d = diameter(t);
      const opt = seasonOption(d);
      if (opt === 'small') {
        return { text: `Для таких дисков отдельной цены в прайсе нет. Лучше уточнить у мастера по телефону ${b.phone.display}.\n\nПрайс переобувки (4 колеса):\n${list('season')}`, actions: [CALL, svc('season', 'r13')] };
      }
      if (opt) {
        const p = findPrice(opt).price;
        const what = d >= 19 && /внедорожн|джип/.test(t) && !/[rр]\s?-?\d/.test(t) ? 'Внедорожник' : `R${d}`;
        return { text: `Переобувка: ${what} — это категория «${p.label}», ${priceText(p)} за комплект.\nТочную сумму назовёт мастер.`, actions: [svc('season', opt), CALL] };
      }
      return { text: `Сезонная переобувка, комплект из 4 колёс:\n${list('season')}`, actions: [svc('season', 'r13'), CALL] };
    },
  },
  {
    id: 'repair',
    re: /ремонт[а-яa-z]* (шин|колес|резин)|почин/,
    answer: () => ({ text: `Ремонт шин:\n${list('repair')}`, actions: [svc('repair', 'plug'), CALL] }),
  },
  {
    id: 'hours',
    re: /когда|график|работает|работаете|часы|время работы|открыт|закрыт|выходн|воскрес|суббот|сегодня|до скольки|во сколько|праздник/,
    answer: (t) => {
      const s = shopStatus(b.hours);
      let text = `Мы работаем:\n${b.hours.text}\n${b.hours.dayOff}.\n\n${s.long}.`;
      if (/праздник/.test(t)) text += `\nО праздничных днях точной информации у меня нет — лучше уточнить по телефону.`;
      return { text, actions: [CALL, MAP] };
    },
  },
  {
    id: 'address',
    re: /(?<![а-я])где(?![а-я])|адрес|найти|доехат|проехат|добрат|на карте|карту|карта(?![а-я])|карты(?![а-я])|маршрут|находит|ленинград|как вас/,
    answer: () => ({ text: `Мы находимся по адресу:\n${b.address.full}.`, actions: [MAP, { type: 'link', href: b.links.yandexMaps, label: 'Яндекс Карты' }, CALL] }),
  },
  {
    id: 'phone',
    re: /телефон|позвон|номер|связат|звонит/,
    answer: () => ({ text: `Наш телефон: ${b.phone.display}`, actions: [CALL] }),
  },
  {
    id: 'warranty',
    re: /гарант/,
    answer: () => ({ text: `Да, на выполненные работы даём гарантию. Условия лучше уточнить у мастера: ${b.phone.display}.`, actions: [CALL] }),
  },
  {
    id: 'booking',
    re: /запис|очеред|бронь|заран|ждать|долго|сколько времени|как быстро/,
    answer: () => ({
      text: `Онлайн-записи на сайте нет — проще всего позвонить: ${b.phone.display}.\nОбычно работаем быстро — от 15 минут; в сезон бывает очередь, поэтому лучше позвонить заранее.`,
      actions: [CALL],
    }),
  },
  {
    id: 'avito',
    re: /авито|avito|отзыв/,
    answer: () => ({ text: 'Наши услуги и отзывы есть на Авито и на Яндекс Картах.', actions: [{ type: 'link', href: b.links.avito, label: 'Авито' }, { type: 'link', href: b.links.yandexMaps, label: 'Яндекс Карты' }] }),
  },
  {
    id: 'price',
    re: /цен|стоим|сколько|прайс|почем|стоит/,
    answer: () => ({
      text:
        'Коротко по прайсу:\n' +
        `• Переобувка R13–R16 (4 колеса) — ${P('r13')}\n` +
        `• Ремонт прокола (жгут) — ${P('plug')}\n` +
        `• Правка дисков — ${P('steel')}\n` +
        `• Дошиповка — ${P('stud')} за шип\n` +
        `• Велоремонт — ${P('brakes')}\n` +
        'Уточните услугу — подскажу точнее.',
      actions: [{ type: 'section', target: '#prices', label: 'Весь прайс' }],
    }),
  },
  {
    id: 'hello',
    re: /^(привет|здравств|добр[а-яa-z]* (день|утро|вечер)|hello|hi\b|хай)/,
    answer: () => ({ text: 'Здравствуйте! Подскажу по услугам, ценам и графику работы. Что случилось с колесом?', actions: [] }),
  },
  {
    id: 'thanks',
    re: /спасиб|благодар/,
    answer: () => ({ text: `Пожалуйста! Если что — звоните: ${b.phone.display}.`, actions: [CALL] }),
  },
];

const FALLBACK = () => ({
  text: `Точной информации у меня нет. Лучше уточнить у мастера по телефону ${b.phone.display} — он ответит точно.`,
  actions: [CALL],
});

/** Сопоставить вопрос с темами. Возвращает массив id тем. */
export function detect(question) {
  const t = norm(question);
  let found = INTENTS.filter((i) => i.re.test(t)).map((i) => i.id);
  // диаметр без слова «переобувка» → это вопрос про переобувку
  if (!found.some((id) => ['season', 'studs', 'rims', 'repair', 'bike'].includes(id)) && diameter(t) != null) found.unshift('season');
  // «продать велосипед» — это скупка, а не ремонт
  if (found.includes('buyout')) found = found.filter((id) => id !== 'bike');
  // если есть конкретная услуга — общий «price» не нужен
  const specific = found.filter((id) => !['price', 'hello', 'thanks'].includes(id));
  if (specific.length) return specific;
  return found;
}

/** Локальный ответ: { text, actions[], matched:boolean } */
export function answerLocally(question) {
  const t = norm(question);
  const ids = detect(question).slice(0, 2);
  if (!ids.length) return { ...FALLBACK(), matched: false };
  const parts = ids.map((id) => INTENTS.find((i) => i.id === id).answer(t));
  const actions = [];
  const seen = new Set();
  parts.forEach((p) =>
    p.actions.forEach((a) => {
      const k = a.type + (a.service || a.href || a.target || '');
      if (!seen.has(k)) { seen.add(k); actions.push(a); }
    })
  );
  return { text: parts.map((p) => p.text).join('\n\n'), actions: actions.slice(0, 3), matched: true };
}

/** Только кнопки-действия (для ответов настоящего ИИ) */
export function actionsFor(question) {
  const r = answerLocally(question);
  return r.matched ? r.actions : [CALL];
}
