const express = require('express');
const expressBasicAuth = require('express-basic-auth');
const dateformat = require('dateformat');
const Conf = require('conf');
const fs = require('fs');
const i2c = require('i2c-bus');
const Oled = require('oled-i2c-bus');
const font = require('oled-font-5x7');
const { PNG } = require('pngjs');
const { CronJob } = require('cron');

require('dotenv').config({
  path: `${__dirname}/../.env`
});

const { icons, emoji } = require('./icons');

const System = require('./modules/system');
const Switch = require('./modules/switch');
const Relay = require('./modules/relay');
const Pir = require('./modules/pir');
const TempDarksky = require('./modules/temp-darksky');
const TempDHT22 = require('./modules/temp-dht22');
const LaMetric = require('./modules/lametric');
const Bt = require('./modules/bt');
const Sun = require('./modules/sun');
const Notify = require('./modules/notify');
const Yeelight = require('./modules/yeelight');
const FirebaseDb = require('./modules/firebase-database');


const numbFixed = (number, fixed = 0) => {
  if (Number.isFinite(number)) {
    const result = Number(number).toFixed(fixed).replace('.', ',');
    return result;
  }

  return '?';
};


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

const oled = new Oled(i2c.openSync(1), {
  width: 128,
  height: 32
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
const tempProvider = new TempDarksky(
  +process.env.POSITION_LAT,
  +process.env.POSITION_LON,
  process.env.TEMP_API_KEY
);
const tempDht22 = new TempDHT22(
  +process.env.TEMP_PIN_POWER,
  +process.env.TEMP_PIN_DATA
);
const lametric = new LaMetric(
  process.env.LAMETRIC_IP_ADDRESS,
  process.env.LAMETRIC_API_KEY,
  process.env.LAMETRIC_TOKEN
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
const yeelight = new Yeelight(
  process.env.YEELIGHT_IP
);
const firebaseDb = new FirebaseDb(
  process.env.FIREBASE_ACCOUNT_FILE
);


/* ************************************************************************************************
 LAMETRIC ACTUALIZE
 ************************************************************************************************ */

const actualizeLametricAppLight = async () => {
  let isLightOn = await yeelight.getState(false);

  if (isLightOn === undefined) {
    isLightOn = await yeelight.getState().power;
  }

  lametric.updateWidget('light', [{
    icon: isLightOn ? icons.light_on : icons.light_off,
    text: isLightOn ? 'off' : 'on'
  }]);
};

setInterval(actualizeLametricAppLight, 60 * 1000);
actualizeLametricAppLight();


/* ************************************************************************************************
 FIREBASE
 ************************************************************************************************ */

new CronJob('0 */5 * * * *', () => {
  const tempDht22State = tempDht22.getState();
  const tempProviderState = tempProvider.getState();

  const data = {
    temperature: tempDht22State.temp,
    humidity: tempDht22State.humidity,
    temperatureOutside: tempProviderState.temp,
    humidityOutside: tempProviderState.humidity
  };

  firebaseDb.saveWeather(data);
}, null, true);


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

bt.on('change', async (state) => {
  if (!state.inRange) {
    firstMove = false;
    if (storage) storage.set('firstMove', firstMove);

    if (automation) {
      swtch.send('B', true);
      lametric.sendAction('radio.stop');
      await yeelight.turnOff();
    }
  } else if (automation) {
    swtch.send('B', false);
  }
});

pir.on('move', async () => {
  const { inRange } = bt.getState();
  const { isNight } = sun.getState();

  if (!firstMove) {
    firstMove = true;
    if (storage) storage.set('firstMove', firstMove);

    if (inRange) {
      if (isNight && automation) {
        await yeelight.turnOn();
      }
    } else {
      notify.send('alarm');
    }
  }
});

sun.on('sunset', async () => {
  const { inRange } = bt.getState();
  if (inRange && automation) {
    await yeelight.turnOn();
  }
});

sun.on('sunrise', async () => {
  if (automation) {
    await yeelight.turnOff();
  }
});

yeelight.on('change',
  actualizeLametricAppLight
);


/* ************************************************************************************************
 OLED
 ************************************************************************************************ */

oled.turnOnDisplay();
oled.clearDisplay();

pir.on('moveend', () => oled.dimDisplay(true));
pir.on('move', () => oled.dimDisplay(false));

fs.createReadStream('./raspberry-icon.png')
  .pipe(new PNG({ filterType: 4 }))
  .on('parsed', function () {
    oled.drawRGBAImage(this, 0, 0);
  });

const oledRedraw = () => {
  const systemState = system.getState();
  const tempDht22State = tempDht22.getState();
  const tempProviderState = tempProvider.getState();

  const tempOut = numbFixed(tempProviderState.temp).padStart(3);
  const humidityOut = numbFixed(tempProviderState.humidity).padStart(3);
  const tempIn = numbFixed(tempDht22State.temp, 1).padStart(5);
  const humidityIn = numbFixed(tempDht22State.humidity, 1).padStart(5);

  const cpu = String(systemState.cpu).padStart(3);
  const uptime = {
    days: String(systemState.uptimeDays).padStart(4),
    hours: String(systemState.uptimeHours).padStart(2),
    minutes: String(systemState.uptimeMinutes).padStart(2, '0')
  };

  oled.setCursor(33, 1);
  oled.writeString(font, 1, `${cpu} %${uptime.days} ${uptime.hours}:${uptime.minutes}`);

  oled.setCursor(33, 15);
  oled.writeString(font, 1, `  ${tempOut}°C ${tempIn}°C`);

  oled.setCursor(33, 25);
  oled.writeString(font, 1, `  ${humidityOut} % ${humidityIn} %`);

  setTimeout(oledRedraw, 3 * 1000);
};

oledRedraw();


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

app.get('/api/light-toggle', async (req, res) => {
  const { power } = await yeelight.getState();
  await yeelight[power ? 'turnOff' : 'turnOn']();
  res.send('ok');
});

app.get('/api/light-on', async (req, res) => {
  try {
    if (req.query.color) {
      await yeelight.setColor(req.query.color, req.query.brightness);
    } else if (req.query.temperature) {
      await yeelight.setTemperature(req.query.temperature, req.query.brightness);
    } else {
      throw new Error('Param color or temperature required');
    }
    res.send('ok');
  } catch (err) {
    res.status(400).send(err.toString());
  }
});

app.get('/api/light-off', async (req, res) => {
  await yeelight.turnOff();
  res.send('ok');
});

app.get('/api/cam-toggle', (req, res) => {
  swtch.send('B', !swtch.getState().B);
  res.send('ok');
});

app.get('/api/automation-toggle', (req, res) => {
  automation = !automation;
  if (storage) storage.set('automation', automation);
  res.send('ok');
});

app.get('/api/radio-play', (req, res) => {
  lametric.sendAction('radio.play');
  res.send('ok');
});

app.get('/api/radio-stop', (req, res) => {
  lametric.sendAction('radio.stop');
  res.send('ok');
});

app.get('/api/open', (req, res) => {
  relay.open();
  res.send('ok');
});

app.get('/api/info', async (req, res) => {
  const pirState = pir.getState();
  const tempProviderState = tempProvider.getState();
  const tempDht22State = tempDht22.getState();
  const swtchState = swtch.getState();
  const btState = bt.getState();
  const systemState = system.getState();
  const yeelightState = await yeelight.getState(false);

  const dateFormat = 'd. m. H:MM:ss';
  const uptimeDate = dateformat(systemState.uptimeStart, dateFormat);
  const lastPirDate = pirState.last ? dateformat(pirState.last, dateFormat) : '---';

  const providerIcons = {
    temp: emoji.weather[tempProviderState.tempIcon] || emoji.weather['clear-day'],
    pop: emoji.weather[tempProviderState.popIcon] || emoji.weather.rain
  };

  res.send(`
    ${emoji.thermometer} ${numbFixed(tempDht22State.temp, 1)}°C ${numbFixed(tempDht22State.humidity, 1)}% &nbsp;
    ${providerIcons.temp} ${numbFixed(tempProviderState.temp)}°C ${numbFixed(tempProviderState.humidity)}% &nbsp;
    ${providerIcons.pop} ${numbFixed(tempProviderState.pop)}%<br>
    🏃 ${lastPirDate} &nbsp; 🕰 ${uptimeDate}<br>
    📹 ${swtchState.B ? 'on' : 'off'} &nbsp;
    🔔 ${firstMove ? 'y' : 'n'} &nbsp;
    🤖 ${automation ? 'y' : 'n'} &nbsp;
    📍 ${btState.inRange ? 'in' : 'out'}<br>
    💡 ${yeelightState.power ? `${yeelightState.color || `${yeelightState.temperature}k`} ${yeelightState.brightness}%` : 'off'}
  `);
});

app.listen(81, () =>
  console.info(
    dateformat('yyyy-mm-dd HH:MM:ss'),
    'Listening...'
  )
);
