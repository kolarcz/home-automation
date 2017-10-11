const request = require('request');

module.exports = class Clock {

  constructor(ipAddress, accessToken) {
    this.ipAddress = ipAddress;
    this.accessToken = accessToken;
    this.appsUrl = {
      light: `https://${this.ipAddress}:4343/api/v1/dev/widget/update/com.lametric.d5c4cf7d936b78ec26550431a4609e6c/1`,
      weather: `https://${this.ipAddress}:4343/api/v1/dev/widget/update/com.lametric.4204a2222b86d7e187f624a55f927209/3`
    };
  }

  setApp(app, frames) {
    if (!this.appsUrl[app]) {
      throw new Error('Unknown app');
    }

    const body = {
      frames: frames.map((frame, index) => Object.assign({}, frame, { index }))
    };

    request({
      method: 'POST',
      url: this.appsUrl[app],
      headers: { 'X-Access-Token': this.accessToken },
      rejectUnauthorized: false,
      json: true,
      body
    }, () => {});
  }

};
