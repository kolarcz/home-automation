const express = require('express');
const expressBasicAuth = require('express-basic-auth');
const dateformat = require('dateformat');
const execSync = require('child_process').execSync;
const vsprintf = require('sprintf-js').vsprintf;
const osUtils = require('os-utils');
const wiringPi = require('wiring-pi');

require('dotenv').config({
  path: `${__dirname}/../.env`
});

const { icons, emoticons } = require('./icons');

const Lcd = require('lcd');

const Switch = require('./modules/switch');
const Pir = require('./modules/pir');
const TempWunder = require('./modules/temp-wunder');
const TempDHT22 = require('./modules/temp-dht22');
const Clock = require('./modules/clock');
const Bt = require('./modules/bt');
const Sun = require('./modules/sun');
const Notify = require('./modules/notify');


/* ************************************************************************************************
 INSTANCES
 ************************************************************************************************ */

const lcd = new Lcd({
  rs: process.env.LCD_PIN_RS,
  e: process.env.LCD_PIN_E,
  data: [
    process.env.LCD_PIN_DATA_DB4,
    process.env.LCD_PIN_DATA_DB5,
    process.env.LCD_PIN_DATA_DB6,
    process.env.LCD_PIN_DATA_DB7
  ],
  cols: 16,
  rows: 2
});

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
const tempWunder = new TempWunder(
  +process.env.POSITION_LAT,
  +process.env.POSITION_LON,
  process.env.TEMP_API_KEY
);
const tempDht22 = new TempDHT22(
  +process.env.TEMP_PIN_POWER,
  +process.env.TEMP_PIN_DATA
);
const clock = new Clock(
  process.env.CLOCK_IP_ADDRESS,
  process.env.CLOCK_API_KEY,
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

tempDht22.on('change', (state) => {
  const { inRange } = bt.getState();
  if (inRange) return;

  const actualTemp = state.temp;
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

  clock.pushState('light', [{
    icon: lightState ? icons.light_on : icons.light_off,
    text: lightState ? 'off' : 'on'
  }]);
};

const actualizeClockAppWeather = () => {
  const tempWunderState = tempWunder.getState();

  const data = [{
    text: tempWunderState.temp ? `${tempWunderState.temp} °C` : '?',
    icon: icons[tempWunderState.temp_icon] || icons.clear
  }];

  if (tempWunderState.pop >= 20) {
    data.push({
      text: tempWunderState.pop ? `${tempWunderState.pop} %` : '?',
      icon: icons[tempWunderState.pop_icon] || icons.clear
    });
  }

  /* data.push({
    text: tempWunderState.wind ? `${tempWunderState.wind}km/h` : '?',
    icon: icons.wind
  }); */

  clock.pushState('weather', data);
};

setInterval(actualizeClockAppLight, 60 * 1000);
setInterval(actualizeClockAppWeather, 60 * 1000);
actualizeClockAppLight();
actualizeClockAppWeather();


/* ************************************************************************************************
 LCD
 ************************************************************************************************ */

wiringPi.setup('gpio');
wiringPi.pinMode(+process.env.LCD_PIN_BACKLIGHT, wiringPi.OUTPUT);
wiringPi.digitalWrite(+process.env.LCD_PIN_BACKLIGHT, wiringPi.HIGH);

pir.on('move', () => wiringPi.digitalWrite(+process.env.LCD_PIN_BACKLIGHT, wiringPi.HIGH));
pir.on('moveend', () => wiringPi.digitalWrite(+process.env.LCD_PIN_BACKLIGHT, wiringPi.LOW));

lcd.on('ready', () => {
  const redraw = () => {
    osUtils.cpuUsage((v) => {
      const cpu = Math.round(v * 100);
      const mem = Math.round(osUtils.totalmem() - osUtils.freemem());
      const upt = osUtils.sysUptime();

      const d = Math.floor(upt / 86400);
      const h = Math.floor((upt % 86400) / 3600);
      const m = Math.floor((upt % 3600) / 60);

      const tempState = tempDht22.getState();
      const tempValue = Number(tempState.temp).toFixed(1);
      const humidityValue = Number(tempState.humidity).toFixed(1);

      lcd.clear(() => {
        lcd.setCursor(0, 0);
        lcd.print(vsprintf('%4sC %3d%% %3dMB', [tempValue, cpu, mem]), () => {
          lcd.setCursor(0, 1);
          lcd.print(vsprintf('%4s%% %3dd %02d:%02d', [humidityValue, d, h, m]), () => {
            setTimeout(redraw, 3 * 1000);
          });
        });
      });
    });
  };

  redraw();
});


/* ************************************************************************************************
 HTTP SERVER
 ************************************************************************************************ */

const app = express();

app.use((req, res, next) => {
  const token = process.env.ACCESS_TOKEN;
  if (typeof token === 'string' && token.length && token === req.query.token) {
    next();
  } else {
    expressBasicAuth({
      users: { [process.env.USERNAME]: process.env.PASSWORD }
    })(req, res, next);
  }
});

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

app.get('/workflow/radio-play', (req, res) => {
  clock.sendAction('radio.play');
  res.send('ok');
});

app.get('/workflow/radio-stop', (req, res) => {
  clock.sendAction('radio.stop');
  res.send('ok');
});

app.get('/workflow/info', (req, res) => {
  const pirState = pir.getState();
  const tempWunderState = tempWunder.getState();
  const tempDht22State = tempDht22.getState();
  const lightState = swtch.getState();
  const btState = bt.getState();

  const dateFormat = 'd. m. H:MM:ss';
  const uptime = new Date(execSync('uptime -s').toString());
  const uptimeDate = dateformat(uptime, dateFormat);
  const lastPirDate = pirState.last ? dateformat(pirState.last, dateFormat) : '---';

  res.send(`
    ${tempDht22State.temp ? `${emoticons.thermometer} ${tempDht22State.temp} °C &nbsp;${tempDht22State.humidity} %` : `${emoticons.thermometer} ? &nbsp;?`} &nbsp;
    ${tempWunderState.temp ? `${emoticons[tempWunderState.temp_icon]} ${tempWunderState.temp} °C &nbsp;${tempWunderState.humidity} %` : `${emoticons.weather} ? &nbsp;?`} &nbsp;
    ${tempWunderState.pop ? `${emoticons[tempWunderState.pop_icon]} ${tempWunderState.pop} %` : `${emoticons.rain} ?`}<br>
    ${lightState.A ? emoticons.light_on : emoticons.light_off} &nbsp; 🔔 ${firstMove ? 'y' : 'n'} &nbsp; 📍 ${btState.inRange ? 'in' : 'out'}<br>
    🏃 ${lastPirDate} &nbsp; 🕰 ${uptimeDate}
  `);
});

app.listen(81, () =>
  console.info(
    dateformat('yyyy-mm-dd HH:MM:ss'),
    'Listening...'
  )
);
