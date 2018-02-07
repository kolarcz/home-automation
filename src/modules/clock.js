const request = require('request');

module.exports = class Clock {

  constructor(ipAddress, apiKey, accessToken) {
    this.ipAddress = ipAddress;
    this.apiKey = apiKey;
    this.accessToken = accessToken;

    this.customApps = {
      light: 'com.lametric.d5c4cf7d936b78ec26550431a4609e6c/1',
      weather: 'com.lametric.4204a2222b86d7e187f624a55f927209/3'
    };
  }

  sendAction(action, params = {}) {
    const app = action.split('.')[0];
    const url = `https://dev:${this.apiKey}@${this.ipAddress}:4343/api/v2/device/apps/com.lametric.${app}`;

    request({
      method: 'GET',
      url,
      rejectUnauthorized: false,
      json: true
    }, (error, response, json) => {
      const widgetId = Object.keys(json.widgets)[0];
      const actionUrl = `${url}/widgets/${widgetId}/actions`;

      request({
        method: 'POST',
        url: actionUrl,
        rejectUnauthorized: false,
        json: true,
        body: {
          id: action,
          params
        }
      }, () => {});
    });
  }

  pushState(customApp, frames) {
    if (!this.customApps[customApp]) {
      throw new Error('Unknown app');
    }

    const url = `https://${this.ipAddress}:4343/api/v1/dev/widget/update/${this.customApps[customApp]}`;
    const body = {
      frames: frames.map((frame, index) => Object.assign({}, frame, { index }))
    };

    request({
      method: 'POST',
      url,
      headers: { 'X-Access-Token': this.accessToken },
      rejectUnauthorized: false,
      json: true,
      body
    }, () => {});
  }

};
