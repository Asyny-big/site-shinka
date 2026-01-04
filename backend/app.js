/**
 * Express-сервер для чат-консультанта шиномонтажа
 * Сарапул — «Шиномонтаж у Дениса»
 */

const path = require('path');

// ─────────────────────────────────────────────
// ИНИЦИАЛИЗАЦИЯ ENV (КРИТИЧНО!)
// ─────────────────────────────────────────────
// Явно указываем путь к .env файлу в папке backend
require('dotenv').config({ 
    path: path.resolve(__dirname, '.env') 
});

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const chatRoutes = require('./routes/chat');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
// ПРОВЕРКА КОНФИГУРАЦИИ
// ─────────────────────────────────────────────
const AI_ENABLED = !!process.env.OPENROUTER_API_KEY;

// Экспортируем флаг для использования в роутах
app.locals.aiEnabled = AI_ENABLED;

// ─────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────

// CORS — разрешаем запросы с фронтенда
app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// Парсинг JSON
app.use(express.json({ limit: '10kb' })); // Ограничение размера запроса

// Статические файлы (фронтенд)
app.use(express.static(path.join(__dirname, '..')));

// Rate limiting — защита от спама
const chatLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 минута
    max: 20, // Максимум 20 запросов в минуту
    message: {
        error: 'Слишком много запросов. Подождите минуту.',
        reply: 'Пожалуйста, подождите немного перед следующим сообщением.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Применяем rate limiting к API чата
app.use('/api/chat', chatLimiter);

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────

// API чата
app.use('/api/chat', chatRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        aiEnabled: AI_ENABLED,
        timestamp: new Date().toISOString() 
    });
});

// Fallback — отдаём index.html для SPA-like поведения
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ─────────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────────

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Внутренняя ошибка сервера',
        reply: 'Извините, произошла ошибка. Позвоните нам: +7 (950) 172-55-14'
    });
});

// ─────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║   🚗 Шиномонтаж у Дениса — Чат-сервер                    ║
╠══════════════════════════════════════════════════════════╣
║   Сервер запущен: http://localhost:${PORT}                  ║
║   API чата: http://localhost:${PORT}/api/chat               ║
╠══════════════════════════════════════════════════════════╣
║   ${AI_ENABLED ? '✅ AI включён (OpenRouter)' : '⚠️  AI выключен — локальная логика'}                  ║
╚══════════════════════════════════════════════════════════╝
    `);
    
    if (!AI_ENABLED) {
        console.log('💡 Для включения AI добавьте OPENROUTER_API_KEY в backend/.env');
    }
});

module.exports = app;
