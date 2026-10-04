// The catalog: a page controller in the old $scope style and a card directive.
angular.module('harbor.catalog', ['harbor.core'])
  .controller('CatalogController', ['$scope', 'teaStore', function ($scope, teaStore) {
    $scope.teas = [];
    $scope.query = '';
    teaStore.all().then(function (teas) { $scope.teas = teas; });

    $scope.$watch('query', function (value) {
      $scope.filtered = $scope.teas.filter(function (t) { return t.name.indexOf(value) >= 0; });
    });

    $scope.$on('cart:changed', function (event, count) {
      $scope.inCart = count;
    });
  }])
  .directive('teaCard', function () {
    return {
      restrict: 'E',
      scope: { tea: '=', onPick: '&' },
      templateUrl: 'app/catalog/tea-card.html'
    };
  });
