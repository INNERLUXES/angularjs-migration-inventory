# 3. Count only what is written, and make unreadable input an error

## Status

Accepted

## Context

An inventory is used to plan: how many modules, which ones first, how much `$scope` and how many watchers are left. A
number that is too low is worse than no number, because it makes a migration look smaller than it is. Two things can
make a number too low without anyone noticing: a file the tool skipped because it could not read it, and a
registration the tool guessed wrong or did not see.

At the same time, a migration inventory is not a gate in the usual sense. Most of what it lists is neither good nor bad:
a module is a module. The risks are worth a warning, because each one is work the migration has to do, but a team that
is only measuring should not have a red pipeline for every `$scope`.

## Decision

1. Findings have three levels. The inventory (module declarations, registrations, names that are not string literals,
   filters in templates) is info; the migration risks (`$scope`, `$rootScope`, watchers, scope events, `$compile`,
   timers, two-way bindings, `ng-controller`, `ng-include`, a module declared twice, a cycle of modules) are warnings;
   a file that cannot be read or tokenized is an error.
2. The run fails on findings at or above `failOn`, which is `error` by default and `warning` for a team that wants
   every risk to fail the run. `--fail-on` sets it for one run.
3. A file that cannot be read or tokenized is reported, never skipped in silence, and the two rules of input problems
   cannot be lowered or set off. The rest of the input is still read, so one broken file does not hide the inventory
   of the others; a path that cannot be used at all stops the run with exit code `2`.
4. Only what is written is counted: a registration needs a module the tool can follow and a name that is a string
   literal. Whatever it cannot place is counted in a finding of `dynamic-name` or a note, so the report shows how much
   it could not see.

## Consequences

- With the defaults the inventory runs in a pipeline without failing on the risks it lists, and fails only when its
  own numbers cannot be trusted.
- The counts are a lower bound, and every report says so. A team that sees many `dynamic-name` findings or a note of
  calls it could not place knows the inventory of its code base is incomplete, and where.
- A rule can be raised to `error` on its own, so a team can stop new `$compile` calls while it measures the rest.
