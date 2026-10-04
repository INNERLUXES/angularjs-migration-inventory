# angularjs-migration-inventory

Measures an AngularJS (Angular 1.x) code base before a migration to modern Angular. Give it the folder of the app, or
single files, and it reads the `.js` and `.ts` scripts and the `.html` templates and lists every `angular.module` with
its dependencies, every controller, directive, component, service, factory, provider, filter, constant, value, config
and run block registered on a module with the way its dependencies are annotated, every use of `$scope`, `$rootScope`,
`$watch`, `$broadcast`, `$emit`, `$on`, `$compile`, `$timeout` and `$interval` and every two-way binding, each with what
takes its place in Angular, and the `ng-controller`, `ng-include`, filters and directives of the templates. It gives a
size score for every file and module and a suggested migration order, and exits with a code a pipeline can act on.

The long-term support of AngularJS has ended (https://docs.angularjs.org/misc/version-support-status), and the Angular
guide to upgrading from AngularJS asks for preparation before any code moves: component directives in place of
controllers and `$scope`, one component per file, and then a hybrid app that moves the code module by module
(https://v17.angular.io/guide/upgrade). Planning that needs numbers: how many modules there are and which depend on
which, how much is registered on each, and where the code leans on the scope, the digest and the template features
Angular does not have. This tool reads them from the files, without running the app.

- **Modules and registrations.** Every module declaration with its dependencies, and every registration, chained on
  `angular.module(...)` or made through a variable that holds a module, in the array, `$inject` and parameter-name
  styles of annotation, in JavaScript and TypeScript, classes included.
- **Migration risks.** `$scope`, `$rootScope`, watchers, scope events, `$compile`, timers, two-way (`=`) bindings in
  directive and component definitions, `ng-controller`, `ng-include`, a module declared twice and modules that depend on
  each other in a cycle, each a warning with a short note on its counterpart in Angular: signals, `input()` and
  `output()`, `model()`, root services, `ViewContainerRef.createComponent`, components and pipes.
- **Templates.** `ng-controller` and `ng-include` in every spelling AngularJS accepts, the filters used in expressions,
  and how often each built-in and registered directive is used.
- **Size and order.** A size score per file and module from lines, registrations and risks, and a migration order that
  starts with the leaf modules that the fewest modules depend on.
- **Honest about input.** A file it cannot read or tokenize is an error finding with its line, never passed over; a
  name it cannot follow is counted, not guessed. [docs/limits.md](docs/limits.md) says what it cannot see.
- Reports as text, JSON, GitHub workflow annotations and CSV of the inventory, with an exit code for a pipeline: `0` no
  finding at or above the `--fail-on` level, `1` a finding at or above it, `2` usage or input error.
- Plain JavaScript, no dependencies, no build run and no network.

```
npm test
```

```
tests 154
pass 151
fail 0
skipped 3
```

These are the summary lines that `npm test` prints at the end on Windows. The skipped tests are the ones that need a
symbolic link, a device or file permissions (a file named through a symbolic link and links inside a folder,
`/dev/zero` named as an input, and a file and a folder with no read access); they are guarded with `process.platform`,
run on Linux and macOS, and none of them asserts a line. `npm run test:coverage` runs the same tests with coverage;
their time limits are four times wider when coverage is on.

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/angularjs-migration-inventory.git
cd angularjs-migration-inventory
node bin/angularjs-migration-inventory.js examples/legacy --config examples/config.json
```

Or without a clone, on your own app:

```
npx --yes github:INNERLUXES/angularjs-migration-inventory src
```

`examples/` holds two made-up apps: `examples/legacy`, a tea shop with several modules and one risk of every kind, a
module cycle, a second declaration, a name built at run time and a file saved half written, and `examples/clean`, a
small notes app that is ready to move. The legacy app also names `$scope` and `angular.module` in comments, holds a
regular expression with quotes in it, a unit test and a copied library, and none of that is counted.
`examples/config.json` leaves the copied library out and fails the run on warnings.

## Usage

```
angularjs-migration-inventory <file-or-folder>... [--config <file>] [options]
```

```
--config <file>           settings in strict JSON: files, exclude, rules, minSeverity, failOn and weights
                          (--print-defaults shows them)
--format <name>           text, json, github or csv (default: text); github writes workflow commands that GitHub
                          shows as annotations; csv writes the inventory
--json                    the same as --format json
--min-severity <level>    the lowest level of a finding that is shown: info, warning, error (default: minSeverity of
                          the configuration, else info)
--fail-on <level>         the lowest level of a finding that fails the run: info, warning, error (default: failOn of
                          the configuration, else error)
--explain                 show the rule, the public sources and the tool's own choice behind each finding
--print-defaults          print the built-in configuration and exit
--help                    show the usage
--version                 show the version
```

A file named on the command line is read whatever its path, if it is of a kind the tool reads. A folder is walked, and
the `.js`, `.mjs`, `.cjs`, `.ts` and `.html` files in it are read, in the order of their paths; `dist`, `build` and
`coverage` at the top, minified files, bundles and unit tests are left out, `.git`, `node_modules` and
`bower_components` are not entered, and a symbolic link is skipped, not followed. The path in the report is relative
to the folder you run the command in, with forward slashes on every system, followed by the line.

The report of the legacy example starts with what was read, the configuration, the rules and the counts, then the
findings, errors first, each risk with its counterpart in Angular, then the modules in the migration order, the
registrations, the templates and the files with the highest score:

```
angularjs-migration-inventory: examples/legacy
input: examples/legacy (12 files: 6 javascript, 1 typescript, 5 template)
config: examples/config.json (Harbor Tea): 6 file patterns, 10 exclude patterns; minimum severity info; fail on warning
rules: module-declaration (info); module-registration (info); dynamic-name (info); template-filter (info); scope-use (warning); root-scope-use (warning); scope-watch (warning); scope-event (warning); compile-use (warning); timer-use (warning); two-way-binding (warning); template-controller (warning); template-include (warning); duplicate-module (warning); module-cycle (warning); unreadable-file (error); untokenizable-file (error)
findings: 42 (1 error, 16 warning, 25 info)

Findings (42)

  ERROR    untokenizable-file   examples/legacy/app/promo/banner.js:3
           line 3, column 15: a string that is not closed before the end of its line; the file was not read past this point, and nothing in it is counted but its lines

  WARNING  root-scope-use       examples/legacy/app/app.module.js:10
           $rootScope appears 3 times in this file, first here
           in Angular: a service provided at the root holds the shared state, with signals or an observable for its changes

  WARNING  scope-event          examples/legacy/app/app.module.js:11
           $on of "$routeChangeError" is called on $rootScope
           in Angular: output() from a child to its parent; a shared service with a signal or a Subject for events that cross the app

  WARNING  two-way-binding      examples/legacy/app/cart/cart.module.js:4
           items: '=' in the bindings of a component binds two ways
           in Angular: input() for data in and output() for changes out, or model() with [( )] where two-way binding is meant

  WARNING  compile-use          examples/legacy/app/cart/cart.module.js:12
           $compile is called to compile markup while the app runs
           in Angular: NgComponentOutlet or ViewContainerRef.createComponent with a component class; markup is not compiled at run time

  WARNING  root-scope-use       examples/legacy/app/cart/cart.module.js:17
           $rootScope appears 2 times in this file, first here
           in Angular: a service provided at the root holds the shared state, with signals or an observable for its changes

  WARNING  timer-use            examples/legacy/app/cart/cart.module.js:21
           $timeout is called
           in Angular: setTimeout and setInterval, or timer() and interval() of RxJS; with signals the view updates without a digest

  WARNING  scope-event          examples/legacy/app/cart/cart.module.js:21
           $broadcast of "cart:changed" is called on $rootScope
           in Angular: output() from a child to its parent; a shared service with a signal or a Subject for events that cross the app

  WARNING  scope-use            examples/legacy/app/catalog/catalog.module.js:3
           $scope appears 10 times in this file, first here
           in Angular: state lives on the component class and in signals; data from a parent comes through input() and goes back through output()

  WARNING  scope-watch          examples/legacy/app/catalog/catalog.module.js:8
           $watch is called on $scope
           in Angular: computed() for a derived value, effect() for a side effect, or the input itself as a signal; RxJS for streams

  WARNING  scope-event          examples/legacy/app/catalog/catalog.module.js:12
           $on of "cart:changed" is called on $scope
           in Angular: output() from a child to its parent; a shared service with a signal or a Subject for events that cross the app

  WARNING  two-way-binding      examples/legacy/app/catalog/catalog.module.js:19
           tea: '=' in the isolate scope of a directive binds two ways
           in Angular: input() for data in and output() for changes out, or model() with [( )] where two-way binding is meant

  WARNING  timer-use            examples/legacy/app/core/clock.service.ts:9
           $interval is called
           in Angular: setTimeout and setInterval, or timer() and interval() of RxJS; with signals the view updates without a digest

  WARNING  module-cycle         examples/legacy/app/promo/promo.module.js:4
           modules harbor.offers -> harbor.promo -> harbor.offers depend on each other; none of them can move before the others
           in Angular: standalone components and services that import what they use, with no cycle between features

  WARNING  duplicate-module     examples/legacy/app/promo/promo.module.js:6
           module harbor.core is declared again; it was declared first at examples/legacy/app/core/core.module.js:2, and a second declaration replaces the module with everything registered on it before
           in Angular: one NgModule or one set of standalone components per feature; nothing replaces a module that exists

  WARNING  template-controller  examples/legacy/index.html:10
           ng-controller="CatalogController" attaches the controller CatalogController to this markup (registered on harbor.catalog)
           in Angular: a component with a selector and its own template takes the place of the controller and the markup it was attached to

  WARNING  template-include     examples/legacy/index.html:16
           ng-include="'app/partials/footer.html'" fetches and compiles a template while the app runs
           in Angular: a child component, or ngTemplateOutlet for markup kept in the same template

  INFO     module-declaration   examples/legacy/app/app.module.js:6
           module harbor is declared with 4 dependencies: harbor.core, harbor.catalog, harbor.cart, ngRoute

  INFO     module-registration  examples/legacy/app/app.module.js:7
           config block on harbor; dependencies in an array: $routeProvider

  INFO     module-registration  examples/legacy/app/app.module.js:10
           run block on harbor; dependencies in an array: $rootScope, $log

  INFO     template-filter      examples/legacy/app/cart/cart-summary.html:2
           filter currency (built in) is used 2 times in this template, first here
           in Angular: a pipe in the Angular template, with the same | syntax; a custom filter becomes a pipe class

  INFO     module-declaration   examples/legacy/app/cart/cart.module.js:2
           module harbor.cart is declared with 2 dependencies: harbor.core, harbor.catalog

  INFO     module-registration  examples/legacy/app/cart/cart.module.js:3
           component cartSummary on harbor.cart; dependencies only as parameter names, which a minifier breaks: $rootScope, $timeout

  INFO     module-registration  examples/legacy/app/cart/cart.module.js:8
           directive quickAdd on harbor.cart; dependencies in an array: $compile

  INFO     module-declaration   examples/legacy/app/catalog/catalog.module.js:2
           module harbor.catalog is declared with 1 dependency: harbor.core

  INFO     module-registration  examples/legacy/app/catalog/catalog.module.js:3
           controller CatalogController on harbor.catalog; dependencies in an array: $scope, teaStore

  INFO     module-registration  examples/legacy/app/catalog/catalog.module.js:16
           directive teaCard on harbor.catalog; no dependency

  INFO     template-filter      examples/legacy/app/catalog/tea-card.html:2
           filter uppercase (built in) is used once in this template
           in Angular: a pipe in the Angular template, with the same | syntax; a custom filter becomes a pipe class

  INFO     template-filter      examples/legacy/app/catalog/tea-card.html:3
           filter steepTime (registered on harbor.core) is used once in this template
           in Angular: a pipe in the Angular template, with the same | syntax; a custom filter becomes a pipe class

  INFO     template-filter      examples/legacy/app/catalog/tea-card.html:3
           filter currency (built in) is used once in this template
           in Angular: a pipe in the Angular template, with the same | syntax; a custom filter becomes a pipe class

  INFO     module-registration  examples/legacy/app/core/clock.service.ts:17
           service clock on harbor.core; dependencies in $inject: $interval

  INFO     module-declaration   examples/legacy/app/core/core.module.js:2
           module harbor.core is declared with 1 dependency: ngSanitize

  INFO     module-registration  examples/legacy/app/core/core.module.js:4
           constant API_ROOT on harbor.core

  INFO     module-registration  examples/legacy/app/core/core.module.js:6
           factory teaStore on harbor.core; dependencies in $inject: $http, API_ROOT

  INFO     module-registration  examples/legacy/app/core/core.module.js:25
           filter steepTime on harbor.core; no dependency

  INFO     module-declaration   examples/legacy/app/promo/promo.module.js:3
           module harbor.promo is declared with 1 dependency: harbor.offers

  INFO     module-registration  examples/legacy/app/promo/promo.module.js:3
           value promoBanner on harbor.promo

  INFO     module-declaration   examples/legacy/app/promo/promo.module.js:4
           module harbor.offers is declared with 1 dependency: harbor.promo

  INFO     dynamic-name         examples/legacy/app/promo/promo.module.js:9
           angular.module is called with a name that is not a string literal, so the module it declares cannot be named; registrations chained on it are counted on no module

  INFO     template-filter      examples/legacy/index.html:6
           filter uppercase (built in) is used once in this template
           in Angular: a pipe in the Angular template, with the same | syntax; a custom filter becomes a pipe class

  INFO     template-filter      examples/legacy/index.html:12
           filter orderBy (built in) is used once in this template
           in Angular: a pipe in the Angular template, with the same | syntax; a custom filter becomes a pipe class

  INFO     template-filter      examples/legacy/index.html:13
           filter currency (built in) is used once in this template
           in Angular: a pipe in the Angular template, with the same | syntax; a custom filter becomes a pipe class

Modules, in the suggested migration order

  order  module          dependents  files  lines  risks  score  registrations
  1      harbor.core     3           2      37     1      28     service 1, factory 1, filter 1, constant 1
  2      harbor.catalog  2           2      25     4      25     controller 1, directive 1
  3      harbor.cart     1           2      27     5      29     directive 1, component 1
  4      harbor          0           2      18     2      19     config 1, run 1
  5*     harbor.offers   1           0      0      0      0      none
  6      harbor.promo    1           1      7      2      12     value 1

  module          declared at                                      depends on
  harbor.core     examples/legacy/app/core/core.module.js:2        ngSanitize
  harbor.catalog  examples/legacy/app/catalog/catalog.module.js:2  harbor.core
  harbor.cart     examples/legacy/app/cart/cart.module.js:2        harbor.core, harbor.catalog
  harbor          examples/legacy/app/app.module.js:6              harbor.core, harbor.catalog, harbor.cart, ngRoute
  harbor.offers   examples/legacy/app/promo/promo.module.js:4      harbor.promo
  harbor.promo    examples/legacy/app/promo/promo.module.js:3      harbor.offers

  * placed to break a cycle of dependencies

  modules not declared in the files read: ngRoute (1), ngSanitize (1)

Registrations

  11: controller 1, directive 2, component 1, service 1, factory 1, filter 1, constant 1, value 1, config 1, run 1
  annotations: array 4, $inject 2, parameter names only 1, no dependency 2, not visible 0

Templates

  5 templates: ng-controller 1, ng-include 1
  filters: currency 4 (built in), uppercase 2 (built in), orderBy 1 (built in), steepTime 1 (custom, harbor.core)
  directives: ngRepeat 3, ngClick 2, teaCard 2 (directive, harbor.catalog), cartSummary 1 (component, harbor.cart), ngApp 1, ngController 1, ngIf 1, ngInclude 1, ngModel 1 and quickAdd 1 (directive, harbor.cart)

Files, highest score first

  score  lines  registrations  risks  module          file
  28     22     2              5      harbor.cart     examples/legacy/app/cart/cart.module.js
  24     20     2              4      harbor.catalog  examples/legacy/app/catalog/catalog.module.js
  18     14     2              2      harbor          examples/legacy/app/app.module.js
  18     24     3              0      harbor.core     examples/legacy/app/core/core.module.js
  12     7      1              2      harbor.promo    examples/legacy/app/promo/promo.module.js
  10     13     1              1      harbor.core     examples/legacy/app/core/clock.service.ts
  8      18     0              2      -               examples/legacy/index.html
  1      5      0              0      harbor.cart     examples/legacy/app/cart/cart-summary.html
  1      4      0              0      harbor          examples/legacy/app/catalog/catalog.html
  1      5      0              0      harbor.catalog  examples/legacy/app/catalog/tea-card.html
  1      1      0              0      -               examples/legacy/app/partials/footer.html
  1      4      0              0      -               examples/legacy/app/promo/banner.js (not read)

  score = lines / 10 (rounded up) + 5 per registration + 3 per risk

This inventory lists what the tool could read in the files it was given: module declarations, registrations with a string name, risks and template use. It does not run the code or follow a name built at run time, a registration made through a variable of another kind, or code a bundler wrote, so the counts are a lower bound (docs/limits.md).

RESULT: FAIL - 17 findings at or above warning (1 error, 16 warning, 25 info)
```

With `--explain`, each finding also shows the rule, the points of the public pages it rests on and the tool's own
choice:

```
  WARNING  two-way-binding      examples/legacy/app/cart/cart.module.js:4
           items: '=' in the bindings of a component binds two ways
           in Angular: input() for data in and output() for changes out, or model() with [( )] where two-way binding is meant
           rule: a binding of the form = in a scope, bindToController or bindings object
           basis: in the scope or bindToController object of a directive, = (also with ? or * after it) binds a value both ways, < one way, @ as a string and & as an expression ($compile (AngularJS API Reference), https://docs.angularjs.org/api/ng/service/$compile)
           basis: a component should take its inputs with < and @ and report changes through & callbacks, so that only the component that owns the data changes it; components also make a later move to Angular easier (Understanding Components (AngularJS Developer Guide), https://docs.angularjs.org/guide/component)
           basis: input takes data from a parent component, and a model input also sends new values back, bound with the [( )] syntax for two-way binding (Accepting data with input properties (angular.dev), https://angular.dev/guide/components/inputs)
           the tool's own choice: a binding whose value is =, =?, =* or =*? with or without an attribute name, inside an object under scope, bindToController or bindings
```

The clean example passes:

```
angularjs-migration-inventory: examples/clean
input: examples/clean (2 files: 1 javascript, 1 template)
config: built-in defaults: 6 file patterns, 9 exclude patterns; minimum severity info; fail on error
rules: module-declaration (info); module-registration (info); dynamic-name (info); template-filter (info); scope-use (warning); root-scope-use (warning); scope-watch (warning); scope-event (warning); compile-use (warning); timer-use (warning); two-way-binding (warning); template-controller (warning); template-include (warning); duplicate-module (warning); module-cycle (warning); unreadable-file (error); untokenizable-file (error)
findings: 3 (3 info)

Findings (3)

  INFO     module-declaration   examples/clean/notes.module.js:2
           module notes is declared with no dependency

  INFO     module-registration  examples/clean/notes.module.js:3
           component noteList on notes; dependencies in $inject: noteStore

  INFO     module-registration  examples/clean/notes.module.js:8
           service noteStore on notes; no dependency

Modules, in the suggested migration order

  order  module  dependents  files  lines  risks  score  registrations
  1      notes   0           2      19     0      13     component 1, service 1

  module  declared at                       depends on
  notes   examples/clean/notes.module.js:2  -

Registrations

  2: component 1, service 1
  annotations: array 0, $inject 1, parameter names only 0, no dependency 1, not visible 0

Templates

  1 template: ng-controller 0, ng-include 0
  filters: none
  directives: ngClick 1 and ngRepeat 1

Files, highest score first

  score  lines  registrations  risks  module  file
  12     16     2              0      notes   examples/clean/notes.module.js
  1      3      0              0      notes   examples/clean/note-list.html

  score = lines / 10 (rounded up) + 5 per registration + 3 per risk

This inventory lists what the tool could read in the files it was given: module declarations, registrations with a string name, risks and template use. It does not run the code or follow a name built at run time, a registration made through a variable of another kind, or code a bundler wrote, so the counts are a lower bound (docs/limits.md).

RESULT: PASS - no finding at or above error (3 info)
```

## What it reports

| Rule | Key | Default level | Finds |
| --- | --- | --- | --- |
| `module-declaration` | `rules.moduleDeclaration` | info | `angular.module(name, [dependencies])`, with its dependencies |
| `module-registration` | `rules.moduleRegistration` | info | a controller, directive, component, service, factory, provider, filter, constant, value, config or run block on a module, with its annotation |
| `dynamic-name` | `rules.dynamicName` | info | a module or registration whose name is not a string literal |
| `template-filter` | `rules.templateFilter` | info | a filter used in the expressions of a template, once per filter and template |
| `scope-use` | `rules.scopeUse` | warning | `$scope`, once per file with the count of uses |
| `root-scope-use` | `rules.rootScopeUse` | warning | `$rootScope`, once per file with the count of uses |
| `scope-watch` | `rules.scopeWatch` | warning | a call of `$watch`, `$watchCollection` or `$watchGroup` |
| `scope-event` | `rules.scopeEvent` | warning | a call of `$broadcast`, `$emit` or `$on`, with the event name |
| `compile-use` | `rules.compileUse` | warning | a call of `$compile` |
| `timer-use` | `rules.timerUse` | warning | a call of `$timeout` or `$interval` |
| `two-way-binding` | `rules.twoWayBinding` | warning | a `=` binding in `scope`, `bindToController` or `bindings` |
| `template-controller` | `rules.templateController` | warning | `ng-controller` in a template, in any spelling |
| `template-include` | `rules.templateInclude` | warning | `ng-include` in a template, as an attribute or an element |
| `duplicate-module` | `rules.duplicateModule` | warning | a module declared again, which replaces the first declaration |
| `module-cycle` | `rules.moduleCycle` | warning | modules that depend on each other in a cycle |
| `unreadable-file` | none | error | a file that cannot be read as UTF-8 text |
| `untokenizable-file` | none | error | a script or template with a string, comment, template literal, regular expression, tag or attribute value that is not closed |

The two rules of input problems are always errors. [docs/method.md](docs/method.md) says exactly what each rule looks
at and what it cannot see, and [docs/rules-and-sources.md](docs/rules-and-sources.md) gives the points of the public
pages each rule rests on and its note on Angular.

## What is not counted

The tool counts what is written and never guesses. It does not count:

- a module, a registration or a `$scope` in a comment, or inside a string or a template literal;
- a call such as `items.filter(...)` on a name that holds no module it can find; the report counts these calls in a
  note;
- a registration made through `$provide` or `$compileProvider` in a config block, a module kept on an object or
  imported from another file, or a name built at run time; a name that is not a string literal is a finding of
  `dynamic-name`, so it is counted but not named;
- the markup of an inline `template:` string;
- files under `dist`, `build` and `coverage`, minified files, bundles and unit tests, unless the configuration asks
  for them.

So every count is a lower bound, and every report says so
([decision 3](docs/decisions/0003-count-only-what-is-written-and-make-unreadable-input-an-error.md)).

## The configuration file

```json
{
  "name": "Harbor Tea",
  "exclude": { "add": ["vendor/**"] },
  "rules": { "timerUse": "info" },
  "failOn": "warning",
  "weights": { "linesPerPoint": 10, "registration": 5, "risk": 3 }
}
```

Every key is optional, and without `--config` the defaults apply. `files` and `exclude` are the file patterns of a
folder walk, with `*`, `?` and `**`; `rules` sets the level of each rule (`info`, `warning`, `error` or `off`),
`minSeverity` the lowest level shown, `failOn` the lowest level that fails the run, and `weights` the weights of the size
score. A list is a JSON array that replaces the built-in list, or an object with `replace`, `add` and `remove`. A key
the tool does not know is an error with its line and a suggestion, and a key named twice is refused.
[docs/inputs.md](docs/inputs.md) describes every key, and `--print-defaults` writes the whole default configuration
out.

## Formats

- `text`: for a terminal: what was read, the configuration, the rules, the counts, the findings with the file and line
  and the note on Angular, the modules in the migration order with their dependencies, the registrations by kind and
  annotation, the templates, filters and directives, the files with the highest score, the notes, the notice and the
  result. With `--explain` also the rule, the points of the public pages and the tool's own choice behind each finding.
- `json` (or `--json`): the whole report: the input with the kind of every file, the configuration, every finding with
  its file, line, column, module and note on Angular, the inventory with every module, registration, file and
  template count, the totals, the result, the notes and the notice.
- `github`: one workflow command per finding, `::error`, `::warning` or `::notice` (for info) with the file, line and
  column, which GitHub shows as an annotation in the pull request, then a summary line. The characters a command gives
  a meaning to are escaped. Two findings of the legacy example:

```
::warning file=examples/legacy/app/catalog/catalog.module.js,line=8,col=12,title=angularjs-migration-inventory scope-watch::$watch is called on $scope; in Angular: computed() for a derived value, effect() for a side effect, or the input itself as a signal; RxJS for streams
::warning file=examples/legacy/index.html,line=10,col=9,title=angularjs-migration-inventory template-controller::ng-controller="CatalogController" attaches the controller CatalogController to this markup (registered on harbor.catalog); in Angular: a component with a selector and its own template takes the place of the controller and the markup it was attached to
```

- `csv`: the inventory as RFC 4180 CSV with CRLF line ends: one record per module, with its order, dependents, files,
  lines, registrations, risks and score, then one per registration with its annotation and dependencies, then one per
  file. A field that starts with `=`, `+`, `-` or `@` gets a quote in front, so a spreadsheet does not read it as a
  formula. The first lines of the legacy example:

```
record,module,kind,name,file,line,annotation,dependencies,order,dependents,files,lines,registrations,risks,score,note
module,harbor.core,declared,harbor.core,examples/legacy/app/core/core.module.js,2,,ngSanitize,1,harbor harbor.cart harbor.catalog,2,37,4,1,28,
module,harbor.catalog,declared,harbor.catalog,examples/legacy/app/catalog/catalog.module.js,2,,harbor.core,2,harbor harbor.cart,2,25,2,4,25,
module,harbor.cart,declared,harbor.cart,examples/legacy/app/cart/cart.module.js,2,,harbor.core harbor.catalog,3,harbor,2,27,2,5,29,
```

## Exit codes

`0`: no finding at or above the fail-on level (`error` by default). `1`: at least one finding at or above it; with the
default, a file the tool could not read or tokenize, or a rule raised to `error`; with `--fail-on warning`, any
migration risk too. `2`: a usage or input error: no path, an unknown option, an option given twice, `--explain` with
the github or csv format, a URL in place of a path, a path that cannot be read, a symbolic link named on the command
line, a folder with no file to read, a file of no kind the tool reads, input past the limit of a run, or a
configuration with an unknown key, a key named twice or a value of the wrong kind. With exit code `2` the tool gives no
result and prints the problems on standard error.

## Limits

The tool reads files; it does not run the app, load its modules, resolve imports or open the libraries it uses. A run
lists what the files hold in the forms of docs/method.md, so the counts are a lower bound: a registration made through
a name the tool cannot follow, a name built at run time, an inline template and code a bundler wrote are not counted.
The size score ranks files and modules against each other; it is not a measure of effort.
[docs/limits.md](docs/limits.md) lists what it cannot see, with the size limits: 4 MB for a file, 256 MB and 20,000
files for a run, 500 findings listed per rule. [docs/threat-model.md](docs/threat-model.md) lists the risks of reading a
source tree from a pull request and their controls, and [docs/secure-defaults.md](docs/secure-defaults.md) the defaults
and how to run the tool in a pipeline.

## Architecture

Plain ES modules in `src/`, with no dependencies.

| File | Job |
| --- | --- |
| `src/cli.js` | the command line, the usage and the exit codes |
| `src/check.js` | reads the configuration and the files, runs the analysis and builds the report of the run |
| `src/files.js`, `src/glob.js`, `src/kinds.js` | the bounded reading of files and folders with no link followed, the file patterns, and the kind of each file |
| `src/lexer.js`, `src/scripts.js` | the tokenizer of JavaScript and TypeScript, and the modules, registrations, annotations, bindings and risks of a script |
| `src/html.js`, `src/templates.js` | the reader of the tags and attributes of templates, and their controllers, includes, filters and directive names |
| `src/analyse.js`, `src/graph.js` | the findings and the inventory of the run, and the cycles and migration order of the modules |
| `src/config.js`, `src/defaults.js`, `src/json.js` | the configuration file over the defaults, and its strict JSON reader |
| `src/rules.js` | the rules, their levels and the result |
| `src/report.js`, `src/csv.js`, `src/text.js`, `src/size.js`, `src/words.js` | the text, JSON, GitHub and CSV output, the cleaning of text from the input, number formats, and names compared as names |
| `src/data.js` | the public pages and the points the rules rest on, in this project's own words |
| `tools/check.mjs`, `tools/example.mjs` | the repository checks, and the examples with their real output |

## Where the facts come from

| Fact | Source |
| --- | --- |
| The long-term support of AngularJS has ended | AngularJS, https://docs.angularjs.org/misc/version-support-status |
| How to prepare an AngularJS app and move it piece by piece | Angular documentation, https://v17.angular.io/guide/upgrade |
| Module declaration, retrieval, chaining, config and run blocks, and a second declaration replacing the first | AngularJS Developer Guide, https://docs.angularjs.org/guide/module |
| The array, `$inject` and parameter-name annotations, and minification | AngularJS Developer Guide, https://docs.angularjs.org/guide/di |
| Directive name normalization and isolate scope bindings | AngularJS Developer Guide, https://docs.angularjs.org/guide/directive |
| Component bindings and the advice against two-way bindings | AngularJS Developer Guide, https://docs.angularjs.org/guide/component |
| Root and child scopes, watchers and scope events | AngularJS Developer Guide, https://docs.angularjs.org/guide/scope |
| Filters in template expressions | AngularJS Developer Guide, https://docs.angularjs.org/guide/filter |
| `$compile` and the `=`, `=?`, `=*`, `<`, `@` and `&` bindings | AngularJS API Reference, https://docs.angularjs.org/api/ng/service/$compile |
| `$timeout` and the digest | AngularJS API Reference, https://docs.angularjs.org/api/ng/service/$timeout |
| `ng-controller` and `ng-include` | AngularJS API Reference, https://docs.angularjs.org/api/ng/directive/ngController and https://docs.angularjs.org/api/ng/directive/ngInclude |
| Signals, inputs and model inputs, outputs, root services, dynamic components and pipes | angular.dev, https://angular.dev/guide/signals, https://angular.dev/guide/components/inputs, https://angular.dev/guide/components/outputs, https://angular.dev/guide/di/creating-and-using-services, https://angular.dev/guide/components/programmatic-rendering and https://angular.dev/guide/templates/pipes |
| Comments, strings, template literals and the two meanings of a slash | MDN Web Docs, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar |
| Tags, attributes, comments and raw text in HTML | WHATWG, https://html.spec.whatwg.org/multipage/syntax.html |
| Annotations from workflow commands | GitHub Docs, https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands |
| The CSV format | RFC 4180, https://www.rfc-editor.org/rfc/rfc4180 |
| Formulas in CSV cells | OWASP, https://community.owasp.org/attacks/CSV_Injection |
| Repeated names in a JSON object | RFC 8259, https://www.rfc-editor.org/rfc/rfc8259 |

[research/sources.md](research/sources.md) has a note on each page, in this project's own words.

## Background

Moving an AngularJS app to Angular is rarely blocked by one hard problem; it is slowed by not knowing the size of the
many small ones: how many modules there are and in what order they can move, which controllers still live on `$scope`,
where events cross the app on `$rootScope`, and which templates still attach controllers and include partials by hand.
An inventory read from the files, on every pull request, turns the migration into a list that gets shorter and an order
to work in. How Angular applications are built and moved is described on the page
[Angular Web Development Services](https://innerluxes.dev/web-development/angular).

## License

MIT
