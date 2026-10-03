/**
 * Статус «открыто / закрыто» по графику из business.hours,
 * в часовом поясе мастерской (Сарапул, Europe/Samara, UTC+4).
 * Праздники не учитываются — их на старом сайте нет.
 */
const DAY_ACC = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function shopNow(tz, date) {
  const d = date || new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
    const get = (t) => (parts.find((p) => p.type === t) || {}).value;
    return { dow: WD[get('weekday')], minutes: parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10) };
  } catch (e) {
    // запасной вариант: UTC+4
    const u = new Date(d.getTime() + 4 * 3600 * 1000);
    return { dow: u.getUTCDay(), minutes: u.getUTCHours() * 60 + u.getUTCMinutes() };
  }
}

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const fmt = (hhmm) => hhmm.replace(/^0/, '');

export function shopStatus(hours, date) {
  const { dow, minutes } = shopNow(hours.timezone, date);
  const o = toMin(hours.open);
  const c = toMin(hours.close);
  const isWork = (d) => hours.workdays.includes(d);

  if (isWork(dow) && minutes >= o && minutes < c) {
    const left = c - minutes;
    return {
      open: true, dow,
      long: `Сейчас открыто · до ${fmt(hours.close)}`,
      short: `Открыто до ${fmt(hours.close)}`,
      soon: left <= 60,
    };
  }
  let when;
  if (isWork(dow) && minutes < o) when = `сегодня в ${fmt(hours.open)}`;
  else {
    let k = 1;
    while (k < 8 && !isWork((dow + k) % 7)) k++;
    const nd = (dow + k) % 7;
    when = k === 1 ? `завтра в ${fmt(hours.open)}` : `в ${DAY_ACC[nd]} в ${fmt(hours.open)}`;
  }
  return { open: false, dow, long: `Сейчас закрыто · откроемся ${when}`, short: `Закрыто · откроемся ${when}`, when };
}
