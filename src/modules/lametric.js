const LaMetricCloud = require('lametric-cloud');
const LaMetricLocal = require('lametric-local');

module.exports = class LaMetric {

  constructor(ipAddress, apiKey, accessToken) {
    const baseUrl = `https://${this.ipAddress}:4343`;

    this.customApps = {
      light: 'com.lametric.d5c4cf7d936b78ec26550431a4609e6c/1',
      weather: 'com.lametric.4204a2222b86d7e187f624a55f927209/3'
    };

    this.lametricLocal = new LaMetricLocal({
      base_url: baseUrl,
      basic_authorization: Buffer.from(`dev:${apiKey}`).toString('base64'),
      request_options: { rejectUnauthorized: false }
    });

    this.lametricCloud = new LaMetricCloud({
      base_url: baseUrl,
      access_token: accessToken,
      request_options: { rejectUnauthorized: false }
    });
  }

  sendAction(actionId) {
    const appId = actionId.split('.')[0];
    const appPackage = `com.lametric.${appId}`;

    return this.lametricLocal.getApp(appPackage)
      .then(result => Object.keys(result.widgets)[0])
      .then(widgetId => this.lametricLocal.interactWithWidget(appPackage, widgetId, actionId));
  }

  updateWidget(customApp, frames) {
    return this.lametricCloud.updateWidget(this.customApps[customApp], frames);
  }

};
