// A clock that ticks for the delivery banner, written in TypeScript.
class Clock {
  static $inject = ['$interval'];
  private ticks: number = 0;

  constructor(private $interval: ng.IIntervalService) {}

  start(): void {
    this.$interval(() => { this.ticks += 1; }, 1000);
  }

  label(): string {
    return `tick ${this.ticks}`;
  }
}

angular.module('harbor.core').service('clock', Clock);
