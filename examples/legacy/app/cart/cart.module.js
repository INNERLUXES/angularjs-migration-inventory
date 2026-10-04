// The cart: a component with a two-way binding, and a directive that compiles markup by hand.
angular.module('harbor.cart', ['harbor.core', 'harbor.catalog'])
  .component('cartSummary', {
    bindings: { items: '=', total: '<' },
    controller: CartSummaryController,
    templateUrl: 'app/cart/cart-summary.html'
  })
  .directive('quickAdd', ['$compile', function ($compile) {
    return {
      restrict: 'A',
      link: function (scope, element) {
        element.append($compile('<button ng-click="add()">Add</button>')(scope));
      }
    };
  }]);

function CartSummaryController($rootScope, $timeout) {
  var vm = this;
  vm.clear = function () {
    vm.items = [];
    $timeout(function () { $rootScope.$broadcast('cart:changed', 0); }, 250);
  };
}
