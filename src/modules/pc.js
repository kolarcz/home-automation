const wol = require('wol');

module.exports = class Pc {

  constructor(macAddress) {
    this.macAddress = macAddress;
  }

  wake() {
    wol.wake(this.macAddress);
  }

};
