document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const burger = document.getElementById('burger');
    const nav = document.getElementById('nav');

    if (burger && nav) {
        burger.addEventListener('click', function() {
            burger.classList.toggle('active');
            nav.classList.toggle('active');
        });

        // Close menu on link click
        const navLinks = nav.querySelectorAll('.nav__link');
        navLinks.forEach(function(link) {
            link.addEventListener('click', function() {
                burger.classList.remove('active');
                nav.classList.remove('active');
            });
        });
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetElement.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Header shadow on scroll
    const header = document.querySelector('.header');
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 100) {
            header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
        } else {
            header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1)';
        }
    });

    // Animate elements on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Add initial styles and observe elements
    const animatedElements = document.querySelectorAll('.service-card, .gallery__item, .review-card, .stat, .avito-card');
    
    animatedElements.forEach(function(el) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Phone number click tracking (for analytics)
    const phoneLinks = document.querySelectorAll('a[href^="tel:"]');
    
    phoneLinks.forEach(function(link) {
        link.addEventListener('click', function() {
            // Can be used for analytics tracking
            console.log('Phone click:', this.href);
        });
    });

    // ===========================================
    // ОНЛАЙН-ЧАТ КОНСУЛЬТАНТА
    // ===========================================
    
    const chatToggle = document.getElementById('chatToggle');
    const chatWindow = document.getElementById('chatWindow');
    const chatClose = document.getElementById('chatClose');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    const chatTyping = document.getElementById('chatTyping');
    
    let chatOpened = false;
    let isSubmitting = false; // Блокировка повторной отправки
    let chatSessionId = null; // ID сессии для диалога
    
    // Приветственное сообщение (отображается до первого ответа AI)
    const welcomeMessage = '👋 Здравствуйте!\nЭто ИИ-консультант сайта шиномонтажа.\nПодскажу по услугам, ценам и графику работы.\nОтветы справочные, а точные детали лучше уточнить по телефону: +7 (950) 172-55-14.';
    
    // Функция форматирования времени
    function formatTime(date) {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    
    // Функция добавления сообщения
    function addMessage(text, isUser) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message ' + (isUser ? 'chat-message--user' : 'chat-message--bot');
        
        // Обработка переносов строк
        const formattedText = text.replace(/\n/g, '<br>');
        
        messageDiv.innerHTML = formattedText + '<span class="chat-message__time">' + formatTime(new Date()) + '</span>';
        
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
    }
    
    // Прокрутка вниз
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Показать индикатор печати
    function showTyping() {
        chatTyping.classList.add('active');
        scrollToBottom();
    }
    
    // Скрыть индикатор печати
    function hideTyping() {
        chatTyping.classList.remove('active');
    }
    
    // Открытие чата
    function openChat() {
        chatToggle.classList.add('active');
        chatWindow.classList.add('active');
        
        // Показываем приветствие только при первом открытии
        if (!chatOpened) {
            chatOpened = true;
            setTimeout(function() {
                addMessage(welcomeMessage, false);
            }, 300);
        }
        
        // Фокус на поле ввода (для десктопа)
        if (window.innerWidth > 480) {
            setTimeout(function() {
                chatInput.focus();
            }, 350);
        }
    }
    
    // Закрытие чата
    function closeChat() {
        chatToggle.classList.remove('active');
        chatWindow.classList.remove('active');
    }
    
    // Переключение чата
    function toggleChat() {
        if (chatWindow.classList.contains('active')) {
            closeChat();
        } else {
            openChat();
        }
    }
    
    // Блокировка/разблокировка формы
    function setFormDisabled(disabled) {
        chatInput.disabled = disabled;
        chatForm.querySelector('button[type="submit"]').disabled = disabled;
        isSubmitting = disabled;
    }
    
    // Отправка сообщения на сервер
    async function sendToServer(message) {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message: message,
                    sessionId: chatSessionId // Передаём sessionId для истории диалога
                }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Сохраняем sessionId из ответа сервера
                if (data.sessionId) {
                    chatSessionId = data.sessionId;
                }
                return data.reply;
            } else {
                // Ошибка от сервера
                console.error('Server error:', data);
                return data.reply || 'Произошла ошибка. Позвоните нам: +7 (950) 172-55-14';
            }
        } catch (error) {
            console.error('Network error:', error);
            // Сеть недоступна — используем локальный fallback
            return getLocalFallback(message);
        }
    }
    
    // Локальный fallback (если сервер недоступен)
    function getLocalFallback(message) {
        const lower = message.toLowerCase();
        
        if (lower.match(/(время|график|работа|когда|час|открыт)/)) {
            return 'Мы работаем:\nПн–Сб: 9:00–18:00\nВоскресенье — выходной.';
        }
        
        if (lower.match(/(адрес|где|находи|доехать)/)) {
            return 'Мы находимся по адресу:\nг. Сарапул, ул. Ленинградская, 2/1';
        }
        
        if (lower.match(/(телефон|позвон|номер)/)) {
            return 'Наш телефон: +7 (950) 172-55-14';
        }
        
        if (lower.match(/(привет|здравств|добр)/)) {
            return 'Здравствуйте! Сейчас чат работает в ограниченном режиме. Позвоните нам: +7 (950) 172-55-14';
        }
        
        return 'Извините, сейчас чат временно недоступен.\nПозвоните нам: +7 (950) 172-55-14';
    }
    
    // Обработка отправки формы
    async function handleSubmit(e) {
        e.preventDefault();
        
        // Защита от повторной отправки
        if (isSubmitting) return;
        
        const message = chatInput.value.trim();
        if (!message) return;
        
        // Ограничение длины
        if (message.length > 500) {
            addMessage('Сообщение слишком длинное. Пожалуйста, сократите его.', false);
            return;
        }
        
        // Блокируем форму
        setFormDisabled(true);
        
        // Добавляем сообщение пользователя
        addMessage(message, true);
        chatInput.value = '';
        
        // Показываем индикатор печати
        showTyping();
        
        try {
            // Отправляем на сервер
            const reply = await sendToServer(message);
            
            // Скрываем индикатор и показываем ответ
            hideTyping();
            addMessage(reply, false);
        } catch (error) {
            console.error('Chat error:', error);
            hideTyping();
            addMessage('Произошла ошибка. Позвоните нам: +7 (950) 172-55-14', false);
        } finally {
            // Разблокируем форму
            setFormDisabled(false);
            
            // Возвращаем фокус на поле ввода
            if (window.innerWidth > 480) {
                chatInput.focus();
            }
        }
    }
    
    // Навешиваем события
    if (chatToggle && chatWindow) {
        chatToggle.addEventListener('click', toggleChat);
        chatClose.addEventListener('click', closeChat);
        chatForm.addEventListener('submit', handleSubmit);
        
        // Закрытие по Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && chatWindow.classList.contains('active')) {
                closeChat();
            }
        });
        
        // Закрытие по клику вне окна (только для десктопа)
        document.addEventListener('click', function(e) {
            if (window.innerWidth > 480 && 
                chatWindow.classList.contains('active') && 
                !chatWindow.contains(e.target) && 
                !chatToggle.contains(e.target)) {
                closeChat();
            }
        });
    }
});
