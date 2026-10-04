# Security

## Reporting a problem

Write to info@innerluxes.dev with the subject line "angularjs-migration-inventory security", or use private
vulnerability reporting on this repository. Please do not open a public issue for a vulnerability.

Include a small made-up app or file and configuration that show the problem, the command you ran, what you expected
and what happened. Use made-up code and names, never the source of a real product, and never a real key, token or
password, even a revoked one.

## Scope

In scope:

- an input that makes the tool read a file other than the files and the configuration it was given, follow a symbolic
  link, or read a file a pattern of the configuration leaves out
- an input that makes the tool open a network connection, fetch a web address or a template, run a program, load a
  module of the app or evaluate any part of a file
- an input that makes the tool write a file
- an input that makes the tool hang, take very long or use unbounded memory, such as a very large file, very many
  files, long runs of quotes, backslashes, comment openers, slashes or brackets, template literals nested very deep,
  markup very deep or very wide, a very long chain of registrations or a long chain or ring of modules
- binary, UTF-16 or invalid UTF-8 input that the tool reads as if it were text
- an input that the tool fails to read and passes over without an error finding, such as a string, a template literal,
  a comment or a regular expression that is not closed in a script, or a tag or attribute value that is not closed in
  a template
- a run that passes at a `failOn` level although a file it read holds a finding at that level that docs/method.md says
  is reported
- text from a file or a file name that rewrites the terminal through control or direction characters, starts or ends
  a GitHub workflow command, is shown unescaped in the output, or reaches a CSV cell as a formula the CSV format should
  have defused
- a name such as `__proto__` that changes how objects behave inside the tool

Out of scope: the forms docs/limits.md says the tool does not read, whether the app works after the migration, the
libraries an app depends on and their versions, who may change the files or the configuration in your repository,
how a spreadsheet program treats a CSV file beyond the leading characters the CSV format defuses, and where your
pipeline keeps the output.

Read [docs/threat-model.md](docs/threat-model.md) for the rest.
