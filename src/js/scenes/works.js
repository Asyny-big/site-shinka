/**
 * МАСТЕРСКАЯ: реальные фото собраны в барабан (как протектор шины).
 * Прокрутка вращает барабан; мышь наклоняет; кадр спереди — в цвете.
 */
import { rt, onFrame, clamp } from '../core/runtime.js';

export function initWorks() {
  const sec = document.querySelector('.works');
  const cyl = sec && sec.querySelector('[data-drum-cyl]');
  if (!cyl) return;
  const faces = [...cyl.querySelectorAll('.face')];
  const n = faces.length;
  const STEP = 360 / n;
  const num = sec.querySelector('[data-drum-n]');
  const pin = sec.querySelector('.works__pin');
  let rot = 0;
  let tilt = 0;
  let shown = -1;

  const range = () => {
    const sc = rt.scenes.find((s) => s.id === 'works');
    if (!sc) return null;
    const a = sc.top + rt.vh * 0.6;
    const b = sc.top + sc.h - rt.vh;
    return { a, b, L: Math.max(1, b - a) };
  };

  onFrame((dt) => {
    if (rt.reduced) return;
    const r = range();
    if (!r) return;
    if (rt.y < r.a - rt.vh * 1.2 || rt.y > r.b + rt.vh) return;
    pin.style.opacity = clamp(1 - (rt.y - r.b) / (rt.vh * 0.25), 0, 1).toFixed(3);
    const p = clamp((rt.y - r.a) / r.L, 0, 1);
    const target = -p * (n - 1) * STEP;
    rot += (target - rot) * (1 - Math.exp(-dt * 8));
    const tTilt = rt.hover && rt.py >= 0 ? (rt.py / rt.vh - 0.5) * -8 : 0;
    tilt += (tTilt - tilt) * (1 - Math.exp(-dt * 4));
    cyl.style.setProperty('--rot', rot.toFixed(2) + 'deg');
    cyl.style.setProperty('--tilt-x', tilt.toFixed(2) + 'deg');
    const front = Math.round(-rot / STEP);
    faces.forEach((f, i) => {
      let d = ((i * STEP + rot) % 360 + 540) % 360 - 180; // −180..180
      const k = clamp(1 - Math.abs(d) / 90, 0, 1);
      f.style.setProperty('--fo', (0.15 + k * 0.85).toFixed(2));
      f.style.setProperty('--fg', (1 - k).toFixed(2));
      f.style.setProperty('--fb', (0.45 + k * 0.5).toFixed(2));
      f.style.setProperty('--cap-o', i === front ? '1' : '0');
      f.style.setProperty('--px', (d * -0.6).toFixed(1) + 'px');
    });
    if (front !== shown && num) {
      shown = front;
      num.textContent = String(clamp(front, 0, n - 1) + 1).padStart(2, '0');
    }
  });

  const go = (dir) => {
    const r = range();
    if (!r) return;
    const k = clamp(Math.round(-rot / STEP) + dir, 0, n - 1);
    window.scrollTo({ top: r.a + (r.L * k) / (n - 1), behavior: rt.reduced ? 'auto' : 'smooth' });
  };
  sec.querySelector('[data-drum-prev]')?.addEventListener('click', () => go(-1));
  sec.querySelector('[data-drum-next]')?.addEventListener('click', () => go(1));
}
