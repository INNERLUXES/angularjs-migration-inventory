// The public pages the inventory and the risks rest on, and what each says, written in this project's own words.
// research/sources.md lists every page with a longer note on each, and test/data.test.js checks that every page here is
// listed there and that every rule names points that exist. The code in src/ uses these constants and never writes a
// reason of its own in a report.

export const SOURCES = [
  { id: 'angularjsModules', title: 'Modules (AngularJS Developer Guide)', url: 'https://docs.angularjs.org/guide/module' },
  { id: 'angularjsDi', title: 'Dependency Injection (AngularJS Developer Guide)', url: 'https://docs.angularjs.org/guide/di' },
  { id: 'angularjsDirectives', title: 'Creating Custom Directives (AngularJS Developer Guide)', url: 'https://docs.angularjs.org/guide/directive' },
  { id: 'angularjsComponents', title: 'Understanding Components (AngularJS Developer Guide)', url: 'https://docs.angularjs.org/guide/component' },
  { id: 'angularjsScopes', title: 'What are Scopes? (AngularJS Developer Guide)', url: 'https://docs.angularjs.org/guide/scope' },
  { id: 'angularjsFilters', title: 'Filters (AngularJS Developer Guide)', url: 'https://docs.angularjs.org/guide/filter' },
  { id: 'angularjsCompile', title: '$compile (AngularJS API Reference)', url: 'https://docs.angularjs.org/api/ng/service/$compile' },
  { id: 'angularjsTimeout', title: '$timeout (AngularJS API Reference)', url: 'https://docs.angularjs.org/api/ng/service/$timeout' },
  { id: 'angularjsNgController', title: 'ngController (AngularJS API Reference)', url: 'https://docs.angularjs.org/api/ng/directive/ngController' },
  { id: 'angularjsNgInclude', title: 'ngInclude (AngularJS API Reference)', url: 'https://docs.angularjs.org/api/ng/directive/ngInclude' },
  { id: 'angularjsSupport', title: 'Version Support Status (AngularJS)', url: 'https://docs.angularjs.org/misc/version-support-status' },
  { id: 'angularUpgrade', title: 'Upgrading from AngularJS (Angular documentation, v17)', url: 'https://v17.angular.io/guide/upgrade' },
  { id: 'angularSignals', title: 'Signals (angular.dev)', url: 'https://angular.dev/guide/signals' },
  { id: 'angularInputs', title: 'Accepting data with input properties (angular.dev)', url: 'https://angular.dev/guide/components/inputs' },
  { id: 'angularOutputs', title: 'Custom events with outputs (angular.dev)', url: 'https://angular.dev/guide/components/outputs' },
  { id: 'angularServices', title: 'Creating and using services (angular.dev)', url: 'https://angular.dev/guide/di/creating-and-using-services' },
  { id: 'angularDynamic', title: 'Programmatically rendering components (angular.dev)', url: 'https://angular.dev/guide/components/programmatic-rendering' },
  { id: 'angularPipes', title: 'Pipes (angular.dev)', url: 'https://angular.dev/guide/templates/pipes' },
  { id: 'mdnLexical', title: 'Lexical grammar (MDN Web Docs)', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar' },
  { id: 'htmlSyntax', title: 'HTML Standard, section 13.1: Writing HTML documents (WHATWG)', url: 'https://html.spec.whatwg.org/multipage/syntax.html' },
  { id: 'githubCommands', title: 'Workflow commands for GitHub Actions (GitHub Docs)', url: 'https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands' },
  { id: 'rfc4180', title: 'RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files', url: 'https://www.rfc-editor.org/rfc/rfc4180' },
  { id: 'owaspCsv', title: 'CSV Injection (OWASP)', url: 'https://community.owasp.org/attacks/CSV_Injection' },
  { id: 'rfc8259', title: 'RFC 8259, The JSON Data Interchange Format', url: 'https://www.rfc-editor.org/rfc/rfc8259' }
];

export const source = (id) => SOURCES.find((s) => s.id === id);

// What a page says, in this project's own words. Each point names its page.
export const POINTS = {
  moduleCreate: { source: 'angularjsModules', text: 'a call of angular.module with a name and a list of required modules creates a module, and with the name alone it returns a module that exists; the methods of a module return the module, so registrations can be chained' },
  moduleOverwrite: { source: 'angularjsModules', text: 'creating a module under a name that is already in use replaces that module, and with it everything that was registered on it before' },
  configRun: { source: 'angularjsModules', text: 'config blocks run while the providers are set up, before any service exists, and run blocks run once the injector is made, much like the main method of the app' },
  annotationStyles: { source: 'angularjsDi', text: 'a component names what it needs in an inline array before its function, in an $inject property, or only through the names of its parameters, and the last form breaks once a minifier renames the parameters' },
  directiveNames: { source: 'angularjsDirectives', text: 'an element or attribute name is matched to a directive after x- and data- are taken off its front and the parts split at a colon, a dash or an underscore are joined in camelCase, so ng-model, data-ng-model and ng:model all mean ngModel' },
  isolateBindings: { source: 'angularjsCompile', text: 'in the scope or bindToController object of a directive, = (also with ? or * after it) binds a value both ways, < one way, @ as a string and & as an expression' },
  componentBindings: { source: 'angularjsComponents', text: 'a component should take its inputs with < and @ and report changes through & callbacks, so that only the component that owns the data changes it; components also make a later move to Angular easier' },
  scopeHierarchy: { source: 'angularjsScopes', text: 'every app has one root scope and child scopes that follow the structure of the page and inherit from their parents' },
  scopeWatch: { source: 'angularjsScopes', text: '$watch and $watchCollection observe an expression on a scope and are checked in every digest, which repeats until the model settles' },
  scopeEvents: { source: 'angularjsScopes', text: '$emit sends an event up the tree of scopes, $broadcast sends it down to the child scopes, and $on listens for it' },
  compileService: { source: 'angularjsCompile', text: '$compile turns an HTML string or a piece of the page into a template function that is linked to a scope while the app runs' },
  timeoutService: { source: 'angularjsTimeout', text: '$timeout wraps setTimeout and by default runs the function inside $apply, so the digest sees what it changed; it returns a promise that can be cancelled' },
  ngControllerDirective: { source: 'angularjsNgController', text: 'ng-controller attaches a controller to a part of the page and gives it a new scope, and controller as names the instance in the template' },
  ngIncludeDirective: { source: 'angularjsNgInclude', text: 'ng-include fetches, compiles and includes an HTML fragment whose address is an expression, written as an element or as an attribute' },
  filterSyntax: { source: 'angularjsFilters', text: 'a filter is applied in a template expression with the | character, takes its arguments after colons, and filters can be chained' },
  supportEnded: { source: 'angularjsSupport', text: 'the long-term support of AngularJS has ended, and the project points its users to Angular' },
  upgradePreparation: { source: 'angularUpgrade', text: 'the guide to upgrading from AngularJS advises one component per file, folders by feature, a module loader, TypeScript and component directives, and then a hybrid app that moves the code piece by piece' },
  signals: { source: 'angularSignals', text: 'signal, computed and effect track where state is read, so derived values and side effects follow their inputs without a watcher written by hand' },
  modelInputs: { source: 'angularInputs', text: 'input takes data from a parent component, and a model input also sends new values back, bound with the [( )] syntax for two-way binding' },
  outputs: { source: 'angularOutputs', text: 'output declares a custom event that a child component emits to its parent, and these events do not bubble up the page' },
  sharedServices: { source: 'angularServices', text: 'a service provided at the root of the app is one shared instance, the place for state and logic that several components use' },
  dynamicComponents: { source: 'angularDynamic', text: 'a component that is not known in advance is rendered with NgComponentOutlet or ViewContainerRef.createComponent, from a component class that is already compiled' },
  pipes: { source: 'angularPipes', text: 'a pipe transforms a value in a template with the | operator, takes its arguments after colons, and pipes chain from left to right' },
  lexicalGrammar: { source: 'mdnLexical', text: 'JavaScript has line and block comments, a hashbang at the very start, strings in single or double quotes, template literals with substitutions and regular expression literals, and whether a slash starts a regular expression or divides depends on what comes before it' },
  htmlAttributes: { source: 'htmlSyntax', text: 'a start tag holds attributes whose values are unquoted or in single or double quotes, a comment runs from <!-- to -->, script and style hold raw text, and tag names do not depend on case' },
  githubAnnotations: { source: 'githubCommands', text: 'a line of output such as ::warning file=...,line=...::message becomes an annotation on that file and line in the run' },
  csvRecords: { source: 'rfc4180', text: 'each record of a CSV file ends with CRLF, and a field that holds a comma, a double quote or a line break is put in double quotes, with a double quote inside it written twice' },
  csvInjection: { source: 'owaspCsv', text: 'a spreadsheet may read a cell that starts with =, +, -, @, a tab or a line break as a formula, and no one escape is safe in every program that opens the file' },
  jsonRepeatedNames: { source: 'rfc8259', text: 'when an object repeats a name the behaviour of the software that reads it cannot be predicted, so the reader of this tool refuses a repeated name' }
};

// The page of a point.
export const pointPage = (key) => source(POINTS[key].source);

// The levels of a finding, from the lowest: info for the inventory, warning for a migration risk, error for a file
// that could not be read.
export const LEVELS = ['info', 'warning', 'error'];

// The sentence every report ends with, before the result.
export const NOTICE = 'This inventory lists what the tool could read in the files it was given: module declarations, registrations with a string name, risks and template use. It does not run the code or follow a name built at run time, a registration made through a variable of another kind, or code a bundler wrote, so the counts are a lower bound (docs/limits.md).';
