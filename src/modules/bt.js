const EventEmitter = require('events');
const btwatch = require('btwatch');

module.exports = class Bt extends EventEmitter {

  constructor(watchedMacAddress) {
    super();

    this.state = {
      inRange: true
    };

    btwatch.watch(watchedMacAddress);

    btwatch.on('change', (inRange) => {
      this.state.inRange = inRange;
      this.emit('change', this.state);
    });
  }

  getState() {
    return this.state;
  }

};
