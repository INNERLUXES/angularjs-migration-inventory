import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG_LIMITS, ConfigError, DEFAULT_EXCLUDE, DEFAULT_FAIL_ON, DEFAULT_FILES, DEFAULT_MIN_SEVERITY, DEFAULT_RULES, DEFAULT_WEIGHTS, KEYS, RULES, SKIPPED_FOLDERS, defaultConfig, defaultsAsConfig, distance, globMatch, globProblem, isIncluded, isObject, kindOf, readConfig, suggestion, validateConfig } from '../src/index.js';

// The configuration file: every key, the list operations, the errors with their lines and suggestions.

const problems = (text) => {
  try {
    readConfig(text, 'c.json');
  } catch (error) {
    assert.ok(error instanceof ConfigError, error.message);
    return error.problems;
  }
  assert.fail('not refused');
  return [];
};

test('config: the defaults, and --print-defaults read back give the same configuration', () => {
  const d = defaultConfig();
  assert.deepEqual(d.files, DEFAULT_FILES);
  assert.deepEqual(d.exclude, DEFAULT_EXCLUDE);
  assert.deepEqual(d.rules, DEFAULT_RULES);
  assert.deepEqual(d.weights, DEFAULT_WEIGHTS);
  assert.equal(d.minSeverity, DEFAULT_MIN_SEVERITY);
  assert.equal(d.failOn, DEFAULT_FAIL_ON);
  assert.equal(DEFAULT_MIN_SEVERITY, 'info');
  assert.equal(DEFAULT_FAIL_ON, 'error');
  const back = readConfig(JSON.stringify(defaultsAsConfig()), 'd.json');
  assert.deepEqual({ ...back, file: null, name: null }, d);
  assert.deepEqual(Object.keys(defaultsAsConfig()), Object.keys(KEYS));
  assert.deepEqual(SKIPPED_FOLDERS, ['.git', 'node_modules', 'bower_components', 'jspm_packages']);
});

test('config: every rule but the two of input problems has a key, and every key a rule', () => {
  assert.deepEqual(RULES.filter((r) => r.key !== null).map((r) => r.key).sort(), Object.keys(DEFAULT_RULES).sort());
  assert.deepEqual(RULES.filter((r) => r.key === null).map((r) => r.id), ['unreadable-file', 'untokenizable-file']);
  for (const r of RULES.filter((x) => x.key !== null)) assert.equal(DEFAULT_RULES[r.key], r.category === 'inventory' ? 'info' : 'warning', r.id);
});

test('config: every key with a good value', () => {
  const c = readConfig(JSON.stringify({ name: 'Shop', files: ['src/**/*.js'], exclude: { add: ['**/legacy/**'], remove: ['dist/**'] }, rules: { scopeUse: 'off', compileUse: 'error', moduleRegistration: 'warning' }, minSeverity: 'warning', failOn: 'warning', weights: { linesPerPoint: 20, risk: 0 } }), 'c.json');
  assert.equal(c.name, 'Shop');
  assert.equal(c.file, 'c.json');
  assert.deepEqual(c.files, ['src/**/*.js']);
  assert.deepEqual(c.exclude, [...DEFAULT_EXCLUDE.filter((x) => x !== 'dist/**'), '**/legacy/**']);
  assert.equal(c.rules.scopeUse, 'off');
  assert.equal(c.rules.compileUse, 'error');
  assert.equal(c.rules.moduleRegistration, 'warning');
  assert.equal(c.minSeverity, 'warning');
  assert.equal(c.failOn, 'warning');
  assert.deepEqual(c.weights, { linesPerPoint: 20, registration: 5, risk: 0 });
});

test('config: an unknown key is an error with its line and a suggestion, at every level', () => {
  assert.deepEqual(problems('{\n  "exlude": []\n}'), ['c.json: line 2: "exlude" is not a key of the configuration; did you mean "exclude"?']);
  assert.deepEqual(problems('{\n  "rules": {\n    "scopUse": "off"\n  }\n}'), ['c.json: line 3: "scopUse" is not a key of rules; did you mean "scopeUse"?']);
  assert.deepEqual(problems('{"files": {"ad": ["*.js"]}}'), ['c.json: line 1: "ad" is not a key of files (replace, add, remove); did you mean "add"?']);
  assert.deepEqual(problems('{"weights": {"risks": 1}}'), ['c.json: line 1: "risks" is not a key of weights; did you mean "risk"?']);
  assert.deepEqual(problems('{"failon": "info"}'), ['c.json: line 1: "failon" is not a key of the configuration; did you mean "failOn"?']);
  assert.deepEqual(problems('{"colour": 1}'), ['c.json: line 1: "colour" is not a key of the configuration']);
});

test('config: a key named twice is refused, as RFC 8259 leaves the result open', () => {
  assert.match(problems('{"name": "a", "name": "b"}')[0], /^c\.json: line 1, column 15: the name "name" appears twice in one object/);
});

test('config: values of the wrong kind, each with its line', () => {
  const text = JSON.stringify({ name: '', files: 'x', exclude: [1], rules: [], minSeverity: 'notice', failOn: 3, weights: [] }, null, 2);
  assert.deepEqual(problems(text), [
    'c.json: line 2: name must be a text of 1 to 120 characters',
    'c.json: line 3: files must be a list or an object with replace, add or remove, not a string',
    'c.json: line 5: exclude[0] must be a text, not a number',
    'c.json: line 7: rules must be an object, not a list',
    'c.json: line 8: minSeverity must be one of info, warning, error',
    'c.json: line 9: failOn must be one of info, warning, error',
    'c.json: line 10: weights must be an object, not a list'
  ]);
});

test('config: weights are whole numbers in range, and a line a point is at least one line', () => {
  assert.deepEqual(problems('{"weights": {"linesPerPoint": 0}}'), ['c.json: line 1: weights.linesPerPoint must be a whole number from 1 to 1000, not 0']);
  assert.deepEqual(problems('{"weights": {"risk": 1.5}}'), ['c.json: line 1: weights.risk must be a whole number from 0 to 1000, not 1.5']);
  assert.deepEqual(problems('{"weights": {"registration": 1001}}'), [`c.json: line 1: weights.registration must be a whole number from 0 to ${CONFIG_LIMITS.maxWeight}, not 1001`]);
  assert.deepEqual(problems('{"weights": {"registration": "5"}}'), ['c.json: line 1: weights.registration must be a whole number from 0 to 1000, not a string']);
  assert.equal(readConfig('{"weights": {"registration": 0}}', 'c').weights.registration, 0);
});

test('config: a name such as __proto__ is an ordinary key and is refused like any other', () => {
  assert.match(problems('{"__proto__": {"files": []}}')[0], /"__proto__" is not a key of the configuration/);
  assert.match(problems('{"rules": {"constructor": "off"}}')[0], /"constructor" is not a key of rules/);
  assert.match(problems('{"weights": {"toString": 1}}')[0], /"toString" is not a key of weights/);
  assert.equal({}.files, undefined);
});

test('config: the list operations replace, add and remove, and their errors', () => {
  assert.deepEqual(readConfig('{"files": {"replace": ["a/*.js"], "add": ["b/*.html"]}}', 'c').files, ['a/*.js', 'b/*.html']);
  assert.deepEqual(problems('{"exclude": {"remove": ["nope/**"]}}'), ['c.json: line 1: exclude.remove names "nope/**", which is not on the list']);
  assert.deepEqual(problems('{"exclude": {"add": ["dist/**"]}}'), ['c.json: line 1: exclude.add names "dist/**", which is already on the list']);
  assert.deepEqual(problems('{"files": ["a.js", "a.js"]}'), ['c.json: line 1: files names "a.js" twice']);
  assert.deepEqual(problems('{"files": []}'), ['c.json: line 1: files has no pattern left, so no file of a folder would be read']);
  assert.match(problems(JSON.stringify({ exclude: Array.from({ length: 501 }, (_, i) => `a${i}/**`) }))[0], /holds more than 500 entries/);
  assert.match(problems(JSON.stringify({ files: [`${'a'.repeat(300)}.js`] }))[0], /must hold 1 to 200 characters/);
});

test('config: a file pattern is checked, and a rule level must be a level or off', () => {
  for (const bad of ['/abs/*.js', '../x', 'a/**b', '[ab].js', 'a\\b']) assert.match(problems(JSON.stringify({ files: [bad] }))[0], /is not a file pattern/, bad);
  assert.match(problems('{"rules": {"scopeUse": "fatal"}}')[0], /rules\.scopeUse must be one of info, warning, error, off, not "fatal"/);
  assert.match(problems('{"rules": {"scopeUse": 1}}')[0], /not a number/);
});

test('config: the configuration must be an object, and JSON errors have their line and column', () => {
  assert.deepEqual(problems('[]'), ['c.json: line 1: the configuration must be a JSON object, not a list']);
  assert.deepEqual(problems('{\n  "name": "x",\n}'), ['c.json: line 3, column 1: a comma before the closing brace; JSON has no trailing comma']);
  assert.throws(() => validateConfig(null), /must be a JSON object, not null/);
});

test('config: helpers for the suggestions and the kinds of values', () => {
  assert.equal(distance('name', 'nmae'), 1);
  assert.equal(distance('', 'abc'), 3);
  assert.equal(suggestion('exclud', ['exclude', 'files']), '; did you mean "exclude"?');
  assert.equal(suggestion('somethingelse', ['files']), '');
  assert.deepEqual([null, [], {}, 1, 'x', true].map(kindOf), ['null', 'a list', 'an object', 'a number', 'a string', 'a boolean']);
  assert.equal(isObject({}), true);
  assert.equal(isObject([]), false);
});

test('patterns: *, ? and ** match by parts, a pattern with no slash matches the file name anywhere, and the rest is refused', () => {
  assert.equal(globMatch('**/*.js', 'a.js'), true);
  assert.equal(globMatch('**/*.js', 'src/app/cart/cart.js'), true);
  assert.equal(globMatch('**/*.js', 'src/readme.md'), false);
  assert.equal(globMatch('src/*.js', 'src/a.js'), true);
  assert.equal(globMatch('src/*.js', 'src/x/a.js'), false);
  assert.equal(globMatch('**/*.spec.js', 'app/cart/cart.spec.js'), true);
  assert.equal(globMatch('dist/**', 'dist/app.js'), true);
  assert.equal(globMatch('dist/**', 'src/dist/app.js'), false);
  assert.equal(globMatch('**/t?.ts', 'a/b/t1.ts'), true);
  assert.equal(globMatch('**/t?.ts', 't12.ts'), false);
  assert.equal(globMatch('*.html', 'deep/down/a.html'), true);
  assert.equal(globMatch('a*b*c', 'aXbYbZc'), true);
  assert.equal(globMatch('a*b*c', 'aXbYbZ'), false);
  assert.equal(isIncluded('dist/app.js', DEFAULT_FILES, DEFAULT_EXCLUDE), false);
  assert.equal(isIncluded('vendor/angular.min.js', DEFAULT_FILES, DEFAULT_EXCLUDE), false);
  assert.equal(isIncluded('app/cart.spec.ts', DEFAULT_FILES, DEFAULT_EXCLUDE), false);
  assert.equal(isIncluded('app/cart.js', DEFAULT_FILES, DEFAULT_EXCLUDE), true);
  assert.equal(isIncluded('app/cart.component.html', DEFAULT_FILES, DEFAULT_EXCLUDE), true);
  assert.equal(isIncluded('app/notes.txt', DEFAULT_FILES, DEFAULT_EXCLUDE), false);
  for (const bad of ['', '/abs', 'a/../b', 'a//b', './a', '[ab].js', '{a,b}.js', '!a.js', 'a\\b', 'a**', 'x'.repeat(201), `a${String.fromCharCode(1)}`]) assert.notEqual(globProblem(bad), null, bad);
  assert.equal(globProblem('src/**/*.js'), null);
  assert.equal(globProblem(3), 'must hold 1 to 200 characters');
});
