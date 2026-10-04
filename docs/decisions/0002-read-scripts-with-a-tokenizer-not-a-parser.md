# 2. Read scripts with a tokenizer, not a parser

## Status

Accepted

## Context

The surest way to find every module and registration of an AngularJS app would be to load it: run the scripts in a
browser or under a fake `angular` object and record each call. That runs the code of whoever opened a pull request,
needs the libraries of the app, and fails on exactly the code bases that are half migrated, built by an old bundler or
broken. A full JavaScript and TypeScript parser is the next step down; it would mean a dependency, or a large parser
written and kept here, and it would still refuse a file with one syntax error and say nothing about the rest.

A plain text search for `.controller(` is the other end: fast, but it counts calls in comments and strings, cannot
tell a module from an array `filter`, and loses its place in a regular expression that holds a quote.

The forms that matter are few: `angular.module(...)`, the methods chained on it or called on a variable that holds it,
the arrays and functions that annotate the dependencies, the names of the scope services and the keys of binding
objects. Finding them needs to know where a comment, a string, a template literal or a regular expression starts and
ends, and where brackets close, and nothing more.

## Decision

1. Scripts are read by a small tokenizer that knows comments, strings, template literals with substitutions,
   regular expression literals and the punctuators, and drops the comments. A slash starts a regular expression or
   divides according to the token before it. It does not parse expressions or types.
2. Modules, registrations, annotations, bindings and risks are found in the tokens with their brackets matched, as
   docs/method.md says.
3. A file the tokenizer cannot place is an error finding with its line and column
   ([decision 3](0003-count-only-what-is-written-and-make-unreadable-input-an-error.md)). The rest of the files are
   still read.
4. Templates are read by a small reader of tags and attributes that skips comments, script and style elements (except
   script templates) and never fetches or evaluates anything.
5. Nothing is guessed from the shape of a name; a name that is not a string literal is counted, not named.

## Consequences

- The tool runs in seconds on a large app, needs no browser, no libraries and no network, and reads an app that does
  not build.
- It cannot see a registration made through a name it cannot follow, or a name built at run time; docs/limits.md lists
  these, and the report counts what it could not place.
- The guess at a slash can fail after a closing parenthesis; such a file is reported as one the tool could not
  tokenize rather than read wrongly in silence, and docs/limits.md says how to avoid it.
