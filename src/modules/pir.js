const EventEmitter = require('events');
const wpi = require('wiring-pi');

module.exports = class Pir extends EventEmitter {

  constructor(pinPower, pinGnd, pinData) {
    super();

    this.state = {
      move: false,
      last: false
    };

    const mode = 'gpio';

    let moveRefreshInterval;
    const moveRefreshFn = () => {
      this.state.last = new Date();
    };

    wpi.setup(mode);

    if (pinPower) {
      wpi.pinMode(pinPower, wpi.OUTPUT);
      wpi.digitalWrite(pinPower, wpi.HIGH);
    }

    if (pinGnd) {
      wpi.pinMode(pinGnd, wpi.OUTPUT);
      wpi.digitalWrite(pinGnd, wpi.LOW);
    }

    wpi.pinMode(pinData, wpi.INPUT);

    wpi.wiringPiISR(pinData, wpi.INT_EDGE_BOTH, () => {
      const state = wpi.digitalRead(pinData);

      this.move = (state === wpi.HIGH);

      if (this.move) {
        moveRefreshInterval = setInterval(moveRefreshFn, 1000);
        moveRefreshFn();
        this.emit('move');
      } else {
        clearInterval(moveRefreshInterval);
        this.emit('moveend');
      }
    });
  }

  getState() {
    return this.state;
  }

};
