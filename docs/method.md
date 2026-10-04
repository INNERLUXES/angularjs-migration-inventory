# Method

This document says exactly what the tool reads, how it reads each kind of file, how it finds modules and
registrations, what each rule looks at and cannot see, and how the size score and the migration order are worked
out. The names used here are the defaults; docs/inputs.md says how the configuration changes them.

## What is read

The input is one or more paths and, if given, a configuration file. A file named on the command line is read whatever
its name, as long as it is of a kind the tool reads. A folder is walked: its files and subfolders in the order of their
names (compared by code unit, so the order does not depend on the locale), `.git`, `node_modules`, `bower_components`
and `jspm_packages` left out, symbolic links skipped and counted in a note, and the files whose path relative to the
folder matches a pattern of `files` and none of `exclude` are read. By default `exclude` leaves out `dist`, `build` and
`coverage` at the top of the folder, minified files and bundles (`*.min.js`, `*.bundle.js`) and unit tests
(`*.spec.js`, `*.spec.ts`, `*.test.js`, `*.test.ts`), because a bundle repeats the code of the sources and a unit test
makes scopes and compiles markup for the test alone.

Each file is read as UTF-8, with or without a byte order mark, with LF, CR LF or CR line ends.

## The kinds of files

The kind of a file comes from its name, compared without regard to the case of the letters A to Z:

| Kind | Name |
| --- | --- |
| `javascript` | ends in `.js`, `.mjs` or `.cjs` |
| `typescript` | ends in `.ts`, `.mts` or `.cts` |
| `template` | ends in `.html` or `.htm` |

JSX and TSX files are not read: the tokenizer does not know markup inside code.

## Input problems

A path named on the command line that is missing, a symbolic link, a device or a pipe, a folder with no file that
matches, a file of no kind the tool reads, a configuration with a problem, and input past the limit of a run (256 MB,
20,000 files) stop the run with exit code `2` and no result.

A file of the input that cannot be read is an error finding of the rule `unreadable-file`: a file that is binary
(a null byte in its first 8,000 bytes), UTF-16, not valid UTF-8, over 4 MB, or that cannot be opened. A file that the
tokenizer or the template reader cannot place is an error finding of the rule `untokenizable-file`, with the line and
column of the problem. Neither rule can be set lower or off, so a run that fails on errors (the default) never passes
because part of the input was passed over. The lines of a file that could not be tokenized are counted in its size;
nothing else in it is.

## Scripts

A script is read by a small tokenizer, once, left to right, as the JavaScript lexical grammar describes the forms
([decision 2](decisions/0002-read-scripts-with-a-tokenizer-not-a-parser.md)). It keeps names, string literals, template
literals, numbers, regular expression literals and punctuators, and drops comments and a hashbang line, so a module or
a `$scope` written in a comment is never counted. It knows:

- line comments and block comments; the first `*/` ends a block comment;
- strings in single and double quotes with their escapes, and a backslash at the end of a line that continues the
  string;
- template literals with `${...}` substitutions, whose code is read as code, with the braces inside it counted, to any
  depth up to 64 template literals inside each other; a template literal with no substitution is read like a string;
- regular expression literals, with character classes, in which a quote or a slash does not end anything. A slash
  starts a regular expression at the start of the file, after a punctuator other than `)`, `]`, `}`, `++` and `--`, and
  after the keywords `return`, `typeof`, `instanceof`, `in`, `of`, `new`, `delete`, `void`, `throw`, `case`, `do`,
  `else`, `yield`, `await` and `extends`; anywhere else it divides.

TypeScript types, generics, decorators and parameter modifiers are read as ordinary names and punctuators. A string, a
template literal, a comment, a substitution or a regular expression that is not closed is a finding of
`untokenizable-file`. The tokenizer does not parse statements; the steps below read the tokens.

### Modules

A module call is `angular.module(` followed by its arguments, also as `window.angular.module(`. With a string literal
(or a template literal with no substitution) as its first argument it names a module; with two or more arguments it
declares one, and the second argument, when it is an array literal, lists the dependencies: each string literal is a
dependency by name, and any other element is counted as a dependency that is not named. A second argument that is not
an array literal is counted as one dependency that is not named. With one argument it returns a module that exists.

### Registrations

A registration is a call of `controller`, `directive`, `component`, `service`, `factory`, `provider`, `filter`,
`constant`, `value`, `config` or `run` on a module, read in two places:

- **chained** on a module call, as in `angular.module('shop').controller(...).directive(...)`, as long as each call of
  the chain is one of these methods;
- **on a variable** that holds a module: a name assigned the result of a module call (`var app =
  angular.module('shop', [])`, also with a TypeScript type, or `window.app = ...`), followed by `.controller(...)` and
  the other methods, chained further or not. The variable is looked up in the same file first, where the assignment
  before the call wins; then across all the files read, where it is used only when every assignment of that name holds
  the same module. A call on a name that holds no module the tool can find, such as `items.filter(...)`, is not a
  registration and is counted in a note.

The first argument of a registration is its name; `config` and `run` take none. An object literal as the first
argument registers every key of the object. A name that is not a string literal is a finding of `dynamic-name`.

The second argument (the first for `config` and `run`) says what the registration depends on. Its annotation is:

- **array**: an inline array literal; its string literals are the dependencies;
- **$inject**: a name whose `Name.$inject = [...]` is assigned in the same file, or a class with a static `$inject`
  array; the strings of the array are the dependencies;
- **implicit**: a function, an arrow function, a function declared by that name in the file, or a class whose
  constructor takes parameters, with no array; the parameter names are the dependencies, and a minifier that renames
  them breaks the app;
- **none**: a function or class that takes no parameter;
- **unknown**: anything else, such as a name declared in another file or a call.

A `constant` and a `value` are not injected and have no annotation. The annotation of a `component` is that of the
`controller` of its definition object, or the name of a controller registered by name.

### Bindings and templates

A key `scope`, `bindToController` or `bindings` followed by a colon or `=` and an object literal is read as a binding
object; each entry whose value is a string literal of the form `=`, `=?`, `=*` or `=*?`, with or without an attribute
name, is a two-way binding. A key `templateUrl` followed by a colon or `=` and a string literal names a template.

## Templates

A template is read by a small reader of tags and attributes, once, left to right, as the HTML syntax writes them. It
keeps every start tag with its attributes (unquoted, in single or in double quotes), and every run of text between
tags. It skips comments, the document type, processing instructions and end tags, and the content of `script` and
`style` elements, except a `script` of type `text/ng-template`, whose content is a template and is read as markup. It
decodes the five entities of XML and character references, and no other entity. It does not check that tags are closed
in order, as a browser does not either. A comment, a tag, a quoted attribute value or a `script` or `style` element
that is not closed is a finding of `untokenizable-file`.

Every tag and attribute name is turned into the form AngularJS matches a directive by: lower case, `x-` or `data-`
taken off its front, and the parts split at a colon, a dash or an underscore joined in camelCase; `data-ng-model`,
`ng:model` and `ng_model` all normalize to `ngModel`.

The expressions of a template are the text between `{{` and `}}`, in text and in any attribute, and the value of an
attribute that normalizes to an `ng` name, except `ngPattern`, `ngSrc`, `ngSrcset`, `ngHref`, `ngController`, `ngApp`,
`ngNonBindable`, `ngCsp`, `ngJq`, `ngStrictDi`, `ngList`, `ngModelOptions` and `ngInclude`, whose values are not
expressions that hold a filter. In an expression, a `|` that is not part of `||` and is outside a string, followed by a
name, applies the filter of that name.

## The rules

Each rule has a category: the inventory (info), the risks (warning) and the input problems (error). A finding has the
file, the line and the column, and a risk also says what takes its place in Angular.

### `module-declaration`

A module declared with a string literal name, at the module call, with its dependencies. A dependency that is not a
string literal is counted.

### `module-registration`

A registration placed on a module, with its kind, its name and its annotation.

### `dynamic-name`

A module call whose name is not a string literal, a registration whose name is not one, and a registration chained on
a module call whose name is not one, which the inventory cannot place on a module.

### `template-filter`

A filter used in the expressions of a template, once per filter name and template, at its first use, with the count
and with where the filter comes from: built in (`currency`, `date`, `filter`, `json`, `limitTo`, `lowercase`, `number`,
`orderBy`, `uppercase`), registered on a module of the files read, or not registered there.

### `scope-use`

The name `$scope` in the code, or the string `'$scope'`, once per file at its first use, with the count. A longer
name such as `$scopes`, and a string that only holds `$scope` among other text, are not uses.

### `root-scope-use`

The name `$rootScope`, or the string `'$rootScope'`, once per file at its first use, with the count.

### `scope-watch`

A call of `$watch`, `$watchCollection` or `$watchGroup` as a method, on any object, with the name of the object when
it is a name.

### `scope-event`

A call of `$broadcast`, `$emit` or `$on` as a method, with the event name when it is a string literal.

### `compile-use`

A call of `$compile`. The name alone, as in an annotation, is not a call.

### `timer-use`

A call of `$timeout` or `$interval`. `$timeout.cancel(...)` is not a call of the service.

### `two-way-binding`

A two-way binding of a binding object, as described above.

### `template-controller`

An attribute that normalizes to `ngController`, with the controller name before `as`, and the module the controller
is registered on when the files read register it.

### `template-include`

An attribute or an element that normalizes to `ngInclude`, with its address as written.

### `duplicate-module`

A declaration of a module name that an earlier declaration in the files read already used, in the order the files
were read. Which declaration wins depends on the order the scripts load, which the tool does not know.

### `module-cycle`

A cycle in the dependencies between the modules declared in the files read, or a module that depends on itself,
reported once per cycle at the declaration of its first module by name.

### `unreadable-file`

A file of the input that cannot be read as UTF-8 text, as described above.

### `untokenizable-file`

A script or template with a form that is not closed, as described above.

## The inventory

### Modules and the migration order

The modules of the inventory are the modules declared in the files read, with the first declaration of each name,
and the modules that registrations are placed on without a declaration in the files read. A dependency on a module
that is not declared in the files read, such as `ngRoute`, is listed with the modules that depend on it, outside the
graph.

The suggested migration order puts every declared module after the modules it depends on that are declared in the
files read. Of the modules that are ready, the one with the fewest dependents goes first, then the one with the
smaller size score, then the first by name: a leaf that little else depends on is the safest place to start. When
every module left waits on another, the modules wait on each other in a cycle; the order is broken at the module of a
cycle with the fewest dependencies not yet placed, then by the same order, and that module is marked.

### The size score

The size score of a file is the number of its lines that hold more than white space, divided by `linesPerPoint`
(10 by default) and rounded up, plus `registration` points (5) for every registration in it and `risk` points (3) for
every finding of a risk rule in it that is not off. The weights are in the configuration. A file counts toward one
module: a script toward the module it registers the most on or declares (the first in the file on a tie), a template
toward the module of the first script whose `templateUrl` names it, by the end of its path (a leading `./` or `/`, a
query and a fragment are taken off the address). The score of a module is the sum of the scores of its files, its
lines and risks the sums of theirs, and its registrations are all the registrations placed on it, in any file.

The score is the tool's own measure, meant to rank files and modules against each other in one code base, not a
measure of time.

### Templates and directives

The inventory counts the templates, the findings of `ng-controller` and `ng-include`, every filter with its uses and
the templates it is used in, and the use of directives: every attribute or element whose normalized name is a
built-in directive (`ng` followed by a capital letter), a directive registered in the files read, or, as an element, a
component registered there.

## The output

Findings are listed errors first, then warnings, then info, each level in the order of the files and then of the
lines. Each rule lists at most 500 findings; the rest are counted in a note and still count for the result. The
result counts the findings at or above `--min-severity` and fails when one of them is at or above `--fail-on`. The
text report then shows the modules in the migration order with their dependents, files, lines, risks, score and
registrations, the declaration and dependencies of each, the modules outside the graph, the registrations by kind and
annotation, the templates, filters and directives, and the 25 files with the highest score.
