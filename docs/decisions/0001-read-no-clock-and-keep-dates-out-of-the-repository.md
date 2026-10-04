# 1. Read no clock, and keep dates out of the repository

## Status

Accepted

## Context

A migration from AngularJS to Angular takes months, and it is tempting to give the tool a sense of time: a deadline in
the configuration after which a warning becomes an error, a report that says how long ago a module was last changed,
a trend of the size score from one week to the next. Each of these would make the same files give a different result
on a different day, so a pipeline that passed yesterday could fail today with no change to the repository, and two
people running the inventory on the same commit could see two answers. The output could never be saved and compared.

The inventory does not need a date. Which modules exist, what is registered on them, where `$scope` is used and which
templates use `ng-controller` can all be read from the files as they are. A trend over time belongs to the system that
keeps the reports of each run, not to the tool.

## Decision

1. The tool reads no clock, no time zone and no locale. The same files and configuration give the same output on
   every machine and on every day.
2. The configuration has no key that holds a date. A team that wants a deadline raises `failOn` or a rule in a commit
   of its own, where the change can be reviewed.
3. No file of this repository holds a date or a number that reads like a year: not the licence, not the changelog,
   not the examples, not the documents, not the comments of the code. `npm run check` and a test fail on any number
   that reads like a year. Version numbers such as AngularJS 1.x, Angular v17 or Node 22 are not years and are fine.

## Consequences

- The output of a run can be saved in the repository (`examples/output`) and compared on every change, because it
  does not move with the calendar.
- A team that wants to see the inventory shrink keeps the JSON or CSV report of each run, and compares them itself.
- The README, the documents and the examples can be read at any time without being out of date about a date. The
  support status of AngularJS is described as ended, with the page that says so, and not with the day it ended.
