const EventEmitter = require('events');
const piswitch = require('piswitch');
const wpi = require('wiring-pi');

module.exports = class Switch extends EventEmitter {

  constructor(pinPower, pinData, code) {
    super();

    this.state = {
      A: false,
      B: false,
      C: false,
      D: false,
      E: false
    };

    const mode = 'gpio';

    this.code = code;

    if (!this.code.match(/^[01]{5}$/)) {
      throw new Error('Invalid code');
    }

    wpi.setup(mode);

    if (pinPower) {
      wpi.pinMode(pinPower, wpi.OUTPUT);
      wpi.digitalWrite(pinPower, wpi.HIGH);
    }

    piswitch.setup({
      mode,
      pin: pinData
    });
  }

  send(letter, turnOn) {
    if (!letter.match(/^[A-E]$/)) return;

    const index = (letter.charCodeAt(0) - 65) + 5;

    let message = `${this.code.replace(/0/g, 'F')}FFFFF${(turnOn ? 'F0' : '0F')}`;
    message = `${message.substr(0, index)}0${message.substr(index + 1)}`;

    piswitch.send(message, 'tristate');
    piswitch.send(message, 'tristate');

    this.state[letter] = turnOn;
    this.emit('change');
  }

  getState() {
    return this.state;
  }

};
