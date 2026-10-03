/**
 * Минимальный сборщик без зависимостей.
 * JS: склеивает ES-модули проекта в один файл (каждый модуль — в своей области видимости).
 *     Поддерживает: import { a, b as c } from './x.js'; export function/const/let/class/async function.
 * CSS: разворачивает @import, подставляет путь к шрифтам, сжимает.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';

const IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/g;
const EXPORT_DECL_RE = /^export\s+(async\s+function|function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;

export function bundleJS(entry, { root } = {}) {
  const order = [];
  const ids = new Map();
  const seen = new Set();

  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    const deps = [];
    src.replace(IMPORT_RE, (_, names, spec) => {
      deps.push(resolve(dirname(file), spec));
      return '';
    });
    deps.forEach(visit);
    ids.set(file, `__m${ids.size}`);
    order.push({ file, src });
  };
  visit(resolve(entry));

  const out = [];
  for (const { file, src } of order) {
    const id = ids.get(file);
    const exports = [];
    let code = src.replace(IMPORT_RE, (_, names, spec) => {
      const dep = ids.get(resolve(dirname(file), spec));
      const binds = names
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const [a, b] = s.split(/\s+as\s+/);
          return b ? `${a}: ${b}` : a;
        })
        .join(', ');
      return `const { ${binds} } = ${dep};`;
    });
    code = code.replace(EXPORT_DECL_RE, (_, kind, name) => {
      exports.push(name);
      return `${kind} ${name}`;
    });
    out.push(`/* ${relative(root || process.cwd(), file)} */\nconst ${id} = (() => {\n${strip(code)}\nreturn { ${exports.join(', ')} };\n})();`);
  }
  return `(() => {\n'use strict';\n${out.join('\n')}\n})();\n`;
}

/** Убрать блочные комментарии и строки-комментарии (безопасно для кода проекта) */
function strip(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .map((l) => l.replace(/^\s+/, ''))
    .filter((l) => l.length)
    .join('\n');
}

export function bundleCSS(entry, { fonts = '/fonts', fontData = null } = {}) {
  const seen = new Set();
  const inline = (file) => {
    if (seen.has(file)) return '';
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    return src.replace(/@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/g, (_, p) => inline(resolve(dirname(file), p)));
  };
  let css = inline(resolve(entry));
  css = css.replace(/url\(__FONTS__\/([^)]+)\)/g, (_, f) => {
    if (fontData) return `url(${fontData(f)})`;
    return `url(${fonts}/${f})`;
  });
  return minifyCSS(css);
}

export function minifyCSS(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,>])\s*/g, '$1')
    .replace(/:\s+/g, ':')
    .replace(/;}/g, '}')
    .replace(/\s*!important/g, '!important')
    .trim();
}
