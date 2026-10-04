// Two promotion modules that depend on each other, a second declaration of harbor.core that would replace the first,
// and a module whose name is built at run time.
angular.module('harbor.promo', ['harbor.offers']).value('promoBanner', { text: 'Spring blends' });
angular.module('harbor.offers', ['harbor.promo']);

angular.module('harbor.core', []);

var extras = 'harbor.' + 'extras';
angular.module(extras, []);
