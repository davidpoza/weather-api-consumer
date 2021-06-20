const dotenv = require('dotenv');
dotenv.config();
const Fs = require('fs');
const Path = require('path');
const ftp = require('basic-ftp');
const fetch = require('node-fetch');

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
  }
];


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
  try {
    const res = await fetch(`${OPENWEATHERMAP_ENDPOINT}&lon=${lon}&lat=${lat}`);
    data = await res.json();
  } catch (Error) {
    console.log('Error during forecast fetch');
  }

  return ({
    current: transformCurrent(data.current),
    daily_forecast: data.daily.map(f => transformForecastDay(f)),
    hourly_forecast: data.hourly.map(f => transformForecastHour(f)),
  });
}

async function fetchPollen(lon, lat) {
  let data;
  try {
    const res = await fetch(`${TOMORROWIO_ENDPOINT}&location=${lat},${lon}&fields=treeIndex,grassIndex,weedIndex`);
    data = await res.json();
  } catch (Error) {
    console.log('Error during pollen fetch');
  }

  return (transformPollen(data));
}

async function fetchAemetTextForecast(provinceCode) {
  let dataUrl, data;
  try {
    const res = await fetch(`${AEMET_ENDPOINT}/prediccion/provincia/manana/${provinceCode}`, {
      headers: {
        api_key: AEMET_API_KEY,
      },
    });
    dataUrl = await res.json();
  } catch (Error) {
    console.log('Error during aemet first fetch');
  }
  try {
    const res = await fetch(dataUrl.datos, {
      headers: {
        api_key: AEMET_API_KEY,
      },
    });
    data = await res.textConverted();
  } catch (Error) {
    console.log('Error during aemet second fetch', Error);
  }
  return (data);
}

async function buildFinalJson(lon, lat, { pollen, provinceCode }) {
  let pollenData;
  const forecastData = await fetchForecast(lon, lat);
  if (pollen) pollenData = await fetchPollen(lon, lat);
  const textForcast = await fetchAemetTextForecast(provinceCode);
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

async function runJob() {
  for (loc of locations) {
    const data = await buildFinalJson(loc.lon, loc.lat, { pollen: loc.pollen, provinceCode: loc.provinceCode });
    Fs.writeFileSync(`${loc.name}.json`, JSON.stringify(data));
  };
  process.exit();
}

(async () => {
  await runJob();
})()