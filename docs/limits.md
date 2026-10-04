# Limits

The tool reads the scripts and templates of an AngularJS app and lists what is written in them. It does not run the
code, load the modules, resolve imports, build the app or open the libraries it uses. Every count of the inventory is
what the tool could see in the files it read, so it is a lower bound: the app may hold more modules, registrations and
risks than the report shows. Every report ends with a sentence that says so.

## What it cannot see

- **Dynamic registration.** A registration made through a name the tool cannot follow is not counted: a module kept on
  an object other than `window` (`app.modules.cart = angular.module(...)`), passed as an argument to a function, or
  imported from another file with an ES module or CommonJS import; a registration made inside a `config` block through
  `$provide`, `$compileProvider`, `$controllerProvider` or `$filterProvider`; and a helper that wraps
  `module.controller` and is called with the pieces. The report counts the calls on a variable it could not place in
  a note.
- **Names built at run time.** A module or registration name that is a variable, a constant, a concatenation or a
  template literal with substitutions is counted by `dynamic-name` but not named, so a registration on such a module
  is placed on no module; a dependency list built at run time (`[core.name, 'ngRoute']`, `deps.concat(...)`) is counted
  as dependencies that are not named, and leaves edges out of the migration order. The common ES module pattern
  `export default angular.module('x', []).name`, imported and used as a dependency, shows the dependency only as one
  that is not named.
- **Code a bundler wrote.** Bundles, minified files and the output folders `dist`, `build` and `coverage` are left out
  by default; if they are read, their registrations repeat those of the sources, a minified file with renamed
  parameters shows no annotation it can trust, and a bundler's wrapper code may hide a module behind a function
  argument. Point the tool at the sources.
- **The annotation of a value from another file.** A registration that names a function or class declared in another
  file has the annotation `unknown`; the tool does not follow imports.
- **Inline templates.** A `template:` string in a directive or component, a template built in code, and a template put
  into `$templateCache` by a build step are not read as markup, so their `ng-controller`, `ng-include`, filters and
  directives are not counted. Templates in `script` elements of type `text/ng-template` are read.
- **JSX and TSX.** Files with markup inside code are not read; name them in `files` and they stop the run as files of
  no kind the tool reads.
- **The tokenizer's guess at a slash.** Whether a slash starts a regular expression is told from the token before it.
  After a closing parenthesis, as in `if (x) /re/.test(y)`, the slash is read as a division; if such a regular
  expression holds a quote, the rest of the line may be read as a string, and a file can end up reported as one the
  tool could not tokenize. Writing the regular expression on its own line, or after `return` or `=`, avoids it.
- **Uses that are not named.** `$scope` is counted where its name, or the string `'$scope'`, is written. A scope
  reached under another name (`function link(scope)`, `this` in a controller written with `controller as`, `vm`) is
  not a use of `$scope` for this tool, although it may still hold watchers; the calls of `$watch`, `$on` and the others
  are counted on any object.
- **Events and watchers through helpers.** A watcher or event registered by a helper function, a mixin or a base class
  that calls `$watch` on behalf of the code is counted once, where the helper calls it.
- **Directives matched by class or comment.** A directive restricted to classes (`C`) or comments (`M`) is not counted
  in the use of directives.
- **What a binding means.** A two-way binding is reported by its form; the tool does not know whether the component
  writes to it.
- **Script order.** Which of two declarations of the same module wins, and whether a module is loaded at all, depends on
  the order of the script tags or of the bundle, which the tool does not read.
- **Size.** The size score counts lines, registrations and risks with fixed weights. It ranks files and modules against
  each other; it is not a measure of effort or time.

## Size limits

Past a limit, the input is refused with exit code `2` and no result, the file is an error finding, or, where the limit
is on the work and not the input, the report says so in a note.

| What | Limit |
| --- | --- |
| a file | 4 MB; a larger file is an `unreadable-file` finding |
| all the files of a run | 256 MB |
| files read in a run | 20,000 |
| files and folders looked at in a walk | 200,000 |
| folders nested in a walk | 32 deep |
| paths on the command line | 100 |
| tokens of one script | 4,000,000 |
| template literals inside each other | 64 |
| templates | 1,000,000 elements, 256 attributes in a tag |
| configuration file | 1 MB; nesting 32 deep; 500 entries in a list; 200 characters for a file pattern |
| findings of one rule | 500 listed; the rest are counted in a note and still count for the result |
| files in the text report | the 25 with the highest score; the JSON and CSV reports hold all |
| problems of the input | 20 listed; the rest are counted |

The tests read a thousand files of a hundred registrations each, runs of hundreds of thousands of quotes,
backslashes, comment openers, slashes, braces and brackets, a chain of fifty thousand registrations, and templates of
three hundred thousand open tags or a hundred thousand elements, each with a time check; another test orders a chain
of a hundred thousand modules.
