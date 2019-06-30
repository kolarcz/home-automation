const firebase = require('firebase-admin');

module.exports = class Firebase {

  constructor(firebaseAccountFile) {
    const firebaseAccount = require(`../../${firebaseAccountFile}`); // eslint-disable-line

    this.firebase = firebase.initializeApp({
      credential: firebase.credential.cert(firebaseAccount),
      databaseURL: `https://${firebaseAccount.project_id}.firebaseio.com`
    }, `firebase-database_${Math.random()}`);

    this.keysToSave = ['temperature', 'humidity', 'temperatureOutside', 'humidityOutside'];
  }

  _groupData(data) {
    const result = {};

    this.keysToSave.forEach((key) => {
      const values = data
        .map(childSnapshot => childSnapshot[key])
        .filter(Number.isFinite);

      result[key] = values.length
        ? (values.reduce((a, b) => a + b) / values.length)
        : null;
    });

    return result;
  }

  async saveWeather(inputData) {
    const db = this.firebase.database();

    const dbWeather = db.ref('weather');
    const dbWeatherByHour = db.ref('weatherByHour');
    const dbWeatherByDay = db.ref('weatherByDay');

    const t = new Date();
    const now = t.getTime();
    const hourBegin = (new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours())).getTime();
    const dayBegin = (new Date(t.getFullYear(), t.getMonth(), t.getDate())).getTime();

    const saveData = { date: now };
    this.keysToSave.forEach((key) => { saveData[key] = inputData[key]; });

    await new Promise((resolve, reject) =>
      dbWeather.push()
        .set(saveData, err => (err ? reject : resolve)())
    );

    const createGroupFn = (dbCollection, begin, key) =>
      new Promise((resolve, reject) => {
        dbWeather.orderByChild('date')
          .startAt(begin)
          .endAt(now)
          .once('value', (snapshot) => {
            const saveDataSum = {
              date: now,
              records: snapshot.numChildren(),
              ...this._groupData(Object.values(snapshot.val()))
            };

            dbCollection.child(key)
              .set(saveDataSum, err => (err ? reject : resolve)());
          });
      });

    return Promise.all([
      createGroupFn(dbWeatherByHour, hourBegin, t.toISOString().substr(0, 13)),
      createGroupFn(dbWeatherByDay, dayBegin, t.toISOString().substr(0, 10))
    ]);
  }

};
