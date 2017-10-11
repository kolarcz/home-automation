const IFTTTMaker = require('iftttmaker');
const dateformat = require('dateformat');

module.exports = class Notify {

  constructor(apiKey) {
    this.ifttt = IFTTTMaker(apiKey);
  }

  send(message) {
    return this.ifttt.send('notify', 'rpi', `${message} (${dateformat('d. m. yyyy H:MM:ss')})`);
  }

};
