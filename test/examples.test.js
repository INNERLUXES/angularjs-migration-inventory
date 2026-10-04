import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLEAN, EXPECTED, LEGACY, UNWANTED, run } from '../tools/example.mjs';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const saved = (name) => readFile(resolve(root, 'examples/output', name), 'utf8');

test('examples: the legacy app fails with the report that is saved in examples/output', async () => {
  const r = await run(LEGACY);
  assert.equal(r.code, 1);
  assert.equal(r.err, '');
  assert.equal(r.out, await saved('legacy.txt'));
  for (const e of EXPECTED) assert.ok(r.out.includes(e), e);
  for (const u of UNWANTED) assert.ok(!r.out.includes(u), u);
});

test('examples: the clean app passes with the report that is saved', async () => {
  const r = await run(CLEAN);
  assert.equal(r.code, 0);
  assert.equal(r.out, await saved('clean.txt'));
  assert.match(r.out, /\nfindings: 3 \(3 info\)\n/);
});

test('examples: --explain, JSON, the GitHub commands, the CSV and the defaults are the reports that are saved', async () => {
  assert.equal((await run([...LEGACY, '--explain'])).out, await saved('legacy-explain.txt'));
  assert.equal((await run([...LEGACY, '--json', '--explain'])).out, await saved('legacy.json'));
  assert.equal((await run([...LEGACY, '--format', 'github'])).out, await saved('legacy-github.txt'));
  assert.equal((await run([...LEGACY, '--format', 'csv'])).out, await saved('legacy.csv'));
  assert.equal((await run(['--print-defaults'])).out, await saved('defaults.json'));
});

test('examples: the rules that fire on the legacy app, each on the line built for it', async () => {
  const report = JSON.parse((await run([...LEGACY, '--json'])).out);
  const byRule = {};
  for (const f of report.findings) (byRule[f.rule] ??= []).push(f.at.replace('examples/legacy/', ''));
  // The place of the first line of a file that holds needle.
  const at = async (rel, needle) => {
    const lines = (await readFile(resolve(root, 'examples/legacy', rel), 'utf8')).split('\n');
    return `${rel}:${lines.findIndex((l) => l.includes(needle)) + 1}`;
  };
  const app = 'app/app.module.js';
  const cart = 'app/cart/cart.module.js';
  const catalog = 'app/catalog/catalog.module.js';
  const core = 'app/core/core.module.js';
  const promo = 'app/promo/promo.module.js';
  assert.deepEqual(byRule, {
    'untokenizable-file': [await at('app/promo/banner.js', "'Spring blends;")],
    'root-scope-use': [await at(app, "'$rootScope'"), await at(cart, 'function CartSummaryController')],
    'scope-event': [await at(app, '$on('), await at(cart, '$broadcast'), await at(catalog, '$on(')],
    'two-way-binding': [await at(cart, 'bindings:'), await at(catalog, 'scope:')],
    'compile-use': [await at(cart, '$compile(')],
    'timer-use': [await at(cart, '$timeout(function'), await at('app/core/clock.service.ts', '$interval(')],
    'scope-use': [await at(catalog, "'$scope'")],
    'scope-watch': [await at(catalog, '$watch')],
    'module-cycle': [await at(promo, "'harbor.offers', ['")],
    'duplicate-module': [await at(promo, "angular.module('harbor.core', [])")],
    'template-controller': [await at('index.html', 'ng-controller')],
    'template-include': [await at('index.html', 'ng-include')],
    'module-declaration': [await at(app, ".module('harbor'"), await at(cart, 'angular.module'), await at(catalog, 'angular.module'), await at(core, 'angular.module'), await at(promo, "'harbor.promo', ['"), await at(promo, "'harbor.offers', ['")],
    'module-registration': [await at(app, '.config('), await at(app, '.run('), await at(cart, '.component('), await at(cart, '.directive('), await at(catalog, '.controller('), await at(catalog, '.directive('), await at('app/core/clock.service.ts', '.service('), await at(core, 'core.constant'), await at(core, 'core.factory'), await at(core, 'core.filter'), await at(promo, '.value(')],
    'template-filter': [await at('app/cart/cart-summary.html', 'currency'), await at('app/catalog/tea-card.html', 'uppercase'), await at('app/catalog/tea-card.html', 'steepTime'), await at('app/catalog/tea-card.html', 'steepTime'), await at('index.html', 'uppercase'), await at('index.html', 'orderBy'), await at('index.html', 'currency')],
    'dynamic-name': [await at(promo, 'angular.module(extras')]
  });
});

test('examples: the same files written with CRLF line ends give the same output', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'angularjs-migration-inventory-crlf-'));
  try {
    await cp(resolve(root, 'examples'), resolve(dir, 'examples'), { recursive: true });
    const walk = async (sub) => {
      for (const e of await readdir(resolve(dir, sub), { withFileTypes: true })) {
        const rel = `${sub}/${e.name}`;
        if (e.isDirectory()) {
          if (e.name !== 'output') await walk(rel);
        } else if (!e.name.endsWith('.md')) {
          const t = (await readFile(resolve(dir, rel), 'utf8')).split('\r\n').join('\n');
          await writeFile(resolve(dir, rel), t.split('\n').join('\r\n'));
        }
      }
    };
    await walk('examples');
    assert.equal((await run([...LEGACY, '--explain'], dir)).out, await saved('legacy-explain.txt'));
    assert.equal((await run(CLEAN, dir)).out, await saved('clean.txt'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
