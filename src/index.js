const express = require('express');
const expressBasicAuth = require('express-basic-auth');
const dateformat = require('dateformat');
const execSync = require('child_process').execSync;

require('dotenv').config({
  path: `${__dirname}/../.env`
});

const { icons, emoticons } = require('./icons');


const Switch = require('./modules/switch');
const Pir = require('./modules/pir');
// const Pc = require('./modules/pc');
const Temp = require('./modules/temp');
const Clock = require('./modules/clock');
const Bt = require('./modules/bt');
const Sun = require('./modules/sun');
const Notify = require('./modules/notify');


/* ************************************************************************************************
 INSTANCES
 ************************************************************************************************ */

const swtch = new Switch(
  +process.env.SWITCH_PIN_POWER,
  +process.env.SWITCH_PIN_DATA,
  process.env.SWITCH_CODE
);
const pir = new Pir(
  +process.env.PIR_PIN_POWER,
  +process.env.PIR_PIN_GND,
  +process.env.PIR_PIN_DATA
);
/* const pc = new Pc(
  process.env.PC_MAC_ADDRESS
); */
const temp = new Temp(
  +process.env.TEMP_PIN_POWER,
  +process.env.TEMP_PIN_DATA,
  +process.env.TEMP_CORRECTION,
  +process.env.POSITION_LAT,
  +process.env.POSITION_LON,
  process.env.TEMP_API_KEY
);
const clock = new Clock(
  process.env.CLOCK_IP_ADDRESS,
  process.env.CLOCK_TOKEN
);
const bt = new Bt(
  process.env.PHONEBT_MAC_ADDRESS
);
const sun = new Sun(
  +process.env.POSITION_LAT,
  +process.env.POSITION_LON
);
const notify = new Notify(
  process.env.NOTIFY_API_KEY
);

/* ************************************************************************************************
 CUSTOM EVENTS
 ************************************************************************************************ */

let tempAlertLast = 0;
let tempAlerts = 0;

temp.on('change', (state) => {
  const { inRange } = bt.getState();
  if (inRange) return;

  const actualTemp = state.inside.temp;
  const diff = Math.abs(actualTemp - tempAlertLast);

  if (actualTemp >= process.env.TEMP_ALERT
    && diff >= 1 && tempAlerts < process.env.TEMP_ALERT_CNT
  ) {
    notify.send(`teplota ${actualTemp} °C`);
    tempAlertLast = actualTemp;
    tempAlerts++;
  }

  if (actualTemp <= process.env.TEMP_ALERT_CLEAN) {
    tempAlertLast = 0;
    tempAlerts = 0;
  }
});

let firstMove = false;

bt.on('change', (state) => {
  if (!state.inRange) {
    firstMove = false;
    swtch.send('A', false);

    tempAlertLast = 0;
    tempAlerts = 0;
  }
});

pir.on('move', () => {
  const { inRange } = bt.getState();
  const { isNight } = sun.getState();

  if (!firstMove) {
    firstMove = true;

    if (inRange) {
      if (isNight) swtch.send('A', true);
    } else {
      notify.send('alarm');
    }
  }
});

sun.on('sunset', () => {
  const { inRange } = bt.getState();
  if (inRange) swtch.send('A', true);
});


/* ************************************************************************************************
 CLOCK ACTUALIZE
 ************************************************************************************************ */

const actualizeClockAppLight = () => {
  const lightState = swtch.getState().A;

  clock.setApp('light', [{
    icon: lightState ? icons.light_on : icons.light_off,
    text: lightState ? 'off' : 'on'
  }]);
};

const actualizeClockAppWeather = () => {
  const tempState = temp.getState();

  const data = [{
    text: tempState.outside.temp ? `${tempState.outside.temp} °C` : '?',
    icon: icons[tempState.outside.temp_icon] || icons.clear
  }];

  if (tempState.outside.pop >= 20) {
    data.push({
      text: tempState.outside.pop ? `${tempState.outside.pop} %` : '?',
      icon: icons[tempState.outside.pop_icon] || icons.clear
    });
  }

  /* data.push({
    text: tempState.outside.wind ? `${tempState.outside.wind}km/h` : '?',
    icon: icons.wind
  }); */

  clock.setApp('weather', data);
};

setInterval(actualizeClockAppLight, 60 * 1000);
setInterval(actualizeClockAppWeather, 60 * 1000);
actualizeClockAppLight();
actualizeClockAppWeather();


/* ************************************************************************************************
 HTTP SERVER
 ************************************************************************************************ */

const app = express();

app.use(expressBasicAuth({
  users: { [process.env.USERNAME]: process.env.PASSWORD }
}));

app.get('/lametric/light', (req, res) => {
  swtch.send('A', !swtch.getState().A);
  actualizeClockAppLight();
  res.send('ok');
});

app.get('/workflow/light-on', (req, res) => {
  swtch.send('A', true);
  actualizeClockAppLight();
  res.send('ok');
});

app.get('/workflow/light-off', (req, res) => {
  swtch.send('A', false);
  actualizeClockAppLight();
  res.send('ok');
});

/* app.get('/workflow/wake-pc', (req, res) => {
  pc.wake();
  res.send('ok');
}); */

app.get('/workflow/info', (req, res) => {
  const pirState = pir.getState();
  const tempState = temp.getState();
  const lightState = swtch.getState();
  const btState = bt.getState();

  const uptime = new Date(execSync('uptime -s').toString());

  res.send(`
    ${emoticons.thermometer} ${tempState.inside.temp ? `${tempState.inside.temp} °C` : '?'} &nbsp;
    ${tempState.outside.temp ? `${emoticons[tempState.outside.temp_icon]} ${tempState.outside.temp} °C` : `${emoticons.weather} ?`} &nbsp;
    ${tempState.outside.pop ? `${emoticons[tempState.outside.pop_icon]} ${tempState.outside.pop} %` : `${emoticons.rain} ?`} &nbsp;
    ${lightState.A ? emoticons.light_on : emoticons.light_off}<br>
    🏃 ${dateformat(pirState.last, 'd. m. yyyy H:MM:ss')} &nbsp; 🔔 ${firstMove ? 'y' : 'n'} &nbsp; 📍 ${btState.inRange ? 'in' : 'out'}<br>
    🕰 ${dateformat(uptime, 'd. m. yyyy H:MM:ss')}
  `);
});

app.listen(81, () =>
  console.info(
    dateformat('yyyy-mm-dd HH:MM:ss'),
    'Listening...'
  )
);
