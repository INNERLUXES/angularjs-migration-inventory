import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_FILTERS, RULES, countLines, decide, readInput, ruleById, unreadableInput, atOrAbove, levelOf, defaultConfig } from '../src/index.js';
import { configOf, findingsOf, html, js, lineOf, reportOf, rulesOf, rulesOfJs } from './helpers.js';

// Every rule with the form that is reported and the form next to it that is not, the levels and the result, and the
// inventory: modules, dependents, order, file and template attribution, scores and directive counts.

test('module-declaration: a declaration with its dependencies; a getter is not one', () => {
  const r = reportOf(js("angular.module('shop', ['shop.core', 'ngRoute']);", "angular.module('shop').run(function () {});", "angular.module('lone', []);"));
  const d = findingsOf(r, 'module-declaration');
  assert.deepEqual(d.map((f) => f.found), ['module shop is declared with 2 dependencies: shop.core, ngRoute', 'module lone is declared with no dependency']);
  assert.deepEqual(d.map((f) => f.module), ['shop', 'lone']);
  assert.equal(d[0].level, 'info');
  assert.equal(d[1].line, 3);
  const dyn = reportOf(js("angular.module('m', [a.name, 'b']);", "angular.module('n', list);"));
  assert.deepEqual(findingsOf(dyn, 'module-declaration').map((f) => f.found), ['module m is declared with 2 dependencies: b, and 1 that is not a string literal', 'module n is declared with 1 dependency, 1 that is not a string literal']);
});

test('module-registration: each registration with its module and annotation, config and run blocks too', () => {
  const text = "angular.module('m', [])\n  .controller('A', ['$scope', function ($scope) {}])\n  .factory('f', function ($http) {})\n  .constant('K', 1)\n  .config(function () {})\n  .component('c', { controller: 'A' });\n";
  const r = reportOf({ 'app/a.js': text });
  assert.deepEqual(findingsOf(r, 'module-registration').map((f) => [f.line, f.found]), [
    [lineOf(text, ".controller"), 'controller A on m; dependencies in an array: $scope'],
    [lineOf(text, '.factory'), 'factory f on m; dependencies only as parameter names, which a minifier breaks: $http'],
    [lineOf(text, '.constant'), 'constant K on m'],
    [lineOf(text, '.config'), 'config block on m; no dependency'],
    [lineOf(text, '.component'), 'component c on m; its controller is registered as A']
  ]);
  assert.deepEqual(findingsOf(reportOf(js("angular.module('m').service('s', S);")), 'module-registration').map((f) => f.found), ['service s on m; its dependencies are not visible in this file']);
});

test('module-registration: a variable is resolved in its file, or across files when it always holds one module', () => {
  const r = reportOf({ 'app/a.js': "var app = angular.module('m', []);\n", 'app/b.js': "app.controller('B', function () {});\nunknown.controller('C', fn);\nitems.filter(function (x) { return x; });\n" });
  assert.deepEqual(findingsOf(r, 'module-registration').map((f) => [f.file, f.found]), [['app/b.js', 'controller B on m; no dependency']]);
  assert.ok(r.notes.includes('2 calls such as x.controller(...) on a variable that holds no module the tool could find are not counted as a registration'));
  const twice = reportOf({ 'app/a.js': "var app = angular.module('m', []);\n", 'app/b.js': "var app = angular.module('n', []);\n", 'app/c.js': "app.controller('C', fn);\n" });
  assert.equal(findingsOf(twice, 'module-registration').length, 0, 'a name that holds two modules in two files is not guessed');
  const local = reportOf({ 'app/a.js': "var app = angular.module('m', []);\napp.controller('A', fn);\nvar app = angular.module('n', []);\napp.controller('B', fn);\n" });
  assert.deepEqual(findingsOf(local, 'module-registration').map((f) => f.module), ['m', 'n'], 'in one file the binding before the call wins');
});

test('dynamic-name: a module or registration name that is not a string literal is counted, not named', () => {
  const r = reportOf(js("angular.module(name, []).controller('A', fn);", "angular.module('m').controller(ctrlName, fn);"));
  assert.deepEqual(findingsOf(r, 'dynamic-name').map((f) => f.found), [
    'angular.module is called with a name that is not a string literal, so the module it declares cannot be named; registrations chained on it are counted on no module',
    'the controller A is registered on a module whose name is not a string literal, so it is placed on no module',
    'a controller is registered on m with a name that is not a string literal, so the inventory cannot name it'
  ]);
  assert.deepEqual(findingsOf(reportOf(js('angular.module(name).run(fn);')), 'dynamic-name').map((f) => f.found)[0], 'angular.module is called with a name that is not a string literal; registrations chained on it are counted on no module');
  assert.equal(r.inventory.counts.dynamicModules, 1);
});

test('scope-use and root-scope-use: once per file with the count, at the first use', () => {
  const text = "function A($scope, $rootScope) {\n  $scope.a = 1;\n  $scope.b = $rootScope.c;\n}\nA.$inject = ['$scope', '$rootScope'];\n";
  const r = reportOf({ 'app/a.js': text });
  assert.deepEqual(findingsOf(r, 'scope-use').map((f) => [f.line, f.found]), [[1, '$scope appears 4 times in this file, first here']]);
  assert.deepEqual(findingsOf(r, 'root-scope-use').map((f) => [f.line, f.found, f.level]), [[1, '$rootScope appears 3 times in this file, first here', 'warning']]);
  assert.match(findingsOf(r, 'scope-use')[0].modern, /input\(\)/);
  assert.deepEqual(findingsOf(reportOf(js('var s = $scope;')), 'scope-use').map((f) => f.found), ['$scope appears once in this file']);
  assert.deepEqual(rulesOfJs('// $scope', "var x = 'my $scope';", 'var $scopes = 1;'), []);
});

test('scope-watch, scope-event, compile-use and timer-use: each call, and the names that are not calls', () => {
  const text = "x.$watch('a', f);\n$rootScope.$broadcast('saved');\ns.$on(evt, f);\n$compile(t)(s);\n$timeout(f);\n$interval(f, 1000);\n";
  const r = reportOf({ 'app/a.js': text });
  assert.deepEqual(r.findings.map((f) => [f.rule, f.line, f.found]), [
    ['scope-watch', 1, '$watch is called on x'],
    ['root-scope-use', 2, '$rootScope appears once in this file'],
    ['scope-event', 2, '$broadcast of "saved" is called on $rootScope'],
    ['scope-event', 3, '$on is called on s'],
    ['compile-use', 4, '$compile is called to compile markup while the app runs'],
    ['timer-use', 5, '$timeout is called'],
    ['timer-use', 6, '$interval is called']
  ]);
  assert.deepEqual(rulesOfJs('var w = x.$watch;', '$timeout.cancel(p);', "inject(['$compile', function () {}]);", 'f(x)$on();'), []);
});

test('two-way-binding: = in scope, bindToController and bindings, and never < @ &', () => {
  const r = reportOf(js("d = { scope: { a: '=', b: '<', c: '@', e: '&', f: '=?f' }, bindToController: { g: '=*' } };", "angular.module('m').component('x', { bindings: { h: '=' } });"));
  assert.deepEqual(findingsOf(r, 'two-way-binding').map((f) => f.found), ["a: '=' in the isolate scope of a directive binds two ways", "f: '=?f' in the isolate scope of a directive binds two ways", "g: '=*' in bindToController binds two ways", "h: '=' in the bindings of a component binds two ways"]);
  assert.match(findingsOf(r, 'two-way-binding')[0].modern, /model\(\)/);
});

test('template-controller and template-include: every spelling, with the registered module', () => {
  const r = reportOf({ ...js("angular.module('m', []).controller('ShopController', fn);"), ...html('<div ng-controller="ShopController as shop"></div>', '<p data-ng-controller="Other"></p>', '<p x-ng:controller="X"></p>', '<p ng-include="\'a.html\'"></p>', '<ng-include src="tpl"></ng-include>', '<p ng-controllers="no"></p>') });
  assert.deepEqual(findingsOf(r, 'template-controller').map((f) => [f.line, f.found, f.module]), [[1, 'ng-controller="ShopController as shop" attaches the controller ShopController to this markup (registered on m)', 'm'], [2, 'ng-controller="Other" attaches the controller Other to this markup', null], [3, 'ng-controller="X" attaches the controller X to this markup', null]]);
  assert.deepEqual(findingsOf(r, 'template-include').map((f) => [f.line, f.found]), [[4, 'ng-include="\'a.html\'" fetches and compiles a template while the app runs'], [5, '<ng-include src="tpl"> fetches and compiles a template while the app runs']]);
});

test('template-filter: once per filter and template, built in, custom or unknown', () => {
  const r = reportOf({ ...js("angular.module('m', []).filter('price', fn);"), ...html('{{ a | currency }} {{ b | currency:"x" }}', '<li ng-repeat="x in xs | orderBy:\'n\' | price">{{ x || "none" }}</li>', '{{ y | mystery }}') });
  assert.deepEqual(findingsOf(r, 'template-filter').map((f) => [f.line, f.found]), [
    [1, 'filter currency (built in) is used 2 times in this template, first here'],
    [2, 'filter orderBy (built in) is used once in this template'],
    [2, 'filter price (registered on m) is used once in this template'],
    [3, 'filter mystery (not registered in the files read) is used once in this template']
  ]);
  assert.deepEqual(BUILT_IN_FILTERS.length, 9);
});

test('duplicate-module and module-cycle: a second declaration, and modules that depend on each other', () => {
  const r = reportOf({ 'app/a.js': "angular.module('a', ['b']);\nangular.module('self', ['self']);\n", 'app/b.js': "angular.module('b', ['a']);\nangular.module('a', []);\n" });
  assert.deepEqual(findingsOf(r, 'duplicate-module').map((f) => [f.file, f.found]), [['app/b.js', 'module a is declared again; it was declared first at app/a.js:1, and a second declaration replaces the module with everything registered on it before']]);
  assert.deepEqual(findingsOf(r, 'module-cycle').map((f) => [f.file, f.line, f.found]), [['app/a.js', 1, 'modules a -> b -> a depend on each other; none of them can move before the others'], ['app/a.js', 2, 'modules self depends on itself; none of them can move before the others']]);
  assert.deepEqual(r.inventory.cycles, [['a', 'b'], ['self']]);
});

test('input problems: a file that cannot be read and a file that cannot be tokenized are errors that cannot be lowered', () => {
  const broken = reportOf({ 'app/a.js': "angular.module('m', []);\nvar s = 'open;\n", 'app/b.html': '<div ng-if="x>\n' });
  assert.deepEqual(broken.findings.map((f) => [f.rule, f.level, f.line]), [['untokenizable-file', 'error', 2], ['untokenizable-file', 'error', 1]]);
  assert.match(broken.findings[0].found, /^line 2, column 9: a string that is not closed before the end of its line; the file was not read past this point, and nothing in it is counted but its lines$/);
  assert.equal(broken.inventory.counts.modules, 0, 'a declaration before the problem is not counted');
  assert.equal(broken.inventory.counts.notRead, 2);
  assert.equal(broken.result.pass, false);
  const r = reportOf({}, null);
  assert.equal(r.findings.length, 0);
  const cfg = defaultConfig();
  assert.equal(levelOf(ruleById('unreadable-file'), cfg), 'error');
  assert.throws(() => configOf({ rules: { unreadableFile: 'off' } }), /"unreadableFile" is not a key of rules/);
  const unread = unreadableInput('app/x.js', 'javascript', 'holds binary data (a null byte); only text is read');
  assert.equal(unread.lines, 0);
});

test('levels: a rule can be raised, lowered or set off, and the minimum severity hides what is below it', () => {
  const src = js("angular.module('m', []).controller('A', function ($scope) {});");
  assert.deepEqual(rulesOf(reportOf(src)), ['scope-use', 'module-declaration', 'module-registration']);
  const raised = reportOf(src, { rules: { scopeUse: 'error', moduleRegistration: 'off' } });
  assert.deepEqual(raised.findings.map((f) => [f.rule, f.level]), [['scope-use', 'error'], ['module-declaration', 'info']]);
  assert.ok(raised.notes.includes('1 rule is off: module-registration'));
  assert.equal(raised.result.pass, false);
  const hidden = reportOf(src, null, { minSeverity: 'warning' });
  assert.deepEqual(rulesOf(hidden), ['scope-use']);
  assert.equal(hidden.totals.hidden, 2);
  assert.ok(hidden.notes.includes('2 findings below warning are not shown'));
});

test('result: the run fails on a finding at or above failOn, and passes otherwise', () => {
  const src = js("angular.module('m', []).controller('A', function ($scope) {});");
  assert.equal(reportOf(src).result.text, 'PASS - no finding at or above error (1 warning, 2 info)');
  assert.equal(reportOf(src, null, { failOn: 'warning' }).result.text, 'FAIL - 1 finding at or above warning (1 warning, 2 info)');
  assert.equal(reportOf(src, null, { failOn: 'info' }).result.failing, 3);
  assert.equal(reportOf(src, null, { minSeverity: 'error', failOn: 'warning' }).result.pass, true, 'a finding that is not shown does not fail the run');
  assert.deepEqual(decide([], 'error'), { pass: true, failOn: 'error', failing: 0, byLevel: { error: 0, warning: 0, info: 0 }, text: 'PASS - no finding at or above error' });
  assert.ok(atOrAbove('error', 'info') && !atOrAbove('info', 'warning'));
});

test('inventory: modules with dependencies, dependents, modules declared elsewhere and the migration order', () => {
  const r = reportOf({
    'app/root.js': "angular.module('root', ['feature', 'shared', 'ngAnimate']).run(function () {});\n",
    'app/feature.js': "angular.module('feature', ['shared', 'util']).controller('F', fn).controller('G', fn);\n",
    'app/shared.js': "angular.module('shared', []).service('s', fn);\n",
    'app/util.js': "angular.module('util', ['ngSanitize']);\nangular.module('plugin').directive('p', fn);\n"
  });
  const inv = r.inventory;
  assert.deepEqual(inv.order, ['util', 'shared', 'feature', 'root'], 'util has one dependent, shared two');
  assert.deepEqual(inv.modules.map((m) => [m.name, m.order, m.dependents, m.registrations]), [
    ['util', 1, ['feature'], {}],
    ['shared', 2, ['feature', 'root'], { service: 1 }],
    ['feature', 3, ['root'], { controller: 2 }],
    ['root', 4, [], { run: 1 }],
    ['plugin', null, [], { directive: 1 }]
  ]);
  assert.deepEqual(inv.external, [{ name: 'ngAnimate', dependents: ['root'] }, { name: 'ngSanitize', dependents: ['util'] }]);
  assert.equal(inv.modules.find((m) => m.name === 'plugin').declared, false);
  assert.deepEqual(inv.registrations.byKind.controller, 2);
  assert.deepEqual(inv.counts, { files: 4, byKind: { javascript: 4, typescript: 0, template: 0 }, lines: 5, notRead: 0, modules: 4, dynamicModules: 0, registrations: 5, unplacedRegistrations: 0 });
});

test('inventory: scores of files and modules, a file counted toward its main module, and a template toward the script that names it', () => {
  const text = "angular.module('m', []).component('c', { templateUrl: './views/c.html?v=1', controller: function ($scope) {} });\nangular.module('n', []);\n";
  const r = reportOf({ 'app/m.js': text, 'app/views/c.html': '<p>{{ a | date }}</p>\n\n<p ng-include="x"></p>\n', 'app/other.html': '<p></p>\n' }, { weights: { linesPerPoint: 1, registration: 10, risk: 100 } });
  const files = Object.fromEntries(r.inventory.files.map((f) => [f.file, f]));
  assert.deepEqual(files['app/m.js'], { file: 'app/m.js', kind: 'javascript', module: 'm', lines: 2, registrations: 1, risks: 1, score: 2 + 10 + 100, read: true });
  assert.deepEqual(files['app/views/c.html'], { file: 'app/views/c.html', kind: 'template', module: 'm', lines: 2, registrations: 0, risks: 1, score: 2 + 100, read: true });
  assert.equal(files['app/other.html'].module, null);
  const m = r.inventory.modules.find((x) => x.name === 'm');
  assert.deepEqual([m.files, m.lines, m.risks, m.score], [2, 4, 2, 214]);
  assert.equal(r.inventory.modules.find((x) => x.name === 'n').files, 0);
  const defaults = reportOf({ 'app/m.js': `${'x;\n'.repeat(11)}` });
  assert.equal(defaults.inventory.files[0].score, 2, '11 lines are 2 points at 10 lines a point');
});

test('inventory: directive and filter use in templates, built in and registered, by element or attribute', () => {
  const r = reportOf({ ...js("angular.module('m', []).directive('teaCard', fn).component('cartView', {}).filter('price', fn);"), ...html('<tea-card ng-repeat="t in ts"></tea-card>', '<div tea-card data-ng-repeat="x in y | price"></div>', '<div cart-view></div><cart-view></cart-view><other-thing></other-thing>') });
  assert.deepEqual(r.inventory.templates.directives.map((d) => [d.name, d.uses, d.kind, d.module, d.templates]), [['ngRepeat', 2, 'built in', null, 1], ['teaCard', 2, 'directive', 'm', 1], ['cartView', 1, 'component', 'm', 1]]);
  assert.deepEqual(r.inventory.templates.filters.map((f) => [f.name, f.origin, f.module, f.uses]), [['price', 'custom', 'm', 1]]);
});

test('countLines and readInput: lines with more than white space, whatever the line ends', () => {
  assert.equal(countLines('a\n\n  \r\nb\rc'), 3);
  assert.equal(countLines(''), 0);
  assert.equal(readInput('x\n', 'a.js', 'javascript').kind, 'javascript');
  assert.throws(() => readInput('x', 'a.txt', 'text'), /not a kind of file the tool reads/);
  for (const rule of RULES) assert.ok(['inventory', 'risk', 'input'].includes(rule.category), rule.id);
});
