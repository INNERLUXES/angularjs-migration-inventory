// A small tokenizer for JavaScript and TypeScript files. It reads the text once, left to right, and keeps what the
// inventory needs: names, string literals with their text, template literals, numbers, regular expression literals and
// punctuators. Comments and a hashbang line are dropped, so a registration written in a comment is never counted. It
// knows the forms that could hide the end of a comment or a string: escapes, line continuations, template literals
// with ${...} substitutions (whose code is read as code, nested to any depth up to a limit) and regular expression
// literals, whose start is told from a division by the token before the slash. A string, a template, a comment or a
// regular expression that is not closed stops the reading of the file with its line and column, and the file is
// reported as one the tool could not tokenize. It does not parse: src/scripts.js reads the tokens.

import { lineStarts, positionOf } from './json.js';

export const LEX_LIMITS = { maxTokens: 4000000, maxTemplateDepth: 64 };

export class LexError extends Error {
  constructor(reason, offset) {
    super(reason);
    this.reason = reason;
    this.offset = offset;
  }
}

const isDigit = (c) => c >= 48 && c <= 57;
const isNameStart = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 36 || c >= 0x80;
const isNamePart = (c) => isNameStart(c) || isDigit(c);
const isLineEnd = (c) => c === 10 || c === 13 || c === 0x2028 || c === 0x2029;
const isSpace = (c) => c === 32 || c === 9 || c === 11 || c === 12 || c === 10 || c === 13 || c === 0xa0 || c === 0xfeff || c === 0x2028 || c === 0x2029;

// The names after which a slash starts a regular expression rather than a division.
export const REGEX_AFTER_NAMES = ['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await', 'extends'];

// The punctuators of more than one character, longest first; any other character is a punctuator of its own.
const PUNCTUATORS = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>'];

// The tokens of a script: [{ type, value, offset }], where type is 'name', 'string', 'template', 'number', 'regex' or
// 'punct'. A string token holds the text between its quotes as written, escapes included; a template literal without a
// substitution is a string token too, and one with substitutions is a template token that holds its literal parts, with
// the code of each substitution read as tokens of its own between the punctuators '${' and '$}'. Throws LexError with
// the offset of the problem.
export function tokenize(text, limits = LEX_LIMITS) {
  const lim = { ...LEX_LIMITS, ...limits };
  const out = [];
  const n = text.length;
  let i = 0;
  // Template literals interrupted by a substitution, innermost last: { start, parts, from, braces }.
  const frames = [];

  const push = (type, value, offset) => {
    if (out.length >= lim.maxTokens) throw new LexError(`more than ${lim.maxTokens} tokens`, offset);
    out.push({ type, value, offset });
  };

  // True when a slash at this point starts a regular expression: at the start, after a punctuator other than a closing
  // bracket or ++ and --, and after a keyword that is followed by an expression.
  const regexAllowed = () => {
    const prev = out.at(-1);
    if (!prev) return true;
    if (prev.type === 'punct') return ![')', ']', '}', '$}', '++', '--'].includes(prev.value);
    if (prev.type === 'name') return REGEX_AFTER_NAMES.includes(prev.value);
    return false;
  };

  // Reads the body of a template literal from i up to its end or a substitution. Returns true when it ended.
  const readTemplate = (frame) => {
    for (;;) {
      if (i >= n) throw new LexError('a template literal that is not closed', frame.start);
      const c = text.charCodeAt(i);
      if (c === 96) {
        frame.parts.push(text.slice(frame.from, i));
        i += 1;
        return true;
      }
      if (c === 92) {
        i += 2;
        continue;
      }
      if (c === 36 && text.charCodeAt(i + 1) === 123) {
        frame.parts.push(text.slice(frame.from, i));
        if (frames.length >= lim.maxTemplateDepth) throw new LexError(`template literals nested more than ${lim.maxTemplateDepth} deep`, i);
        push('punct', '${', i);
        i += 2;
        frame.braces = 0;
        frames.push(frame);
        return false;
      }
      i += 1;
    }
  };

  const endTemplate = (frame) => {
    if (frame.parts.length === 1) push('string', frame.parts[0], frame.start);
    else push('template', frame.parts.join(''), frame.start);
  };

  if (text.startsWith('#!')) while (i < n && !isLineEnd(text.charCodeAt(i))) i += 1;

  while (i < n) {
    const c = text.charCodeAt(i);
    if (isSpace(c)) {
      i += 1;
      continue;
    }
    if (c === 47 && text.charCodeAt(i + 1) === 47) {
      while (i < n && !isLineEnd(text.charCodeAt(i))) i += 1;
      continue;
    }
    if (c === 47 && text.charCodeAt(i + 1) === 42) {
      const end = text.indexOf('*/', i + 2);
      if (end < 0) throw new LexError('a comment that is not closed', i);
      i = end + 2;
      continue;
    }
    if (c === 34 || c === 39) {
      const start = i;
      i += 1;
      for (;;) {
        if (i >= n) throw new LexError('a string that is not closed', start);
        const d = text.charCodeAt(i);
        if (d === c) break;
        if (d === 10 || d === 13) throw new LexError('a string that is not closed before the end of its line', start);
        if (d === 92) {
          // An escape; a backslash before CR LF continues the string on the next line.
          i += text.charCodeAt(i + 1) === 13 && text.charCodeAt(i + 2) === 10 ? 3 : 2;
          continue;
        }
        i += 1;
      }
      push('string', text.slice(start + 1, i), start);
      i += 1;
      continue;
    }
    if (c === 96) {
      const frame = { start: i, parts: [], from: i + 1, braces: 0 };
      i += 1;
      if (readTemplate(frame)) endTemplate(frame);
      continue;
    }
    if (c === 47 && regexAllowed()) {
      const start = i;
      let inClass = false;
      i += 1;
      for (;;) {
        if (i >= n || isLineEnd(text.charCodeAt(i))) throw new LexError('a regular expression that is not closed before the end of its line', start);
        const d = text.charCodeAt(i);
        if (d === 92) {
          if (i + 1 < n && isLineEnd(text.charCodeAt(i + 1))) throw new LexError('a regular expression that is not closed before the end of its line', start);
          i += 2;
          continue;
        }
        i += 1;
        if (d === 91) inClass = true;
        else if (d === 93) inClass = false;
        else if (d === 47 && !inClass) break;
      }
      while (i < n && isNamePart(text.charCodeAt(i))) i += 1;
      push('regex', text.slice(start, i), start);
      continue;
    }
    if (isNameStart(c)) {
      const start = i;
      while (i < n && isNamePart(text.charCodeAt(i))) i += 1;
      push('name', text.slice(start, i), start);
      continue;
    }
    if (isDigit(c) || (c === 46 && isDigit(text.charCodeAt(i + 1)))) {
      // A number: digits, letters, underscores and dots, and a sign right after the e of an exponent.
      const start = i;
      const hex = c === 48 && (text.charCodeAt(i + 1) | 32) === 120;
      i += 1;
      while (i < n) {
        const d = text.charCodeAt(i);
        if (isNamePart(d) || d === 46) i += 1;
        else if ((d === 43 || d === 45) && !hex && (text.charCodeAt(i - 1) | 32) === 101) i += 1;
        else break;
      }
      push('number', text.slice(start, i), start);
      continue;
    }
    if (frames.length && c === 123) frames.at(-1).braces += 1;
    if (frames.length && c === 125) {
      const frame = frames.at(-1);
      if (frame.braces === 0) {
        // The end of a substitution: back to the template literal it interrupted.
        frames.pop();
        push('punct', '$}', i);
        i += 1;
        frame.from = i;
        if (readTemplate(frame)) endTemplate(frame);
        continue;
      }
      frame.braces -= 1;
    }
    let p = PUNCTUATORS.find((x) => text.startsWith(x, i));
    if (p === '?.' && isDigit(text.charCodeAt(i + 2))) p = undefined;
    push('punct', p ?? text[i], i);
    i += p ? p.length : 1;
  }
  if (frames.length) throw new LexError('a substitution ${ of a template literal that is not closed', frames.at(-1).start);
  return out;
}

// The line and column of a LexError, for a message.
export function lexProblem(error, text) {
  const pos = positionOf(lineStarts(text), Math.min(error.offset, text.length));
  return `line ${pos.line}, column ${pos.column}: ${error.reason}`;
}
