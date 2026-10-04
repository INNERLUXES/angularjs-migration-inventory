import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BINDING_KEYS, EVENT_METHODS, REGISTRATION_KINDS, TIMER_SERVICES, TWO_WAY, WATCH_METHODS } from '../src/index.js';
import { scriptOf } from './helpers.js';

// What a script holds: module calls, registrations in every form, annotations, bindings, template addresses and risks.

const regs = (text) => scriptOf(text).registrations.map((r) => [r.kind, r.name, r.module.name ?? r.module.variable ?? 'dynamic', r.annotation, r.deps.join(' ')]);

test('scripts: a module declaration with its dependencies, a getter, and names that are not string literals', () => {
  const s = scriptOf("angular.module('a', ['b', \"c\", dep.name]);\nangular.module('a');\nangular.module(name, []);\nangular.module('d', deps);\nangular.module(`e`, []);\nangular.module(`f${x}`, []);");
  assert.deepEqual(s.modules.map((m) => [m.name, m.declaration, m.deps, m.dynamicDeps]), [['a', true, ['b', 'c'], 1], ['a', false, [], 0], [null, true, [], 0], ['d', true, [], 1], ['e', true, [], 0], [null, true, [], 0]]);
  assert.deepEqual(scriptOf('window.angular.module("w", [])').modules.map((m) => m.name), ['w']);
  assert.deepEqual(scriptOf('angular.module()').modules, [], 'a call with no argument is not a module call');
  assert.deepEqual(scriptOf('angular.modules("x", [])').modules, []);
});

test('scripts: registrations chained on a module call, of every kind', () => {
  const chained = REGISTRATION_KINDS.map((k) => (k === 'config' || k === 'run' ? `.${k}(function () {})` : `.${k}('${k}Name', function () {})`)).join('\n');
  const r = regs(`angular.module('m', [])\n${chained};`);
  assert.deepEqual(r.map((x) => x[0]), REGISTRATION_KINDS);
  assert.deepEqual(r.map((x) => x[1]), REGISTRATION_KINDS.map((k) => (k === 'config' || k === 'run' ? '' : `${k}Name`)));
  assert.ok(r.every((x) => x[2] === 'm'));
  assert.deepEqual(regs("angular.module('m').controller('A', fn).toString().directive('b', fn)").map((x) => x[1]), ['A'], 'a chain ends at a method that is not a registration');
  assert.deepEqual(regs("angular.module('m')?.filter('f', fn)").map((x) => x[1]), ['f']);
});

test('scripts: registrations through a variable that holds a module, with or without a TypeScript type', () => {
  const s = scriptOf("var app = angular.module('m', []);\napp.controller('A', fn).service('s', fn);\nconst typed: ng.IModule = angular.module('t', []);\ntyped.factory('f', fn);\nwindow.shared = angular.module('w', []);\nobj.prop = angular.module('o', []);");
  assert.deepEqual(s.variables.map((v) => [v.variable, v.module]), [['app', 'm'], ['typed', 't'], ['shared', 'w']]);
  assert.deepEqual(s.registrations.map((r) => [r.kind, r.name, r.module.variable]), [['controller', 'A', 'app'], ['service', 's', 'app'], ['factory', 'f', 'typed']]);
  assert.deepEqual(scriptOf('x.y.controller("A", fn)').registrations, [], 'a member of a member is not a variable');
  assert.deepEqual(scriptOf('list.filter(function (x) { return x; })').registrations.map((r) => r.name), [null], 'kept for the analysis, which drops it when list holds no module');
});

test('scripts: the object form registers every key', () => {
  assert.deepEqual(regs("angular.module('m').controller({ A: fn, 'B': ['$http', function ($http) {}] })").map((x) => [x[1], x[3], x[4]]), [['A', 'unknown', ''], ['B', 'array', '$http']]);
});

test('scripts: the annotation of a registration: array, $inject, implicit, none, a class, a component controller, unknown', () => {
  const r = regs([
    "var m = angular.module('m', []);",
    "m.controller('Arr', ['$scope', 'svc', function (a, b) {}]);",
    "m.controller('Inj', Inj); Inj.$inject = ['$http'];",
    'function Inj(h) {}',
    "m.factory('Imp', function ($q, store) {});",
    "m.factory('Arrow', ($q) => $q);",
    "m.factory('Arrow1', $q => $q);",
    "m.service('None', function () {});",
    "m.service('Decl', Decl); function Decl($log, ...rest) {}",
    "m.service('Var', Var); var Var = function ($window) {};",
    "m.service('Cls', Cls); class Cls { static $inject = ['$timeout']; constructor(private t: any) {} }",
    "m.service('Ctor', Ctor); class Ctor { constructor(public readonly $http: any, $q) {} }",
    "m.service('Empty', Empty); class Empty {}",
    "m.component('cmp', { controller: Inj, template: '' });",
    "m.component('named', { controller: 'NamedController' });",
    "m.component('bare', { template: '<p></p>' });",
    "m.component('notObject', options);",
    "m.directive('d', async function ($q) {});",
    "m.constant('C', 1).value('V', {});",
    "m.factory('Elsewhere', imported);",
    "m.factory('Call', make());"
  ].join('\n'));
  assert.deepEqual(r.map((x) => [x[1], x[3], x[4]]), [
    ['Arr', 'array', '$scope svc'],
    ['Inj', '$inject', '$http'],
    ['Imp', 'implicit', '$q store'],
    ['Arrow', 'implicit', '$q'],
    ['Arrow1', 'implicit', '$q'],
    ['None', 'none', ''],
    ['Decl', 'implicit', '$log rest'],
    ['Var', 'implicit', '$window'],
    ['Cls', '$inject', '$timeout'],
    ['Ctor', 'implicit', '$http $q'],
    ['Empty', 'none', ''],
    ['cmp', '$inject', '$http'],
    ['named', 'controller NamedController', ''],
    ['bare', 'none', ''],
    ['notObject', 'unknown', ''],
    ['d', 'implicit', '$q'],
    ['C', null, ''],
    ['V', null, ''],
    ['Elsewhere', 'unknown', ''],
    ['Call', 'unknown', '']
  ]);
});

test('scripts: a registration in a comment or a string is not read, and a name that is not a string literal is null', () => {
  assert.deepEqual(regs("// angular.module('m').controller('A', fn)\nvar s = \"angular.module('m').controller('B', fn)\";"), []);
  assert.deepEqual(regs("angular.module('m').controller(name, fn).run(['$log', function ($log) {}])").map((x) => [x[0], x[1], x[3]]), [['controller', null, 'unknown'], ['run', '', 'array']]);
  assert.equal(scriptOf("angular.module(n, []).controller('A', fn)").registrations[0].module.dynamic, true);
});

test('scripts: two-way bindings in scope, bindToController and bindings, in every form, and the other bindings', () => {
  const s = scriptOf([
    "x = { scope: { a: '=', b: '=?', c: '=*', d: '=*?', e: '=attr', f: '=?attr-name', g: '<', h: '@', i: '&', j: ' = ' } };",
    "y = { bindToController: { k: '=' }, bindings: { 'l': '=' } };",
    "class C { static bindings = { m: '=' }; }",
    "z = { other: { n: '=' }, scope: true, bindings: obj };",
    "w = { scope: { o: '==' , p: 'x=' } };",
    'v.scope = { q: "=" };'
  ].join('\n'));
  assert.deepEqual(s.twoWay.map((b) => [b.key, b.context]), [['a', 'scope'], ['b', 'scope'], ['c', 'scope'], ['d', 'scope'], ['e', 'scope'], ['f', 'scope'], ['j', 'scope'], ['k', 'bindToController'], ['l', 'bindings'], ['m', 'bindings']]);
  for (const v of ['=', '=?', '=*', '=*?', '=a', ' =?b ']) assert.ok(TWO_WAY.test(v), v);
  for (const v of ['<', '@', '&', '==', 'x=', '= a b', '<=']) assert.ok(!TWO_WAY.test(v), v);
  assert.deepEqual(BINDING_KEYS, ['scope', 'bindToController', 'bindings']);
});

test('scripts: templateUrl values in a definition object and a class', () => {
  assert.deepEqual(scriptOf("x = { templateUrl: 'a.html' }; class C { templateUrl = \"b.html\"; } y = { templateUrl: fn() }; z = { 'templateUrl': 'c.html' };").templateUrls.map((t) => t.value), ['a.html', 'b.html', 'c.html']);
});

test('scripts: the risks: $scope and $rootScope counted with their first place, and each call of the services', () => {
  const s = scriptOf([
    "ctrl(['$scope', '$rootScope', function ($scope, $rootScope) {",
    "  $scope.$watch('a', f); vm.$watchCollection('b', f); this.$watchGroup(['c'], f); $watch('not a method');",
    "  $rootScope.$broadcast('x:changed', 1); $scope.$emit(name); $scope.$on('y', f); obj.$on;",
    '  $compile(el)(scope); this.$compile(el); $compile;',
    '  $timeout(f, 250); $interval(f, 1000); $timeout.cancel(p); function $timeout() {}',
    '}]);'
  ].join('\n'));
  assert.equal(s.risks.scope.count, 5);
  assert.equal(s.risks.scope.offset, 6);
  assert.equal(s.risks.rootScope.count, 3);
  assert.deepEqual(s.risks.watch.map((w) => [w.method, w.receiver]), [['$watch', '$scope'], ['$watchCollection', 'vm'], ['$watchGroup', 'this']]);
  assert.deepEqual(s.risks.events.map((e) => [e.method, e.receiver, e.event]), [['$broadcast', '$rootScope', 'x:changed'], ['$emit', '$scope', null], ['$on', '$scope', 'y']]);
  assert.equal(s.risks.compile.length, 2);
  assert.deepEqual(s.risks.timers.map((t) => t.method), ['$timeout', '$interval']);
  assert.deepEqual([WATCH_METHODS, EVENT_METHODS, TIMER_SERVICES].map((l) => l.length), [3, 3, 2]);
});

test('scripts: names in comments, strings that are not exact and longer names are not risks', () => {
  const s = scriptOf("// $scope.$watch('a')\n/* $rootScope */\nvar t = '$scope.x'; var $scopeX = 1; var my$scope = 2;");
  assert.equal(s.risks.scope.count, 0);
  assert.equal(s.risks.rootScope.count, 0);
  assert.equal(s.risks.watch.length, 0);
});

test('scripts: brackets left open do not stop the reading of the rest', () => {
  assert.deepEqual(scriptOf("angular.module('m', [").modules, []);
  assert.deepEqual(scriptOf("f(]; angular.module('m', []).controller('A', fn)").registrations.map((r) => r.name), ['A']);
});
