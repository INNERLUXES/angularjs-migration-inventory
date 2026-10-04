import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FILE_LIMITS, HtmlError, LIMITS, LexError, MAX_PROBLEMS, readHtml, readScript, tokenize } from '../src/index.js';
import { cli, reportOf, rulesOf, run, withFiles } from './helpers.js';

// Hostile input: files built to exhaust the memory or the time, to make the tool follow a link, to rewrite the
// terminal, to start a second workflow command, to slip a formula into a spreadsheet or to change how objects behave.
// Each heavy test also checks the time, because work that grows faster than the input is a failure even when the
// answer is right. Tests that need a symbolic link, a device or file permissions are guarded with process.platform, and
// none of them asserts a line: lines are asserted in the tests that run everywhere.

const LIMIT = { timeout: 180000 };
// Coverage counting slows every line of the tool several times over, so a run with --experimental-test-coverage gets a
// wider time limit. A plain `npm test` keeps the tight one, and that is the run that guards against slow growth.
// The runner sets NODE_V8_COVERAGE for its test processes only when coverage is on.
const COVERAGE = Boolean(process.env.NODE_V8_COVERAGE);
const fast = async (fn, ms = 5000) => {
  const limit = COVERAGE ? ms * 4 : ms;
  const start = Date.now();
  const result = await fn();
  assert.ok(Date.now() - start < limit, `took ${Date.now() - start} ms`);
  return result;
};

const BAD = "angular.module('m', []).controller('A', function ($scope) { $scope.$watch('x', f); });\n";
const GOOD = { 'p/a.js': BAD };

test('hostile: a file over its size limit is an error finding, a configuration over its limit stops the run', LIMIT, async () => {
  const big = await fast(() => run({ 'p/big.js': `var a;\n${' '.repeat(FILE_LIMITS.maxFileBytes)}`, ...GOOD }, ['p']));
  assert.equal(big.code, 1);
  assert.match(big.out, /p\/big\.js:1\n {11}the file cannot be read: [\d,]+ bytes is over the 4 MB limit; nothing in it is counted/);
  const config = await run({ ...GOOD, 'c.json': ' '.repeat(FILE_LIMITS.maxConfigBytes + 1) }, ['p', '--config', 'c.json']);
  assert.equal(config.code, 2);
  assert.match(config.err, /c\.json: [\d,]+ bytes is over the 1 MB limit/);
});

test('hostile: a thousand files of a hundred registrations each are read in seconds, and each rule lists at most its limit', LIMIT, async () => {
  const regs = Array.from({ length: 100 }, (_, i) => `.controller('C${i}', ['$scope', function ($scope) { $scope.$watch('a', f); }])`).join('\n');
  const files = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`x/f${String(i).padStart(4, '0')}/a.js`, `angular.module('m${i}', ['m${(i + 1) % 1000}'])\n${regs};\n`]));
  const r = await fast(() => run(files, ['x', '--json']), 60000);
  const json = JSON.parse(r.out);
  assert.equal(json.inventory.counts.registrations, 100000);
  assert.equal(json.inventory.counts.modules, 1000);
  assert.equal(json.findings.filter((f) => f.rule === 'module-registration').length, LIMITS.maxFindingsPerRule);
  assert.equal(json.totals.findings, 1000 + 100000 + 1000 + 100000 + 1);
  assert.ok(json.notes.some((n) => /findings past the limit of 500 per rule are counted but not listed/.test(n)));
  assert.equal(json.inventory.cycles.length, 1, 'the thousand modules depend on each other in one ring');
  assert.equal(json.inventory.order.length, 1000);
});

test('hostile: long runs of quotes, backslashes, comment openers, slashes, braces and brackets are read in one pass', LIMIT, async () => {
  for (const text of [
    `var s = '${"\\'".repeat(500000)}';`,
    `/*${'/*'.repeat(300000)}`,
    `${'/'.repeat(500001)}`,
    `x = ${'/a/ / '.repeat(200000)}1`,
    `${'`'.repeat(500001)}`,
    `var s = \`${'${'.repeat(60)}${'}'.repeat(60)}\`;`,
    `${'{'.repeat(500000)}`,
    `${'('.repeat(300000)}${')'.repeat(300000)}`,
    `${'['.repeat(300000)}`,
    `${"angular.module('m', [".repeat(50000)}`,
    `${"angular.module('m').controller('a', ".repeat(50000)}`,
    `${"scope: { a: '=', ".repeat(100000)}`,
    `var s = '${'\\'.repeat(400001)}`
  ]) {
    await fast(() => {
      try {
        readScript(tokenize(text));
      } catch (error) {
        assert.ok(error instanceof LexError, error.message);
      }
    });
  }
  const chain = await fast(() => reportOf({ 'a.js': `angular.module('m', [])${".value('v', 1)".repeat(50000)};` }));
  assert.equal(chain.inventory.counts.registrations, 50000);
});

test('hostile: deep, wide and repetitive HTML is read or refused fast', LIMIT, async () => {
  await fast(() => readHtml('<div>'.repeat(300000)));
  await fast(() => readHtml(`<p>${'<b ng-if="x | f" ng-repeat="a in b">{{ c | d }}</b>'.repeat(100000)}</p>`));
  await fast(() => assert.throws(() => readHtml(`<a ${Array.from({ length: 300 }, (_, i) => `x${i}="1"`).join(' ')}/>`), /more than 256 attributes/));
  await fast(() => assert.throws(() => readHtml(`<a><!--${'-'.repeat(1000000)}`), HtmlError));
  await fast(() => assert.throws(() => readHtml(`${'<script>'.repeat(100000)}`), /a script element that is not closed/));
  await fast(() => readHtml(`{{ ${'a | '.repeat(200000)}b }}`));
  const r = await fast(() => reportOf({ 'a.html': `${'<p ng-controller="X">{{ y | z }}</p>\n'.repeat(20000)}` }));
  assert.equal(r.inventory.templates.controllers, 20000);
});

test('hostile: a set with a hundred files of no kind the tool reads lists twenty problems and a count', LIMIT, async () => {
  const files = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`x/F${String(i).padStart(3, '0')}.txt`, 'x']));
  const r = await fast(() => run({ ...files, 'c.json': '{"files": ["*.txt"]}' }, ['x', '--config', 'c.json']));
  assert.equal(r.code, 2);
  assert.match(r.err, /the input has problems:/);
  assert.match(r.err, /\n {2}and 80 more\n$/);
  assert.equal(r.err.split('\n').filter((l) => l.startsWith('  x/')).length, MAX_PROBLEMS);
});

test('hostile: CRLF, CR and a byte order mark give the same report as LF', async () => {
  const files = {
    'p/a.js': "angular.module('m', [])\n  .controller('A', ['$scope', function ($scope) {\n    $scope.$on('x', f);\n  }]);\n// done\n",
    'p/b.ts': "class S {\n  static $inject = ['$http'];\n}\nangular.module('m').service('s', S);\nvar t = `a\n${1}`;\n",
    'p/c.html': '<div\n  ng-controller="A">\n  {{ a | currency }}\n<!-- x\n-->\n</div>\n',
    'p/d.js': "var s = 'a\\\nb';\n$timeout(f);\n"
  };
  const lf = await run(files, ['p', '--json']);
  assert.equal(lf.code, 0, lf.err);
  assert.equal(JSON.parse(lf.out).totals.findings, 8);
  for (const eol of ['\r\n', '\r']) {
    const changed = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, `${String.fromCharCode(0xfeff)}${v.split('\n').join(eol)}`]));
    const r = await run(changed, ['p', '--json']);
    assert.equal(r.out, lf.out, JSON.stringify(eol));
  }
});

test('hostile: control, escape and direction characters in file names, names and values never reach the reports', async () => {
  const esc = String.fromCharCode(27);
  const rlo = String.fromCharCode(0x202e);
  const ls = String.fromCharCode(0x2028);
  const files = { [`p/a${rlo}.js`]: `angular.module('m${esc}[2J${rlo}', []).controller('C${ls}', fn);\nx.$on('e${esc}', f);\n`, [`p/t${rlo}.html`]: `<p ng-controller="X${esc}[1m">{{ a | f${rlo} }}</p>` };
  for (const format of ['text', 'json', 'github', 'csv']) {
    const r = await run(files, ['p', '--format', format, ...(format === 'text' || format === 'json' ? ['--explain'] : [])]);
    assert.equal(r.code, 0, r.err);
    for (const c of [esc, rlo, ls]) assert.ok(!r.out.includes(c) && !r.err.includes(c), `${format}: ${c.charCodeAt(0)}`);
  }
  const bad = await run({ [`bad${rlo}.txt`]: 'x' }, [`bad${rlo}.txt`]);
  assert.equal(bad.code, 2);
  assert.ok(!bad.err.includes(rlo));
});

test('hostile: a text cannot start a second workflow command, and a name cannot become a spreadsheet formula', async () => {
  const r = await run({ 'p/a.js': "angular.module('m', []).controller('=HYPERLINK(1)', fn);\nx.$on('%0A::error::x', f);\n" }, ['p', '--format', 'github']);
  const lines = r.out.trimEnd().split('\n');
  assert.ok(lines.every((l) => l.startsWith('::warning ') || l.startsWith('::notice ') || l.startsWith('angularjs-migration-inventory: ')), r.out);
  assert.ok(r.out.includes('%250A::error::x'));
  const csv = await run({ 'p/a.js': "angular.module('m', []).controller('=HYPERLINK(1)', fn).filter('+x', fn).value('@y', 1).constant('-z', 1);\n" }, ['p', '--format', 'csv']);
  for (const v of ['=HYPERLINK(1)', '+x', '@y', '-z']) assert.ok(csv.out.includes(`,'${v},`), v);
});

test('hostile: constructor, toString and __proto__ as names, values and keys are only data', async () => {
  const r = reportOf({ 'a.js': "var __proto__ = angular.module('constructor', ['__proto__']);\n__proto__.controller('toString', fn);\nangular.module('hasOwnProperty', []).filter('__proto__', fn);\nx = { scope: { __proto__: '=' } };\n", 'b.html': '<p __proto__="x" ng-controller="toString">{{ a | __proto__ }}</p>' });
  assert.deepEqual(rulesOf(r).sort(), ['module-declaration', 'module-declaration', 'module-registration', 'module-registration', 'template-controller', 'template-filter', 'two-way-binding']);
  assert.equal(Object.getPrototypeOf({}), Object.prototype);
  assert.equal(r.inventory.modules.find((m) => m.name === 'constructor').registrations.controller, 1);
  const cfg = await run({ ...GOOD, 'c.json': '{"rules": {"toString": "off"}, "weights": {"__proto__": 1}}' }, ['p', '--config', 'c.json']);
  assert.equal(cfg.code, 2);
  assert.match(cfg.err, /"toString" is not a key of rules/);
});

test('hostile: empty files of every kind are read without a crash', async () => {
  const r = await run({ 'p/a.js': '', 'p/b.ts': '', 'p/c.html': '', 'p/d.mjs': '' }, ['p']);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /\(4 files: 2 javascript, 1 typescript, 1 template\)/);
  assert.match(r.out, /Findings \(0\)/);
});

test('hostile: a file named through a symbolic link is refused, and a link inside a folder is skipped, not followed', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Windows needs extra rights to make a symbolic link');
    return;
  }
  await withFiles({ 'x/a.js': BAD, 'secret/s.js': BAD, 'c.json': '{}' }, async (dir) => {
    await symlink(resolve(dir, 'x/a.js'), resolve(dir, 'linked.js'));
    await symlink(resolve(dir, 'secret'), resolve(dir, 'x/inside'));
    await symlink(resolve(dir, 'secret/s.js'), resolve(dir, 'x/s.js'));
    await symlink(resolve(dir, 'c.json'), resolve(dir, 'c-link.json'));
    const r = await cli(['linked.js'], dir);
    assert.equal(r.code, 2);
    assert.match(r.err, /linked\.js: is a symbolic link, which is not followed/);
    const c = await cli(['x', '--config', 'c-link.json'], dir);
    assert.equal(c.code, 2);
    assert.match(c.err, /is a symbolic link/);
    const walk = await cli(['x'], dir);
    assert.equal(walk.code, 0, walk.err);
    assert.match(walk.out, /\(1 file: 1 javascript\)/);
    assert.match(walk.out, /note: 2 symbolic links inside the folders were skipped, not followed/);
  });
});

test('hostile: a device named as a script or the configuration is refused', LIMIT, async (t) => {
  if (process.platform === 'win32') {
    t.skip('Windows has no /dev/zero to name as an input');
    return;
  }
  await withFiles(GOOD, async (dir) => {
    const config = await fast(() => cli(['p', '--config', '/dev/zero'], dir));
    assert.equal(config.code, 2);
    assert.match(config.err, /is not a regular file/);
    const input = await fast(() => cli(['/dev/zero'], dir));
    assert.equal(input.code, 2);
    assert.match(input.err, /is not a regular file|not a kind of file/);
  });
});

test('hostile: a file without read access is an error finding, and a folder without read access stops the run', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Windows does not take away read access with chmod');
    return;
  }
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    t.skip('the root user can read a file without read access');
    return;
  }
  await withFiles({ 'x/a.js': BAD, 'x/b.js': BAD, 'y/locked/c.js': BAD, 'y/d.js': BAD }, async (dir) => {
    await chmod(resolve(dir, 'x/a.js'), 0o000);
    await chmod(resolve(dir, 'y/locked'), 0o000);
    try {
      const r = await cli(['x'], dir);
      assert.equal(r.code, 1);
      assert.match(r.out, /the file cannot be read: cannot be read \(EACCES\)/);
      const folder = await cli(['y'], dir);
      assert.equal(folder.code, 2);
      assert.match(folder.err, /y\/locked: cannot be read \(EACCES\)/);
    } finally {
      await chmod(resolve(dir, 'x/a.js'), 0o644);
      await chmod(resolve(dir, 'y/locked'), 0o755);
    }
  });
});
