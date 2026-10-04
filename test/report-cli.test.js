import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CSV_COLUMNS, NOTICE, USAGE, VERSION, csvField, escapeData, escapeProperty, parseArgs, toCsv, toGithub, toJson, toText } from '../src/index.js';
import { cli, js, reportOf, run, withFiles } from './helpers.js';

const CLEAN = { 'app/src/a.js': "angular.module('m', []).component('c', { bindings: { x: '<' } });\n" };
const RISKY = { 'app/src/a.js': "angular.module('m', []).controller('A', ['$scope', function ($scope) {}]);\n" };
const BROKEN = { 'app/src/a.js': "var s = 'open;\n" };

test('cli: exit 0 below the fail-on level, 1 at or above it, from the flag or the configuration', async () => {
  const clean = await run(CLEAN, ['app']);
  assert.equal(clean.code, 0, clean.err);
  assert.match(clean.out, /^angularjs-migration-inventory: app\ninput: app \(1 file: 1 javascript\)\nconfig: built-in defaults: 6 file patterns, 9 exclude patterns; minimum severity info; fail on error\nrules: module-declaration \(info\); /);
  assert.match(clean.out, /RESULT: PASS - no finding at or above error \(2 info\)\n$/);
  assert.equal(clean.err, '');
  const risky = await run(RISKY, ['app']);
  assert.equal(risky.code, 0, 'a warning does not fail the run by default');
  assert.equal((await run(RISKY, ['app', '--fail-on', 'warning'])).code, 1);
  assert.equal((await run(CLEAN, ['app', '--fail-on', 'info'])).code, 1);
  const configured = await run({ ...RISKY, 'c.json': '{"failOn": "warning"}' }, ['app', '--config', 'c.json']);
  assert.equal(configured.code, 1);
  assert.match(configured.out, /RESULT: FAIL - 1 finding at or above warning \(1 warning, 2 info\)\n$/);
  assert.equal((await run({ ...RISKY, 'c.json': '{"failOn": "warning"}' }, ['app', '--config', 'c.json', '--fail-on', 'error'])).code, 0, 'the flag wins over the configuration');
  const broken = await run(BROKEN, ['app']);
  assert.equal(broken.code, 1, 'a file that cannot be tokenized fails the run at the default level');
  assert.match(broken.out, /ERROR {4}untokenizable-file {3}app\/src\/a\.js:1/);
});

test('cli: several paths, files and folders, read together in the order given, each file once', async () => {
  const r = await run({ ...RISKY, 'more/t.html': '<p ng-controller="A"></p>', 'one/b.ts': "angular.module('m').service('s', S);\n" }, ['app', 'more', 'one/b.ts', 'app/src/a.js', '--json']);
  assert.equal(r.code, 0, r.err);
  const json = JSON.parse(r.out);
  assert.deepEqual(json.input.paths, ['app', 'more', 'one/b.ts', 'app/src/a.js']);
  assert.deepEqual(json.input.files.map((f) => [f.file, f.kind]), [['app/src/a.js', 'javascript'], ['more/t.html', 'template'], ['one/b.ts', 'typescript']]);
  assert.deepEqual(json.inventory.modules[0].registrations, { controller: 1, service: 1 });
});

test('cli: build output, minified files, tests and dependency folders are not read, and the patterns of the configuration are', async () => {
  const bad = RISKY['app/src/a.js'];
  const files = { ...CLEAN, 'app/dist/b.js': bad, 'app/src/c.min.js': bad, 'app/src/d.spec.js': bad, 'app/node_modules/x/e.js': bad, 'app/bower_components/y/f.js': bad, 'app/.git/g.js': bad, 'app/src/notes.md': 'x', 'app/src/build/h.js': bad };
  const r = await run(files, ['app', '--json']);
  assert.deepEqual(JSON.parse(r.out).input.files.map((f) => f.file), ['app/src/a.js', 'app/src/build/h.js'], 'a folder named build deep in the tree is read');
  const only = await run({ ...files, 'c.json': '{"files": ["src/**/*.js"], "exclude": ["**/build/**"]}' }, ['app', '--config', 'c.json', '--json']);
  assert.deepEqual(JSON.parse(only.out).input.files.map((f) => f.file), ['app/src/a.js', 'app/src/c.min.js', 'app/src/d.spec.js']);
  const named = await run(files, ['app/dist/b.js']);
  assert.match(named.out, /input: app\/dist\/b\.js \(1 file: 1 javascript\)/, 'a file named directly is read even when a pattern leaves it out');
});

test('cli: exit 2 for usage errors, with the usage and nothing on standard output', async () => {
  for (const [args, message] of [
    [[], /give the code base to measure: a folder, or script and template files/],
    [['app', 'app'], /app is named twice/],
    [['app', '--bogus'], /unknown argument --bogus/],
    [['app', '--format', 'xml'], /unknown format xml \(text, json, github or csv\)/],
    [['app', '--format', 'json', '--format', 'text'], /--format was given twice/],
    [['app', '--json', '--format', 'csv'], /--json and --format csv ask for two formats; give one/],
    [['app', '--min-severity', 'notice'], /--min-severity: unknown level notice \(info, warning, error\)/],
    [['app', '--fail-on', 'fatal'], /--fail-on: unknown level fatal/],
    [['app', '--fail-on', 'error', '--fail-on', 'info'], /--fail-on was given twice/],
    [['app', '--config'], /--config needs a value/],
    [['app', '--config', '--json'], /--config needs a value/],
    [['app', '--explain', '--format', 'csv'], /--explain adds the sources of each finding to the text and JSON reports; the csv format has no place for them/],
    [['app', '--explain', '--format', 'github'], /the github format has no place for them/],
    [['-'], /reading from standard input is not supported/],
    [['app', '--config', '-'], /reading from standard input is not supported/],
    [['https://example.com/app'], /give a local path; the tool never fetches a URL/],
    [['app', '--config', 'file://c.json'], /give a local path/]
  ]) {
    const r = await run(CLEAN, args);
    assert.equal(r.code, 2, args.join(' '));
    assert.match(r.err, message, args.join(' '));
    assert.ok(r.err.includes('Usage: angularjs-migration-inventory'), args.join(' '));
    assert.equal(r.out, '');
  }
  assert.throws(() => parseArgs(Array.from({ length: 101 }, (_, i) => `p${i}`)), /more than 100 paths/);
});

test('cli: exit 2 for input errors, with the problems and no result', async () => {
  for (const [files, args, message] of [
    [CLEAN, ['missing'], /missing: no such file/],
    [{ ...CLEAN, 'empty/notes.md': 'x' }, ['empty'], /empty: no file in this folder matches \*\*\/\*\.js/],
    [{ 'a.txt': 'x' }, ['a.txt'], /a\.txt: not a kind of file the tool reads \(a \.js, \.mjs, \.cjs, \.ts, \.mts, \.cts, \.html or \.htm file\)/],
    [{ ...CLEAN, 'c.json': '{"exlude": []}' }, ['app', '--config', 'c.json'], /c\.json: line 1: "exlude" is not a key of the configuration; did you mean "exclude"\?/],
    [{ ...CLEAN, 'c.json': '{"files": ["*.txt"]}', 'app/x.txt': 'x' }, ['app', '--config', 'c.json'], /app\/x\.txt: not a kind of file the tool reads/],
    [CLEAN, ['app', '--config', 'nope.json'], /nope\.json: no such file/],
    [CLEAN, ['app', '--config', 'app'], /app: is a folder; give the file itself/]
  ]) {
    const r = await run(files, args);
    assert.equal(r.code, 2, `${args.join(' ')}: ${r.err}`);
    assert.match(r.err, /^angularjs-migration-inventory: no result, the input has (?:a problem|problems):\n/);
    assert.match(r.err, message);
    assert.equal(r.out, '');
  }
});

test('cli: a binary, UTF-16 or invalid UTF-8 file in a folder is an error finding, and the rest is still read', async () => {
  const r = await run({ ...RISKY, 'app/src/bin.js': Buffer.from([0x61, 0, 0x62]), 'app/src/u16.js': Buffer.from([0xff, 0xfe, 0x61, 0]), 'app/src/latin.html': Buffer.from([0x63, 0x61, 0x66, 0xe9]) }, ['app']);
  assert.equal(r.code, 1);
  assert.match(r.out, /app\/src\/bin\.js:1\n {11}the file cannot be read: holds binary data \(a null byte\); only text is read; nothing in it is counted/);
  assert.match(r.out, /the file cannot be read: is UTF-16; only UTF-8 is read/);
  assert.match(r.out, /the file cannot be read: is not valid UTF-8; only UTF-8 text is read/);
  assert.match(r.out, /controller A on m/);
  const big = await run(RISKY, ['app'], { maxFileBytes: 10 });
  assert.match(big.out, /the file cannot be read: \d+ bytes is over the 10 byte limit/);
  const total = await run({ 'x/a.js': 'var a = 1;\n', 'x/b.js': 'var b = 2;\n' }, ['x'], { maxTotalBytes: 12 });
  assert.equal(total.code, 2);
  assert.match(total.err, /x\/b\.js: the files read so far hold more than 12 bytes, the limit of one run/);
});

test('cli: --help, --version and --print-defaults', async () => {
  const help = await cli(['--help'], '.');
  assert.equal(help.code, 0);
  assert.equal(help.out, USAGE);
  for (const s of ['--fail-on', '--min-severity', '--format', 'csv', 'scope-use (rules.scopeUse)', 'unreadable-file (always error)', 'Exit codes: 0 no finding at or above the fail-on level']) assert.ok(USAGE.includes(s), s);
  const version = await cli(['--version'], '.');
  assert.equal(version.out, `${VERSION}\n`);
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  const defaults = await cli(['--print-defaults'], '.');
  assert.equal(defaults.code, 0);
  assert.deepEqual(Object.keys(JSON.parse(defaults.out)), ['name', 'files', 'exclude', 'rules', 'minSeverity', 'failOn', 'weights']);
});

test('text: the findings with the modern Angular note, --explain with the rule and its sources, and the inventory', async () => {
  const r = reportOf({ ...RISKY, 'app/t.html': '<p ng-controller="A">{{ x | date }}</p>' });
  const text = toText(r);
  assert.match(text, /\n {2}WARNING {2}scope-use {12}app\/src\/a\.js:1\n {11}\$scope appears 2 times in this file, first here\n {11}in Angular: state lives on the component class/);
  assert.ok(text.includes('Modules, in the suggested migration order'));
  assert.ok(text.includes('Registrations\n\n  1: controller 1\n  annotations: array 1, $inject 0, parameter names only 0, no dependency 0, not visible 0'));
  assert.ok(text.includes('  1 template: ng-controller 1, ng-include 0\n  filters: date 1 (built in)\n  directives: ngController 1'));
  assert.ok(text.includes('  score = lines / 10 (rounded up) + 5 per registration + 3 per risk'));
  assert.ok(text.includes(NOTICE));
  assert.ok(!text.includes('basis:'));
  const explained = toText(r, { explain: true });
  assert.match(explained, /\n {11}rule: the name \$scope, or the string '\$scope', in a script\n {11}basis: every app has one root scope .+ \(What are Scopes\? \(AngularJS Developer Guide\), https:\/\/docs\.angularjs\.org\/guide\/scope\)\n/);
  assert.match(explained, /the tool's own choice: reported once per file/);
  const empty = toText(reportOf({ 'a.js': 'var x = 1;\n' }));
  assert.ok(empty.includes('Findings (0)\n\n  none\n'));
  assert.ok(empty.includes('Modules, in the suggested migration order\n\n  none\n'));
});

test('text: a module with no declaration, external modules, a broken cycle and a long list of files', () => {
  const files = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`app/f${String(i).padStart(2, '0')}.js`, `angular.module('m${i}', ['ngX']);\n`]));
  const r = reportOf({ ...files, 'app/z.js': "angular.module('a', ['b']); angular.module('b', ['a']); angular.module('ext').run(fn);\n" });
  const text = toText(r);
  assert.ok(text.includes('modules not declared in the files read: ngX (30)'));
  assert.ok(text.includes('* placed to break a cycle of dependencies'));
  assert.match(text, /\n {2}-\s+ext\s+0/);
  assert.match(text, /ext\s+not declared in the files read\s+-/);
  assert.ok(text.includes('  and 6 more files'));
});

test('json: the whole report, without the sources unless --explain', () => {
  const r = reportOf(RISKY);
  const json = JSON.parse(toJson(r));
  assert.deepEqual(Object.keys(json), ['tool', 'version', 'input', 'config', 'findings', 'inventory', 'totals', 'result', 'notes', 'notice']);
  assert.equal(json.findings[0].basis, undefined);
  assert.equal(json.findings[0].modern.length > 10, true);
  assert.deepEqual(Object.keys(json.inventory), ['counts', 'registrations', 'modules', 'external', 'cycles', 'order', 'templates', 'files', 'weights']);
  assert.deepEqual(json.inventory.registrations.list, [{ module: 'm', kind: 'controller', name: 'A', file: 'app/src/a.js', line: 1, annotation: 'array', deps: ['$scope'] }]);
  assert.ok(JSON.parse(toJson(r, { explain: true })).findings[0].basis.length > 0);
  assert.deepEqual(json.result, { pass: true, failOn: 'error', failing: 0, byLevel: { error: 0, warning: 1, info: 2 }, text: 'PASS - no finding at or above error (1 warning, 2 info)' });
});

test('github: one workflow command per finding, info as notice, with its properties and message escaped', () => {
  const r = reportOf({ 'app/a,b:c.js': "x.$on('100%\\nreal', f);\nangular.module('m', []);\n" });
  const out = toGithub(r);
  const lines = out.trimEnd().split('\n');
  assert.equal(lines[0], '::warning file=app/a%2Cb%3Ac.js,line=1,col=3,title=angularjs-migration-inventory scope-event::$on of "100%25\\nreal" is called on x; in Angular: output() from a child to its parent; a shared service with a signal or a Subject for events that cross the app');
  assert.equal(lines[1], '::notice file=app/a%2Cb%3Ac.js,line=2,col=9,title=angularjs-migration-inventory module-declaration::module m is declared with no dependency');
  assert.equal(lines[2], 'angularjs-migration-inventory: app/a,b:c.js: 1 file, 1 module, 0 registrations, 2 findings; RESULT: PASS - no finding at or above error (1 warning, 1 info)');
  assert.equal(escapeData('a%\r\nb'), 'a%25%0D%0Ab');
  assert.equal(escapeProperty('a:b,c'), 'a%3Ab%2Cc');
});

test('csv: a header, modules, registrations and files, CRLF line ends, fields quoted and formulas neutralized', () => {
  const r = reportOf({ 'app/a.js': "angular.module('m', ['x']).controller('A, \"B\"', ['$scope', function ($scope) {}]).filter('=SUM(1)', fn);\n" });
  const out = toCsv(r);
  assert.ok(out.endsWith('\r\n'));
  const rows = out.split('\r\n');
  assert.equal(rows[0], CSV_COLUMNS.join(','));
  assert.equal(rows[1], 'module,m,declared,m,app/a.js,1,,x,1,,1,1,2,1,14,');
  assert.equal(rows[2], 'registration,m,controller,"A, ""B""",app/a.js,1,array,$scope,,,,,,,,');
  assert.equal(rows[3], "registration,m,filter,'=SUM(1),app/a.js,1,unknown,,,,,,,,,");
  assert.equal(rows[4], 'file,m,javascript,,app/a.js,,,,,,,1,2,1,14,');
  for (const [v, expected] of [['+1', "'+1"], ['-x', "'-x"], ['@a', "'@a"], ['\tx', "'\tx"], ['a\nb', '"a\nb"'], [null, ''], [3, '3'], ['$scope', '$scope']]) assert.equal(csvField(v), expected, String(v));
  assert.ok(toCsv(reportOf({ 'a.js': "var s = 'x;\n" })).includes(',not read\r\n'));
});

test('cli: a run writes nothing to disk', async () => {
  await withFiles(RISKY, async (dir) => {
    const before = await readdir(resolve(dir), { recursive: true });
    for (const format of ['text', 'json', 'github', 'csv']) assert.equal((await cli(['app', '--format', format], dir)).code, 0);
    assert.deepEqual(await readdir(resolve(dir), { recursive: true }), before);
  });
  assert.ok(js('x').constructor === Object);
});
