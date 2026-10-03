#!/usr/bin/env node
/**
 * Production-сборка без внешних зависимостей (только Node ≥ 18).
 *
 *   npm run build                         → dist/  +  preview.html
 *   ASSISTANT_ENDPOINT=/api/chat npm run build
 *   ASSISTANT_ENDPOINT=off npm run build  → ИИ только по локальному справочнику
 *   SITE_URL=https://ydenisa.ru/          → canonical / og:url / sitemap
 */
import { mkdirSync, rmSync, writeFileSync, readFileSync, cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { bundleJS, bundleCSS } from './lib/bundle.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const PUB = join(ROOT, 'public');

// свежие версии модулей при повторной сборке в watch-режиме
const bust = `?t=${Date.now()}`;
const { business } = await import(pathToFileURL(join(SRC, 'data/business.js')).href + bust);
const { page } = await import(pathToFileURL(join(SRC, 'templates/page.mjs')).href + bust);

const endpoint = process.env.ASSISTANT_ENDPOINT || '/api/chat';
if (process.env.SITE_URL) business.siteUrl = process.env.SITE_URL.replace(/\/?$/, '/');

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB';
const gz = (s) => (gzipSync(Buffer.from(s)).length / 1024).toFixed(1) + ' KB gz';

const t0 = Date.now();
rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'assets'), { recursive: true });

// 1. public → dist
cpSync(PUB, DIST, { recursive: true, filter: (p) => !p.endsWith('.gitkeep') });

// 1b. бэкенд ИИ (Express + OpenRouter) — без изменений, рядом с фронтендом,
//     как на текущем сервере: /var/www/ydenisa.ru/{index.html, backend/, package.json}
const SERVER = join(ROOT, 'server');
if (existsSync(SERVER)) {
  cpSync(join(SERVER, 'backend'), join(DIST, 'backend'), {
    recursive: true,
    // секреты и логи никогда не попадают в сборку
    filter: (p) => !/(^|[\\/])(\.env|node_modules|.*\.log)$/.test(p),
  });
  for (const f of ['package.json', 'package-lock.json']) cpSync(join(SERVER, f), join(DIST, f));
}

// 2. CSS / JS
const css = bundleCSS(join(SRC, 'styles/index.css'), { fonts: '/fonts' });
const js = bundleJS(join(SRC, 'js/main.js'), { root: ROOT });
const cssName = `app.${hash(css)}.css`;
const jsName = `app.${hash(js)}.js`;
writeFileSync(join(DIST, 'assets', cssName), css);
writeFileSync(join(DIST, 'assets', jsName), js);

const assistantMeta = `<meta name="yd-assistant-endpoint" content="${endpoint}">`;
const preload = [
  '<link rel="preload" href="/fonts/inter-display-black.woff" as="font" type="font/woff" crossorigin>',
  '<link rel="preload" href="/fonts/inter-regular.woff" as="font" type="font/woff" crossorigin>',
  assistantMeta,
].join('\n');

// 3. index.html
const html = page(business, {
  css: `<link rel="stylesheet" href="/assets/${cssName}">`,
  js: `<script src="/assets/${jsName}" defer></script>`,
  preload,
});
writeFileSync(join(DIST, 'index.html'), html);

// 4. SEO-файлы
const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${business.siteUrl}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`
);
writeFileSync(
  join(DIST, 'robots.txt'),
  `User-agent: *
Allow: /
Allow: /images/
Allow: /assets/
Allow: /fonts/
Disallow: /backend/
Disallow: /node_modules/
Disallow: /.git/
Disallow: /*.json$
Disallow: /.env
Disallow: /.gitignore

Sitemap: ${business.siteUrl}sitemap.xml
Host: ${business.siteUrl.replace(/\/$/, '')}
`
);

// 5. знания для бэкенда ИИ (чтобы сервер отвечал по тем же ценам)
const knowledge = {
  generated: today,
  note: 'Данные сайта для системного промпта ИИ-ассистента. Источник: src/data/business.js',
  name: business.name,
  address: business.address.full,
  phone: business.phone.display,
  hours: `${business.hours.text}; ${business.hours.dayOff}`,
  services: business.services.map((s) => ({
    title: s.title,
    description: s.desc,
    prices: s.prices.map((p) => ({ item: p.label, price: p.amount == null ? p.text : (p.from ? 'от ' : '') + p.amount + ' ₽' })),
  })),
  facts: business.facts.map((f) => `${f.display} ${f.label}`),
  links: { avito: business.links.avito, yandexMaps: business.links.yandexMaps },
};
writeFileSync(join(DIST, 'assistant-knowledge.json'), JSON.stringify(knowledge, null, 2));

// 6. preview.html — один самодостаточный файл (шрифты, CSS и JS внутри)
const fontData = (f) => `data:font/woff;base64,${readFileSync(join(PUB, 'fonts', f)).toString('base64')}`;
const cssInline = bundleCSS(join(SRC, 'styles/index.css'), { fontData });
const favicon = `data:image/svg+xml;base64,${readFileSync(join(PUB, 'images/favicon/favicon.svg')).toString('base64')}`;
let preview = page(business, {
  css: `<style>${cssInline}</style>`,
  js: `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`,
  preload: `<meta name="yd-assistant-endpoint" content="${endpoint}">`,
  base: '/',
  metrika: false,
});
// фото — сразу с живого сайта (в превью нет папки /images)
preview = preview
  .replace(/src="\/images\//g, `src="${business.remoteImageBase}/images/`)
  .replace(/<link rel="(?:shortcut )?icon"[^>]+>\n?/g, '')
  .replace(/<link rel="(?:apple-touch-icon|manifest)"[^>]+>\n?/g, '')
  .replace('</title>', `</title>\n<link rel="icon" href="${favicon}" type="image/svg+xml">`);
writeFileSync(join(ROOT, 'preview.html'), preview);

// отчёт
const total = (dir) => readdirSync(dir).reduce((a, f) => {
  const p = join(dir, f);
  return a + (statSync(p).isDirectory() ? total(p) : statSync(p).size);
}, 0);
console.log(`✓ build ${Date.now() - t0} ms`);
console.log(`  index.html  ${kb(html)} (${gz(html)})`);
console.log(`  ${cssName}  ${kb(css)} (${gz(css)})`);
console.log(`  ${jsName}  ${kb(js)} (${gz(js)})`);
console.log(`  preview.html  ${kb(preview)}`);
console.log(`  dist total  ${(total(DIST) / 1024).toFixed(0)} KB`);
console.log(`  ИИ endpoint: ${endpoint}`);
if (!existsSync(join(PUB, 'images/gallery/shop-1.jpg'))) {
  console.log('  ! Фото мастерской не найдены в public/images/gallery — сайт возьмёт их с ydenisa.ru (см. README → «Фотографии»).');
}
