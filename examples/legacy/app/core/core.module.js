// Shared services of the shop. The module is kept in a variable and the registrations use it.
var core = angular.module('harbor.core', ['ngSanitize']);

core.constant('API_ROOT', '/api');

core.factory('teaStore', TeaStore);

TeaStore.$inject = ['$http', 'API_ROOT'];

function TeaStore($http, API_ROOT) {
  // A comment that names $scope or angular.module('ghost', []) is not code and is not counted.
  var cache = [];
  return {
    all: function () {
      return $http.get(API_ROOT + '/teas').then(function (response) {
        cache = response.data.filter(function (tea) { return tea.stock > 0; });
        return cache;
      });
    },
    // The slash in this pattern is a regular expression, and the quotes inside it do not start a string.
    slug: function (name) { return name.toLowerCase().replace(/['" ]+/g, '-'); }
  };
}

core.filter('steepTime', function () {
  return function (seconds) {
    return Math.round(seconds / 60) + ' min';
  };
});
