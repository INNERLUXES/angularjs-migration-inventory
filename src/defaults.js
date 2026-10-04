// The built-in configuration: the files read in a folder, the files left out, the level of every rule, the lowest level
// shown, the level that fails the run and the weights of the size score. docs/inputs.md describes every key, and
// --print-defaults writes all of this out.

// The files read in a folder named on the command line: scripts, TypeScript files and templates.
export const DEFAULT_FILES = ['**/*.js', '**/*.mjs', '**/*.cjs', '**/*.ts', '**/*.html', '**/*.htm'];

// What a walk leaves out by default: build output, minified files and bundles, which repeat the code a bundler took
// from the sources, and unit tests, which make scopes and compile templates for the test alone.
export const DEFAULT_EXCLUDE = ['dist/**', 'build/**', 'coverage/**', '**/*.min.js', '**/*.bundle.js', '**/*.spec.js', '**/*.spec.ts', '**/*.test.js', '**/*.test.ts'];

// Folders a walk never enters.
export const SKIPPED_FOLDERS = ['.git', 'node_modules', 'bower_components', 'jspm_packages'];

// The level of every rule that the configuration can set. The two rules of input problems are always errors.
export const DEFAULT_RULES = {
  moduleDeclaration: 'info',
  moduleRegistration: 'info',
  dynamicName: 'info',
  templateFilter: 'info',
  scopeUse: 'warning',
  rootScopeUse: 'warning',
  scopeWatch: 'warning',
  scopeEvent: 'warning',
  compileUse: 'warning',
  timerUse: 'warning',
  twoWayBinding: 'warning',
  templateController: 'warning',
  templateInclude: 'warning',
  duplicateModule: 'warning',
  moduleCycle: 'warning'
};

// The lowest level of a finding that is shown.
export const DEFAULT_MIN_SEVERITY = 'info';

// The lowest level of a finding that fails the run.
export const DEFAULT_FAIL_ON = 'error';

// The size score of a file: one point for every linesPerPoint lines that hold more than white space (rounded up), and
// the given points for every registration and every risk.
export const DEFAULT_WEIGHTS = { linesPerPoint: 10, registration: 5, risk: 3 };
