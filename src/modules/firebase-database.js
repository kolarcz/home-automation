const firebase = require('firebase-admin');

module.exports = class Firebase {

  constructor(firebaseAccountFile) {
    const firebaseAccount = require(`../../${firebaseAccountFile}`); // eslint-disable-line

    this.firebase = firebase.initializeApp({
      credential: firebase.credential.cert(firebaseAccount),
      databaseURL: `https://${firebaseAccount.project_id}.firebaseio.com`
    }, `firebase-database_${Math.random()}`);
  }

  saveWeather(inputData) {
    return new Promise((resolve, reject) => {
      const keysToSave = ['temperature', 'humidity', 'temperatureOutside', 'humidityOutside'];

      const db = this.firebase.database();

      const dbWeather = db.ref('weather');
      const dbWeatherByDay = db.ref('weatherByDay');

      const t = new Date();
      const dateNow = t.getTime();
      const dateBegin = (new Date(t.getFullYear(), t.getMonth(), t.getDate())).getTime();

      const saveData = { date: dateNow };
      keysToSave.forEach((key) => { saveData[key] = inputData[key]; });

      dbWeather.push().set(saveData, (err) => {
        if (err) return reject();

        dbWeather.orderByChild('date')
          .startAt(dateBegin)
          .endAt(dateNow)
          .once('value', (snapshot) => {
            const saveDataSum = {
              date: dateNow,
              records: snapshot.numChildren()
            };

            keysToSave.forEach((key) => {
              const values = Object.values(snapshot.val())
                .map(childSnapshot => childSnapshot[key])
                .filter(value => Number.isFinite(value));

              saveDataSum[key] = values.length
                ? (values.reduce((a, b) => a + b) / values.length)
                : null;
            });

            const key = t.toISOString().substr(0, 10);
            dbWeatherByDay.child(key).set(saveDataSum, () => {
              if (err) {
                reject();
              } else {
                resolve();
              }
            });
          });

        return true;
      });
    });
  }

};
