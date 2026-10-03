/**
 * ЦЕНЫ: колесо — поворотный селектор услуг. Подписи услуг стоят по кругу
 * вокруг 3D-колеса; выбранная — на «3 часа», указывает на табло.
 * Крутите колесо (drag), кликайте подписи или стрелками на клавиатуре.
 * Колесо реагирует: диаметр меняет посадку диска, штамповка/литьё,
 * шипы, грузик, превращение в вело-колесо.
 */
import { rt, onFrame, addMod, clamp } from '../core/runtime.js';
import { business, rub, findPrice, serviceById } from '../../data/business.js';

const RIM = { r13: 0.6, r17: 0.67, r19: 0.74 };

export function initPrices() {
  const sec = document.querySelector('.prices');
  if (!sec) return;
  const dial = sec.querySelector('[data-dialsel]');
  const tabs = [...sec.querySelectorAll('.dl')];
  const panels = [...sec.querySelectorAll('[role="tabpanel"]')];
  const ticksG = sec.querySelector('[data-ring-ticks]');
  const n = tabs.length;
  const STEP = 360 / n;
  let cur = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
  if (cur < 0) cur = 0;
  let opt = {};
  let ringA = -cur * STEP;
  let ringT = ringA;
  let dragging = false;

  // риски кольца
  if (ticksG) {
    let s = '';
    for (let i = 0; i < n * 6; i++) {
      const a = (i / (n * 6)) * Math.PI * 2;
      const mj = i % 6 === 0;
      const r1 = mj ? 88 : 93;
      s += `<line class="${mj ? 'mj' : ''}" x1="${(Math.sin(a) * r1).toFixed(2)}" y1="${(-Math.cos(a) * r1).toFixed(2)}" x2="${(Math.sin(a) * 98).toFixed(2)}" y2="${(-Math.cos(a) * 98).toFixed(2)}"/>`;
    }
    ticksG.innerHTML = s;
    ticksG.insertAdjacentHTML('afterend', '<path class="ptr" d="M100 0 l10 -6 v12z"/>');
  }

  /* ---------- крупная цена: одометр с «размытием движения» ---------- */
  function renderBig(panel, input) {
    const box = panel.querySelector('[data-big-val]');
    const label = panel.querySelector('[data-big-label]');
    if (!box || !input) return;
    label.textContent = input.dataset.label;
    const amount = input.dataset.amount ? Number(input.dataset.amount) : null;
    const from = input.dataset.from === '1';
    const plain = amount == null ? input.dataset.text || 'уточняет мастер' : (from ? 'от ' : '') + rub(amount) + ' ₽';
    if (amount == null) {
      box.innerHTML = `<span class="big__text">${input.dataset.text || 'уточняет мастер'}</span>`;
      return;
    }
    const str = rub(amount);
    const digits = [...str]
      .map((ch) =>
        /\d/.test(ch)
          ? `<span class="odo"><span data-d="${ch}" style="transform:translateY(-${rt.reduced ? ch : (Number(ch) + 5) % 10}em)">${'0123456789'
              .split('')
              .map((d) => `<span>${d}</span>`)
              .join('')}</span></span>`
          : `<span>${ch}</span>`
      )
      .join('');
    box.innerHTML = `<span class="sr-only">${plain}</span><span class="big__from" aria-hidden="true" ${from ? '' : 'hidden'}>от</span><span class="big__num" aria-hidden="true">${digits}</span><span class="big__cur" aria-hidden="true">₽</span>`;
    if (!rt.reduced) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          box.querySelectorAll('.odo > span').forEach((s, k) => {
            s.classList.add('is-moving');
            s.style.transitionDelay = k * 60 + 'ms';
            s.style.transform = `translateY(-${s.dataset.d}em)`;
            setTimeout(() => s.classList.remove('is-moving'), 650 + k * 60);
          })
        )
      );
    }
  }

  /* ---------- калькулятор шипов ---------- */
  const calc = sec.querySelector('[data-studcalc]');
  let studN = 20;
  if (calc) {
    const nIn = calc.querySelector('[data-stud-n]');
    const rIn = calc.querySelector('[data-stud-range]');
    const out = calc.querySelector('[data-stud-out]');
    const per = findPrice('stud').price.amount;
    const sync = (v) => {
      studN = clamp(parseInt(v, 10) || 1, 1, 200);
      nIn.value = studN;
      rIn.value = Math.min(120, studN);
      out.textContent = `${studN} × ${per} ₽ = ${rub(studN * per)} ₽`;
    };
    nIn.addEventListener('input', () => sync(nIn.value));
    rIn.addEventListener('input', () => sync(rIn.value));
    calc.querySelectorAll('[data-stud-step]').forEach((b) => b.addEventListener('click', () => sync(studN + Number(b.dataset.studStep))));
  }

  /* ---------- выбор услуги ---------- */
  function select(i, optId, { focus = false, fromDrag = false, user = false } = {}) {
    i = ((i % n) + n) % n;
    const tab = tabs[i];
    const sid = tab.dataset.service;
    const panel = panels.find((p) => p.dataset.panel === sid);
    const apply = () => {
      tabs.forEach((t, k) => {
        t.setAttribute('aria-selected', k === i);
        t.tabIndex = k === i ? 0 : -1;
      });
      panels.forEach((p) => (p.hidden = p !== panel));
      let input = optId ? panel.querySelector(`input[value="${optId}"]`) : panel.querySelector('input:checked');
      if (!input) input = panel.querySelector('input');
      input.checked = true;
      opt[sid] = input.value;
      renderBig(panel, input);
    };
    const changed = i !== cur;
    cur = i;
    // кольцо поворачивается кратчайшим путём
    const target = -i * STEP;
    let d = target - ringT;
    d = ((d % 360) + 540) % 360 - 180;
    if (!fromDrag) ringT += d;
    if (changed && document.startViewTransition && !rt.reduced && !rt.mobile) document.startViewTransition(apply);
    else apply();
    if (focus) tab.focus();
    if (rt.mobile) {
      const strip = tab.parentElement;
      strip.scrollTo({ left: tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2, behavior: rt.reduced ? 'auto' : 'smooth' });
      // заголовок новой услуги не должен прятаться под липкой лентой вкладок
      if (user) {
        const sb = strip.closest('.dialsel') || strip;
        const edge = sb.getBoundingClientRect().bottom + 8;
        const top = panel.getBoundingClientRect().top;
        if (top < edge) window.scrollTo({ top: window.scrollY + top - edge, behavior: rt.reduced ? 'auto' : 'smooth' });
      }
    }
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i, null, { user: true }));
    t.addEventListener('keydown', (e) => {
      const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      let j = null;
      if (e.key in keys) j = i + keys[e.key];
      if (e.key === 'Home') j = 0;
      if (e.key === 'End') j = n - 1;
      if (j != null) { e.preventDefault(); select(j, null, { focus: true }); }
    });
  });
  panels.forEach((p) =>
    p.addEventListener('change', (e) => {
      if (e.target.matches('input[type="radio"]')) {
        opt[p.dataset.panel] = e.target.value;
        renderBig(p, e.target);
      }
    })
  );

  // крутим колесо → крутится кольцо услуг
  (rt.dragHandlers || (rt.dragHandlers = [])).push((d, phase) => {
    if (rt.active !== 'prices' || rt.mobile) return;
    if (phase === 'start') dragging = true;
    if (phase === 'move') { ringT += (d * 180) / Math.PI; ringA = ringT; }
    if (phase === 'end') {
      dragging = false;
      const i = Math.round(-ringT / STEP);
      ringT = -i * STEP;
      select(i, null, { fromDrag: true });
    }
  });

  // реакция колеса на выбранную услугу
  addMod((st) => {
    if (rt.active !== 'prices') { if (rt.stage && rt.stage.steel) rt.stage.setSteel(false); st.rimR = 0.64; return; }
    const sid = tabs[cur].dataset.service;
    const o = opt[sid] || serviceById(sid).prices[0].id;
    st.rimR = sid === 'season' ? RIM[o] || 0.64 : 0.64;
    if (rt.stage) rt.stage.setSteel(sid === 'rims' && o === 'steel');
    st.studs = sid === 'studs' ? 1 : 0;
    st.hiStud = sid === 'studs' ? 0.6 : 0;
    st.weight = sid === 'balance' ? 1 : 0;
    st.hiRim = sid === 'rims' ? 0.6 : 0;
    st.mode = sid === 'bike' || sid === 'buyout' ? 1 : 0;
    if (sid === 'studs' && !rt.mobile) { st.pitch = 30; }
  });

  // кольцо: позиция вокруг колеса + вращение
  let lastRing = ringA;
  onFrame((dt) => {
    if (rt.mobile || !dial) return;
    const on = rt.active === 'prices' && rt.weights.prices > 0.6 && rt.wheel.a > 0.5;
    dial.style.setProperty('--dial-o', on ? '1' : '0');
    dial.classList.toggle('is-live', on);
    if (!dragging) ringA += (ringT - ringA) * (1 - Math.exp(-dt * 7));
    const dA = ringA - lastRing;
    lastRing = ringA;
    if (rt.stage && Math.abs(dA) > 0.001 && !dragging) rt.stage.dragBy((-dA * Math.PI) / 180);
    if (!on) return;
    const w = rt.wheel;
    const R = w.r * 1.16;
    dial.style.transform = `translate3d(${w.x.toFixed(1)}px, ${w.y.toFixed(1)}px, 0)`;
    dial.style.setProperty('--rr', R.toFixed(1) + 'px');
    if (ticksG) ticksG.setAttribute('transform', `rotate(${ringA.toFixed(2)})`);
    // подписи стоят на дуге справа от колеса: выбранная — на «3 часа»
    const ARC = 21;
    tabs.forEach((t, i) => {
      const rel = i + ringA / STEP; // 0 — выбранная
      const deg = 90 + rel * ARC;
      const a = (deg * Math.PI) / 180;
      const sx = Math.sin(a), cy = -Math.cos(a);
      t.style.setProperty('--lx', (sx * R).toFixed(1) + 'px');
      t.style.setProperty('--ly', (cy * R).toFixed(1) + 'px');
      t.style.setProperty('--ax', '0%');
      const k = clamp(1 - Math.abs(rel) / 3.6, 0, 1);
      t.style.opacity = k.toFixed(2);
      t.style.pointerEvents = k > 0.15 ? 'auto' : 'none';
    });
  });

  // переходы в прайс из hero, «анатомии» и из ИИ
  const goto = (sid, optId) => {
    const i = tabs.findIndex((t) => t.dataset.service === sid);
    if (i < 0) return;
    select(i, optId);
    const target = rt.mobile ? sec.querySelector('.board') : sec.querySelector('.prices__in');
    const y = target.getBoundingClientRect().top + window.scrollY - (rt.mobile ? 120 : rt.vh * 0.08);
    window.scrollTo({ top: y, behavior: rt.reduced ? 'auto' : 'smooth' });
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-goto-service]');
    if (!a) return;
    e.preventDefault();
    goto(a.dataset.gotoService, a.dataset.gotoOption);
  });
  document.addEventListener('yd:service', (e) => goto(e.detail.service, e.detail.option));

  select(cur);
}
