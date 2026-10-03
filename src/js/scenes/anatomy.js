/**
 * АНАТОМИЯ: приколотая сцена, прокрутка ведёт камеру вокруг колеса.
 * Шаг = часть колеса + проблема + цены. Колесо реагирует: гвоздь, грыжа,
 * погнутый обод выпрямляется, дисбаланс «бьёт» и затухает, шипы, вело-колесо.
 */
import { rt, onFrame, addMod, clamp } from '../core/runtime.js';
import { anatomySteps } from '../../data/scenes.js';

export function initAnatomy() {
  const sec = document.querySelector('.anat');
  if (!sec) return;
  const steps = [...sec.querySelectorAll('.step')];
  const nav = [...sec.querySelectorAll('[data-step-go]')];
  const title = document.querySelector('[data-stage-title]');
  const call = sec.querySelector('[data-callout]');
  const callT = sec.querySelector('[data-callout-t]');
  const callPath = sec.querySelector('[data-callout-path]');
  const callDot = sec.querySelector('.callout__dot');
  const n = steps.length;
  const pin = sec.querySelector('.anat__pin');
  let cur = -1;
  let enterT = 0;

  const range = () => {
    const sc = rt.scenes.find((s) => s.id === 'anatomy');
    if (!sc) return null;
    const a = sc.top + rt.vh * 0.3;
    const b = sc.top + sc.h - rt.vh;
    return { a, b, L: Math.max(1, b - a) };
  };

  const setStep = (i) => {
    if (i === cur) return;
    const prev = cur;
    cur = i;
    enterT = performance.now();
    steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    nav.forEach((a, k) => a.classList.toggle('is-active', k === i));
    if (title) {
      title.innerHTML = `<span>${anatomySteps[i].part}</span>`;
    }
    if (callT) callT.textContent = anatomySteps[i].callout;
    // события колеса при входе в шаг
    const s = rt.stage;
    if (s && s.ok) {
      const id = anatomySteps[i].id;
      if (id === 'rim') s.state.dent = 1;
      if (id === 'balance') s.state.wobble = 1;
      if (id === 'bike' && prev !== -1) s.state.wobble = 0.8;
    }
  };

  // корректировка целевого состояния колеса во время шагов
  addMod((st) => {
    if (rt.active !== 'anatomy' || cur < 0) { st.dent = 0; st.wobble = 0; return; }
    const id = anatomySteps[cur].id;
    const t = (performance.now() - enterT) / 1000;
    st.dent = id === 'rim' && t < 0.8 ? 1 : 0;
    st.wobble = (id === 'balance' && t < 1.4) || (id === 'bike' && t < 0.9) ? 1 : 0;
    if (id === 'balance' && t > 1.4) st.idle = 1.2;
  });

  onFrame(() => {
    const r = range();
    if (!r) return;
    const y = rt.y;
    const inPin = y >= r.a - rt.vh * 0.2 && y <= r.b + rt.vh * 0.1;
    const p = clamp((y - r.a) / r.L, 0, 0.9999);
    const i = Math.floor(p * n);
    if (inPin || cur === -1) setStep(clamp(i, 0, n - 1));
    nav.forEach((a, k) => a.style.setProperty('--p', clamp(p * n - k, 0, 1).toFixed(3)));
    if (title) document.querySelector('.stage').style.setProperty('--st-o', inPin && !rt.mobile && y < r.b ? '1' : '0');
    // в конце сцены содержимое растворяется — дальше заливка следующей сцены
    const fade = clamp(1 - (y - r.b) / (rt.vh * 0.25), 0, 1);
    pin.style.opacity = fade.toFixed(3);

    // выноска к точке на колесе
    const show = inPin && rt.stage && rt.stage.ok && y > r.a - rt.vh * 0.05;
    call.classList.toggle('is-on', !!show);
    if (!show) return;
    const id = anatomySteps[cur].id;
    const R = rt.stage.builtRim || 0.64;
    let pt;
    if (id === 'tread') pt = rt.stage.project([0, 1.0, 0.06], false);
    else if (id === 'side') pt = rt.stage.project([Math.sin(1.15) * 0.82, Math.cos(1.15) * 0.82, 0.31], false);
    else if (id === 'rim') pt = rt.stage.project([Math.sin(2.2) * R, Math.cos(2.2) * R, 0.09], false);
    else if (id === 'balance') pt = rt.stage.project([Math.sin(2.6) * (R - 0.03), Math.cos(2.6) * (R - 0.03), 0.07], true);
    else if (id === 'studs') pt = rt.stage.project([Math.sin(-0.07) * 1.0, Math.cos(-0.07) * 1.0, 0.155], false);
    else pt = rt.stage.project([Math.sin(0.8) * 0.9, Math.cos(0.8) * 0.9, 0], false);
    const dx = pt.x > rt.vw * 0.62 ? -1 : 1;
    const lx = pt.x + dx * (rt.mobile ? 50 : 110);
    const ly = pt.y - (rt.mobile ? 40 : 80);
    callDot.style.setProperty('--cx', pt.x.toFixed(1) + 'px');
    callDot.style.setProperty('--cy', pt.y.toFixed(1) + 'px');
    callPath.setAttribute('d', `M${pt.x.toFixed(1)} ${pt.y.toFixed(1)}L${lx.toFixed(1)} ${ly.toFixed(1)}H${(lx + dx * 24).toFixed(1)}`);
    const tw = callT.offsetWidth;
    callT.style.setProperty('--lx', (dx > 0 ? lx + 28 : lx - 28 - tw).toFixed(1) + 'px');
    callT.style.setProperty('--ly', (ly - 12).toFixed(1) + 'px');
  });

  // переход к шагу по клику в навигации
  nav.forEach((a, k) =>
    a.addEventListener('click', (e) => {
      const r = range();
      if (!r) return;
      e.preventDefault();
      window.scrollTo({ top: r.a + (r.L / n) * (k + 0.45), behavior: rt.reduced ? 'auto' : 'smooth' });
    })
  );
}
