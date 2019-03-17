const EventEmitter = require('events');
const colorsys = require('colorsys');
const yeelight = require('yeelight-awesome');

module.exports = class Yeelight extends EventEmitter {

  constructor(ipAddress, durationChange = 1000) {
    super();

    this.yeelight = new yeelight.Yeelight({ lightIp: ipAddress });
    this.duration = durationChange;
  }

  async setColor(hexColor, changePower = true) {
    if (!/^[0-9a-f]{6}$/i.test(hexColor)) {
      throw new Error('Invalid hexColor, valid format is in hexa RRGGBB');
    } else if (typeof changePower !== 'boolean') {
      throw new Error('Invalid changePower type, valid type is boolen');
    }

    const { h, s, v } = colorsys.hexToHsv(hexColor);

    const yl = await this.yeelight.connect();
    await yl.stopColorFlow();
    await yl.setHSV(h, s, 'smooth', this.duration);
    await yl.setBright(Math.max(1, v), 'smooth', this.duration);
    await yl.setPower(!!v, 'smooth', this.duration);
    await yl.disconnect();

    this.emit('change');
  }

  async turnOn() {
    const yl = await this.yeelight.connect();
    await yl.setPower(true, 'smooth', this.duration);
    await yl.disconnect();

    this.emit('change');
  }

  async turnOff() {
    const yl = await this.yeelight.connect();
    await yl.setPower(false, 'smooth', this.duration);
    await yl.disconnect();

    this.emit('change');
  }

  async getState() {
    const yl = await this.yeelight.connect();

    const { result: { result: [power, hue, sat, bright] } } = await yl.getProperty([
      yeelight.DevicePropery.POWER,
      yeelight.DevicePropery.HUE,
      yeelight.DevicePropery.SAT,
      yeelight.DevicePropery.BRIGHT
    ]);

    await yl.disconnect();

    return {
      power: power === 'on',
      color: colorsys.hsv2Hex(Number(hue), Number(sat), Number(bright)).substr(1),
      bright
    };
  }

};
