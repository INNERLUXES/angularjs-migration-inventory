# A legacy app

A made-up tea shop, Harbor Tea, as an AngularJS app before the move to Angular: a root module with a route config and
a run block, a core module kept in a variable with a constant, a factory annotated with `$inject`, a filter and a
TypeScript service class, a catalog module with a `$scope` controller and a card directive, a cart module with a
component and a directive that compiles markup by hand, two promotion modules that depend on each other, a second
declaration of the core module, a module whose name is built at run time, and a file saved half written. The
templates use `ng-controller`, `ng-include`, a script template, built-in and custom filters and the directives of the
app.

It also holds what must not be counted: `$scope` and `angular.module` inside comments, a regular expression with
quotes in it, an array `filter` call, a unit test that the default exclude patterns leave out, and a copy of a library
under `vendor` that `examples/config.json` leaves out.
