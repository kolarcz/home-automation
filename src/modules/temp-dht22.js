const EventEmitter = require('events');
const rpiDhtSensor = require('rpi-dht-sensor');
const wiringPi = require('wiring-pi');

module.exports = class TempDHT22 extends EventEmitter {

  constructor(pinPower, pinData) {
    super();

    this.state = {
      temp: null,
      humidity: null
    };

    if (pinPower) {
      wiringPi.setup('gpio');
      wiringPi.pinMode(pinPower, wiringPi.OUTPUT);
      wiringPi.digitalWrite(pinPower, wiringPi.HIGH);
    }

    const dht = new rpiDhtSensor.DHT22(pinData);

    const loadData = () => {
      const readout = dht.read();

      if (readout.temperature || readout.humidity) {
        this.state.temp = Math.round((readout.temperature) * 10) / 10;
        this.state.humidity = Math.round((readout.humidity) * 10) / 10;
        this.emit('change', this.state);
      }

      setTimeout(loadData, 5 * 1000);
    };

    loadData();
  }

  getState() {
    return this.state;
  }

};
