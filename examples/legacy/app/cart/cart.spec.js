// A unit test: left out by the default exclude patterns, because tests make scopes and compile markup for the test alone.
describe('cartSummary', function () {
  it('compiles', inject(function ($compile, $rootScope) {
    var scope = $rootScope.$new();
    $compile('<cart-summary></cart-summary>')(scope);
  }));
});
