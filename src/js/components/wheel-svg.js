/**
 * Генератор SVG колеса. Чистые функции → строка SVG.
 * Используется и при сборке (hero рендерится статически), и в браузере.
 * Координаты: центр (0,0), viewBox -500..500. Угол 0 — «12 часов», по часовой.
 */

const TAU = Math.PI * 2;
const r2 = (n) => Math.round(n * 10) / 10;

export function pt(r, a) {
  return `${r2(r * Math.sin(a))} ${r2(-r * Math.cos(a))}`;
}

/** Замкнутый контур окружности радиуса r с «вмятиной» (для правки дисков). */
export function rimPath(r, dent = 0, center = 2.2, width = 0.32, depth = 26) {
  const steps = 120;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * TAU;
    let da = a - center;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const rr = r - dent * depth * Math.exp(-(da * da) / (width * width));
    d += (i ? 'L' : 'M') + pt(rr, a);
  }
  return d + 'Z';
}

/** Протектор: направленные блоки «ёлочкой». */
function tread(n, rIn, rOut) {
  let d = '';
  const w = (TAU / n) * 0.58;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const sk = (i % 2 ? 1 : -1) * w * 0.35;
    d += `M${pt(rOut, a - w / 2)}L${pt(rOut, a + w / 2)}L${pt(rIn, a + w / 2 + sk)}L${pt(rIn, a - w / 2 + sk)}Z`;
  }
  return d;
}

/** Литые спицы: 5 сдвоенных лучей. */
function alloySpokes(rHub, rOut) {
  let d = '';
  for (let i = 0; i < 5; i++) {
    const base = (i / 5) * TAU;
    for (const off of [-0.13, 0.13]) {
      const a = base + off;
      d += `M${pt(rHub, a - 0.1)}L${pt(rOut, a - 0.045 + off * 0.35)}L${pt(rOut, a + 0.045 + off * 0.35)}L${pt(rHub, a + 0.1)}Z`;
    }
  }
  return d;
}

/** Штампованный диск: отверстия по кругу. */
function steelHoles(n, r, size) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + TAU / n / 2;
    const [x, y] = pt(r, a).split(' ');
    s += `<ellipse cx="${x}" cy="${y}" rx="${size}" ry="${r2(size * 0.72)}" transform="rotate(${r2((a * 180) / Math.PI)} ${x} ${y})"/>`;
  }
  return s;
}

function lugs(n, r, size) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const [x, y] = pt(r, (i / n) * TAU).split(' ');
    s += `<circle cx="${x}" cy="${y}" r="${size}"/>`;
  }
  return s;
}

function studs(n, r) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const [x, y] = pt(r, ((i + 0.5) / n) * TAU).split(' ');
    s += `<circle class="w-stud" data-i="${i}" cx="${x}" cy="${y}" r="5.5"/>`;
  }
  return s;
}

function ticks(n, rIn, rOut, every = 5, longOut = 14) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const o = i % every === 0 ? longOut : 0;
    d += `M${pt(rIn, a)}L${pt(rOut + o, a)}`;
  }
  return d;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/**
 * Автомобильное колесо.
 * opts: id (префикс для id), top/bottom — надписи на боковине, variant 'alloy'|'steel',
 *       withStuds, detail (рисовать мелочи)
 */
export function carWheelSVG(opts = {}) {
  const id = opts.id || 'w';
  const top = esc(opts.top || 'ШИНОМОНТАЖ У ДЕНИСА · САРАПУЛ');
  const bottom = esc(opts.bottom || 'ЛЕНИНГРАДСКАЯ 2/1 · ПН–СБ 9:00–18:00');
  const small = esc(opts.small || '');
  return `
<defs>
  <radialGradient id="${id}-side" r="0.5">
    <stop offset="0.64" stop-color="var(--w-side-in, #1d1d1b)"/>
    <stop offset="0.8" stop-color="var(--w-side-mid, #121211)"/>
    <stop offset="0.98" stop-color="var(--w-side-out, #0a0a09)"/>
  </radialGradient>
  <radialGradient id="${id}-face" cx="0.42" cy="0.38" r="0.62">
    <stop offset="0" stop-color="var(--w-metal-hi, #c9c7c0)"/>
    <stop offset="0.55" stop-color="var(--w-metal, #8d8b84)"/>
    <stop offset="1" stop-color="var(--w-metal-lo, #4b4a46)"/>
  </radialGradient>
  <path id="${id}-arcT" d="M -372 0 A 372 372 0 1 1 372 0"/>
  <path id="${id}-arcB" d="M -424 0 A 424 424 0 0 0 424 0"/>
  <path id="${id}-arcS" d="M 0 -440 A 440 440 0 1 1 -0.1 -440"/>
</defs>
<g class="w-tire">
  <circle class="w-band" r="408" fill="none" stroke="url(#${id}-side)" stroke-width="168"/>
  <path class="w-tread" d="${tread(64, 450, 494)}"/>
  <circle class="w-groove" r="450" fill="none"/>
  <circle class="w-bead" r="333" fill="none"/>
  <g class="w-letters">
    <text class="w-emboss"><textPath href="#${id}-arcT" startOffset="50%" text-anchor="middle">${top}</textPath></text>
    <text class="w-emboss"><textPath href="#${id}-arcB" startOffset="50%" text-anchor="middle">${bottom}</textPath></text>
    ${small ? `<text class="w-emboss w-emboss--s"><textPath href="#${id}-arcS" startOffset="61%" text-anchor="middle">${small}</textPath></text>` : ''}
  </g>
  <g class="w-studs">${studs(32, 472)}</g>
  <g class="w-dmg w-dmg--puncture">
    <circle cx="0" cy="-472" r="9"/>
    <path d="M -26 -472 H 26 M 0 -498 V -446"/>
  </g>
  <g class="w-dmg w-dmg--cut"><path d="${'M' + pt(352, -1.15) + 'L' + pt(418, -1.02)}"/></g>
  <g class="w-dmg w-dmg--bulge"><ellipse cx="${pt(392, 1.25).split(' ')[0]}" cy="${pt(392, 1.25).split(' ')[1]}" rx="30" ry="46" transform="rotate(${r2((1.25 * 180) / Math.PI)} ${pt(392, 1.25)})"/></g>
</g>
<g class="w-rim">
  <g class="w-rim-scale">
    <path class="w-lip" d="${rimPath(328)}"/>
    <circle class="w-barrel" r="306"/>
    <circle class="w-face" r="292" fill="url(#${id}-face)"/>
    <g class="w-alloy"><circle class="w-face-dark" r="282"/><path class="w-spokes" fill="url(#${id}-face)" d="${alloySpokes(84, 284)}"/></g>
    <g class="w-steel"><g class="w-holes">${steelHoles(8, 200, 40)}</g><circle class="w-steel-ring" r="250" fill="none"/></g>
    <circle class="w-hub" r="92" fill="url(#${id}-face)"/>
    <g class="w-lugs">${lugs(5, 56, 12)}</g>
    <circle class="w-cap" r="30"/>
    <rect class="w-valve" x="-7" y="-318" width="14" height="30" rx="4" transform="rotate(200)"/>
    <path class="w-weight" d="${'M' + pt(298, 2.45) + 'A298 298 0 0 1 ' + pt(298, 2.85)}"/>
  </g>
</g>`;
}

/** Велосипедное колесо: тонкая шина, 32 спицы с перекрёстом. */
export function bikeWheelSVG(opts = {}) {
  let spokes = '';
  const n = 32;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const hubA = a + (i % 2 ? 0.55 : -0.55);
    spokes += `M${pt(46, hubA)}L${pt(436, a)}`;
  }
  return `
<g class="b-tire">
  <circle r="470" fill="none" class="b-tire-ring"/>
  <path class="b-knobs" d="${tread(90, 480, 494)}"/>
</g>
<g class="b-rim">
  <circle r="440" fill="none" class="b-rim-ring"/>
  <circle r="428" fill="none" class="b-rim-ring b-rim-ring--in"/>
  <path class="b-spokes" d="${spokes}"/>
  <circle r="54" class="b-hub"/>
  <circle r="20" class="b-axle"/>
  ${opts.withDisc ? '<circle r="120" fill="none" class="b-disc"/>' : ''}
</g>`;
}

/** Внешняя шкала-лимб (не вращается). */
export function dialSVG() {
  return `<path class="w-ticks" d="${ticks(180, 512, 522, 5, 10)}"/>`;
}
