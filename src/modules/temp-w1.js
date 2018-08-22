const EventEmitter = require('events');
const w1temp = require('w1temp');

module.exports = class TempW1 extends EventEmitter {

  constructor(pinPower, pinData, correction) {
    super();

    this.state = {
      temp: null
    };

    if (pinPower) {
      w1temp.setGpioPower(pinPower);
    }

    w1temp.setGpioData(pinData);

    const initData = () => {
      w1temp.getSensorsUids().then((sensorsUids) => {
        if (!sensorsUids[0]) throw new Error('Sensor not found');

        w1temp.getSensor(sensorsUids[0]).then((sensor) => {
          this.state.temp = Math.round((sensor.getTemperature() + correction) * 10) / 10;
          this.emit('change', this.state);

          sensor.on('change', (temp) => {
            this.state.temp = Math.round((temp + correction) * 10) / 10;
            this.emit('change', this.state);
          });
        });
      }).catch(() => {
        setTimeout(initData, 5 * 1000);
      });
    };

    initData();
  }

  getState() {
    return this.state;
  }

};
