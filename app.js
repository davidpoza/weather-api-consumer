const Fs = require('fs');
const Utils = require('./utils');
const { locations, FTP_BASE_PATH } = require('./constants');

async function runForecastJob() {
  for (loc of locations) {
    try {
      const data = await Utils.buildFinalJson(loc.lon, loc.lat, {
        pollen: loc?.pollen || false,
        provinceCode: loc?.provinceCode || null
       });
      Fs.writeFileSync(`${loc.name}.json`, JSON.stringify(data));
    } catch(Error) {
      console.log('Some fetch has fail', Error);
      process.exit();
    }
    await Utils.uploadFile(`${__dirname}/${loc.name}.json`, `${FTP_BASE_PATH}/${loc.name}.json`);
  };
}

async function runPollutionJob() {
  const pollutionScene = await Utils.calculatePollution();
  Fs.writeFileSync('scene.json', JSON.stringify(pollutionScene));
  await Utils.uploadFile(`${__dirname}/scene.json`, `${FTP_BASE_PATH}/pollution_scene.json`);
}

(async () => {
  await runForecastJob();
  await runPollutionJob();
  process.exit();
})()