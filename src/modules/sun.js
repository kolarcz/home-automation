const EventEmitter = require('events');
const SunCalc = require('suncalc');

module.exports = class Sun extends EventEmitter {

  constructor(latitude, longitude) {
    super();

    const isNight = (now, sunrise, sunset) => (+now < +sunrise || +now > +sunset);

    const now = new Date();
    const times = SunCalc.getTimes(now, latitude, longitude);

    this.state = {
      isNight: isNight(now, times.goldenHourEnd, times.goldenHour)
    };

    setInterval(() => {
      const now = new Date();
      const times = SunCalc.getTimes(now, latitude, longitude);
      const newIsNight = isNight(now, times.goldenHourEnd, times.goldenHour);

      if (newIsNight && !this.state.isNight) {
        this.state.isNight = newIsNight;
        this.emit('sunset', this.state);
      } else if (!newIsNight && this.state.isNight) {
        this.state.isNight = newIsNight;
        this.emit('sunrise', this.state);
      }
    }, 60 * 1000);
  }

  getState() {
    return this.state;
  }

};
