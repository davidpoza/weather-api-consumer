const dotenv = require('dotenv');
dotenv.config();

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

const LEVEL_1 = 'preaviso';
const LEVEL_2 = 'aviso';
const LEVEL_3 = 'alerta';

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

module.exports = {
  locations,
  LEVEL_1,
  LEVEL_2,
  LEVEL_3,
  FTP_HOST,
  FTP_USER,
  FTP_PASSWORD,
  FTP_BASE_PATH,
  LOCAL_PATH,
  OPENWEATHERMAP_API_KEY,
  TOMORROWIO_API_KEY,
  AEMET_API_KEY,
  TOMORROWIO_ENDPOINT,
  AEMET_ENDPOINT,
  OPENWEATHERMAP_ENDPOINT
};