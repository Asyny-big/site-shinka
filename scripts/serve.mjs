#!/usr/bin/env node
/**
 * Локальный сервер для dist/ (без зависимостей).
 *   npm run preview            → http://localhost:5173
 *   npm run dev                → то же + пересборка при изменениях в src/ и public/
 *   PORT=8080 API_PROXY=http://127.0.0.1:3000 npm run dev
 *       → запросы /api/* проксируются на ваш бэкенд ИИ (как nginx в проде)
 */
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 5173;
const API = process.env.API_PROXY || '';
const WATCH = process.argv.includes('--watch');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};

const build = () => {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts/build.mjs')], { stdio: 'inherit', env: process.env });
  return r.status === 0;
};
build();

if (WATCH) {
  let t;
  for (const dir of ['src', 'public']) {
    watch(join(ROOT, dir), { recursive: true }, () => {
      clearTimeout(t);
      t = setTimeout(build, 150);
    });
  }
}

function proxy(req, res) {
  const target = new URL(req.url, API);
  const fn = target.protocol === 'https:' ? httpsRequest : httpRequest;
  const p = fn(target, { method: req.method, headers: { ...req.headers, host: target.host } }, (r) => {
    res.writeHead(r.statusCode || 502, r.headers);
    r.pipe(res);
  });
  p.on('error', () => { res.writeHead(502, { 'content-type': 'application/json' }); res.end('{"error":"bad gateway"}'); });
  req.pipe(p);
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    if (API) return proxy(req, res);
    res.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: 'API_PROXY не задан — ассистент ответит из локального справочника' }));
  }
  let file = join(DIST, decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    const cache = /\/assets\//.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': cache });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404');
  }
}).listen(PORT, () => console.log(`→ http://localhost:${PORT}${API ? `  (/api → ${API})` : ''}${WATCH ? '  [watch]' : ''}`));
