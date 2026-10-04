import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HtmlError, decodeEntities, filtersIn, htmlProblem, interpolations, isNgName, normalizeName, readHtml, readTemplate } from '../src/index.js';

// The template reader: tags and attributes in every quoting, comments, script and style elements, script templates,
// forms left open; then the names AngularJS matches, the filters of expressions and the interpolations.

const attrs = (text) => readHtml(text).elements.map((e) => [e.name, e.attributes.map((a) => [a.name, a.value])]);
const fails = (text, reason) => assert.throws(() => readHtml(text), (e) => e instanceof HtmlError && reason.test(e.reason));

test('html: start tags with double, single, unquoted and empty attributes, with offsets', () => {
  assert.deepEqual(attrs('<div a="1" b=\'2\' c=3 d e = "5"></div>'), [['div', [['a', '1'], ['b', '2'], ['c', '3'], ['d', ''], ['e', '5']]]]);
  const r = readHtml('<p x="ab">t</p>');
  assert.equal(r.elements[0].attributes[0].offset, 3);
  assert.equal(r.elements[0].attributes[0].valueOffset, 6);
  assert.deepEqual(r.texts.map((t) => [t.value, t.offset]), [['t', 10]]);
  assert.deepEqual(attrs('<br/><img src=a.png/>'), [['br', []], ['img', [['src', 'a.png/']]]]);
  assert.deepEqual(attrs('<input disabled/>'), [['input', [['disabled', '']]]]);
});

test('html: comments, declarations, end tags and a < that starts no tag', () => {
  const r = readHtml('<!DOCTYPE html><!-- <div ng-controller="X"> --><?x?><p>a < b</p></p>');
  assert.deepEqual(r.elements.map((e) => e.name), ['p']);
  assert.deepEqual(r.texts.map((t) => t.value), ['a ', '< b']);
  fails('<!-- open', /a comment that is not closed/);
  fails('<!DOCTYPE html', /a declaration that is not closed/);
  fails('<p></p', /an end tag that is not closed/);
});

test('html: script and style hold raw text, except a script template, which is read as markup', () => {
  const r = readHtml('<script>var a = "<div ng-controller=x>";</script><style>p > a {}</style><script type="text/ng-template" id="t.html"><b ng-if="x">{{ y | z }}</b></script>');
  assert.deepEqual(r.elements.map((e) => e.name), ['script', 'style', 'script', 'b']);
  assert.deepEqual(attrs('<SCRIPT>x</SCRIPT><p>').map((e) => e[0]), ['SCRIPT', 'p'], 'the end tag is found whatever its case');
  fails('<script>never closed', /a script element that is not closed/);
  fails('<style>p {}', /a style element that is not closed/);
});

test('html: a tag or an attribute value left open stops the reading with its line and column', () => {
  fails('<div ng-if="x', /an attribute value whose quote is not closed/);
  fails('<div a=1', /a tag that is not closed/);
  const text = '<p>\n  <a href=\'x>\n';
  try {
    readHtml(text);
    assert.fail('not refused');
  } catch (error) {
    assert.equal(htmlProblem(error, text), 'line 2, column 11: an attribute value whose quote is not closed');
  }
  assert.throws(() => readHtml('<a></a><b></b>', { maxElements: 1 }), /more than 1 elements/);
});

test('html: the five XML entities and character references are decoded, others are kept', () => {
  assert.equal(decodeEntities('a &amp;&lt;&gt;&quot;&apos; &#124; &#x7C; &nbsp; &#0;'), 'a &<>"\' | | &nbsp; &#0;');
  assert.deepEqual(attrs('<p ng-if="a &amp;&amp; b">'), [['p', [['ng-if', 'a && b']]]]);
});

test('templates: names are normalized as AngularJS matches them to directives', () => {
  for (const n of ['ng-model', 'NG-MODEL', 'ng:model', 'ng_model', 'data-ng-model', 'x-ng-model', 'data-ng:model']) assert.equal(normalizeName(n), 'ngModel', n);
  assert.equal(normalizeName('tea-card'), 'teaCard');
  assert.equal(normalizeName('data-tea-card'), 'teaCard');
  assert.equal(normalizeName('class'), 'class');
  assert.equal(normalizeName('my--odd'), 'myOdd');
  assert.ok(isNgName('ngRepeat') && !isNgName('ngrepeat') && !isNgName('angular'));
});

test('templates: filters in expressions, with arguments and chains, outside strings and never ||', () => {
  assert.deepEqual(filtersIn("items | filter:q | orderBy:'name'").map((f) => f.name), ['filter', 'orderBy']);
  assert.deepEqual(filtersIn('a || b').map((f) => f.name), []);
  assert.deepEqual(filtersIn("'a | b' | upper").map((f) => f.name), ['upper']);
  assert.deepEqual(filtersIn('"x\\" | y" | z').map((f) => f.name), ['z']);
  assert.deepEqual(filtersIn('a |\n  currency').map((f) => [f.name, f.index]), [['currency', 6]]);
  assert.deepEqual(filtersIn('a | 1'), []);
  assert.deepEqual(interpolations('a {{ x }} b {{y}} {{ open'), [{ value: ' x ', index: 4 }, { value: 'y', index: 14 }]);
});

test('templates: controllers, includes, filters and names of a template', () => {
  const t = readTemplate(readHtml('<div data-ng-controller="ShopController as shop">{{ total | currency }}<ng-include src="\'a.html\'"></ng-include><p ng-include="\'b.html\'" ng-repeat="x in xs | limitTo:3" ng-pattern="/a|b/" title="{{ t | upper }}"></p></div>'));
  assert.deepEqual(t.controllers.map((c) => [c.value, c.controller]), [['ShopController as shop', 'ShopController']]);
  assert.deepEqual(t.includes.map((i) => [i.value, i.element]), [["'a.html'", true], ["'b.html'", false]]);
  assert.deepEqual(t.filters.map((f) => f.name), ['currency', 'limitTo', 'upper']);
  assert.deepEqual(t.names.map((n) => n.name), ['div', 'ngController', 'ngInclude', 'src', 'p', 'ngInclude', 'ngRepeat', 'ngPattern', 'title']);
});
