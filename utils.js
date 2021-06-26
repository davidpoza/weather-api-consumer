
const Fs = require('fs');
const Path = require('path');
const ftp = require('basic-ftp');
const fetch = require('node-fetch');
const air = require('aire-madrid');
const dayjs = require('dayjs');

const {
  LEVEL_1,
  LEVEL_2,
  LEVEL_3,
  FTP_HOST,
  FTP_USER,
  FTP_PASSWORD,
  OPENWEATHERMAP_ENDPOINT,
  TOMORROWIO_ENDPOINT,
  AEMET_ENDPOINT,
  AEMET_API_KEY,
  ZONES,
} = require('./constants');

class Utils {
  static async uploadFile(sourceFilePath, targetFilePath) {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
      await client.access({
        host: FTP_HOST,
        user: FTP_USER,
        password: FTP_PASSWORD,
        secure: false
      })
      console.log(await client.list());
      await client.ensureDir(Path.dirname(targetFilePath));
      await client.uploadFrom(sourceFilePath, targetFilePath);
    }
    catch(err) {
      console.log(err)
    }
    client.close()
  }

  static transformCurrent(data) {
    return ({
      visibility: data.visibility,
      temperature: data.temp,
      weather: data.weather[0].icon,
      feels_like: data.feels_like,
      humidity: data.humidity,
      wind_speed: data.wind_speed,
      wind_direction: data.wind_deg,
      humidity: data.humidity,
      cloud_cover: data.clouds,
      uvi: data.uvi,
      sunrise: data.sunrise,
      sunset: data.sunset,
    });
  }

  static transformForecastDay(data) {
    return ({
      date: data.dt,
      max_temp: data.temp.max,
      min_temp: data.temp.min,
      weather: data.weather[0].icon,
      wind_speed: data.wind_speed,
      probability_of_precipitation: data.pop,
      rain: data.rain,
      moonrise: data.moonrise,
      moonset:  data.moonset,
      moon_phase: data.moon_phase,
    });
  }

  static transformForecastHour(data) {
    return ({
      date: data.dt,
      temp: data.temp,
      weather: data.weather[0].icon,
      wind_speed: data.wind_speed,
      probability_of_precipitation: data.pop,
      rain: data.rain?.['1h'],
    });
  }

  static transformPollen(data) {
    return ({
      treeIndex: data.data.timelines?.[0].intervals?.[0].values?.treeIndex,
      grassIndex: data.data.timelines?.[0].intervals?.[0].values?.grassIndex,
      weedIndex: data.data.timelines?.[0].intervals?.[0].values?.weedIndex,
    });
  }

  static async fetchForecast(lon, lat) {
    let data;
    const res = await fetch(`${OPENWEATHERMAP_ENDPOINT}&lon=${lon}&lat=${lat}`);
    data = await res.json();

    return ({
      current: Utils.transformCurrent(data.current),
      daily_forecast: data.daily.map(f => Utils.transformForecastDay(f)),
      hourly_forecast: data.hourly.map(f => Utils.transformForecastHour(f)),
    });
  }

  static async fetchPollen(lon, lat) {
    let data;
    const res = await fetch(`${TOMORROWIO_ENDPOINT}&location=${lat},${lon}&fields=treeIndex,grassIndex,weedIndex`);
    data = await res.json();
    return (Utils.transformPollen(data));
  }

  static async fetchAemetTextForecast(provinceCode) {
    let dataUrl, data;
    const firstRes = await fetch(`${AEMET_ENDPOINT}/prediccion/provincia/manana/${provinceCode}`, {
      headers: {
        api_key: AEMET_API_KEY,
      },
    });
    dataUrl = await firstRes.json();

    const secondRes = await fetch(dataUrl.datos, {
      headers: {
        api_key: AEMET_API_KEY,
      },
    });
    data = await secondRes.textConverted();

    return (data);
  }

  static async buildFinalJson(lon, lat, { pollen, provinceCode }) {
    let pollenData, textForcast;
    const forecastData = await Utils.fetchForecast(lon, lat);
    if (pollen) pollenData = await Utils.fetchPollen(lon, lat);
    if (provinceCode) textForcast = await Utils.fetchAemetTextForecast(provinceCode);
    return({
      ts: new Date().getTime(),
      data: {
        lon,
        lat,
        ...forecastData,
        pollen: pollenData,
        textForecast: textForcast
      }
    });
  }

  static calculateScene(totalStationsByZone, totalStationsByZoneYes, totalStationsByZoneBefYes, totalStationsByZoneBefBefYes) {
    // un día en nivel alerta (tres estaciones)

    if (
      Object.keys(totalStationsByZone).some(zone => totalStationsByZone[zone][LEVEL_3] >= 3)
    ) {
      return 5;
    }

    // se superan 4 dias el nivel aviso
    if (
      totalStationsByZone && totalStationsByZoneYes && totalStationsByZoneBefYes && totalStationsByZoneBefBefYes
      && Object.keys(totalStationsByZone).some(zone => totalStationsByZone[zone][LEVEL_2] >= 2)
      && Object.keys(totalStationsByZoneYes).some(zone => totalStationsByZoneYes[zone][LEVEL_2] >= 2)
      && Object.keys(totalStationsByZoneBefYes).some(zone => totalStationsByZoneBefYes[zone][LEVEL_2] >= 2)
      && Object.keys(totalStationsByZoneBefBefYes).some(zone => totalStationsByZoneBefBefYes[zone][LEVEL_2] >= 2)
    ) {
      return 4;
    }

    // tres días en preaviso o 2 en aviso
    if (
      totalStationsByZone && totalStationsByZoneYes && totalStationsByZoneBefYes
      && (
        (
          Object.keys(totalStationsByZone).some(zone => totalStationsByZone[zone][LEVEL_1] >= 2)
          && Object.keys(totalStationsByZoneYes).some(zone => totalStationsByZoneYes[zone][LEVEL_1] >= 2)
          && Object.keys(totalStationsByZoneBefYes).some(zone => totalStationsByZoneBefYes[zone][LEVEL_1] >= 2)
        )
        ||
        (
          Object.keys(totalStationsByZone).some(zone => totalStationsByZone[zone][LEVEL_2] >= 2)
          && Object.keys(totalStationsByZoneYes).some(zone => totalStationsByZoneYes[zone][LEVEL_2] >= 2)
        )
      )
    ) {
      return 3;
    }

    // se supera el nivel de preaviso en 2 días consecutivos o en un día el nivel de aviso (superiores a 200 durante tres horas consecutivas en dos estaciones de la misma zona)
    if (
      totalStationsByZone && totalStationsByZoneYes
      && (
        (
          Object.keys(totalStationsByZone).some(zone => totalStationsByZone[zone][LEVEL_1] >= 2)
          && Object.keys(totalStationsByZoneYes).some(zone => totalStationsByZoneYes[zone][LEVEL_1] >= 2)
        )
        ||
        Object.keys(totalStationsByZone).some(zone => totalStationsByZone[zone][LEVEL_2] >= 2)
      )
    ) {
      return 2;
    }
    // durante 1 día se supera el nivel de preaviso (niveles superiores a 180 durante dos horas consecutivas en dos estaciones de la misma zona)
    if (Object.keys(totalStationsByZone).some(zone => totalStationsByZone[zone][LEVEL_1] >= 2)) return 1;

    return 0;
  }

  static async calculatePollution() {
    const today = `${dayjs().format('YYYYMMDD')}.json`;
    const yesterday = `${dayjs().subtract(1, 'day').format('YYYYMMDD')}.json`;
    const befYesterday = `${dayjs().subtract(2, 'day').format('YYYYMMDD')}.json`;
    const befbefYesterday = `${dayjs().subtract(3, 'day').format('YYYYMMDD')}.json`;
    const toDelete = `${dayjs().subtract(4, 'day').format('YYYYMMDD')}.json`; // we only save 4 days info

    let totalStationsByZone = {
      zone1: {},
      zone2: {},
      zone3: {},
      zone4: {},
      zone5: {},
    };

    let totalStationsByZoneYes,
    totalStationsByZoneBefYes,
    totalStationsByZoneBefBefYes;

    if (Fs.existsSync(toDelete)) {
      Fs.unlinkSync(toDelete);
    }

    if (Fs.existsSync(yesterday)) {
      totalStationsByZoneYes = JSON.parse(Fs.readFileSync(yesterday, { encoding:'utf8', flag:'r' }));
    }

    if (Fs.existsSync(befYesterday)) {
      totalStationsByZoneBefYes = JSON.parse(Fs.readFileSync(befYesterday, { encoding:'utf8', flag:'r' }));
    }

    if (Fs.existsSync(befbefYesterday)) {
      totalStationsByZoneBefBefYes = JSON.parse(Fs.readFileSync(befbefYesterday, { encoding:'utf8', flag:'r' }));
    }
    // returns how many stations meet given level
    function checkStationsMeetsLevel(zoneStationsObj, level) {
      return Object.keys(zoneStationsObj).filter(st => (zoneStationsObj[st] === level)).length;
    }

    const LEVELS = [LEVEL_3, LEVEL_2, LEVEL_1];

    const results = {
      zone1: {},
      zone2: {},
      zone3: {},
      zone4: {},
      zone5: {},
    };

    for (const z of Object.keys(ZONES)) {
      const stationReadings = await air.getReadings({ stations: ZONES[z], pollutants: [8]});
      stationReadings.forEach((st, sti) => {
        st.pollutants?.[0]?.values.forEach((v, i, values) => {
          if ((v > 400 && values?.[i+1] > 400 && values?.[i+2] > 400) || (z === 'zone4' && v > 400 && values?.[i+1] > 400)) {
            if (!results[z][stationReadings[sti].id]) results[z][stationReadings[sti].id] = LEVEL_3;
          } else if (v > 200 && values?.[i+1] > 200 && values?.[i+2] > 200) {
            if (!results[z][stationReadings[sti].id]) results[z][stationReadings[sti].id] = LEVEL_2;
          } else if (v > 180 && values?.[i+1] > 180) {
            if (!results[z][stationReadings[sti].id]) results[z][stationReadings[sti].id] = LEVEL_1;
          }
        })
      });
    }

    LEVELS.forEach(lvl => {
      Object.keys(ZONES).forEach(z => {
        totalStationsByZone[z][lvl] = checkStationsMeetsLevel(results[z], lvl);
      });
    });

    Fs.writeFileSync(today, JSON.stringify(totalStationsByZone));
    return Utils.calculateScene(totalStationsByZone, totalStationsByZoneYes, totalStationsByZoneBefYes, totalStationsByZoneBefBefYes);
  }
}

module.exports = Utils;