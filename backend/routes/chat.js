/**
 * Роут чата с AI-консультантом
 * 
 * АРХИТЕКТУРА:
 * ─────────────────────────────────────────────
 * 1. AI вызывается ВСЕГДА (если есть API ключ)
 * 2. История диалога хранится в памяти по sessionId
 * 3. JSON-цены передаются как system-контекст
 * 4. Backend НЕ анализирует текст — всё делает AI
 * 5. Локальный ответ только при ошибке API
 * ─────────────────────────────────────────────
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ═══════════════════════════════════════════════
// ЛОГИРОВАНИЕ СООБЩЕНИЙ
// ═══════════════════════════════════════════════

const LOG_FILE_PATH = '/var/www/ydenisa/chat.log';

function formatLogTimestamp(date = new Date()) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

function sanitizeLogValue(value = '') {
    return String(value)
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeLogMessage(value = '') {
    return String(value)
        .replace(/\r\n?/g, '\n')
        .trim();
}

function appendLogEntry(logEntry) {
    fs.appendFile(LOG_FILE_PATH, `${logEntry}\n`, 'utf8', (err) => {
        if (err) {
            console.error('⚠️ Ошибка записи в лог:', err.message);
        }
    });
}

/**
 * Универсальное логирование сообщения чата
 * @param {Object} params
 * @param {string} params.sessionId
 * @param {number} params.turn
 * @param {'user'|'assistant'} params.role
 * @param {string} params.source
 * @param {string} params.message
 */
function logChatMessage({ sessionId, turn, role, source, message }) {
    try {
        const shortSessionId = sessionId ? sessionId.slice(0, 8) : 'unknown';
        const normalizedMessage = normalizeLogMessage(message);
        const logEntry = [
            `[${formatLogTimestamp()}] session=${sessionId || 'unknown'} sessionShort=${shortSessionId} turn=${turn || 0} role=${role} source=${source}`,
            normalizedMessage || '(empty)',
            '--------------------'
        ].join('\n');
        appendLogEntry(logEntry);
    } catch (error) {
        console.error('⚠️ Ошибка логирования:', error.message);
    }
}

/**
 * Логирование событий сессии
 * @param {Object} params
 * @param {string} params.sessionId
 * @param {string} params.event
 * @param {string} [params.reason]
 */
function logChatEvent({ sessionId, event, reason }) {
    try {
        const shortSessionId = sessionId ? sessionId.slice(0, 8) : 'unknown';
        const reasonPart = reason ? ` reason=${sanitizeLogValue(reason)}` : '';
        const logEntry = `[${formatLogTimestamp()}] session=${sessionId || 'unknown'} sessionShort=${shortSessionId} event=${event}${reasonPart}`;
        appendLogEntry(logEntry);
    } catch (error) {
        console.error('⚠️ Ошибка логирования:', error.message);
    }
}

// ═══════════════════════════════════════════════
// ЗАГРУЗКА ДАННЫХ
// ═══════════════════════════════════════════════

const dataPath = path.join(__dirname, '..', 'data');

// Загружаем все JSON с ценами
const pricesAuto = JSON.parse(fs.readFileSync(path.join(dataPath, 'prices.auto.json'), 'utf8'));
const pricesBike = JSON.parse(fs.readFileSync(path.join(dataPath, 'prices.bike.json'), 'utf8'));
const pricesMaterials = JSON.parse(fs.readFileSync(path.join(dataPath, 'prices.materials.json'), 'utf8'));
const pricesTireSets = JSON.parse(fs.readFileSync(path.join(dataPath, 'prices.tire_sets.json'), 'utf8'));

// Загружаем system prompt
let baseSystemPrompt = '';
const systemPromptPath = path.join(__dirname, '..', 'promts', 'system.txt');
try {
    baseSystemPrompt = fs.readFileSync(systemPromptPath, 'utf8');
} catch (e) {
    console.error('⚠️ System prompt не найден:', systemPromptPath);
}

// ═══════════════════════════════════════════════
// ХРАНИЛИЩЕ СЕССИЙ (IN-MEMORY)
// ═══════════════════════════════════════════════

/**
 * Структура сессии:
 * {
 *   messages: [{ role: 'user'|'assistant', content: string }],
 *   turnCounter: number,
 *   createdAt: Date,
 *   lastActivity: Date
 * }
 */
const sessions = new Map();

// Очистка старых сессий каждые 30 минут
const SESSION_TTL = 60 * 60 * 1000; // 1 час
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of sessions.entries()) {
        if (now - session.lastActivity > SESSION_TTL) {
            logChatEvent({
                sessionId,
                event: 'session_deleted',
                reason: 'timeout'
            });
            sessions.delete(sessionId);
            console.log(`🗑️ Сессия ${sessionId.slice(0, 8)}... удалена (timeout)`);
        }
    }
}, 30 * 60 * 1000);

// ═══════════════════════════════════════════════
// ФОРМИРОВАНИЕ SYSTEM PROMPT С ЦЕНАМИ
// ═══════════════════════════════════════════════

/**
 * Создаёт полный system prompt с актуальными ценами
 */
function buildSystemPrompt() {
    const pricesContext = `

═══════════════════════════════════════════════
АКТУАЛЬНЫЕ ЦЕНЫ И УСЛУГИ
(используй ТОЛЬКО эти данные, не выдумывай)
═══════════════════════════════════════════════

📦 СЕЗОННАЯ ПЕРЕОБУВКА (4 колеса, всё включено):
${pricesTireSets.description}

Штампованные диски:
${Object.entries(pricesTireSets.prices.stamped).map(([r, p]) => `  ${r}: ${p} ₽`).join('\n')}

Литые диски:
${Object.entries(pricesTireSets.prices.alloy).map(([r, p]) => `  ${r}: ${p} ₽`).join('\n')}

Доплаты:
${pricesTireSets.notes.map(n => `  • ${n}`).join('\n')}

─────────────────────────────────────────────
🚗 УСЛУГИ ШИНОМОНТАЖА (авто):
${pricesAuto.services.map(s => `• ${s.name}: ${s.price} ₽ (${s.unit})`).join('\n')}

─────────────────────────────────────────────
🚴 ВЕЛОРЕМОНТ — КОЛЁСА:

Шиномонтаж:
${pricesBike.wheels.tire_service.map(s => `• ${s.name}: ${s.price} ₽`).join('\n')}

Ремонт:
${pricesBike.wheels.repairs.map(s => `• ${s.name}: ${s.price} ₽`).join('\n')}

Втулки:
${pricesBike.wheels.hubs.map(s => `• ${s.name}: ${s.price} ₽`).join('\n')}

─────────────────────────────────────────────
🚴 ВЕЛОРЕМОНТ — ТРАНСМИССИЯ:
${pricesBike.drivetrain.cranks_bottom_bracket_chain.map(s => `• ${s.name}: ${s.price} ₽`).join('\n')}

─────────────────────────────────────────────
🚴 ВЕЛОРЕМОНТ — ПЕРЕКЛЮЧАТЕЛИ:
${pricesBike.shifting_system.map(s => `• ${s.name}: ${s.price} ₽`).join('\n')}

─────────────────────────────────────────────
🚴 ВЕЛОРЕМОНТ — ТОРМОЗА:
${pricesBike.brakes.map(s => `• ${s.name}: ${s.price} ₽`).join('\n')}

─────────────────────────────────────────────
🚴 ВЕЛОРЕМОНТ — РУЛЕВАЯ:
${pricesBike.steering.map(s => `• ${s.name}: ${s.price} ₽`).join('\n')}

─────────────────────────────────────────────
🚴 ВЕЛОРЕМОНТ — ПРОЧЕЕ:
${pricesBike.other.map(s => `• ${s.name}: ${s.price} ₽`).join('\n')}

─────────────────────────────────────────────
🚴 УСТАНОВКА АКСЕССУАРОВ:
${pricesBike.accessories.map(s => `• ${s.name}: ${s.price} ₽`).join('\n')}

═══════════════════════════════════════════════
`;

    return baseSystemPrompt + pricesContext;
}

// Кэшируем собранный prompt
const FULL_SYSTEM_PROMPT = buildSystemPrompt();

// ═══════════════════════════════════════════════
// ПОЛУЧЕНИЕ МЕСТНОГО ВРЕМЕНИ (Europe/Samara, UTC+4)
// ═══════════════════════════════════════════════

/**
 * Возвращает текущую дату и время в часовом поясе Europe/Samara
 * @returns {Object} { date, time, timezone }
 */
function getSamaraTime() {
    const now = new Date();
    const options = { timeZone: 'Europe/Samara' };
    
    const date = now.toLocaleDateString('ru-RU', {
        ...options,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).split('.').reverse().join('-'); // YYYY-MM-DD
    
    const time = now.toLocaleTimeString('ru-RU', {
        ...options,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }); // HH:MM
    
    return {
        date,
        time,
        timezone: 'Europe/Samara (UTC+4)'
    };
}

// ═══════════════════════════════════════════════
// ЗАПРОС К OPENROUTER API
// ═══════════════════════════════════════════════

/**
 * Отправляет запрос к OpenRouter API с полной историей диалога
 * @param {Array} conversationHistory - История сообщений [{ role, content }]
 * @returns {Promise<string|null>} - Ответ AI или null при ошибке
 */
async function queryOpenRouter(conversationHistory) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
        console.log('⚠️ OPENROUTER_API_KEY не установлен');
        return null;
    }

    // Получаем местное время Сарапула
    const { date, time, timezone } = getSamaraTime();
    
    const timeContext = `
ТЕКУЩЕЕ МЕСТНОЕ ВРЕМЯ В САРАПУЛЕ:
═══════════════════════════════════════════════
Дата: ${date}
Время: ${time}
Часовой пояс: ${timezone}

⚠️ КРИТИЧЕСКИ ВАЖНО:
Ты ОБЯЗАН использовать ТОЛЬКО это время для всех расчётов и ответов.
НЕ используй свои внутренние часы или системное время.
Все временные расчёты и проверки режима работы делай ТОЛЬКО на основе этой даты и времени.
═══════════════════════════════════════════════
`;

    // Формируем массив messages для API
    const messages = [
        {
            role: 'system',
            content: timeContext + '\n' + FULL_SYSTEM_PROMPT
        },
        ...conversationHistory
    ];

    const payload = {
        model: process.env.AI_MODEL || 'arcee-ai/trinity-large-preview:free',
        messages,
        temperature: 0.5,
        max_tokens: 500
    };

    try {
        console.log(`🤖 Отправляем в AI (${conversationHistory.length} сообщений в истории)...`);
        
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json',
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Shinka Chat'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ OpenRouter error ${response.status}: ${errorText}`);
            return null;
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content;

        if (reply) {
            console.log(`✅ AI ответил: "${reply.slice(0, 60)}..."`);
            return reply.trim();
        }

        console.error('❌ AI вернул пустой ответ');
        return null;

    } catch (error) {
        console.error('❌ Ошибка запроса к AI:', error.message);
        return null;
    }
}

// ═══════════════════════════════════════════════
// FALLBACK ОТВЕТ (ТОЛЬКО ПРИ ОШИБКЕ AI)
// ═══════════════════════════════════════════════

const FALLBACK_MESSAGE = `Извините, чат временно недоступен.
Позвоните нам: +7 (950) 172-55-14
Работаем: Пн–Сб 9:00–18:00`;

// ═══════════════════════════════════════════════
// ОСНОВНОЙ ENDPOINT
// ═══════════════════════════════════════════════

router.post('/', async (req, res) => {
    try {
        const { message, sessionId: clientSessionId } = req.body;

        // ─────────────────────────────────────
        // ВАЛИДАЦИЯ
        // ─────────────────────────────────────

        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                error: 'Сообщение обязательно',
                reply: 'Пожалуйста, напишите ваш вопрос.'
            });
        }

        const trimmedMessage = message.trim().slice(0, 500);

        if (trimmedMessage.length === 0) {
            return res.status(400).json({
                error: 'Пустое сообщение',
                reply: 'Пожалуйста, напишите ваш вопрос.'
            });
        }

        // ─────────────────────────────────────
        // РАБОТА С СЕССИЕЙ
        // ─────────────────────────────────────

        // Используем sessionId от клиента или генерируем новый
        let sessionId = clientSessionId;
        let isNewSession = false;

        if (!sessionId || !sessions.has(sessionId)) {
            sessionId = crypto.randomUUID();
            isNewSession = true;
            sessions.set(sessionId, {
                messages: [],
                turnCounter: 0,
                createdAt: Date.now(),
                lastActivity: Date.now()
            });
            logChatEvent({
                sessionId,
                event: 'session_created',
                reason: 'new_chat'
            });
            console.log(`🆕 Новая сессия: ${sessionId.slice(0, 8)}...`);
        }

        const session = sessions.get(sessionId);
        session.lastActivity = Date.now();
        session.turnCounter = Number.isInteger(session.turnCounter) ? session.turnCounter : 0;
        session.turnCounter += 1;
        const currentTurn = session.turnCounter;

        // ─────────────────────────────────────
        // ДОБАВЛЯЕМ СООБЩЕНИЕ ПОЛЬЗОВАТЕЛЯ В ИСТОРИЮ
        // ─────────────────────────────────────

        session.messages.push({
            role: 'user',
            content: trimmedMessage
        });
        logChatMessage({
            sessionId,
            turn: currentTurn,
            role: 'user',
            source: 'client',
            message: trimmedMessage
        });

        console.log(`📩 [${sessionId.slice(0, 8)}] Пользователь: "${trimmedMessage}"`);
        console.log(`📚 История: ${session.messages.length} сообщений`);

        // ─────────────────────────────────────
        // ЗАПРОС К AI (ВСЕГДА!)
        // ─────────────────────────────────────

        const aiReply = await queryOpenRouter(session.messages);

        // ─────────────────────────────────────
        // ФОРМИРУЕМ ОТВЕТ
        // ─────────────────────────────────────

        let reply;

        if (aiReply) {
            // AI ответил успешно
            reply = aiReply;

            // Сохраняем ответ AI в историю
            session.messages.push({
                role: 'assistant',
                content: reply
            });
            logChatMessage({
                sessionId,
                turn: currentTurn,
                role: 'assistant',
                source: 'ai',
                message: reply
            });
        } else {
            // AI недоступен — fallback
            console.log('⚠️ AI недоступен, используем fallback');
            reply = FALLBACK_MESSAGE;
            logChatMessage({
                sessionId,
                turn: currentTurn,
                role: 'assistant',
                source: 'fallback',
                message: reply
            });

            // НЕ сохраняем fallback в историю,
            // чтобы не путать AI в следующем запросе
            // Удаляем последнее сообщение пользователя
            session.messages.pop();
        }

        // ─────────────────────────────────────
        // ОТПРАВЛЯЕМ ОТВЕТ
        // ─────────────────────────────────────

        console.log(`📤 [${sessionId.slice(0, 8)}] Ответ: "${reply.slice(0, 60)}..."`);

        return res.json({
            reply,
            sessionId,
            isNewSession
        });

    } catch (error) {
        console.error('❌ Chat error:', error);
        return res.status(500).json({
            error: 'Ошибка сервера',
            reply: FALLBACK_MESSAGE
        });
    }
});

// ═══════════════════════════════════════════════
// ENDPOINT: СБРОС СЕССИИ
// ═══════════════════════════════════════════════

router.delete('/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    if (sessions.has(sessionId)) {
        logChatEvent({
            sessionId,
            event: 'session_deleted',
            reason: 'manual'
        });
        sessions.delete(sessionId);
        console.log(`🗑️ Сессия ${sessionId.slice(0, 8)}... удалена вручную`);
        return res.json({ success: true });
    }
    
    return res.status(404).json({ error: 'Сессия не найдена' });
});

// ═══════════════════════════════════════════════
// ENDPOINT: ИНФОРМАЦИЯ О СЕССИИ (DEBUG)
// ═══════════════════════════════════════════════

router.get('/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Сессия не найдена' });
    }
    
    return res.json({
        sessionId,
        messagesCount: session.messages.length,
        createdAt: new Date(session.createdAt).toISOString(),
        lastActivity: new Date(session.lastActivity).toISOString()
    });
});

module.exports = router;
