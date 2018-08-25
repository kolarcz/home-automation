const EventEmitter = require('events');
const request = require('request');

module.exports = class TempWunder extends EventEmitter {

  constructor(latitude, longitude, apiKey) {
    super();

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Latitude or longitude is not number');
    }

    const apiUrlConditions =
      `https://api.wunderground.com/api/${apiKey}/conditions/q/${latitude},${longitude}.json`;
    const apiUrlHourly =
      `https://api.wunderground.com/api/${apiKey}/hourly/q/${latitude},${longitude}.json`;

    this.state = {
      temp: null,
      temp_icon: null,
      pop: null,
      pop_icon: null,
      wind: null,
      humidity: null
    };

    const loadData = () => {
      request.get({ url: apiUrlConditions, json: true }, (err1, response1, bodyConds) => {
        request.get({ url: apiUrlHourly, json: true }, (err2, response2, bodyHourly) => {
          try {
            const snow = parseInt(bodyHourly.hourly_forecast[0].snow.english, 10);
            const rain = parseInt(bodyHourly.hourly_forecast[0].qpf.english, 10);
            const icon = bodyHourly.hourly_forecast[0].icon;

            const popIcon = (icon.match(/snow/) || snow > rain) ? 'snow' : 'rain';

            this.state.humidity = Number(String(bodyConds.current_observation.relative_humidity).replace('%', ''));
            this.state.temp = Math.round(bodyConds.current_observation.temp_c);
            this.state.temp_icon = bodyConds.current_observation.icon;
            this.state.pop = bodyHourly.hourly_forecast[0].pop;
            this.state.pop_icon = popIcon;
            this.state.wind = Math.round(bodyConds.current_observation.wind_kph);
            this.emit('change', this.state);
          } catch (e) {}
          setTimeout(loadData, 5 * 60 * 1000);
        });
      });
    };

    loadData();
  }

  getState() {
    return this.state;
  }

};
