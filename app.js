const dotenv = require('dotenv');
dotenv.config();
const Fs = require('fs');
const Path = require('path');
const ftp = require('basic-ftp');
const fetch = require('node-fetch');
const air = require('aire-madrid');
const dayjs = require('dayjs');

const FTP_HOST = process.env.FTP_HOST;
const FTP_USER= process.env.FTP_USER;
const FTP_PASSWORD = process.env.FTP_PASSWORD;
const FTP_BASE_PATH = process.env.FTP_BASE_PATH; // without trailing backslash
const LOCAL_PATH = process.env.LOCAL_PATH; // without trailing backslash
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const TOMORROWIO_API_KEY = process.env.TOMORROWIO_API_KEY;
const AEMET_API_KEY = process.env.AEMET_API_KEY;

const TOMORROWIO_ENDPOINT = `https://api.tomorrow.io/v4/timelines?units=metric&apikey=${TOMORROWIO_API_KEY}`;
const AEMET_ENDPOINT = 'https://opendata.aemet.es/opendata/api';
const OPENWEATHERMAP_ENDPOINT = `https://api.openweathermap.org/data/2.5/onecall?appid=${OPENWEATHERMAP_API_KEY}&units=metric`;

const locations = [
  {
    name: 'colmenar-viejo',
    lon: '-3.7750177',
    lat: '40.666554',
    pollen: true,
    air_quality: true,
    text_forecast: true,
    provinceCode: 28, // AEMET
  },
  {
    name: 'penalara',
    lat: '40.850131',
    lon: '-3.9593821',
  },
  {
    name: 'hoyos-del-espino',
    lat: '40.355235',
    lon: '-5.177728',
  },
  {
    name: 'somosierra',
    lat: '41.132662',
    lon: '-5.177728',
  }
];

async function uploadFile(sourceFilePath, targetFilePath) {
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

function transformCurrent(data) {
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

function transformForecastDay(data) {
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

function transformForecastHour(data) {
  return ({
    date: data.dt,
    temp: data.temp,
    weather: data.weather[0].icon,
    wind_speed: data.wind_speed,
    probability_of_precipitation: data.pop,
    rain: data.rain?.['1h'],
  });
}

function transformPollen(data) {
  return ({
    treeIndex: data.data.timelines?.[0].intervals?.[0].values?.treeIndex,
    grassIndex: data.data.timelines?.[0].intervals?.[0].values?.grassIndex,
    weedIndex: data.data.timelines?.[0].intervals?.[0].values?.weedIndex,
  });
}

async function fetchForecast(lon, lat) {
  let data;
  const res = await fetch(`${OPENWEATHERMAP_ENDPOINT}&lon=${lon}&lat=${lat}`);
  data = await res.json();

  return ({
    current: transformCurrent(data.current),
    daily_forecast: data.daily.map(f => transformForecastDay(f)),
    hourly_forecast: data.hourly.map(f => transformForecastHour(f)),
  });
}

async function fetchPollen(lon, lat) {
  let data;
  const res = await fetch(`${TOMORROWIO_ENDPOINT}&location=${lat},${lon}&fields=treeIndex,grassIndex,weedIndex`);
  data = await res.json();
  return (transformPollen(data));
}

async function fetchAemetTextForecast(provinceCode) {
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

async function buildFinalJson(lon, lat, { pollen, provinceCode }) {
  let pollenData, textForcast;
  const forecastData = await fetchForecast(lon, lat);
  if (pollen) pollenData = await fetchPollen(lon, lat);
  if (provinceCode) textForcast = await fetchAemetTextForecast(provinceCode);
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

async function calculatePollution() {
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
    console.log('deleting: ', toDelete);
    fs.unlinkSync(toDelete);
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
    // console.log("comprobando cuales de las estaciones:", Object.keys(zoneStationsObj), "tienen nivel ", level)
    return Object.keys(zoneStationsObj).filter(st => (zoneStationsObj[st] === level)).length;
  }

  function calculateScene() {
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

  const LEVEL_1 = 'preaviso';
  const LEVEL_2 = 'aviso';
  const LEVEL_3 = 'alerta';
  const LEVELS = [LEVEL_3, LEVEL_2, LEVEL_1];

  const STATION_LIMIT_PER_LEVEL = {};


  const zones = {
    zone1: [4],
    zone2: [36, 40, 54],
    zone3: [16, 27, 55, 57, 59, 60],
    zone4: [/**24, */ 58], // casa de campo es la 24 pero no está disponible
    zone5: [17, 18, 56],
  };

  const results = {
    zone1: {},
    zone2: {},
    zone3: {},
    zone4: {},
    zone5: {},
  };

  for (z of Object.keys(zones)) {
    const stationReadings = await air.getReadings({ stations: zones[z], pollutants: [8]});
    stationReadings.forEach((st, sti) => {
      st.pollutants?.[0]?.values.forEach((v, i, values) => {
        if ((v > 400 && values?.[i+1] > 400 && values?.[i+2] > 400) || (z === 'zone4' && v > 400 && values?.[i+1] > 400)) {
          results[z][stationReadings[sti].id] = LEVEL_3;
        } else if (v > 200 && values?.[i+1] > 200 && values?.[i+2] > 200) {
          results[z][stationReadings[sti].id] = LEVEL_2;
        } else if (v > 20 && values?.[i+1] > 20) {
          results[z][stationReadings[sti].id] = LEVEL_1;
        }
      })
    });
  }

  LEVELS.forEach(lvl => {
    Object.keys(zones).forEach(z => {
      totalStationsByZone[z][lvl] = checkStationsMeetsLevel(results[z], lvl);
    });
  });

  console.log(totalStationsByZone);
  Fs.writeFileSync(today, JSON.stringify(totalStationsByZone));

  return calculateScene();
}

async function runJob() {
  for (loc of locations) {
    try {
      const data = await buildFinalJson(loc.lon, loc.lat, {
        pollen: loc?.pollen || false,
        provinceCode: loc?.provinceCode || null
       });
      Fs.writeFileSync(`${loc.name}.json`, JSON.stringify(data));
    } catch(Error) {
      console.log('Some fetch has fail', Error);
      process.exit();
    }
    await uploadFile(`${__dirname}/${loc.name}.json`, `${FTP_BASE_PATH}/${loc.name}.json`);
  };
  process.exit();
}

(async () => {
  //await runJob();
  const pollutionScene = await calculatePollution();
  Fs.writeFileSync('scene.json', JSON.stringify(pollutionScene));
  await uploadFile(`${__dirname}/scene.json`, `${FTP_BASE_PATH}/pollution_scene.json`);
})()