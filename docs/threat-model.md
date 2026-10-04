# Threat model

## What the tool touches

- It reads the files and folders named on the command line and the configuration file named with `--config`. In a
  folder it opens only the files whose path matches the patterns of the configuration. Nothing else is opened.
- It writes the report to standard output and its errors to standard error. It writes nothing to disk.
- It opens no network connection, follows no symbolic link, evaluates nothing it reads, starts no program, loads no
  module of the app and reads no clock.

## What the input may hold

The tool reads a source tree, and in a pipeline that measures every pull request, the scripts, the templates and the
configuration may all be written by whoever opened the pull request. Through them, a person can try to:

- make the tool read another file: a file or a folder named through a symbolic link that points at a key file, a link
  inside a folder, a file swapped for a link between the walk and the read, a path with `..` in a pattern;
- make the tool fetch something: a path written as a web address, a template that names a remote file in
  `ng-include` or `templateUrl`;
- make the tool run something: a script that would run if it were loaded, a template expression;
- hide a risk: a `$scope` or a registration behind a comment marker that does not end where it seems to (a `*/` inside
  a string, a quote inside a regular expression), a template literal that ends a string early, a script element that
  hides markup, a file the tokenizer cannot place;
- move the result through the configuration: a key named twice, an unknown key that looks like a known one, a rule set
  to off, a pattern in `exclude` that leaves a folder out, a `failOn` raised to `error`;
- exhaust the memory or the time: thousands of files, a file of megabytes, long runs of quotes, backslashes, comment
  openers, slashes or brackets, template literals inside each other, deep or wide markup, a chain of registrations
  tens of thousands long, a long chain or ring of modules;
- slip in something that is not text: a binary file named `.js`, a file in UTF-16, bytes that are not UTF-8;
- rewrite the terminal or break the output: control characters, ANSI escapes, direction controls and line separators
  in a file name, a module name, an event name or an attribute value;
- start a second workflow command: a text that holds `::error`, `%`, a comma, a colon or a line break, which the
  GitHub format writes into a command;
- put a formula into a spreadsheet: a module or registration name that starts with `=`, `+`, `-` or `@`, which the CSV
  format writes into a cell that someone opens in a spreadsheet;
- change how objects behave: a module, registration, filter, attribute or configuration key named `__proto__`,
  `constructor` or `toString`.

## What could go wrong, and what stops it

| Risk | Control |
| --- | --- |
| A symbolic link makes the tool read another file | A path named on the command line is looked at without following a link, and a link is refused; inside a folder a link is skipped and counted; each file is opened with `O_NOFOLLOW` where the system has it and its type is taken from the open handle, so a file swapped for a link is refused. A test names a file and the configuration through a link and puts links in a folder |
| The tool fetches or runs something | No module of the network or of child processes is imported, nothing is evaluated, and a path that looks like an address is refused; `ng-include` and `templateUrl` values are only text. A test checks the imports of src |
| A risk is hidden | The tokenizer reads every form of comment, string, template literal and regular expression, and a form that is not closed is an error finding with its line, which fails the run at the default level and cannot be set off; a regular expression is told from a division by the token before it, and docs/limits.md says where that guess can fail. A test covers each form, closed and left open |
| The configuration moves the result | The JSON reader refuses a repeated key; an unknown key stops the run with its line and a suggestion; the two rules of input problems have no key; a rule set to off is named in a note; the report lists every file read with its kind. Review a change to the configuration like a change to code (docs/secure-defaults.md) |
| The memory or the time is exhausted | Files have size limits checked on the open handle before they are read, and a run has limits on its files, its bytes and the entries it walks; the tokenizer and the template reader read each character once and limit their tokens, elements, attributes and nesting; the module graph is walked without recursion; findings are capped per rule. Tests check the time, with limits that widen under coverage only |
| A pattern from the input is slow | No regular expression is built from the input or the configuration; file patterns are matched by hand with work bounded by the product of their lengths; a test looks for `new RegExp` in src |
| A binary or UTF-16 file is read as text | A null byte, a UTF-16 byte order mark or bytes that are not valid UTF-8 make the file an error finding; nothing in it is read |
| Text from the input rewrites the terminal | Every text, file names included, goes through `safeText`, which removes control, line separator and direction characters and caps the length. A test puts ANSI escapes and direction controls in a file name, a module name and a template, in every format |
| A text starts a second workflow command | The GitHub format escapes `%`, CR and LF in a message and `:` and `,` in a property; a line break never reaches a command. A test writes `%0A::error::` into an event name and a comma and a colon into the file name |
| A name becomes a spreadsheet formula | The CSV format puts a single quote in front of a field that starts with `=`, `+`, `-`, `@`, a tab or a carriage return, and quotes a field that holds a comma, a quote or a line break. This is a help, not a guarantee: no one escape is safe in every program that opens a CSV file, so open it as data, not as a sheet to trust. A test writes names that start with each of these characters |
| `__proto__` changes how objects behave | The JSON reader defines own properties; names are kept in arrays and `Map`, and the counts by name are built with `Object.fromEntries`. A test uses `__proto__`, `constructor` and `toString` as module, registration, filter, attribute and configuration names |
| A device or a pipe hangs the tool | A path that is not a regular file or a folder is refused before it is read, and a walk reads regular files only |
| The tool leaves files behind | Nothing is written to disk; there is no cache, no temporary file and no log. A test checks that a run leaves the folder as it was |

## Out of scope

Whether the app works after the migration, the libraries it depends on and their versions, the forms docs/limits.md
says the tool does not read, who may change the scripts or the configuration in your repository, and where your
pipeline keeps the output.
