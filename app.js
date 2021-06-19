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
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

const TOMORROWIO_ENDPOINT = '';
const AEMET_ENDPOINT = '';
const WEATHERAPI_ENDPOINT = `http://api.weatherapi.com/v1`;
const OPENWEATHERMAP_ENDPOINT = `https://api.openweathermap.org/data/2.5/onecall?appid=${OPENWEATHERMAP_API_KEY}&units=metric`;

const locations = [
  {
    name: 'colmenar-viejo',
    lon: '-3.7750177',
    lat: '40.666554',
    pollen: true,
  }
];

function transformCurrent(data) {
  console.log(">>", data)
  return ({
    visibility: data.vis_km,
    temperature: data.temp_c,
    condition: data.condition.code,
    feels_like: data.feelslike_c,
    precipitation: data.precip_mm,
    pressure: data.pressure_mb,
    wind_speed: data.wind_kph,
    wind_gust_speed: data.gust_kph,
    wind_direction: data.wind_degree,
    humidity: data.humidity,
    cloud_cover: data.cloud,
    uv: data.uv,
    air_quality: {
      co: data['air_quality'].co,
      no2: data['air_quality'].no2,
      o3: data['air_quality'].o3,
      so2: data['air_quality'].so2,
      pm2_5: data['air_quality'].pm2_5,
      pm10: data['air_quality'].pm10,
      'us-epa-index': data['air_quality']['us-epa-index'],
      'gb-defra-index': data['air_quality']['gb-defra-index']
    },
  });
}


async function fetchWeatherApi(lon, lat) {
  let currentData;
  let forecastData;
  try {
    const res = await fetch(`${WEATHERAPI_ENDPOINT}/current.json?key=${WEATHER_API_KEY}&q=${lat},${lon}&aqi=yes`);
    currentData = await res.json();
    currentData = transformCurrent(currentData.current);
  } catch (Error) {
    console.log('Error during weatherapi current fetch');
  }

  try {
    const res = await fetch(`${WEATHERAPI_ENDPOINT}/forecast.json?key=${WEATHER_API_KEY}&days=7&q=${lat},${lon}&aqi=yes`);
    forecastData = await res.json();
  } catch (Error) {
    console.log('Error during weatherapi forecast fetch');
  }
  return ({
    current: currentData,
    forecast: forecastData,
  });
}

async function buildFinalJson(lon, lat) {
  const weatherapi = await fetchWeatherApi(lon, lat);
  console.log(weatherapi);
  return({
    ts: new Date().getTime(),
    data: {
      lon,
      lat,
      ...weatherapi,
    }
  });
}

async function runJob() {
  for (loc of locations) {
    console.log(await buildFinalJson(loc.lon, loc.lat));
  };
  process.exit();
}

(async () => {
  await runJob();
})()