export interface DailyWeather {
  date: string;
  tMax: number;
  tMin: number;
  tMean: number;
  precipitation: number;
  gdd: number;
}

export interface WeatherSeason {
  seasonStart: string;
  today: string;
  days: DailyWeather[];
  cumulativeGdd: number;
  gddToday: number;
  avgTemp: number;
  totalPrecip: number;
  chillingHours: number;
}

export interface ForecastDay {
  date: string;
  tMax: number;
  tMin: number;
  precipitation: number;
  precipProbability: number;
  windSpeedMax: number;
  weatherCode: number;
}

export interface ForecastCurrent {
  temperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  time: string;
}

export interface WeatherForecast {
  current: ForecastCurrent | null;
  days: ForecastDay[];
  frostRisk: boolean;
  nextFrostDate: string | null;
}

const BASE_TEMP_C = 10;
const CHILL_BASE_C = 7.2;

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function getSeasonStart(latitude: number, now: Date = new Date()): Date {
  const southern = latitude < 0;
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  if (southern) {
    const start = new Date(Date.UTC(month >= 9 ? year : year - 1, 9, 1));
    return start;
  }
  const start = new Date(Date.UTC(month >= 3 ? year : year - 1, 3, 1));
  return start;
}

function getDormancyStart(latitude: number, now: Date = new Date()): Date {
  const southern = latitude < 0;
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  if (southern) {
    return new Date(Date.UTC(month >= 3 ? year : year - 1, 3, 1));
  }
  return new Date(Date.UTC(month >= 10 ? year : year - 1, 10, 1));
}

export interface WeatherOptions {
  stationId?: string | null;
  apiKey?: string;
}

async function fetchPwsDailySummary(
  stationId: string,
  apiKey: string,
  startStr: string,
  endStr: string
): Promise<{
  times: string[];
  tMax: number[];
  tMin: number[];
  prec: number[];
} | null> {
  try {
    const url = `https://api.weather.com/v2/pws/history/daily?stationId=${stationId}&format=json&units=m&startDate=${startStr.replace(/-/g, '')}&endDate=${endStr.replace(/-/g, '')}&apiKey=${apiKey}`;
    console.log('[Weather] Fetching PWS', url);
    const res = await fetch(url);
    if (!res.ok) {
      console.log('[Weather] PWS fetch failed', res.status);
      return null;
    }
    const json = (await res.json()) as {
      observations?: Array<{
        obsTimeLocal?: string;
        metric?: {
          tempHigh?: number;
          tempLow?: number;
          precipTotal?: number;
        };
      }>;
    };
    const obs = json.observations ?? [];
    if (obs.length === 0) return null;
    return {
      times: obs.map((o) => (o.obsTimeLocal ?? '').slice(0, 10)),
      tMax: obs.map((o) => o.metric?.tempHigh ?? 0),
      tMin: obs.map((o) => o.metric?.tempLow ?? 0),
      prec: obs.map((o) => o.metric?.precipTotal ?? 0),
    };
  } catch (e) {
    console.log('[Weather] PWS error', e);
    return null;
  }
}

async function fetchHourlyRange(
  latitude: number,
  longitude: number,
  startStr: string,
  endStr: string
): Promise<{ times: string[]; temps: number[] } | null> {
  try {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${startStr}&end_date=${endStr}&hourly=temperature_2m&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      hourly?: { time?: string[]; temperature_2m?: number[] };
    };
    return {
      times: json.hourly?.time ?? [],
      temps: json.hourly?.temperature_2m ?? [],
    };
  } catch (e) {
    console.log('[Weather] hourly fetch error', e);
    return null;
  }
}

export async function fetchSeasonWeather(
  latitude: number,
  longitude: number,
  baseTemp: number = BASE_TEMP_C,
  options?: WeatherOptions
): Promise<WeatherSeason> {
  const now = new Date();
  const seasonStart = getSeasonStart(latitude, now);
  const startStr = formatDate(seasonStart);
  const endStr = formatDate(now);

  let times: string[] = [];
  let tMaxArr: number[] = [];
  let tMinArr: number[] = [];
  let precArr: number[] = [];

  if (options?.stationId && options.apiKey) {
    const pws = await fetchPwsDailySummary(options.stationId, options.apiKey, startStr, endStr);
    if (pws && pws.times.length > 0) {
      times = pws.times;
      tMaxArr = pws.tMax;
      tMinArr = pws.tMin;
      precArr = pws.prec;
    }
  }

  if (times.length === 0) {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${startStr}&end_date=${endStr}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
    console.log('[Weather] Fetching', url);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Weather fetch failed: ${res.status}`);
    }
    const json = (await res.json()) as {
      daily: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_sum: number[];
      };
    };

    times = json.daily?.time ?? [];
    tMaxArr = json.daily?.temperature_2m_max ?? [];
    tMinArr = json.daily?.temperature_2m_min ?? [];
    precArr = json.daily?.precipitation_sum ?? [];
  }

  let cumulativeGdd = 0;
  let sumTemp = 0;
  let tempCount = 0;
  let totalPrecip = 0;
  const days: DailyWeather[] = times.map((date, i) => {
    const tMax = tMaxArr[i] ?? 0;
    const tMin = tMinArr[i] ?? 0;
    const tMean = (tMax + tMin) / 2;
    const gdd = Math.max(0, tMean - baseTemp);
    cumulativeGdd += gdd;
    if (Number.isFinite(tMean)) {
      sumTemp += tMean;
      tempCount += 1;
    }
    const precipitation = precArr[i] ?? 0;
    totalPrecip += precipitation;
    return { date, tMax, tMin, tMean, precipitation, gdd };
  });

  const gddToday = days.length > 0 ? days[days.length - 1].gdd : 0;
  const avgTemp = tempCount > 0 ? sumTemp / tempCount : 0;

  const dormancy = getDormancyStart(latitude, now);
  const dormStr = formatDate(dormancy);
  const hourly = await fetchHourlyRange(latitude, longitude, dormStr, endStr);
  let chillingHours = 0;
  if (hourly) {
    for (const t of hourly.temps) {
      if (Number.isFinite(t) && t > 0 && t <= CHILL_BASE_C) chillingHours += 1;
    }
  }

  return {
    seasonStart: startStr,
    today: endStr,
    days,
    cumulativeGdd,
    gddToday,
    avgTemp,
    totalPrecip,
    chillingHours,
  };
}

export async function fetchForecast(
  latitude: number,
  longitude: number
): Promise<WeatherForecast> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code&forecast_days=7&timezone=auto`;
  console.log('[Weather] forecast', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Forecast failed ${res.status}`);
  const json = (await res.json()) as {
    current?: {
      time: string;
      temperature_2m: number;
      relative_humidity_2m: number;
      wind_speed_10m: number;
      weather_code: number;
    };
    daily?: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_sum: number[];
      precipitation_probability_max: number[];
      wind_speed_10m_max: number[];
      weather_code: number[];
    };
  };
  const d = json.daily;
  const days: ForecastDay[] = (d?.time ?? []).map((date, i) => ({
    date,
    tMax: d?.temperature_2m_max[i] ?? 0,
    tMin: d?.temperature_2m_min[i] ?? 0,
    precipitation: d?.precipitation_sum[i] ?? 0,
    precipProbability: d?.precipitation_probability_max[i] ?? 0,
    windSpeedMax: d?.wind_speed_10m_max[i] ?? 0,
    weatherCode: d?.weather_code[i] ?? 0,
  }));
  const frostDay = days.find((dd) => dd.tMin <= 2);
  return {
    current: json.current
      ? {
          temperature: json.current.temperature_2m,
          humidity: json.current.relative_humidity_2m,
          windSpeed: json.current.wind_speed_10m,
          weatherCode: json.current.weather_code,
          time: json.current.time,
        }
      : null,
    days,
    frostRisk: !!frostDay,
    nextFrostDate: frostDay?.date ?? null,
  };
}

export function weatherCodeToDescription(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: 'Clear', emoji: '☀️' };
  if (code <= 3) return { label: 'Partly cloudy', emoji: '⛅' };
  if (code <= 48) return { label: 'Fog', emoji: '🌫️' };
  if (code <= 57) return { label: 'Drizzle', emoji: '🌦️' };
  if (code <= 67) return { label: 'Rain', emoji: '🌧️' };
  if (code <= 77) return { label: 'Snow', emoji: '🌨️' };
  if (code <= 82) return { label: 'Showers', emoji: '🌧️' };
  if (code <= 86) return { label: 'Snow showers', emoji: '🌨️' };
  if (code <= 99) return { label: 'Thunderstorm', emoji: '⛈️' };
  return { label: 'Unknown', emoji: '❓' };
}
