// Runs the README examples, checks that they report what the README shows, and writes the reports of the two made-up
// apps to examples/output. CI runs it and then fails if those files changed, so the example output in the repository is
// always the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// The arguments of the examples; every path is relative to the root of the repository.
export const LEGACY = ['examples/legacy', '--config', 'examples/config.json'];
export const CLEAN = ['examples/clean'];

// Runs the tool on files of the repository; the paths shown in the report are relative to the root of the repository.
export async function run(argv, base = root) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// What the README says of the legacy app: the counts, one finding of every rule that fires, the inventory and the
// result.
export const EXPECTED = [
  'input: examples/legacy (12 files: 6 javascript, 1 typescript, 5 template)',
  'findings: 42 (1 error, 16 warning, 25 info)',
  'line 3, column 15: a string that is not closed before the end of its line',
  'module harbor is declared with 4 dependencies: harbor.core, harbor.catalog, harbor.cart, ngRoute',
  'controller CatalogController on harbor.catalog; dependencies in an array: $scope, teaStore',
  'factory teaStore on harbor.core; dependencies in $inject: $http, API_ROOT',
  'service clock on harbor.core; dependencies in $inject: $interval',
  'component cartSummary on harbor.cart; dependencies only as parameter names, which a minifier breaks: $rootScope, $timeout',
  '$scope appears 10 times in this file, first here',
  '$rootScope appears 3 times in this file, first here',
  '$watch is called on $scope',
  '$broadcast of "cart:changed" is called on $rootScope',
  '$compile is called to compile markup while the app runs',
  '$interval is called',
  "items: '=' in the bindings of a component binds two ways",
  "tea: '=' in the isolate scope of a directive binds two ways",
  'ng-controller="CatalogController" attaches the controller CatalogController to this markup (registered on harbor.catalog)',
  'ng-include="\'app/partials/footer.html\'" fetches and compiles a template while the app runs',
  'filter steepTime (registered on harbor.core) is used once in this template',
  'module harbor.core is declared again',
  'modules harbor.offers -> harbor.promo -> harbor.offers depend on each other',
  'angular.module is called with a name that is not a string literal',
  '  1      harbor.core     3',
  'modules not declared in the files read: ngRoute (1), ngSanitize (1)',
  'RESULT: FAIL - 17 findings at or above warning (1 error, 16 warning, 25 info)'
];
// Names in comments and strings, the regular expression with quotes, Array filter calls, the unit test and the vendor
// folder that the configuration leaves out are not counted.
export const UNWANTED = ['RESULT: PASS', 'ghost', 'chartHelper', 'miniChart', 'cart.spec.js', 'vendor/', 'filter filter', "data: '='"];

const problems = [];
function expect(name, result, code, expected, unwanted, stream = 'out') {
  const text = result[stream];
  const missing = expected.filter((e) => !text.includes(e));
  const wrong = unwanted.filter((e) => text.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})${result.err ? `\n${result.err}` : ''}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const legacy = await run(LEGACY);
  process.stdout.write(legacy.out);
  expect('legacy app', legacy, 1, EXPECTED, UNWANTED);

  const clean = await run(CLEAN);
  expect('clean app', clean, 0, ['input: examples/clean (2 files: 1 javascript, 1 template)', 'findings: 3 (3 info)', 'component noteList on notes; dependencies in $inject: noteStore', 'RESULT: PASS - no finding at or above error (3 info)'], ['  WARNING  ', '  ERROR  ', 'RESULT: FAIL']);

  // Without the configuration the vendor folder is read too, and the run fails only on the file it cannot read.
  expect('legacy, built-in configuration', await run(['examples/legacy']), 1, ['config: built-in defaults:', 'module chartHelper is declared', "data: '=' in the isolate scope of a directive binds two ways", 'RESULT: FAIL - 1 finding at or above error'], []);
  // The clean app fails when warnings fail the run only if it has one; it has none.
  expect('clean, fail on warning', await run([...CLEAN, '--fail-on', 'warning']), 0, ['RESULT: PASS - no finding at or above warning'], []);
  // Only the risks and the errors can be shown, and one file can be named on its own.
  expect('legacy, warnings and up', await run([...LEGACY, '--min-severity', 'warning']), 1, ['findings: 17 (1 error, 16 warning); 25 below warning not shown'], ['  INFO  ']);
  expect('legacy, one file', await run(['examples/legacy/app/catalog/catalog.module.js', '--fail-on', 'warning']), 1, ['angularjs-migration-inventory: examples/legacy/app/catalog/catalog.module.js', 'findings: 7 (4 warning, 3 info)'], []);
  // A file of no kind the tool reads stops the run.
  expect('legacy, a README named', await run(['examples/legacy/README.md']), 2, ['examples/legacy/README.md: not a kind of file the tool reads'], [], 'err');

  // The README shows the whole report of the legacy app, the --explain lines of one finding, the GitHub annotations of
  // two findings, the head of the CSV and the report of the clean app.
  const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
  if (!readme.includes(legacy.out)) problems.push('README: the sample output of the legacy app differs from a real run');
  if (!readme.includes(clean.out)) problems.push('README: the sample output of the clean app differs from a real run');

  await mkdir(resolve(root, 'examples/output'), { recursive: true });
  await writeFile(resolve(root, 'examples/output/legacy.txt'), legacy.out);
  await writeFile(resolve(root, 'examples/output/clean.txt'), clean.out);
  const explain = await run([...LEGACY, '--explain']);
  if (explain.code !== 1) problems.push(`explain: exit code ${explain.code}, expected 1`);
  const lines = explain.out.split('\n');
  const at = lines.findIndex((l) => l.includes('two-way-binding') && l.includes('cart.module.js:4'));
  const sample = lines.slice(at, at + 8).join('\n');
  if (at < 0 || !readme.includes(sample)) problems.push('README: the --explain sample of the two-way binding differs from a real run');
  await writeFile(resolve(root, 'examples/output/legacy-explain.txt'), explain.out);
  const github = await run([...LEGACY, '--format', 'github']);
  if (github.code !== 1) problems.push(`github: exit code ${github.code}, expected 1`);
  const picked = github.out.split('\n').filter((x) => x.includes('catalog.module.js,line=8,') || x.includes('index.html,line=10,'));
  if (picked.length !== 2) problems.push('github: the sample lines are not in the output');
  for (const l of picked) if (!readme.includes(l)) problems.push('README: the GitHub sample differs from a real run');
  await writeFile(resolve(root, 'examples/output/legacy-github.txt'), github.out);
  const csv = await run([...LEGACY, '--format', 'csv']);
  if (csv.code !== 1) problems.push(`csv: exit code ${csv.code}, expected 1`);
  const head = csv.out.split('\r\n').slice(0, 4).join('\n');
  if (!readme.includes(head)) problems.push('README: the CSV sample differs from a real run');
  await writeFile(resolve(root, 'examples/output/legacy.csv'), csv.out);
  const json = await run([...LEGACY, '--json', '--explain']);
  if (json.code !== 1) problems.push(`json: exit code ${json.code}, expected 1`);
  await writeFile(resolve(root, 'examples/output/legacy.json'), json.out);
  const defaults = await run(['--print-defaults']);
  if (defaults.code !== 0) problems.push(`--print-defaults: exit code ${defaults.code}, expected 0`);
  await writeFile(resolve(root, 'examples/output/defaults.json'), defaults.out);

  if (problems.length) {
    for (const p of problems) console.error(`example: ${p}`);
    process.exit(1);
  }
}
