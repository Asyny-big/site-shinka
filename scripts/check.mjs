#!/usr/bin/env node
/**
 * Быстрая проверка сборки без браузера (npm test):
 *  - все цены из business.js действительно есть в HTML
 *  - телефон, адрес, график на месте
 *  - внутренние якоря (#…) ведут на существующие id
 *  - JSON-LD валиден
 *  - нет «ключей» в бандле
 *  - локальный справочник ИИ отвечает на быстрые вопросы без «выдумок»
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const { business, priceText } = await import(pathToFileURL(join(ROOT, 'src/data/business.js')).href);
const { assistantCopy } = await import(pathToFileURL(join(ROOT, 'src/data/assistant.js')).href);

let fails = 0;
const t = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) fails++;
};

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const text = unesc(html);

for (const s of business.services) for (const p of s.prices) t(text.includes(priceText(p)), `цена «${s.short}: ${p.label} — ${priceText(p)}»`);
t(text.includes(business.phone.display), 'телефон');
t(html.includes(`href="${business.phone.href}"`), 'tel:-ссылка');
t(text.includes(business.address.full), 'адрес');
t(text.includes(business.hours.text) && text.includes(business.hours.dayOff), 'график');
for (const r of business.reviews) t(text.includes(r.text), `отзыв ${r.name}`);
for (const p of business.photos) t(text.includes(p.alt), `фото «${p.caption}»`);

const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const anchors = [...new Set([...html.matchAll(/href="#([^"]*)"/g)].map((m) => m[1]))];
for (const a of anchors) t(ids.has(a), `якорь #${a}`);
for (const old of ['services', 'works', 'reviews', 'about', 'contacts']) t(ids.has(old), `старый якорь #${old} сохранён`);

const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
t(ld.length === 2, 'два блока JSON-LD');
ld.forEach((m, i) => {
  try { JSON.parse(m[1]); t(true, `JSON-LD #${i + 1} валиден`); } catch (e) { t(false, `JSON-LD #${i + 1}: ${e.message}`); }
});
t(/<title>[^<]*Сарапул/.test(html), 'title содержит «Сарапул»');
t(/<h1[\s\S]*Шиномонтаж в&nbsp;Сарапуле/.test(html), 'h1 содержит «Шиномонтаж в Сарапуле»');
t((html.match(/<h1/g) || []).length === 1, 'ровно один h1');
t(/rel="canonical"/.test(html), 'canonical');

const assets = readdirSync(join(DIST, 'assets'));
const js = readFileSync(join(DIST, 'assets', assets.find((f) => f.endsWith('.js'))), 'utf8');
t(!/sk-[A-Za-z0-9]{20,}|api[_-]?key\s*[:=]\s*['"][^'"]{8,}/i.test(js), 'в бандле нет API-ключей');

const { answerLocally } = await import(pathToFileURL(join(ROOT, 'src/js/services/knowledge.js')).href);
const allowed = new Set(business.services.flatMap((s) => s.prices.filter((p) => p.amount != null).map((p) => p.amount)));
for (const q of [...assistantCopy.quick, 'сколько стоит балансировка', 'оплата картой', 'грузовики делаете?']) {
  const r = answerLocally(q);
  const nums = [...r.text.matchAll(/(\d[\d\s ]*)\s?₽/g)].map((m) => Number(m[1].replace(/\D/g, '')));
  const bad = nums.filter((n) => !allowed.has(n));
  t(r.text.length > 10 && bad.length === 0, `ИИ-справочник: «${q}»${bad.length ? ' — лишние цены ' + bad : ''}`);
}

// готовность к замене старого сайта на VPS
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const files = walk(DIST).map((f) => f.slice(DIST.length + 1));
for (const f of ['index.html', 'favicon.ico', 'site.webmanifest', 'robots.txt', 'sitemap.xml', 'googleab543badaa364955.html',
  'images/og-image.jpg', 'images/favicon/apple-touch-icon.png', 'images/gallery/shop-1.jpg', 'images/gallery/shop-6.jpg',
  'backend/app.js', 'backend/routes/chat.js', 'backend/.env.example', 'package.json', 'package-lock.json']) {
  t(files.includes(f), `в сборке есть ${f}`);
}
t(!files.some((f) => /(^|\/)\.env$/.test(f)), 'в сборке нет файла .env');
t(!files.some((f) => /node_modules|\.log$/.test(f)), 'в сборке нет node_modules и логов');
t(!/=\s*\S{6,}/.test(readFileSync(join(DIST, 'backend/.env.example'), 'utf8').match(/^OPENROUTER_API_KEY.*$/m)[0]), '.env.example без ключа');
t(html.includes('mc.yandex.ru/metrika/tag.js?id=106113716'), 'счётчик Яндекс.Метрики 106113716 на месте');
t(html.includes('/favicon.ico') && html.includes('/site.webmanifest'), 'иконки и манифест подключены');

console.log(fails ? `\n${fails} проверок не прошло` : '\nВсё в порядке');
process.exit(fails ? 1 : 0);
