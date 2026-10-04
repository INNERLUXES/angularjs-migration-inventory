// The root module of Harbor Tea, a made-up tea shop.
(function () {
  'use strict';

  angular
    .module('harbor', ['harbor.core', 'harbor.catalog', 'harbor.cart', 'ngRoute'])
    .config(['$routeProvider', function ($routeProvider) {
      $routeProvider.when('/', { templateUrl: 'app/catalog/catalog.html' });
    }])
    .run(['$rootScope', '$log', function ($rootScope, $log) {
      $rootScope.$on('$routeChangeError', function (event, next) {
        $log.warn('route failed', next);
      });
    }]);
})();
