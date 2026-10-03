// Мелкие помощники для HTML-шаблонов (выполняются только при сборке, в Node).
export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const join = (arr, fn) => arr.map(fn).join('');

/** Технический заголовок раздела: «ЛИСТ 02 / 07 · ЦЕНЫ» */
export function sheetLabel(n, total, label) {
  return `<p class="sheet mono" aria-hidden="true"><span class="sheet__n">Лист ${n}</span><span class="sheet__sep">/</span><span class="sheet__t">${total}</span><span class="sheet__label">${esc(label)}</span></p>`;
}

export const arrow = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';
export const phoneIco = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3.5h3l1.5 4-2 1.3a11 11 0 0 0 6.1 6.1l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/></svg>';
export const pinIco = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
export const aiIco = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5v5.5M12 15v5.5M3.5 12H9M15 12h5.5"/></svg>';
export const closeIco = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
export const extIco = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';
