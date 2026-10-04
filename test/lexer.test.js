import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LexError, REGEX_AFTER_NAMES, lexProblem, tokenize } from '../src/index.js';

// The tokenizer of scripts: every form of comment, string, template literal and regular expression, closed and left
// open, and the slash that divides next to the slash that starts a regular expression.

const types = (text) => tokenize(text).map((t) => `${t.type}:${t.value}`);
const fails = (text, reason) => assert.throws(() => tokenize(text), (e) => e instanceof LexError && reason.test(e.reason));

test('lexer: names, numbers, strings and punctuators with their offsets', () => {
  const t = tokenize("var a = 'x' + \"y\" + 1.5e-3;");
  assert.deepEqual(t.map((x) => [x.type, x.value, x.offset]), [['name', 'var', 0], ['name', 'a', 4], ['punct', '=', 6], ['string', 'x', 8], ['punct', '+', 12], ['string', 'y', 14], ['punct', '+', 18], ['number', '1.5e-3', 20], ['punct', ';', 26]]);
  assert.deepEqual(types('$scope.$watch'), ['name:$scope', 'punct:.', 'name:$watch']);
  assert.deepEqual(types('a === b !== c => d?.e ?? f ... g'), ['name:a', 'punct:===', 'name:b', 'punct:!==', 'name:c', 'punct:=>', 'name:d', 'punct:?.', 'name:e', 'punct:??', 'name:f', 'punct:...', 'name:g']);
  assert.deepEqual(types('a ?.5 : b'), ['name:a', 'punct:?', 'number:.5', 'punct::', 'name:b']);
  assert.deepEqual(types('0x1e+2'), ['number:0x1e', 'punct:+', 'number:2']);
});

test('lexer: comments are dropped, a hashbang line too, and a comment that is not closed stops the reading', () => {
  assert.deepEqual(types('a // angular.module("x", [])\nb /* $scope */ c'), ['name:a', 'name:b', 'name:c']);
  assert.deepEqual(types('#!/usr/bin/env node\nx'), ['name:x']);
  assert.deepEqual(types('/* a /* b */ c'), ['name:c'], 'a block comment ends at the first */');
  fails('a /* b', /a comment that is not closed/);
});

test('lexer: strings with escapes and line continuations, and a string left open', () => {
  assert.deepEqual(types("'it\\'s' \"a\\\"b\""), ["string:it\\'s", 'string:a\\"b']);
  assert.deepEqual(types("'a\\\nb' 'c\\\r\nd'"), ["string:a\\\nb", "string:c\\\r\nd"]);
  fails("'abc", /a string that is not closed/);
  fails("'abc\nd'", /not closed before the end of its line/);
  fails('"abc\r', /not closed before the end of its line/);
});

test('lexer: template literals with and without substitutions, nested, and left open', () => {
  assert.deepEqual(types('`plain $ text`'), ['string:plain $ text']);
  assert.deepEqual(types('`a ${b + `c ${d}`} e`'), ['punct:${', 'name:b', 'punct:+', 'punct:${', 'name:d', 'punct:$}', 'template:c ', 'punct:$}', 'template:a  e']);
  assert.deepEqual(types('`${ {a: 1}.a }`'), ['punct:${', 'punct:{', 'name:a', 'punct::', 'number:1', 'punct:}', 'punct:.', 'name:a', 'punct:$}', 'template:']);
  assert.deepEqual(types('`a\\`b`'), ['string:a\\`b']);
  fails('`abc', /a template literal that is not closed/);
  fails('`a ${b', /a substitution \$\{ of a template literal that is not closed/);
  assert.throws(() => tokenize(`${'`${'.repeat(70)}`), /nested more than 64 deep/);
});

test('lexer: a slash after a value divides, a slash at the start of an expression starts a regular expression', () => {
  assert.deepEqual(types('a / b / c'), ['name:a', 'punct:/', 'name:b', 'punct:/', 'name:c']);
  assert.deepEqual(types('x = /a\'b"/g.test(y)'), ['name:x', 'punct:=', "regex:/a'b\"/g", 'punct:.', 'name:test', 'punct:(', 'name:y', 'punct:)']);
  assert.deepEqual(types('f(1) / 2'), ['name:f', 'punct:(', 'number:1', 'punct:)', 'punct:/', 'number:2']);
  assert.deepEqual(types('a[0] /2/ 1'), ['name:a', 'punct:[', 'number:0', 'punct:]', 'punct:/', 'number:2', 'punct:/', 'number:1']);
  assert.deepEqual(types('i++ / 2'), ['name:i', 'punct:++', 'punct:/', 'number:2']);
  assert.deepEqual(types('/[/]/'), ['regex:/[/]/'], 'a slash inside a character class does not end it');
  assert.deepEqual(types('x /= 2'), ['name:x', 'punct:/=', 'number:2']);
  for (const k of REGEX_AFTER_NAMES) assert.equal(tokenize(`${k} /a/`)[1].type, 'regex', k);
  assert.equal(tokenize('value /a/')[1].type, 'punct', 'after an ordinary name a slash divides');
  assert.equal(tokenize("'s' /a/")[1].type, 'punct');
  fails('x = /abc\n/', /a regular expression that is not closed before the end of its line/);
  fails('x = /abc\\\n/', /a regular expression that is not closed/);
});

test('lexer: TypeScript forms read as tokens: types, generics, decorators and modifiers', () => {
  assert.deepEqual(types('constructor(private $scope: ng.IScope) {}').slice(0, 5), ['name:constructor', 'punct:(', 'name:private', 'name:$scope', 'punct::']);
  assert.deepEqual(types('let a: Array<string> = [];').slice(0, 7), ['name:let', 'name:a', 'punct::', 'name:Array', 'punct:<', 'name:string', 'punct:>']);
  assert.deepEqual(types('@Inject() x'), ['punct:@', 'name:Inject', 'punct:(', 'punct:)', 'name:x']);
});

test('lexer: lexProblem gives the line and column of the problem', () => {
  const text = 'a\nb = "x\n';
  try {
    tokenize(text);
    assert.fail('not refused');
  } catch (error) {
    assert.equal(lexProblem(error, text), 'line 2, column 5: a string that is not closed before the end of its line');
  }
  assert.throws(() => tokenize('a b c d', { maxTokens: 3 }), /more than 3 tokens/);
});
