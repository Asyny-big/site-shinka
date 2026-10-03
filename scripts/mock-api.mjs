#!/usr/bin/env node
/**
 * Заглушка бэкенда ИИ для локальной проверки протокола.
 * НЕ для продакшена. Отвечает эхом и возвращает sessionId.
 *   node scripts/mock-api.mjs            (порт 3001)
 *   API_PROXY=http://127.0.0.1:3001 npm run dev
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
const PORT = Number(process.env.PORT) || 3001;
createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/api/chat') { res.writeHead(404); return res.end(); }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    let data = {};
    try { data = JSON.parse(body); } catch { /* noop */ }
    const sessionId = data.sessionId || randomUUID();
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ reply: `[mock] Получил вопрос: «${data.message}». Сессия ${sessionId.slice(0, 8)}.`, sessionId }));
  });
}).listen(PORT, () => console.log(`mock /api/chat → http://127.0.0.1:${PORT}`));
