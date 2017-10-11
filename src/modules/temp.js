const EventEmitter = require('events');
const w1temp = require('w1temp');
const request = require('request');

module.exports = class Temp extends EventEmitter {

  constructor(pinPower, pinData, correction, latitude, longitude, apiKey) {
    super();

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Latitude or longitude is not number');
    }

    const outsideApiUrlConditions =
      `https://api.wunderground.com/api/${apiKey}/conditions/q/${latitude},${longitude}.json`;
    const outsideApiUrlHourly =
      `https://api.wunderground.com/api/${apiKey}/hourly/q/${latitude},${longitude}.json`;

    this.state = {
      inside: { temp: false },
      outside: { temp: false, icon: false, rain: false, wind: false }
    };

    if (pinPower) {
      w1temp.setGpioPower(pinPower);
    }

    w1temp.setGpioData(pinData);

    const initInside = () => {
      w1temp.getSensorsUids().then((sensorsUids) => {
        if (!sensorsUids[0]) throw new Error('Sensor not found');

        w1temp.getSensor(sensorsUids[0]).then((sensor) => {
          this.state.inside.temp = Math.round((sensor.getTemperature() + correction) * 10) / 10;
          this.emit('change', this.state);

          sensor.on('change', (temp) => {
            this.state.inside.temp = Math.round((temp + correction) * 10) / 10;
            this.emit('change', this.state);
          });
        });
      }).catch(() => {
        setTimeout(initInside, 5000);
      });
    };

    const loadOutside = () => {
      request.get({ url: outsideApiUrlConditions, json: true }, (err1, response1, bodyConds) => {
        request.get({ url: outsideApiUrlHourly, json: true }, (err2, response2, bodyHourly) => {
          try {
            const snow = parseInt(bodyHourly.hourly_forecast[0].qpf.english, 10);
            const rain = parseInt(bodyHourly.hourly_forecast[0].qpf.english, 10);
            const icon = bodyHourly.hourly_forecast[0].icon;

            const popIcon = (icon.match(/snow/) || snow > rain) ? 'snow' : 'rain';

            this.state.outside.temp = Math.round(bodyConds.current_observation.temp_c);
            this.state.outside.temp_icon = bodyConds.current_observation.icon;
            this.state.outside.pop = bodyHourly.hourly_forecast[0].pop;
            this.state.outside.pop_icon = popIcon;
            this.state.outside.wind = Math.round(bodyConds.current_observation.wind_kph);
            this.emit('change', this.state);
          } catch (e) {}
          setTimeout(loadOutside, 5 * 60 * 1000);
        });
      });
    };

    initInside();
    loadOutside();
  }

  getState() {
    return this.state;
  }

};
