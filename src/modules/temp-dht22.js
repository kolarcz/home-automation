const EventEmitter = require('events');
const rpiDhtSensor = require('rpi-dht-sensor');
const wiringPi = require('wiring-pi');

module.exports = class TempDHT22 extends EventEmitter {

  constructor(pinPower, pinData) {
    super();

    this.waitForNextTemp = false;

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
      const { temperature, humidity } = dht.read();

      if (temperature || humidity) {
        if (this.waitForNextTemp) {
          this.waitForNextTemp = false;
        } else if (this.state.temp !== null && Math.abs(this.state.temp - temperature) > 5) {
          this.waitForNextTemp = true;
        }

        if (!this.waitForNextTemp) {
          const newTemperature = Math.round(temperature * 10) / 10;
          const newHumidity = Math.round(humidity * 10) / 10;

          if (this.state.temp !== newTemperature || this.state.humidity !== newHumidity) {
            this.state.temp = newTemperature;
            this.state.humidity = newHumidity;
            this.emit('change', this.state);
          }
        }
      }

      setTimeout(loadData, 5 * 1000);
    };

    loadData();
  }

  getState() {
    return this.state;
  }

};
