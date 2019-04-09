const EventEmitter = require('events');
const yeelight = require('yeelight-awesome');

module.exports = class Yeelight extends EventEmitter {

  constructor(ipAddress, durationChange = 1000) {
    super();

    this.yeelight = new yeelight.Yeelight({ lightIp: ipAddress });
    this.yeelightActualize = new yeelight.Yeelight({ lightIp: ipAddress });

    this.duration = durationChange;

    this.state = {};

    const actualize = async () => {
      setTimeout(actualize, 10 * 1000);
      const yl = await this.yeelightActualize.connect();
      await this._actualizeState(yl);
      await yl.disconnect();
    };

    actualize();
  }

  async setColor(hexColor, brightness = undefined, turnOn = true) {
    const brightnessN = Number(brightness);

    if (!/^#[0-9a-f]{6}$/i.test(hexColor)) {
      throw new Error('Invalid hexColor, valid format is #RRGGBB');
    } else if (brightness !== undefined
      && (!Number.isInteger(brightnessN) || brightnessN < 1 || brightnessN > 100)) {
      throw new Error('Invalid brightness, valid brightness is number in range 1 - 100');
    } else if (typeof turnOn !== 'boolean') {
      throw new Error('Invalid turnOn, valid type is boolen');
    }

    const color = new yeelight.Color(null, null, null, hexColor.substr(1));

    const yl = await this.yeelight.connect();
    await yl.stopColorFlow();
    await yl.setRGB(color, 'smooth', this.duration);

    if (brightness !== undefined) {
      await yl.setBright(brightnessN, 'smooth', this.duration);
    }

    if (turnOn) {
      await yl.setPower(true, 'smooth', this.duration);
    }

    await this._actualizeState(yl);
    await yl.disconnect();
  }

  async setTemperature(temperature, brightness = undefined, turnOn = true) {
    const temperatureN = Number(temperature);
    const brightnessN = Number(brightness);

    if (!Number.isInteger(temperatureN) || temperatureN < 1700 || temperatureN > 6500) {
      throw new Error('Invalid temperature, valid temperature is number in range 1700 - 6500');
    } else if (brightness !== undefined
      && (!Number.isInteger(brightnessN) || brightnessN < 1 || brightnessN > 100)) {
      throw new Error('Invalid brightness, valid brightness is number in range 1 - 100');
    } else if (typeof turnOn !== 'boolean') {
      throw new Error('Invalid turnOn, valid type is boolen');
    }

    const yl = await this.yeelight.connect();
    await yl.stopColorFlow();
    await yl.setCtAbx(temperatureN, 'smooth', this.duration);

    if (brightness !== undefined) {
      await yl.setBright(brightnessN, 'smooth', this.duration);
    }

    if (turnOn) {
      await yl.setPower(true, 'smooth', this.duration);
    }

    await this._actualizeState(yl);
    await yl.disconnect();
  }

  async setBrightness(brightness, turnOn = true) {
    const brightnessN = Number(brightness);

    if (!Number.isInteger(brightnessN) || brightnessN < 1 || brightnessN > 100) {
      throw new Error('Invalid brightness, valid brightness is number in range 1 - 100');
    } else if (typeof turnOn !== 'boolean') {
      throw new Error('Invalid turnOn, valid type is boolen');
    }

    const yl = await this.yeelight.connect();
    await yl.setBright(brightnessN, 'smooth', this.duration);

    if (turnOn) {
      await yl.setPower(true, 'smooth', this.duration);
    }

    await this._actualizeState(yl);
    await yl.disconnect();
  }

  async turnOn() {
    const yl = await this.yeelight.connect();
    await yl.setPower(true, 'smooth', this.duration);

    await this._actualizeState(yl);
    await yl.disconnect();
  }

  async turnOff() {
    const yl = await this.yeelight.connect();
    await yl.setPower(false, 'smooth', this.duration);

    await this._actualizeState(yl);
    await yl.disconnect();
  }

  async _actualizeState(yl) {
    const { result: { result: [power, mode, rgb, bright, temp] } } = await yl.getProperty([
      yeelight.DevicePropery.POWER,
      yeelight.DevicePropery.COLOR_MODE,
      yeelight.DevicePropery.RGB,
      yeelight.DevicePropery.BRIGHT,
      yeelight.DevicePropery.CT
    ]);

    const modes = {
      1: 'color',
      2: 'temperature'
    };

    const newState = {
      power: power === 'on',
      mode: modes[mode],
      color: modes[mode] === 'color' ? `#${Number(rgb).toString(16).padStart(6, '0')}` : undefined,
      temperature: modes[mode] === 'temperature' ? Number(temp) : undefined,
      brightness: Number(bright)
    };

    if (JSON.stringify(this.state) !== JSON.stringify(newState)) {
      this.state = newState;
      this.emit('change', newState);
    } else {
      this.state = newState;
    }

    return this.state;
  }

  async getState(forceActualize = true) {
    if (forceActualize) {
      const yl = await this.yeelight.connect();
      await this._actualizeState(yl);
      await yl.disconnect();
    }

    return this.state;
  }

};
