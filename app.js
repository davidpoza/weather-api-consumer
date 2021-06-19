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

const TOMORROWIO_ENDPOINT = '';
const AEMET_ENDPOINT = '';
const OPENWEATHERMAP_ENDPOINT = '';

const locations = [
  {
    name: 'colmenar-viejo',
    lon: '-3.7750177',
    lat: '40.666554',
    pollen: true,
  }
];

function fetchOpenWeatherMap(lon, lat) {

}

async function runJob() {

  process.exit();
}

(async () => {
  await runJob();
})()