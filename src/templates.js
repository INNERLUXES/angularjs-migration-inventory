// What a template holds for the inventory, read from its tags and attributes (src/html.js): the ng-controller and
// ng-include directives, the filters used in expressions, and every element and attribute name in the normalized form
// AngularJS matches directives by, so src/analyse.js can count the uses of the built-in and the registered directives.

import { asciiLower } from './words.js';

// The ng attributes whose value is not an expression that can hold a filter: a pattern, an address, a controller name
// or a switch with no value.
export const NOT_EXPRESSIONS = ['ngPattern', 'ngSrc', 'ngSrcset', 'ngHref', 'ngController', 'ngApp', 'ngNonBindable', 'ngCsp', 'ngJq', 'ngStrictDi', 'ngList', 'ngModelOptions', 'ngInclude'];

// A tag or attribute name as AngularJS matches it to a directive: in lower case, without an x- or data- in front, and
// with the parts split at a colon, a dash or an underscore joined in camelCase: data-ng-model is ngModel.
export function normalizeName(name) {
  let n = asciiLower(name);
  if (n.startsWith('x-')) n = n.slice(2);
  else if (n.startsWith('data-')) n = n.slice(5);
  const parts = n.split(/[:_-]/).filter((p) => p !== '');
  return parts.map((p, i) => (i === 0 ? p : `${p[0].toUpperCase()}${p.slice(1)}`)).join('');
}

// True for a built-in directive name such as ngRepeat.
export const isNgName = (name) => /^ng[A-Z]/.test(name);

// The filters of an expression: [{ name, index }] for every | that is not part of || and is outside a string, with the
// name after it.
export function filtersIn(expression) {
  const out = [];
  const text = String(expression);
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '|') {
      if (text[i + 1] === '|') {
        i += 1;
        continue;
      }
      let j = i + 1;
      while (j < text.length && (text[j] === ' ' || text[j] === '\t' || text[j] === '\n' || text[j] === '\r')) j += 1;
      const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(text.slice(j, j + 200));
      if (m) out.push({ name: m[0], index: j });
    }
  }
  return out;
}

// The expressions between {{ and }} of a text: [{ value, index }].
export function interpolations(text) {
  const out = [];
  let at = 0;
  for (;;) {
    const start = text.indexOf('{{', at);
    if (start < 0) return out;
    const end = text.indexOf('}}', start + 2);
    if (end < 0) return out;
    out.push({ value: text.slice(start + 2, end), index: start + 2 });
    at = end + 2;
  }
}

// Reads the parts of a template the inventory needs from the result of readHtml: { controllers, includes, filters,
// names }, each item with its offset in the file.
export function readTemplate({ elements, texts }) {
  const controllers = [];
  const includes = [];
  const filters = [];
  const names = [];
  const addFilters = (expression, offset) => {
    for (const f of filtersIn(expression)) filters.push({ name: f.name, offset: offset + f.index });
  };
  for (const t of texts) for (const x of interpolations(t.value)) addFilters(x.value, t.offset + x.index);
  for (const element of elements) {
    const tag = normalizeName(element.name);
    names.push({ name: tag, element: true, offset: element.offset });
    if (tag === 'ngInclude') {
      const src = element.attributes.find((a) => asciiLower(a.name) === 'src');
      includes.push({ value: src ? src.value.trim() : '', offset: element.offset, element: true });
    }
    for (const a of element.attributes) {
      const name = normalizeName(a.name);
      if (!name) continue;
      names.push({ name, element: false, offset: a.offset });
      if (name === 'ngController') {
        const value = a.value.trim();
        controllers.push({ value, controller: value.split(/\s+as\s+/)[0].trim(), offset: a.offset });
      }
      if (name === 'ngInclude') includes.push({ value: a.value.trim(), offset: a.offset, element: false });
      if (isNgName(name) && !NOT_EXPRESSIONS.includes(name) && !a.value.includes('{{')) addFilters(a.value, a.valueOffset);
      for (const x of interpolations(a.value)) addFilters(x.value, a.valueOffset + x.index);
    }
  }
  return { controllers, includes, filters, names };
}
