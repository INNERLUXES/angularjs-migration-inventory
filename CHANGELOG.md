# Changes

## 1.0.0

First release.

- Measures an AngularJS (Angular 1.x) code base before a migration to Angular, from one folder, several folders or
  single files: `.js`, `.mjs`, `.cjs`, `.ts`, `.mts` and `.cts` scripts and `.html` and `.htm` templates.
- An inventory of every module declared with `angular.module` and its dependencies, and of every controller,
  directive, component, service, factory, provider, filter, constant, value, config and run block registered on a
  module, chained on the module call or through a variable that holds the module, in the object form too, with the way
  its dependencies are annotated: an inline array, `$inject` (also as a static field of a class), parameter names only,
  none, or not visible in the file.
- Seventeen rules in three levels: the inventory as info (`module-declaration`, `module-registration`, `dynamic-name`,
  `template-filter`), the migration risks as warnings (`scope-use`, `root-scope-use`, `scope-watch`, `scope-event`,
  `compile-use`, `timer-use`, `two-way-binding`, `template-controller`, `template-include`, `duplicate-module`,
  `module-cycle`), each with what takes its place in Angular, and input problems as errors that cannot be lowered
  (`unreadable-file`, `untokenizable-file`).
- A small tokenizer for JavaScript and TypeScript that knows comments, a hashbang line, strings with escapes and line
  continuations, template literals with nested substitutions and regular expression literals told from a division by
  the token before the slash; and a small reader of the tags and attributes of templates that skips comments, script
  and style elements, reads script templates as markup, and normalizes names as AngularJS matches directives.
- The templates with `ng-controller`, `ng-include`, the filters of their expressions and the use of the built-in and
  registered directives and components.
- A size score per file and per module from lines, registrations and risks with weights of the configuration, a file
  counted toward its main module and a template toward the script whose `templateUrl` names it, and a suggested
  migration order that puts a module after its dependencies and the leaves with the fewest dependents first, with
  cycles found and broken.
- A configuration file in strict JSON over documented defaults: the file patterns of a folder, the files left out, the
  level of every rule, the minimum severity, the level that fails the run and the weights of the score; a key the tool
  does not know is an error with its line and a suggestion, and a key named twice is refused.
- Reports as text, JSON, GitHub workflow commands (`--format github`) that show each finding as an annotation, and CSV
  of the inventory (`--format csv`) with fields that a spreadsheet would read as a formula defused; `--min-severity`,
  `--fail-on`, `--explain` with the rule and the sources of each finding, and `--print-defaults`. Exit code `0` when no
  finding is at or above the fail-on level, `1` when one is, `2` for a usage or input error, with no result.
- Follows no symbolic link, fetches nothing, runs nothing, writes nothing to disk, and reports binary, UTF-16 and
  invalid UTF-8 input as errors; every input has a size limit.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation, after the SSDF gate
  of the repository.
