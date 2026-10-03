/**
 * АДАПТЕР ИИ-АССИСТЕНТА
 * ------------------------------------------------------------------
 * Протокол сохранён 1-в-1 со старого сайта (js/main.js на ydenisa.ru):
 *
 *   POST {endpoint}          Content-Type: application/json
 *   → { "message": "текст вопроса", "sessionId": "… | null" }
 *   ← { "reply": "текст ответа", "sessionId": "…" }
 *
 * Endpoint по умолчанию — '/api/chat' (тот же, что раньше).
 * Переопределяется ОДНОЙ настройкой:
 *   • при сборке: ASSISTANT_ENDPOINT=https://… npm run build
 *     (пишется в <meta name="yd-assistant-endpoint">)
 *   • или вручную в dist/index.html в том же meta-теге.
 *   • ASSISTANT_ENDPOINT=off — работать только по локальному справочнику.
 *
 * Ключи API на фронтенде НЕ хранятся и не нужны: их держит бэкенд.
 * Если сервер недоступен / ответил ошибкой / молчит дольше таймаута —
 * отвечает локальный справочник (knowledge.js) по данным сайта.
 */
import { answerLocally, actionsFor } from './knowledge.js';

const meta = typeof document !== 'undefined' ? document.querySelector('meta[name="yd-assistant-endpoint"]') : null;

export const ASSISTANT_CONFIG = {
  endpoint: (meta && meta.content) || '/api/chat',
  timeoutMs: 25000,
  maxLength: 500, // как в старом интерфейсе
};

const SESSION_KEY = 'yd-chat-session';
let sessionId = null;
try { sessionId = sessionStorage.getItem(SESSION_KEY); } catch (e) { /* приватный режим */ }

const serverEnabled = () => {
  const ep = ASSISTANT_CONFIG.endpoint;
  if (!ep || ep === 'off') return false;
  // при открытии файла с диска (preview.html) относительного сервера нет
  if (location.protocol === 'file:' && !/^https?:/.test(ep)) return false;
  return true;
};

async function askServer(message) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), ASSISTANT_CONFIG.timeoutMs) : null;
  try {
    const res = await fetch(ASSISTANT_CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId }),
      signal: ctrl ? ctrl.signal : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (data && data.sessionId) {
      sessionId = data.sessionId;
      try { sessionStorage.setItem(SESSION_KEY, sessionId); } catch (e) { /* noop */ }
    }
    if (!res.ok || !data || typeof data.reply !== 'string' || !data.reply.trim()) {
      throw new Error('bad response ' + res.status);
    }
    return data.reply.trim();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Главная функция для интерфейса.
 * @returns {Promise<{text:string, actions:Array, source:'ai'|'local'}>}
 */
export async function ask(message) {
  const text = String(message || '').slice(0, ASSISTANT_CONFIG.maxLength).trim();
  if (!text) return null;
  if (serverEnabled()) {
    try {
      const reply = await askServer(text);
      return { text: reply, actions: actionsFor(text), source: 'ai' };
    } catch (e) {
      // молча переходим на справочник — пользователь видит пометку в шапке чата
    }
  }
  const local = answerLocally(text);
  return { text: local.text, actions: local.actions, source: 'local' };
}
