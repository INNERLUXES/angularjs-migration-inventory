# Inputs

## The code base

```
angularjs-migration-inventory <file-or-folder>... [--config <file>] [options]
```

One or more paths, up to 100: folders, or single scripts and templates of the kinds of docs/method.md, or both. A
folder is walked and the files that match `files` and not `exclude` are read; a file named directly is read whatever
its path, as long as it is of a kind the tool reads. Each path may be named once. Name the root of the app to read the
scripts and the templates together, so registrations, templates and the modules between them meet in one inventory.

```
angularjs-migration-inventory src
angularjs-migration-inventory app/scripts app/views --config inventory.json
angularjs-migration-inventory app/scripts/cart/cart.controller.js
```

## Options

| Option | Value |
| --- | --- |
| `--config <file>` | the configuration file below; without it the defaults apply |
| `--format <name>` | `text` (the default), `json`, `github` or `csv` |
| `--json` | the same as `--format json` |
| `--min-severity <level>` | `info`, `warning` or `error`: the lowest level of a finding that is shown; it wins over `minSeverity` of the configuration |
| `--fail-on <level>` | `info`, `warning` or `error`: the lowest level of a finding that fails the run; it wins over `failOn` of the configuration |
| `--explain` | each finding also shows its rule, the points of the public pages it rests on and the tool's own choice; with `--format github` or `csv` it is a usage error |
| `--print-defaults` | prints the built-in configuration as a configuration file and exits |
| `--help`, `--version` | the usage, the version |

A path that looks like a web address, an option given twice, `-` for standard input and an unknown option are usage
errors with exit code `2`.

## The configuration file

The configuration is one JSON object, read strictly as RFC 8259 writes JSON: no comments, no trailing comma, and no
name given twice in one object. Every key is optional. A key the tool does not know is an error with its line and, when
it is close to a known key, a suggestion; a run never goes on with a typo left in place.

```json
{
  "name": "Harbor Tea",
  "exclude": { "add": ["vendor/**"] },
  "rules": { "timerUse": "info", "compileUse": "error" },
  "minSeverity": "info",
  "failOn": "warning",
  "weights": { "linesPerPoint": 10, "registration": 5, "risk": 3 }
}
```

A list is either a JSON array, which replaces the built-in list, or an object with `replace`, `add` and `remove`,
applied in that order. Removing an entry that is not on the list, adding one that is, and naming one twice are errors.

### `name`

A name for the configuration, 1 to 120 characters, shown in the report next to the file.

### `files`

The file patterns of a folder walk. A pattern is a relative path with forward slashes in which `*` matches any run of
characters inside one name, `?` one character, and `**` as a whole part any number of folders; a pattern with no slash
matches the file name in any folder. Character classes, braces, a backslash, `..`, an empty part and a leading slash
are refused. The default:

```
**/*.js, **/*.mjs, **/*.cjs, **/*.ts, **/*.html, **/*.htm
```

A pattern that matches a file of no kind the tool reads makes that file an input error, so a pattern cannot pass a
file over in silence. `files` must keep at least one pattern.

### `exclude`

The file patterns a walk leaves out, in the same form. The default:

```
dist/**, build/**, coverage/**, **/*.min.js, **/*.bundle.js, **/*.spec.js, **/*.spec.ts, **/*.test.js, **/*.test.ts
```

It leaves out build output at the top of the folder, minified files and bundles anywhere, and unit tests. A library
copied into the app, such as a `vendor` or `lib` folder, is read unless a pattern is added for it. A file named
directly on the command line is read even when it matches `exclude`. The folders `.git`, `node_modules`,
`bower_components` and `jspm_packages` are never entered.

### `rules`

The level of each rule: `info`, `warning`, `error` or `off`. A rule set to `off` is not reported, does not count
toward the risks of the size score, and is named in a note of the report. The two rules of input problems,
`unreadable-file` and `untokenizable-file`, are always errors and have no key.

| Key | Rule | Default |
| --- | --- | --- |
| `rules.moduleDeclaration` | `module-declaration` | info |
| `rules.moduleRegistration` | `module-registration` | info |
| `rules.dynamicName` | `dynamic-name` | info |
| `rules.templateFilter` | `template-filter` | info |
| `rules.scopeUse` | `scope-use` | warning |
| `rules.rootScopeUse` | `root-scope-use` | warning |
| `rules.scopeWatch` | `scope-watch` | warning |
| `rules.scopeEvent` | `scope-event` | warning |
| `rules.compileUse` | `compile-use` | warning |
| `rules.timerUse` | `timer-use` | warning |
| `rules.twoWayBinding` | `two-way-binding` | warning |
| `rules.templateController` | `template-controller` | warning |
| `rules.templateInclude` | `template-include` | warning |
| `rules.duplicateModule` | `duplicate-module` | warning |
| `rules.moduleCycle` | `module-cycle` | warning |

### `minSeverity`

The lowest level of a finding that is shown: `info` (the default), `warning` or `error`. `--min-severity` wins over
it. A finding below it is counted in a note and does not count for the result.

### `failOn`

The lowest level of a finding that fails the run with exit code `1`: `info`, `warning` or `error` (the default).
`--fail-on` wins over it. With `error`, only a file the tool could not read, or a rule raised to `error`, fails the
run; with `warning`, every migration risk does.

### `weights`

The weights of the size score (docs/method.md), each a whole number:

| Key | Default | Range |
| --- | --- | --- |
| `weights.linesPerPoint` | 10 | 1 to 1,000: the lines of a file that make one point, rounded up |
| `weights.registration` | 5 | 0 to 1,000: the points of each registration |
| `weights.risk` | 3 | 0 to 1,000: the points of each finding of a risk rule |

## Limits of the input

| What | Limit |
| --- | --- |
| a file | 4 MB; a larger file is an `unreadable-file` finding |
| all the files of a run | 256 MB |
| files read in a run | 20,000 |
| files and folders looked at in a walk | 200,000 |
| folders nested in a walk | 32 deep |
| paths on the command line | 100 |
| configuration file | 1 MB; 500 entries in a list; 200 characters for a file pattern |

docs/limits.md lists the limits of the readers and of the report.
