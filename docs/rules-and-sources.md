# Rules and sources

Every rule rests on points of public pages, written in this project's own words; this document lists them, with the
choices that are the tool's own and, for a risk, what takes its place in Angular. The same points are in src/data.js
and are shown by `--explain`; research/sources.md has a longer note on each page.

## Rules

### `module-declaration`

Category: inventory; key `rules.moduleDeclaration`.

- A call of angular.module with a name and a list of required modules creates a module, and with the name alone it returns a module that exists; the methods of a module return the module, so registrations can be chained. ([Modules (AngularJS Developer Guide)](https://docs.angularjs.org/guide/module))
- The guide to upgrading from AngularJS advises one component per file, folders by feature, a module loader, TypeScript and component directives, and then a hybrid app that moves the code piece by piece. ([Upgrading from AngularJS (Angular documentation, v17)](https://v17.angular.io/guide/upgrade))
- The tool's own choice: only a call with a string literal as its name and a second argument counts as a declaration; a dependency that is not a string literal is counted, not named.

### `module-registration`

Category: inventory; key `rules.moduleRegistration`.

- A call of angular.module with a name and a list of required modules creates a module, and with the name alone it returns a module that exists; the methods of a module return the module, so registrations can be chained. ([Modules (AngularJS Developer Guide)](https://docs.angularjs.org/guide/module))
- Config blocks run while the providers are set up, before any service exists, and run blocks run once the injector is made, much like the main method of the app. ([Modules (AngularJS Developer Guide)](https://docs.angularjs.org/guide/module))
- A component names what it needs in an inline array before its function, in an $inject property, or only through the names of its parameters, and the last form breaks once a minifier renames the parameters. ([Dependency Injection (AngularJS Developer Guide)](https://docs.angularjs.org/guide/di))
- The tool's own choice: a registration is read when it is chained on angular.module(...) or on a variable that holds a module (in the same file, or in exactly one way across the files read); the annotation is the array, $inject, implicit (parameter names only) or none, as far as the file shows it.

### `dynamic-name`

Category: inventory; key `rules.dynamicName`.

- A call of angular.module with a name and a list of required modules creates a module, and with the name alone it returns a module that exists; the methods of a module return the module, so registrations can be chained. ([Modules (AngularJS Developer Guide)](https://docs.angularjs.org/guide/module))
- The tool's own choice: the inventory counts such a call but cannot name it, and a registration on a module whose name is not a string literal is not placed on any module.

### `template-filter`

Category: inventory; key `rules.templateFilter`.

- A filter is applied in a template expression with the | character, takes its arguments after colons, and filters can be chained. ([Filters (AngularJS Developer Guide)](https://docs.angularjs.org/guide/filter))
- A pipe transforms a value in a template with the | operator, takes its arguments after colons, and pipes chain from left to right. ([Pipes (angular.dev)](https://angular.dev/guide/templates/pipes))
- The tool's own choice: counted once per filter name and template, at its first use; the expressions read are the {{ }} interpolations and the values of ng attributes that hold expressions.
- In Angular: a pipe in the Angular template, with the same | syntax; a custom filter becomes a pipe class.

### `scope-use`

Category: risk; key `rules.scopeUse`.

- Every app has one root scope and child scopes that follow the structure of the page and inherit from their parents. ([What are Scopes? (AngularJS Developer Guide)](https://docs.angularjs.org/guide/scope))
- A component should take its inputs with < and @ and report changes through & callbacks, so that only the component that owns the data changes it; components also make a later move to Angular easier. ([Understanding Components (AngularJS Developer Guide)](https://docs.angularjs.org/guide/component))
- The guide to upgrading from AngularJS advises one component per file, folders by feature, a module loader, TypeScript and component directives, and then a hybrid app that moves the code piece by piece. ([Upgrading from AngularJS (Angular documentation, v17)](https://v17.angular.io/guide/upgrade))
- The tool's own choice: reported once per file at its first use, with the count of uses: the name $scope in the code and the string '$scope' in an annotation.
- In Angular: state lives on the component class and in signals; data from a parent comes through input() and goes back through output().

### `root-scope-use`

Category: risk; key `rules.rootScopeUse`.

- Every app has one root scope and child scopes that follow the structure of the page and inherit from their parents. ([What are Scopes? (AngularJS Developer Guide)](https://docs.angularjs.org/guide/scope))
- A service provided at the root of the app is one shared instance, the place for state and logic that several components use. ([Creating and using services (angular.dev)](https://angular.dev/guide/di/creating-and-using-services))
- The tool's own choice: reported once per file at its first use, with the count of uses.
- In Angular: a service provided at the root holds the shared state, with signals or an observable for its changes.

### `scope-watch`

Category: risk; key `rules.scopeWatch`.

- $watch and $watchCollection observe an expression on a scope and are checked in every digest, which repeats until the model settles. ([What are Scopes? (AngularJS Developer Guide)](https://docs.angularjs.org/guide/scope))
- Signal, computed and effect track where state is read, so derived values and side effects follow their inputs without a watcher written by hand. ([Signals (angular.dev)](https://angular.dev/guide/signals))
- The tool's own choice: each call is reported, on whatever object it is made.
- In Angular: computed() for a derived value, effect() for a side effect, or the input itself as a signal; RxJS for streams.

### `scope-event`

Category: risk; key `rules.scopeEvent`.

- $emit sends an event up the tree of scopes, $broadcast sends it down to the child scopes, and $on listens for it. ([What are Scopes? (AngularJS Developer Guide)](https://docs.angularjs.org/guide/scope))
- Output declares a custom event that a child component emits to its parent, and these events do not bubble up the page. ([Custom events with outputs (angular.dev)](https://angular.dev/guide/components/outputs))
- A service provided at the root of the app is one shared instance, the place for state and logic that several components use. ([Creating and using services (angular.dev)](https://angular.dev/guide/di/creating-and-using-services))
- The tool's own choice: each call is reported with the event name when it is a string literal.
- In Angular: output() from a child to its parent; a shared service with a signal or a Subject for events that cross the app.

### `compile-use`

Category: risk; key `rules.compileUse`.

- $compile turns an HTML string or a piece of the page into a template function that is linked to a scope while the app runs. ([$compile (AngularJS API Reference)](https://docs.angularjs.org/api/ng/service/$compile))
- A component that is not known in advance is rendered with NgComponentOutlet or ViewContainerRef.createComponent, from a component class that is already compiled. ([Programmatically rendering components (angular.dev)](https://angular.dev/guide/components/programmatic-rendering))
- The tool's own choice: each call of $compile is reported; Angular has no counterpart that compiles a template string while the app runs.
- In Angular: NgComponentOutlet or ViewContainerRef.createComponent with a component class; markup is not compiled at run time.

### `timer-use`

Category: risk; key `rules.timerUse`.

- $timeout wraps setTimeout and by default runs the function inside $apply, so the digest sees what it changed; it returns a promise that can be cancelled. ([$timeout (AngularJS API Reference)](https://docs.angularjs.org/api/ng/service/$timeout))
- Signal, computed and effect track where state is read, so derived values and side effects follow their inputs without a watcher written by hand. ([Signals (angular.dev)](https://angular.dev/guide/signals))
- The tool's own choice: each call is reported; the timer itself moves easily, the digest it starts is what the new code no longer has.
- In Angular: setTimeout and setInterval, or timer() and interval() of RxJS; with signals the view updates without a digest.

### `two-way-binding`

Category: risk; key `rules.twoWayBinding`.

- In the scope or bindToController object of a directive, = (also with ? or * after it) binds a value both ways, < one way, @ as a string and & as an expression. ([$compile (AngularJS API Reference)](https://docs.angularjs.org/api/ng/service/$compile))
- A component should take its inputs with < and @ and report changes through & callbacks, so that only the component that owns the data changes it; components also make a later move to Angular easier. ([Understanding Components (AngularJS Developer Guide)](https://docs.angularjs.org/guide/component))
- Input takes data from a parent component, and a model input also sends new values back, bound with the [( )] syntax for two-way binding. ([Accepting data with input properties (angular.dev)](https://angular.dev/guide/components/inputs))
- The tool's own choice: a binding whose value is =, =?, =* or =*? with or without an attribute name, inside an object under scope, bindToController or bindings.
- In Angular: input() for data in and output() for changes out, or model() with [( )] where two-way binding is meant.

### `template-controller`

Category: risk; key `rules.templateController`.

- Ng-controller attaches a controller to a part of the page and gives it a new scope, and controller as names the instance in the template. ([ngController (AngularJS API Reference)](https://docs.angularjs.org/api/ng/directive/ngController))
- An element or attribute name is matched to a directive after x- and data- are taken off its front and the parts split at a colon, a dash or an underscore are joined in camelCase, so ng-model, data-ng-model and ng:model all mean ngModel. ([Creating Custom Directives (AngularJS Developer Guide)](https://docs.angularjs.org/guide/directive))
- The guide to upgrading from AngularJS advises one component per file, folders by feature, a module loader, TypeScript and component directives, and then a hybrid app that moves the code piece by piece. ([Upgrading from AngularJS (Angular documentation, v17)](https://v17.angular.io/guide/upgrade))
- The tool's own choice: every spelling AngularJS accepts is read: ng-controller, data-ng-controller, x-ng-controller, ng:controller and ng_controller.
- In Angular: a component with a selector and its own template takes the place of the controller and the markup it was attached to.

### `template-include`

Category: risk; key `rules.templateInclude`.

- Ng-include fetches, compiles and includes an HTML fragment whose address is an expression, written as an element or as an attribute. ([ngInclude (AngularJS API Reference)](https://docs.angularjs.org/api/ng/directive/ngInclude))
- An element or attribute name is matched to a directive after x- and data- are taken off its front and the parts split at a colon, a dash or an underscore are joined in camelCase, so ng-model, data-ng-model and ng:model all mean ngModel. ([Creating Custom Directives (AngularJS Developer Guide)](https://docs.angularjs.org/guide/directive))
- The tool's own choice: the attribute and the element forms are read; the address is shown as written, since it is an expression.
- In Angular: a child component, or ngTemplateOutlet for markup kept in the same template.

### `duplicate-module`

Category: risk; key `rules.duplicateModule`.

- Creating a module under a name that is already in use replaces that module, and with it everything that was registered on it before. ([Modules (AngularJS Developer Guide)](https://docs.angularjs.org/guide/module))
- The tool's own choice: the second and later declarations are reported; which one wins depends on the order the scripts load, which the tool does not know.
- In Angular: one NgModule or one set of standalone components per feature; nothing replaces a module that exists.

### `module-cycle`

Category: risk; key `rules.moduleCycle`.

- A call of angular.module with a name and a list of required modules creates a module, and with the name alone it returns a module that exists; the methods of a module return the module, so registrations can be chained. ([Modules (AngularJS Developer Guide)](https://docs.angularjs.org/guide/module))
- The guide to upgrading from AngularJS advises one component per file, folders by feature, a module loader, TypeScript and component directives, and then a hybrid app that moves the code piece by piece. ([Upgrading from AngularJS (Angular documentation, v17)](https://v17.angular.io/guide/upgrade))
- The tool's own choice: AngularJS loads such modules, but no module of the cycle can move first; the migration order breaks the cycle at the module with the fewest unmet dependencies.
- In Angular: standalone components and services that import what they use, with no cycle between features.

### `unreadable-file`

Category: input; always an error, with no key.

- JavaScript has line and block comments, a hashbang at the very start, strings in single or double quotes, template literals with substitutions and regular expression literals, and whether a slash starts a regular expression or divides depends on what comes before it. ([Lexical grammar (MDN Web Docs)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar))
- The tool's own choice: a file that is missing, over its size limit, binary, UTF-16 or not valid UTF-8 is an error and is counted nowhere else; this rule cannot be set lower or off.

### `untokenizable-file`

Category: input; always an error, with no key.

- JavaScript has line and block comments, a hashbang at the very start, strings in single or double quotes, template literals with substitutions and regular expression literals, and whether a slash starts a regular expression or divides depends on what comes before it. ([Lexical grammar (MDN Web Docs)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar))
- A start tag holds attributes whose values are unquoted or in single or double quotes, a comment runs from <!-- to -->, script and style hold raw text, and tag names do not depend on case. ([HTML Standard, section 13.1: Writing HTML documents (WHATWG)](https://html.spec.whatwg.org/multipage/syntax.html))
- The tool's own choice: a string, template literal, comment, regular expression, tag or attribute value that is not closed stops the reading of the file; nothing in it is counted except its lines; this rule cannot be set lower or off.

## The output and the configuration

- A line of output such as ::warning file=...,line=...::message becomes an annotation on that file and line in the run. ([Workflow commands for GitHub Actions (GitHub Docs)](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands))
- Each record of a CSV file ends with CRLF, and a field that holds a comma, a double quote or a line break is put in double quotes, with a double quote inside it written twice. ([RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files](https://www.rfc-editor.org/rfc/rfc4180))
- A spreadsheet may read a cell that starts with =, +, -, @, a tab or a line break as a formula, and no one escape is safe in every program that opens the file. ([CSV Injection (OWASP)](https://community.owasp.org/attacks/CSV_Injection))
- When an object repeats a name the behaviour of the software that reads it cannot be predicted, so the reader of this tool refuses a repeated name. ([RFC 8259, The JSON Data Interchange Format](https://www.rfc-editor.org/rfc/rfc8259))
- The long-term support of AngularJS has ended, and the project points its users to Angular. ([Version Support Status (AngularJS)](https://docs.angularjs.org/misc/version-support-status))

## Every page

- Modules (AngularJS Developer Guide): https://docs.angularjs.org/guide/module
- Dependency Injection (AngularJS Developer Guide): https://docs.angularjs.org/guide/di
- Creating Custom Directives (AngularJS Developer Guide): https://docs.angularjs.org/guide/directive
- Understanding Components (AngularJS Developer Guide): https://docs.angularjs.org/guide/component
- What are Scopes? (AngularJS Developer Guide): https://docs.angularjs.org/guide/scope
- Filters (AngularJS Developer Guide): https://docs.angularjs.org/guide/filter
- $compile (AngularJS API Reference): https://docs.angularjs.org/api/ng/service/$compile
- $timeout (AngularJS API Reference): https://docs.angularjs.org/api/ng/service/$timeout
- ngController (AngularJS API Reference): https://docs.angularjs.org/api/ng/directive/ngController
- ngInclude (AngularJS API Reference): https://docs.angularjs.org/api/ng/directive/ngInclude
- Version Support Status (AngularJS): https://docs.angularjs.org/misc/version-support-status
- Upgrading from AngularJS (Angular documentation, v17): https://v17.angular.io/guide/upgrade
- Signals (angular.dev): https://angular.dev/guide/signals
- Accepting data with input properties (angular.dev): https://angular.dev/guide/components/inputs
- Custom events with outputs (angular.dev): https://angular.dev/guide/components/outputs
- Creating and using services (angular.dev): https://angular.dev/guide/di/creating-and-using-services
- Programmatically rendering components (angular.dev): https://angular.dev/guide/components/programmatic-rendering
- Pipes (angular.dev): https://angular.dev/guide/templates/pipes
- Lexical grammar (MDN Web Docs): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar
- HTML Standard, section 13.1: Writing HTML documents (WHATWG): https://html.spec.whatwg.org/multipage/syntax.html
- Workflow commands for GitHub Actions (GitHub Docs): https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands
- RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files: https://www.rfc-editor.org/rfc/rfc4180
- CSV Injection (OWASP): https://community.owasp.org/attacks/CSV_Injection
- RFC 8259, The JSON Data Interchange Format: https://www.rfc-editor.org/rfc/rfc8259
