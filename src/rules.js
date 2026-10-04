// The rules and the result. Each rule has a category: inventory (info by default), risk (warning by default) or input
// (always error). Each names the points of the public pages it rests on (src/data.js), says where it is the tool's own
// choice, and a risk also says what takes its place in modern Angular. docs/method.md says exactly what each rule looks
// at and what it cannot see. The checks themselves are in src/analyse.js.

import { LEVELS } from './data.js';
import { grouped, plural } from './size.js';

export const RULES = [
  {
    id: 'module-declaration',
    key: 'moduleDeclaration',
    category: 'inventory',
    title: 'a module declared with angular.module and its dependencies',
    basis: ['moduleCreate', 'upgradePreparation'],
    own: 'only a call with a string literal as its name and a second argument counts as a declaration; a dependency that is not a string literal is counted, not named',
    rule: () => 'a call angular.module(name, [dependencies]) with two or more arguments, which creates a module'
  },
  {
    id: 'module-registration',
    key: 'moduleRegistration',
    category: 'inventory',
    title: 'a controller, directive, component, service, factory, provider, filter, constant, value, config or run block registered on a module',
    basis: ['moduleCreate', 'configRun', 'annotationStyles'],
    own: 'a registration is read when it is chained on angular.module(...) or on a variable that holds a module (in the same file, or in exactly one way across the files read); the annotation is the array, $inject, implicit (parameter names only) or none, as far as the file shows it',
    rule: () => 'a call of controller, directive, component, service, factory, provider, filter, constant, value, config or run on a module, with its name and the way its dependencies are annotated'
  },
  {
    id: 'dynamic-name',
    key: 'dynamicName',
    category: 'inventory',
    title: 'a module or registration whose name is not a string literal',
    basis: ['moduleCreate'],
    own: 'the inventory counts such a call but cannot name it, and a registration on a module whose name is not a string literal is not placed on any module',
    rule: () => 'an angular.module call or a registration whose name is a variable, an expression or a template with substitutions'
  },
  {
    id: 'template-filter',
    key: 'templateFilter',
    category: 'inventory',
    title: 'a filter used in the expressions of a template',
    basis: ['filterSyntax', 'pipes'],
    own: 'counted once per filter name and template, at its first use; the expressions read are the {{ }} interpolations and the values of ng attributes that hold expressions',
    rule: () => 'a | followed by a filter name in an interpolation or an ng attribute of a template',
    modern: 'a pipe in the Angular template, with the same | syntax; a custom filter becomes a pipe class'
  },
  {
    id: 'scope-use',
    key: 'scopeUse',
    category: 'risk',
    title: '$scope is used',
    basis: ['scopeHierarchy', 'componentBindings', 'upgradePreparation'],
    own: 'reported once per file at its first use, with the count of uses: the name $scope in the code and the string \'$scope\' in an annotation',
    rule: () => 'the name $scope, or the string \'$scope\', in a script',
    modern: 'state lives on the component class and in signals; data from a parent comes through input() and goes back through output()'
  },
  {
    id: 'root-scope-use',
    key: 'rootScopeUse',
    category: 'risk',
    title: '$rootScope is used',
    basis: ['scopeHierarchy', 'sharedServices'],
    own: 'reported once per file at its first use, with the count of uses',
    rule: () => 'the name $rootScope, or the string \'$rootScope\', in a script',
    modern: 'a service provided at the root holds the shared state, with signals or an observable for its changes'
  },
  {
    id: 'scope-watch',
    key: 'scopeWatch',
    category: 'risk',
    title: 'a watcher: $watch, $watchCollection or $watchGroup',
    basis: ['scopeWatch', 'signals'],
    own: 'each call is reported, on whatever object it is made',
    rule: () => 'a call of $watch, $watchCollection or $watchGroup as a method',
    modern: 'computed() for a derived value, effect() for a side effect, or the input itself as a signal; RxJS for streams'
  },
  {
    id: 'scope-event',
    key: 'scopeEvent',
    category: 'risk',
    title: 'a scope event: $broadcast, $emit or $on',
    basis: ['scopeEvents', 'outputs', 'sharedServices'],
    own: 'each call is reported with the event name when it is a string literal',
    rule: () => 'a call of $broadcast, $emit or $on as a method',
    modern: 'output() from a child to its parent; a shared service with a signal or a Subject for events that cross the app'
  },
  {
    id: 'compile-use',
    key: 'compileUse',
    category: 'risk',
    title: '$compile is called',
    basis: ['compileService', 'dynamicComponents'],
    own: 'each call of $compile is reported; Angular has no counterpart that compiles a template string while the app runs',
    rule: () => 'a call of $compile',
    modern: 'NgComponentOutlet or ViewContainerRef.createComponent with a component class; markup is not compiled at run time'
  },
  {
    id: 'timer-use',
    key: 'timerUse',
    category: 'risk',
    title: 'a timer: $timeout or $interval',
    basis: ['timeoutService', 'signals'],
    own: 'each call is reported; the timer itself moves easily, the digest it starts is what the new code no longer has',
    rule: () => 'a call of $timeout or $interval',
    modern: 'setTimeout and setInterval, or timer() and interval() of RxJS; with signals the view updates without a digest'
  },
  {
    id: 'two-way-binding',
    key: 'twoWayBinding',
    category: 'risk',
    title: 'a two-way binding (=) in the scope, bindToController or bindings of a definition',
    basis: ['isolateBindings', 'componentBindings', 'modelInputs'],
    own: 'a binding whose value is =, =?, =* or =*? with or without an attribute name, inside an object under scope, bindToController or bindings',
    rule: () => 'a binding of the form = in a scope, bindToController or bindings object',
    modern: 'input() for data in and output() for changes out, or model() with [( )] where two-way binding is meant'
  },
  {
    id: 'template-controller',
    key: 'templateController',
    category: 'risk',
    title: 'ng-controller in a template',
    basis: ['ngControllerDirective', 'directiveNames', 'upgradePreparation'],
    own: 'every spelling AngularJS accepts is read: ng-controller, data-ng-controller, x-ng-controller, ng:controller and ng_controller',
    rule: () => 'an attribute that normalizes to ngController',
    modern: 'a component with a selector and its own template takes the place of the controller and the markup it was attached to'
  },
  {
    id: 'template-include',
    key: 'templateInclude',
    category: 'risk',
    title: 'ng-include in a template',
    basis: ['ngIncludeDirective', 'directiveNames'],
    own: 'the attribute and the element forms are read; the address is shown as written, since it is an expression',
    rule: () => 'an attribute or element that normalizes to ngInclude',
    modern: 'a child component, or ngTemplateOutlet for markup kept in the same template'
  },
  {
    id: 'duplicate-module',
    key: 'duplicateModule',
    category: 'risk',
    title: 'a module declared more than once',
    basis: ['moduleOverwrite'],
    own: 'the second and later declarations are reported; which one wins depends on the order the scripts load, which the tool does not know',
    rule: () => 'angular.module(name, [...]) for a name that an earlier declaration in the files read already used',
    modern: 'one NgModule or one set of standalone components per feature; nothing replaces a module that exists'
  },
  {
    id: 'module-cycle',
    key: 'moduleCycle',
    category: 'risk',
    title: 'modules that depend on each other in a cycle',
    basis: ['moduleCreate', 'upgradePreparation'],
    own: 'AngularJS loads such modules, but no module of the cycle can move first; the migration order breaks the cycle at the module with the fewest unmet dependencies',
    rule: () => 'a cycle in the dependencies between the modules declared in the files read',
    modern: 'standalone components and services that import what they use, with no cycle between features'
  },
  {
    id: 'unreadable-file',
    key: null,
    category: 'input',
    title: 'a file that cannot be read',
    basis: ['lexicalGrammar'],
    own: 'a file that is missing, over its size limit, binary, UTF-16 or not valid UTF-8 is an error and is counted nowhere else; this rule cannot be set lower or off',
    rule: () => 'a file of the input that the tool could not read as UTF-8 text'
  },
  {
    id: 'untokenizable-file',
    key: null,
    category: 'input',
    title: 'a file the tokenizer or the template reader cannot place',
    basis: ['lexicalGrammar', 'htmlAttributes'],
    own: 'a string, template literal, comment, regular expression, tag or attribute value that is not closed stops the reading of the file; nothing in it is counted except its lines; this rule cannot be set lower or off',
    rule: () => 'a script or template with a form that is not closed'
  }
];

export const ruleById = (id) => RULES.find((r) => r.id === id);

// True when a level is at or above another.
export const atOrAbove = (level, min) => LEVELS.indexOf(level) >= LEVELS.indexOf(min);

// The result: the run fails when a finding is at or above the level failOn. { pass, failOn, failing, byLevel, text }.
export function decide(findings, failOn) {
  const byLevel = { error: 0, warning: 0, info: 0 };
  for (const f of findings) byLevel[f.level] += 1;
  const failing = findings.filter((f) => atOrAbove(f.level, failOn)).length;
  const counts = ['error', 'warning', 'info'].filter((l) => byLevel[l]).map((l) => `${grouped(byLevel[l])} ${l}`);
  const text = failing
    ? `FAIL - ${plural(failing, 'finding')} at or above ${failOn}${counts.length ? ` (${counts.join(', ')})` : ''}`
    : `PASS - no finding at or above ${failOn}${counts.length ? ` (${counts.join(', ')})` : ''}`;
  return { pass: failing === 0, failOn, failing, byLevel, text };
}
