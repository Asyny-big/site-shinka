import { $, $$, isDesktop, isTouch, ssGet, ssSet, emit, scrollToEl } from '../utils/dom.js';
import { ask } from '../services/assistant.js';
import { assistantCopy as c } from '../../data/assistant.js';
import { business as b } from '../../data/business.js';

/** Интерфейс ИИ-консультанта: плавающая «пилюля» → панель (desktop) / шторка (телефон) */
export function initChat() {
  const root = $('[data-ai]');
  if (!root) return;
  const pill = $('[data-ai-toggle]', root);
  const panel = $('#ai-panel');
  const log = $('[data-ai-log]', root);
  const form = $('[data-ai-form]', root);
  const input = $('textarea', form);
  const send = $('.ai__send', form);
  const mode = $('[data-ai-mode]', root);
  let started = false;
  let busy = false;
  let lastFocus = null;

  const time = () => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // ссылки на телефон внутри текста ответа делаем кликабельными
  const linkify = (s) => esc(s).replace(/\+7\s?\(?950\)?\s?172-55-14/g, (m) => `<a href="${b.phone.href}">${m}</a>`);

  function bubble(role, text, { actions = [], meta } = {}) {
    const m = document.createElement('div');
    m.className = `msg msg--${role}`;
    let acts = '';
    if (actions.length) {
      acts =
        '<div class="msg__acts">' +
        actions
          .map((a, i) => {
            if (a.type === 'call') return `<a class="is-call" href="${b.phone.href}" data-phone>☎ ${esc(a.label)}</a>`;
            if (a.type === 'map') return `<a href="${b.links.yandexRoute}" target="_blank" rel="noopener">⌖ ${esc(a.label)}</a>`;
            if (a.type === 'link') return `<a href="${a.href}" target="_blank" rel="noopener">${esc(a.label)} ↗</a>`;
            return `<button type="button" data-act="${i}">→ ${esc(a.label)}</button>`;
          })
          .join('') +
        '</div>';
    }
    m.innerHTML = `<p class="msg__meta">${role === 'user' ? 'Вы' : 'ИИ'} · ${meta || time()}</p><div class="msg__b">${linkify(text)}</div>${acts}`;
    $$('[data-act]', m).forEach((btn) =>
      btn.addEventListener('click', () => {
        const a = actions[Number(btn.dataset.act)];
        if (!isDesktop()) close(false);
        if (a.type === 'service') emit('service', { service: a.service, option: a.option });
        if (a.type === 'section') scrollToEl(document.querySelector(a.target));
      })
    );
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }

  function typing(on) {
    let t = $('.typing', log);
    if (on && !t) {
      t = document.createElement('p');
      t.className = 'typing';
      t.innerHTML = `<svg viewBox="-12 -12 24 24" aria-hidden="true"><circle r="9"/><path d="M0-9V9M-9 0H9"/></svg>${esc(c.typing)}`;
      log.appendChild(t);
      log.scrollTop = log.scrollHeight;
    } else if (!on && t) t.remove();
  }

  function start() {
    if (started) return;
    started = true;
    bubble('bot', `${c.greeting}\n\n${c.disclaimer}`, { meta: 'онлайн' });
  }

  function open(focusInput = true) {
    if (root.classList.contains('is-open')) return;
    lastFocus = document.activeElement;
    panel.hidden = false;
    panel.classList.remove('is-closing');
    root.classList.add('is-opening');
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('is-opening')));
    root.classList.add('is-open');
    hideBubble();
    root.classList.remove('is-hint');
    pill.setAttribute('aria-expanded', 'true');
    start();
    if (!isDesktop()) document.documentElement.style.overflow = 'hidden';
    if (focusInput && !isTouch()) setTimeout(() => input.focus(), 60);
    else setTimeout(() => $('.ai__close', panel).focus({ preventScroll: true }), 60);
  }
  function close(restore = true) {
    if (!root.classList.contains('is-open')) return;
    root.classList.remove('is-open');
    panel.classList.add('is-closing');
    setTimeout(() => { if (!root.classList.contains('is-open')) panel.hidden = true; panel.classList.remove('is-closing'); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 560);
    pill.setAttribute('aria-expanded', 'false');
    document.documentElement.style.overflow = '';
    if (restore && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  async function submit(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    open(false);
    busy = true;
    send.disabled = true;
    root.dataset.state = 'busy';
    bubble('user', text);
    input.value = '';
    autosize();
    typing(true);
    const t0 = performance.now();
    let r;
    try {
      r = await ask(text);
    } catch (e) {
      r = { text: `Произошла ошибка. Позвоните нам: ${b.phone.display}`, actions: [{ type: 'call', label: 'Позвонить' }], source: 'local' };
    }
    // небольшая пауза, чтобы мгновенный локальный ответ не «моргал»
    const wait = Math.max(0, 450 - (performance.now() - t0));
    await new Promise((res) => setTimeout(res, wait));
    typing(false);
    bubble('bot', r.text, { actions: r.actions });
    mode.textContent = r.source === 'ai' ? c.subtitle : 'Ответ из справочника сайта';
    mode.classList.toggle('is-local', r.source !== 'ai');
    busy = false;
    send.disabled = false;
    root.dataset.state = 'idle';
  }

  function autosize() {
    input.style.height = 'auto';
    input.style.height = Math.min(140, input.scrollHeight) + 'px';
  }

  pill.addEventListener('click', () => (root.classList.contains('is-open') ? close() : open()));
  $('[data-ai-close]', root).addEventListener('click', () => close());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit(input.value);
  });
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submit(input.value);
    }
  });
  $$('[data-ai-q]', root).forEach((btn) => btn.addEventListener('click', () => submit(btn.dataset.aiQ)));
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  // клик вне панели закрывает её на desktop (как раньше)
  document.addEventListener('pointerdown', (e) => {
    if (!isDesktop() || !root.classList.contains('is-open')) return;
    if (root.contains(e.target) || e.target.closest('[data-ai-open],[data-ai-ask]')) return;
    close(false);
  });

  // внешние кнопки
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-ai-open]');
    if (o) { e.preventDefault(); open(); return; }
    const q = e.target.closest('[data-ai-ask]');
    if (q) { e.preventDefault(); submit(q.dataset.aiAsk); }
  });
  const inline = $('[data-ai-inline]');
  if (inline) {
    inline.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = inline.querySelector('input');
      const v = f.value;
      f.value = '';
      if (v.trim()) submit(v);
      else open();
    });
  }

  /* ---------- живое присутствие: глаз следит за курсором, реплики по сценам ---------- */
  const pupil = root.querySelector('[data-ai-pupil]');
  const eye = pupil && pupil.parentElement;
  if (pupil) {
    addEventListener('pointermove', (e) => {
      const r = eye.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 300) * 9;
      pupil.style.setProperty('--ex', ((dx / d) * k).toFixed(1) + 'px');
      pupil.style.setProperty('--ey', ((dy / d) * k).toFixed(1) + 'px');
    }, { passive: true });
  }
  const bub = root.querySelector('[data-ai-bubble]');
  const bubT = root.querySelector('[data-ai-bubble-t]');
  const bubA = root.querySelector('[data-ai-bubble-acts]');
  let bubTimer = 0;
  function hideBubble() {
    if (!bub) return;
    bub.hidden = true;
    root.classList.remove('is-ping');
  }
  function showBubble(text, acts) {
    if (!bub || root.classList.contains('is-open')) return;
    bubT.textContent = text;
    bubA.innerHTML = '';
    acts.forEach((a, i) => {
      let el;
      if (a.href) { el = document.createElement('a'); el.href = a.href; if (/^https?:/.test(a.href)) { el.target = '_blank'; el.rel = 'noopener'; } }
      else { el = document.createElement('button'); el.type = 'button'; }
      el.textContent = a.label;
      if (i === 0) el.className = 'is-main';
      el.addEventListener('click', (e) => {
        hideBubble();
        if (a.ask) { e.preventDefault(); submit(a.ask); }
        else if (a.open) { e.preventDefault(); open(); }
      });
      bubA.appendChild(el);
    });
    bub.hidden = false;
    root.classList.add('is-ping');
    clearTimeout(bubTimer);
    bubTimer = setTimeout(hideBubble, 9000);
  }
  root.querySelector('[data-ai-bubble-x]')?.addEventListener('click', hideBubble);
  window.ydShowBubble = showBubble;
  window.ydHideBubble = hideBubble;
}

/** Контекстные реплики ассистента — по одной на сцену за сессию */
export function initPresence(rt) {
  const HINTS = {
    hero: { delay: 6500, text: 'Привет! Я ИИ-консультант мастерской. Подсказать цену или график?', acts: [{ label: 'Сколько стоит переобуть R16?', ask: 'Сколько стоит переобуть R16?' }, { label: 'Открыть чат', open: true }] },
    anatomy: { delay: 4000, text: 'Не уверены, что с колесом? Опишите словами — подскажу услугу и цену.', acts: [{ label: 'Спросить', open: true }] },
    prices: { delay: 3500, text: 'Назовите диаметр — скажу цену переобувки. Например: «R17».', acts: [{ label: 'R16?', ask: 'Сколько стоит переобуть R16?' }, { label: 'R17?', ask: 'Сколько стоит переобуть R17?' }] },
    finish: { delay: 2500, text: `Проложить маршрут до ул. Ленинградская, 2/1?`, acts: [{ label: 'Маршрут', href: b.links.yandexRoute }, { label: 'Позвонить', href: b.phone.href }] },
  };
  const shown = new Set();
  try { (sessionStorage.getItem('yd-hints') || '').split(',').filter(Boolean).forEach((x) => shown.add(x)); } catch (e) { /* noop */ }
  let cur = '';
  let timer = 0;
  let hideT = 0;
  let shownAt = -1;
  const hide = () => { clearTimeout(hideT); shownAt = -1; if (window.ydHideBubble) window.ydHideBubble(); };
  setInterval(() => {
    // подсказка не должна долго закрывать контент: на телефоне прячем при прокрутке
    if (shownAt >= 0 && rt.mobile && Math.abs(window.scrollY - shownAt) > innerHeight * 0.6) hide();
    if (rt.active === cur) return;
    cur = rt.active;
    clearTimeout(timer);
    hide();
    const h = HINTS[cur];
    if (!h || shown.has(cur)) return;
    // на телефоне карточки анатомии и прайса занимают низ экрана — там подсказка мешала бы читать
    if (rt.mobile && (cur === 'anatomy' || cur === 'prices')) return;
    const id = cur;
    timer = setTimeout(() => {
      if (rt.active !== id || !window.ydShowBubble) return;
      shown.add(id);
      try { sessionStorage.setItem('yd-hints', [...shown].join(',')); } catch (e) { /* noop */ }
      window.ydShowBubble(h.text, h.acts);
      shownAt = window.scrollY;
      clearTimeout(hideT);
      hideT = setTimeout(hide, rt.mobile ? 7000 : 12000);
    }, h.delay);
  }, 500);
}
