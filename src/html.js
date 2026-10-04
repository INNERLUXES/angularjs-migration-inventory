// A small reader of the tags and attributes of an HTML template. It reads the text once, left to right, and keeps what
// the inventory needs: every start tag with its name and attributes, and every run of text between tags, each with its
// offset. It skips comments, the document type, end tags and the content of script and style elements, except a script
// of type text/ng-template, whose content is a template and is read as markup. It does not build a tree and does not
// check that tags are closed in order, as browsers do not either. A comment, a tag, an attribute value in quotes or a
// script or style element that is not closed stops the reading of the file with its line and column, and the file is
// reported as one the tool could not tokenize. It never fetches anything and decodes only the five entities of XML and
// character references.

import { lineStarts, positionOf } from './json.js';
import { asciiLower } from './words.js';

export const HTML_LIMITS = { maxElements: 1000000, maxAttributes: 256 };

export class HtmlError extends Error {
  constructor(reason, offset) {
    super(reason);
    this.reason = reason;
    this.offset = offset;
  }
}

const isSpace = (c) => c === 32 || c === 9 || c === 10 || c === 12 || c === 13;
const isLetter = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

// Text with the five entities of XML and character references decoded; any other entity is kept as written.
export function decodeEntities(text) {
  return text.replace(/&(#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|[A-Za-z]{2,4});/g, (whole, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return Object.hasOwn(ENTITIES, name) ? ENTITIES[name] : whole;
  });
}

// Reads one template: { elements: [{ name, offset, attributes: [{ name, value, offset, valueOffset }] }], texts:
// [{ value, offset }] }. Names are kept as written; values and texts have their entities decoded, and the offset of
// a value is that of its first character in the file. Throws HtmlError with the offset of the problem.
export function readHtml(text, limits = HTML_LIMITS) {
  const lim = { ...HTML_LIMITS, ...limits };
  const lower = asciiLower(text);
  const n = text.length;
  const elements = [];
  const texts = [];
  let i = 0;
  const fail = (reason, at) => {
    throw new HtmlError(reason, at);
  };
  const skipPast = (end, reason, start) => {
    const at = text.indexOf(end, i);
    if (at < 0) fail(reason, start);
    i = at + end.length;
  };

  while (i < n) {
    if (text.charCodeAt(i) !== 60) {
      const start = i;
      const at = text.indexOf('<', i + 1);
      i = at < 0 ? n : at;
      texts.push({ value: decodeEntities(text.slice(start, i)), offset: start });
      continue;
    }
    const start = i;
    const next = text.charCodeAt(i + 1);
    if (text.startsWith('<!--', i)) {
      i += 4;
      skipPast('-->', 'a comment that is not closed', start);
      continue;
    }
    if (next === 33 || next === 63) {
      skipPast('>', 'a declaration that is not closed', start);
      continue;
    }
    if (next === 47) {
      skipPast('>', 'an end tag that is not closed', start);
      continue;
    }
    if (!isLetter(next)) {
      // A < that starts no tag is text.
      const at = text.indexOf('<', i + 1);
      i = at < 0 ? n : at;
      texts.push({ value: decodeEntities(text.slice(start, i)), offset: start });
      continue;
    }
    i += 1;
    const nameStart = i;
    while (i < n && !isSpace(text.charCodeAt(i)) && text[i] !== '>' && text[i] !== '/') i += 1;
    const element = { name: text.slice(nameStart, i), offset: start, attributes: [] };
    if (elements.length >= lim.maxElements) fail(`more than ${lim.maxElements} elements`, start);
    elements.push(element);
    for (;;) {
      while (i < n && (isSpace(text.charCodeAt(i)) || (text[i] === '/' && text[i + 1] !== '>'))) i += 1;
      if (i >= n) fail('a tag that is not closed', start);
      if (text[i] === '>') {
        i += 1;
        break;
      }
      if (text[i] === '/' && text[i + 1] === '>') {
        i += 2;
        break;
      }
      const attrStart = i;
      while (i < n && !isSpace(text.charCodeAt(i)) && text[i] !== '>' && text[i] !== '=' && !(text[i] === '/' && text[i + 1] === '>')) i += 1;
      if (i === attrStart) i += 1;
      const attr = { name: text.slice(attrStart, i), value: '', offset: attrStart, valueOffset: i };
      let j = i;
      while (j < n && isSpace(text.charCodeAt(j))) j += 1;
      if (text[j] === '=') {
        i = j + 1;
        while (i < n && isSpace(text.charCodeAt(i))) i += 1;
        const q = text[i];
        if (q === '"' || q === "'") {
          const end = text.indexOf(q, i + 1);
          if (end < 0) fail('an attribute value whose quote is not closed', i);
          attr.value = decodeEntities(text.slice(i + 1, end));
          attr.valueOffset = i + 1;
          i = end + 1;
        } else {
          const vs = i;
          while (i < n && !isSpace(text.charCodeAt(i)) && text[i] !== '>') i += 1;
          attr.value = decodeEntities(text.slice(vs, i));
          attr.valueOffset = vs;
        }
      }
      if (element.attributes.length >= lim.maxAttributes) fail(`more than ${lim.maxAttributes} attributes in a tag`, start);
      element.attributes.push(attr);
    }
    const tag = asciiLower(element.name);
    if (tag === 'script' || tag === 'style') {
      const type = element.attributes.find((a) => asciiLower(a.name) === 'type');
      if (tag === 'script' && type && asciiLower(type.value.trim()) === 'text/ng-template') continue;
      const end = lower.indexOf(`</${tag}`, i);
      if (end < 0) fail(`a ${tag} element that is not closed`, start);
      i = end;
    }
  }
  return { elements, texts };
}

// The line and column of an HtmlError, for a message.
export function htmlProblem(error, text) {
  const pos = positionOf(lineStarts(text), Math.min(error.offset, text.length));
  return `line ${pos.line}, column ${pos.column}: ${error.reason}`;
}
