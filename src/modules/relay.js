const EventEmitter = require('events');
const wpi = require('wiring-pi');

module.exports = class Relay extends EventEmitter {

  constructor(pinData) {
    super();

    this.pinData = pinData;
    this.timeout = null;

    wpi.setup('gpio');
    wpi.pinMode(this.pinData, wpi.OUTPUT);
    wpi.digitalWrite(this.pinData, wpi.HIGH);
  }

  open() {
    clearTimeout(this.timeout);
    wpi.digitalWrite(this.pinData, wpi.LOW);
    this.timeout = setTimeout(() => wpi.digitalWrite(this.pinData, wpi.HIGH), 2000);
    this.emit('opening');
  }

};
