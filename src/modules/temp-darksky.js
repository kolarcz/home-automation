const EventEmitter = require('events');
const request = require('request');

module.exports = class TempDarksky extends EventEmitter {

  constructor(latitude, longitude, apiKey) {
    super();

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Latitude or longitude is not number');
    }

    const url = `https://api.darksky.net/forecast/${apiKey}/${latitude},${longitude}?units=ca&lang=cs&exclude=hourly,daily,flags`;

    this.state = {
      temp: null,
      tempIcon: null,
      pop: null,
      popIcon: null,
      wind: null,
      humidity: null
    };

    const loadData = () => {
      request.get({ url, json: true }, (_0, _1, body) => {
        try {
          this.state.temp = body.currently.temperature;
          this.state.tempIcon = body.currently.icon;
          this.state.pop = Number.isFinite(body.currently.precipProbability)
            ? Math.round(body.currently.precipProbability * 100)
            : undefined;
          this.state.popIcon = body.currently.precipType;
          this.state.wind = body.currently.windSpeed;
          this.state.humidity = Number.isFinite(body.currently.humidity)
            ? Math.round(body.currently.humidity * 100)
            : undefined;

          this.emit('change', this.state);
        } catch (e) {}
        setTimeout(loadData, 5 * 60 * 1000);
      });
    };

    loadData();
  }

  getState() {
    return this.state;
  }

};
