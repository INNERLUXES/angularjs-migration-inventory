# Sources

The public pages the inventory and the risks of this tool are based on, each with a short note in this project's own
words on what the page says and which parts of the tool lean on it. Nothing here is a copy of a page: read the page
itself for its exact wording. src/data.js holds the pages and the points the reports show, and test/data.test.js checks
that every page there is listed here. Each page was fetched and read before it was listed.

The pages of docs.angularjs.org are built in the browser: the address of a page loads its text from a file of the same
path under `https://docs.angularjs.org/partials/`, with `.html` at the end, and that file is what was read for each of
them. The address listed is the one a reader opens.

## AngularJS

### Modules (AngularJS Developer Guide)

https://docs.angularjs.org/guide/module

The guide to modules. A call of `angular.module` with a name and a list of required modules creates a module; with
the name alone it returns one that exists. Creating a module under a name that is in use replaces the module that had
the name, with everything registered on it, which the page warns about. The methods that register services,
directives, filters and the rest return the module, so they can be chained. Config blocks run while the providers are
set up and run blocks once the injector exists. The tool reads module declarations and getters, chains of
registrations, config and run blocks (`module-declaration`, `module-registration`), and reports a second declaration
(`duplicate-module`).

### Dependency Injection (AngularJS Developer Guide)

https://docs.angularjs.org/guide/di

The guide to how AngularJS hands a component what it needs. It describes three ways to name the dependencies: an
inline array of names with the function last, which it prefers; an `$inject` property that holds the names; and the
names of the parameters alone, which breaks once a minifier renames them. It mentions a strict mode that refuses the
last form. The tool reports the annotation of every registration in these terms (`module-registration`).

### Creating Custom Directives (AngularJS Developer Guide)

https://docs.angularjs.org/guide/directive

The guide to writing directives. It explains how an element or attribute name is matched to a directive: `x-` and
`data-` are taken off the front and the parts split at a colon, a dash or an underscore are joined in camelCase, so
several spellings mean one directive. It also covers `restrict`, isolate scopes with `=`, `@` and `&` bindings, and
`templateUrl`. The tool normalizes every tag and attribute name of a template the same way (`template-controller`,
`template-include`, the use of directives).

### Understanding Components (AngularJS Developer Guide)

https://docs.angularjs.org/guide/component

The guide to `module.component`. It lists the binding forms: `=` two ways, `<` one way, `@` for strings and `&` for
callbacks, and advises inputs with `<` and `@` and outputs through `&`, so only the component that owns the data
changes it. It names an easier move to Angular among the reasons to write components. The tool reports `=` bindings
(`two-way-binding`) and reads the controller of a component for its annotation.

### What are Scopes? (AngularJS Developer Guide)

https://docs.angularjs.org/guide/scope

The guide to scopes. An app has one root scope and child scopes that follow the structure of the page and inherit from
their parents; `$watch` and `$watchCollection` observe expressions and are checked in every digest, which repeats
until the model settles; `$emit` sends an event up the tree, `$broadcast` down, and `$on` listens. The tool reports the
uses of `$scope` and `$rootScope`, the watchers and the scope events (`scope-use`, `root-scope-use`, `scope-watch`,
`scope-event`).

### Filters (AngularJS Developer Guide)

https://docs.angularjs.org/guide/filter

The guide to filters. In a template a filter follows a `|` in an expression, takes arguments after colons and can be
chained; a filter is registered on a module by name. The tool reads the filters of the expressions of templates
(`template-filter`).

### $compile (AngularJS API Reference)

https://docs.angularjs.org/api/ng/service/$compile

The reference of the compile service. It turns an HTML string or a piece of the page into a template function that is
linked to a scope while the app runs. The same page describes the directive definition object, with the binding forms
of `scope` and `bindToController`: `=` and its optional and shallow forms `=?` and `=*`, `<`, `@` and `&`. The tool
reports calls of `$compile` (`compile-use`) and every form of `=` (`two-way-binding`).

### $timeout (AngularJS API Reference)

https://docs.angularjs.org/api/ng/service/$timeout

The reference of the timeout service: a wrapper of `setTimeout` that by default runs its function inside `$apply`, so
the digest sees the change, and returns a promise that `$timeout.cancel` can stop. The tool reports its calls, and those
of `$interval`, its counterpart for repeated calls, the same way (`timer-use`).

### ngController (AngularJS API Reference)

https://docs.angularjs.org/api/ng/directive/ngController

The reference of `ng-controller`, which attaches a controller to a part of the page and makes a new scope for it; the
`controller as` form names the instance in the template. The tool reports every `ng-controller` with its controller
name before `as` (`template-controller`).

### ngInclude (AngularJS API Reference)

https://docs.angularjs.org/api/ng/directive/ngInclude

The reference of `ng-include`, which fetches, compiles and includes an HTML fragment. It can be an element with a
`src` attribute or an attribute, and its value is an expression, so a literal address is written inside quotes. The
tool reports both forms and shows the value as written (`template-include`).

### Version Support Status (AngularJS)

https://docs.angularjs.org/misc/version-support-status

The page on the support of AngularJS. It says that the long-term support of AngularJS has ended and sends readers to
Angular. This is the reason a code base is measured for a migration at all; the tool names no date for it.

## Angular

### Upgrading from AngularJS (Angular documentation, v17)

https://v17.angular.io/guide/upgrade

The guide of the Angular project to moving an AngularJS app, kept in the documentation of Angular v17. It advises
getting ready first: following the AngularJS style guide, one component per file, folders by feature, a module
loader, TypeScript, and component directives in place of controllers and `$scope`. It then describes hybrid apps that
run both frameworks and move the code piece by piece. The tool's inventory of modules and its migration order serve
that piece by piece move (`module-declaration`, `module-cycle`), and `scope-use` and `template-controller` point at the
code the guide asks to turn into components.

### Signals (angular.dev)

https://angular.dev/guide/signals

The guide to signals. `signal` holds a value, `computed` derives a value from other signals and is worked out again
only when they change, and `effect` runs a side effect when the signals it reads change. The tool names these as what
takes the place of a watcher (`scope-watch`) and of the digest a timer starts (`timer-use`).

### Accepting data with input properties (angular.dev)

https://angular.dev/guide/components/inputs

The guide to inputs. A component declares what it takes from its parent with `input`, and a model input also sends new
values back to the parent, bound with the `[( )]` syntax for two-way binding. The tool names these as what takes the
place of a two-way binding (`two-way-binding`) and of data on `$scope` (`scope-use`).

### Custom events with outputs (angular.dev)

https://angular.dev/guide/components/outputs

The guide to outputs. A component declares an event with `output` and emits it to its parent, and these events do not
bubble up the page. The tool names outputs as what takes the place of scope events between a child and its parent
(`scope-event`).

### Creating and using services (angular.dev)

https://angular.dev/guide/di/creating-and-using-services

The guide to services. A service provided at the root of the app is one shared instance, the place for data and logic
that several components use. The tool names a shared service as what takes the place of `$rootScope` and of events
that cross the app (`root-scope-use`, `scope-event`).

### Programmatically rendering components (angular.dev)

https://angular.dev/guide/components/programmatic-rendering

The guide to rendering a component that is not known in advance, with `NgComponentOutlet` in a template or
`ViewContainerRef.createComponent` in code, both from a component class that is already compiled. The tool names these
as what takes the place of `$compile` (`compile-use`).

### Pipes (angular.dev)

https://angular.dev/guide/templates/pipes

The guide to pipes, which transform a value in a template with the `|` operator, take arguments after colons and chain
from left to right. The tool names a pipe as what takes the place of a filter (`template-filter`).

## Reading the files

### Lexical grammar (MDN Web Docs)

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar

The reference of the tokens of JavaScript: line and block comments, the hashbang comment at the very start of a file,
strings in single or double quotes with their escapes, template literals with `${}` substitutions, and regular
expression literals. It notes that a slash can start a regular expression or divide, depending on what comes before
it. The tokenizer of src/lexer.js reads these forms and tells the two slashes apart by the token before
(`untokenizable-file` when a form is not closed).

### HTML Standard, section 13.1: Writing HTML documents (WHATWG)

https://html.spec.whatwg.org/multipage/syntax.html

The part of the HTML standard on the syntax of documents. A start tag holds attributes with unquoted, single-quoted or
double-quoted values separated by white space; a comment runs from `<!--` to `-->`; `script` and `style` hold raw text;
tag names do not depend on case. The template reader of src/html.js reads tags and attributes this way and skips the
raw text of script and style.

## The output and the configuration

### Workflow commands for GitHub Actions (GitHub Docs)

https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands

The page that describes the `::notice`, `::warning` and `::error` commands with their `file`, `line`, `col` and
`title` properties, which turn a line of output into an annotation on a file. `--format github` writes one such
command per finding, info as a notice.

### RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files

https://www.rfc-editor.org/rfc/rfc4180

The memo that describes CSV: records separated by CRLF, an optional header line, fields separated by commas, and a
field that holds a comma, a double quote or a line break put in double quotes, with a double quote inside it written
twice. `--format csv` writes the inventory this way.

### CSV Injection (OWASP)

https://community.owasp.org/attacks/CSV_Injection

The page on formulas hidden in CSV files. A spreadsheet may treat a cell that starts with `=`, `+`, `-`, `@`, a tab or
a line break as a formula; the page lists ways to defuse such a cell, among them a quote in front, and warns that none
of them is safe in every program. The CSV format puts a single quote in front of such a field, and docs/threat-model.md
says that this is a help, not a guarantee.

### RFC 8259, The JSON Data Interchange Format

https://www.rfc-editor.org/rfc/rfc8259

The JSON standard. Its section on objects notes that when the names in an object are not unique, programs that read
it behave in different ways. The reader of the configuration refuses a repeated name instead of keeping one of the
values, so a setting never depends on which value a library would keep.
