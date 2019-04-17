const firebase = require('firebase-admin');

module.exports = class Firebase {

  constructor(firebaseAccountFile) {
    const firebaseAccount = require(`../../${firebaseAccountFile}`); // eslint-disable-line

    this.firebase = firebase.initializeApp({
      credential: firebase.credential.cert(firebaseAccount)
    });
  }

  async saveWeather(inputData) {
    const keysToSave = ['temperature', 'humidity', 'temperatureOutside', 'humidityOutside'];

    const db = this.firebase.firestore();

    const dbWeather = db.collection('weather');
    const dbWeatherByDay = db.collection('weatherByDay');

    const serverTimestamp = firebase.firestore.Timestamp;

    const t = serverTimestamp.now().toDate();
    t.setHours(0);
    t.setMinutes(0);
    t.setSeconds(0);
    t.setMilliseconds(0);
    const serverTimeBegin = serverTimestamp.fromDate(t);
    const serverTimeNow = serverTimestamp.now();

    const saveData = { date: serverTimeNow };
    keysToSave.forEach((key) => { saveData[key] = inputData[key]; });
    await dbWeather.add(saveData);

    const result = await dbWeather
      .where('date', '>', serverTimeBegin)
      .where('date', '<=', serverTimeNow)
      .get();

    const saveDataSum = {
      date: serverTimeNow,
      records: result.size
    };

    keysToSave.forEach((key) => {
      const values = result.docs
        .map(record => record.data()[key])
        .filter(value => Number.isFinite(value));

      saveDataSum[key] = values.reduce((a, b) => a + b) / values.length;
    });

    const resultSum = await dbWeatherByDay
      .where('date', '>', serverTimeBegin)
      .where('date', '<=', serverTimeNow)
      .orderBy('date', 'desc')
      .limit(1)
      .get();

    const recordSum = resultSum.docs[0];

    if (recordSum) {
      await recordSum.ref.update(saveDataSum);
    } else {
      await dbWeatherByDay.add(saveDataSum);
    }
  }

};
