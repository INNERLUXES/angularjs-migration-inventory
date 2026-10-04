// A copy of a library the shop does not own; examples/config.json leaves the vendor folder out.
angular.module('chartHelper', []).directive('miniChart', function ($compile) {
  return { scope: { data: '=' } };
});
