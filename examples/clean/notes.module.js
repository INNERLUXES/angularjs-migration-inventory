// A small notes app that is ready to move: components, one-way bindings and dependencies in $inject.
angular.module('notes', [])
  .component('noteList', {
    bindings: { notes: '<', onSelect: '&' },
    controller: NoteListController,
    templateUrl: 'note-list.html'
  })
  .service('noteStore', NoteStore);

NoteListController.$inject = ['noteStore'];

function NoteListController(noteStore) {
  this.count = function () { return noteStore.size(); };
}

function NoteStore() {
  var notes = [];
  this.size = function () { return notes.length; };
}
