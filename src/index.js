const express = require('express');
const expressBasicAuth = require('express-basic-auth');
const dateformat = require('dateformat');
const vsprintf = require('sprintf-js').vsprintf;
const wiringPi = require('wiring-pi');
const Conf = require('conf');

require('dotenv').config({
  path: `${__dirname}/../.env`
});

const { icons, emoticons } = require('./icons');

const Lcd = require('lcd');

const System = require('./modules/system');
const Switch = require('./modules/switch');
const Relay = require('./modules/relay');
const Pir = require('./modules/pir');
const TempWunder = require('./modules/temp-wunder');
const TempDHT22 = require('./modules/temp-dht22');
const Clock = require('./modules/clock');
const Bt = require('./modules/bt');
const Sun = require('./modules/sun');
const Notify = require('./modules/notify');


/* ************************************************************************************************
 GLOBALS
 ************************************************************************************************ */

const saveState = (process.env.SAVE_STATES === 'true');
const storage = saveState && new Conf({ configName: __filename });

let automation = false;
let firstMove = false;

if (storage) {
  automation = storage.get('automation', automation);
  firstMove = storage.get('firstMove', firstMove);
}


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

const system = new System();
const swtch = new Switch(
  +process.env.SWITCH_PIN_POWER,
  +process.env.SWITCH_PIN_DATA,
  process.env.SWITCH_CODE,
  saveState
);
const relay = new Relay(
  +process.env.RELAY_PIN_DATA
);
const pir = new Pir(
  +process.env.PIR_PIN_POWER,
  +process.env.PIR_PIN_GND,
  +process.env.PIR_PIN_DATA,
  saveState
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
 CLOCK ACTUALIZE
 ************************************************************************************************ */

const actualizeClockAppLight = () => {
  const isLightOn = swtch.getState().A;

  clock.pushState('light', [{
    icon: isLightOn ? icons.light_on : icons.light_off,
    text: isLightOn ? 'off' : 'on'
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

  clock.pushState('weather', data);
};

setInterval(actualizeClockAppLight, 60 * 1000);
setInterval(actualizeClockAppWeather, 60 * 1000);
actualizeClockAppLight();
actualizeClockAppWeather();


/* ************************************************************************************************
 CUSTOM EVENTS
 ************************************************************************************************ */

let tempAlertLast = 0;

tempDht22.on('change', ({ temp }) => {
  const { inRange } = bt.getState();
  if (inRange) {
    tempAlertLast = 0;
    return;
  }

  const diff = Math.abs(temp - tempAlertLast);
  const isBigTemp = (temp >= process.env.TEMP_ALERT);

  if ((isBigTemp || tempAlertLast) && diff >= 1) {
    notify.send(`teplota ${temp} °C`);
    tempAlertLast = isBigTemp ? temp : 0;
  }
});

bt.on('change', (state) => {
  if (!state.inRange) {
    firstMove = false;
    if (storage) storage.set('firstMove', firstMove);

    if (automation) {
      swtch.send('A', false);
      swtch.send('B', true);
    }
  } else if (automation) {
    swtch.send('B', false);
  }
});

pir.on('move', () => {
  const { inRange } = bt.getState();
  const { isNight } = sun.getState();

  if (!firstMove) {
    firstMove = true;
    if (storage) storage.set('firstMove', firstMove);

    if (inRange) {
      if (isNight && automation) {
        swtch.send('A', true);
      }
    } else {
      notify.send('alarm');
    }
  }
});

sun.on('sunset', () => {
  const { inRange } = bt.getState();
  if (inRange && automation) {
    swtch.send('A', true);
  }
});

sun.on('sunrise', () => {
  if (automation) {
    swtch.send('A', false);
  }
});

swtch.on('change::A', () =>
  actualizeClockAppLight()
);


/* ************************************************************************************************
 LCD
 ************************************************************************************************ */

wiringPi.pinMode(+process.env.LCD_PIN_BACKLIGHT, wiringPi.OUTPUT);
wiringPi.digitalWrite(+process.env.LCD_PIN_BACKLIGHT, wiringPi.HIGH);

pir.on('moveend', () => wiringPi.digitalWrite(+process.env.LCD_PIN_BACKLIGHT, wiringPi.LOW));
pir.on('move', () => {
  const { isNight } = sun.getState();
  const isLightOn = swtch.getState().A;
  if (!isNight || isLightOn) wiringPi.digitalWrite(+process.env.LCD_PIN_BACKLIGHT, wiringPi.HIGH);
});

lcd.on('ready', () => {
  const redraw = () => {
    const systemState = system.getState();
    const tempState = tempDht22.getState();
    const tempValue = Number(tempState.temp).toFixed(1);
    const humidityValue = Number(tempState.humidity).toFixed(1);

    lcd.clear(() => {
      lcd.setCursor(0, 0);
      lcd.print(vsprintf('%4sC %3d%% %3dMB', [tempValue, systemState.cpu, systemState.memory]), () => {
        lcd.setCursor(0, 1);
        lcd.print(vsprintf('%4s%% %3dd %02d:%02d', [humidityValue, systemState.uptimeDays, systemState.uptimeHours, systemState.uptimeMinutes]), () => {
          setTimeout(redraw, 3 * 1000);
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
  res.send('ok');
});

app.get('/shortcuts/light-on', (req, res) => {
  swtch.send('A', true);
  res.send('ok');
});

app.get('/shortcuts/light-off', (req, res) => {
  swtch.send('A', false);
  res.send('ok');
});

app.get('/shortcuts/cam-on', (req, res) => {
  swtch.send('B', true);
  res.send('ok');
});

app.get('/shortcuts/cam-off', (req, res) => {
  swtch.send('B', false);
  res.send('ok');
});

app.get('/shortcuts/automation-on', (req, res) => {
  automation = true;
  if (storage) storage.set('automation', automation);
  res.send('ok');
});

app.get('/shortcuts/automation-off', (req, res) => {
  automation = false;
  if (storage) storage.set('automation', automation);
  res.send('ok');
});

app.get('/shortcuts/radio-play', (req, res) => {
  clock.sendAction('radio.play');
  res.send('ok');
});

app.get('/shortcuts/radio-stop', (req, res) => {
  clock.sendAction('radio.stop');
  res.send('ok');
});

app.get('/shortcuts/open', (req, res) => {
  relay.open();
  res.send('ok');
});

app.get('/shortcuts/info', (req, res) => {
  const pirState = pir.getState();
  const tempWunderState = tempWunder.getState();
  const tempDht22State = tempDht22.getState();
  const swtchState = swtch.getState();
  const btState = bt.getState();
  const systemState = system.getState();

  const dateFormat = 'd. m. H:MM:ss';
  const uptimeDate = dateformat(systemState.uptimeStart, dateFormat);
  const lastPirDate = pirState.last ? dateformat(pirState.last, dateFormat) : '---';

  res.send(`
    ${tempDht22State.temp ? `${emoticons.thermometer} ${tempDht22State.temp}°C ${tempDht22State.humidity}%` : `${emoticons.thermometer} ? ?`} &nbsp;
    ${tempWunderState.temp ? `${emoticons[tempWunderState.temp_icon]} ${tempWunderState.temp}°C ${tempWunderState.humidity}%` : `${emoticons.weather} ? ?`} &nbsp;
    ${tempWunderState.pop ? `${emoticons[tempWunderState.pop_icon]} ${tempWunderState.pop}%` : `${emoticons.rain} ?`}<br>
    🏃 ${lastPirDate} &nbsp; 🕰 ${uptimeDate}<br>
    ${swtchState.A ? emoticons.light_on : emoticons.light_off} &nbsp;
    📹 ${swtchState.B ? 'on' : 'off'} &nbsp;
    🔔 ${firstMove ? 'y' : 'n'} &nbsp;
    📍 ${btState.inRange ? 'in' : 'out'} &nbsp;
    🤖 ${automation ? 'y' : 'n'}
  `);
});

app.listen(81, () =>
  console.info(
    dateformat('yyyy-mm-dd HH:MM:ss'),
    'Listening...'
  )
);
