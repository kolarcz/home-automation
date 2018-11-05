const EventEmitter = require('events');
const piswitch = require('piswitch');
const wpi = require('wiring-pi');
const Conf = require('conf');

module.exports = class Switch extends EventEmitter {

  constructor(pinPower, pinData, code, saveState) {
    super();

    this.code = code;

    if (!this.code.match(/^[01]{5}$/)) {
      throw new Error('Invalid code');
    }

    const mode = 'gpio';

    wpi.setup(mode);

    if (pinPower) {
      wpi.pinMode(pinPower, wpi.OUTPUT);
      wpi.digitalWrite(pinPower, wpi.HIGH);
    }

    piswitch.setup({
      mode,
      pin: pinData
    });

    this.state = {
      A: false,
      B: false,
      C: false,
      D: false,
      E: false
    };

    if (saveState) {
      this.storage = new Conf({ configName: __filename });
      this.state = this.storage.get('state', this.state);
    }
  }

  send(letter, turnOn) {
    if (!letter.match(/^[A-E]$/)) return;

    const index = (letter.charCodeAt(0) - 65) + 5;

    let message = `${this.code.replace(/0/g, 'F')}FFFFF${(turnOn ? 'F0' : '0F')}`;
    message = `${message.substr(0, index)}0${message.substr(index + 1)}`;

    piswitch.send(message, 'tristate');
    piswitch.send(message, 'tristate');

    this.state[letter] = turnOn;
    if (this.storage) {
      this.storage.set('state', this.state);
    }

    this.emit(`change::${letter}`);
    this.emit('change');
  }

  getState() {
    return this.state;
  }

};
