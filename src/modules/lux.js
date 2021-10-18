// TODO: not working yet
// max44009-i2c-bus

const EventEmitter = require('events');
const i2c = require('i2c-bus');

module.exports = class Lux extends EventEmitter {

  constructor() {
    super();

    this.state = {
      luminance: null
    };

    const ADDRESS = 0x4A;

    setInterval(() => {
      const i2cBus = i2c.openSync(1);

      const luxHigh = i2cBus.readByteSync(ADDRESS, 0x03);
      const luxLow = i2cBus.readByteSync(ADDRESS, 0x04);

      const exponent = (luxHigh & 0xF0) >> 4;
      const mantissa = ((luxHigh & 0x0F) << 4) | (luxLow & 0x0F);

      const luminance = Math.pow(2, exponent) * mantissa * 0.045;

      i2cBus.closeSync();

      this.state = { luminance };
      this.emit('change', this.state);
    }, 5 * 1000);
  }

  getState() {
    return this.state;
  }

};
