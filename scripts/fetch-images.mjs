#!/usr/bin/env node
/**
 * Скачивает реальные фотографии мастерской со старого сайта в public/images/,
 * чтобы новый сайт не зависел от старого хостинга.
 *
 *   npm run images        (нужен доступ в интернет, Node ≥ 18)
 *   npm run build
 *
 * Если на сервере папка /images/ со старого сайта и так остаётся на месте,
 * этот шаг можно пропустить — пути совпадают (/images/gallery/shop-N.jpg).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { business } = await import(pathToFileURL(join(ROOT, 'src/data/business.js')).href);

const files = [...business.photos.map((p) => p.src), '/images/og-image.jpg', '/images/logo.png'];
let ok = 0;
for (const f of files) {
  const url = business.remoteImageBase + f;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const out = join(ROOT, 'public', f);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, buf);
    console.log(`✓ ${f}  ${(buf.length / 1024).toFixed(0)} KB`);
    ok++;
  } catch (e) {
    console.log(`✗ ${f}  — ${e.message}`);
  }
}
console.log(`\nГотово: ${ok}/${files.length}. Теперь: npm run build`);
console.log('Совет: большие JPG можно пережать (например, squoosh.app или `npx @squoosh/cli`) до ширины 1600 px.');
