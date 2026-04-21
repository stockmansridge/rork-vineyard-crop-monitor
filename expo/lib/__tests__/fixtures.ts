import type { DbVineyard } from '@/providers/VineyardProvider';
import type {
  WeatherForecast,
  WeatherSeason,
  ForecastDay,
  DailyWeather,
} from '@/lib/weather';
import type { NdviSample } from '@/lib/ndvi';
import type { DbScoutTask } from '@/lib/scoutTasks';
import type { DbBlockSeason } from '@/providers/BlockSeasonsProvider';
import type { DbIndexReading } from '@/providers/IndexReadingsProvider';

export function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

export function daysAgo(d: number): string {
  return new Date(Date.now() - d * 24 * 3_600_000).toISOString();
}

export function dateOnlyFromNow(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 24 * 3_600_000);
  return d.toISOString().slice(0, 10);
}

export function buildVineyard(overrides: Partial<DbVineyard> = {}): DbVineyard {
  return {
    id: 'vine-1',
    owner_id: 'owner-1',
    name: 'Test Block',
    variety: 'Shiraz',
    area: 2.5,
    area_unit: 'ha',
    latitude: -34.5,
    longitude: 150.5,
    polygon_coords: [
      { latitude: -34.5, longitude: 150.5 },
      { latitude: -34.501, longitude: 150.5 },
      { latitude: -34.501, longitude: 150.501 },
      { latitude: -34.5, longitude: 150.501 },
    ],
    planting_date: '2012-09-01',
    health_score: 80,
    last_scan: hoursAgo(48),
    image_url: null,
    created_at: daysAgo(365),
    updated_at: hoursAgo(2),

    // agronomy defaults — "fully configured"
    clone: '470',
    rootstock: '101-14',
    row_spacing_m: 2.5,
    vine_spacing_m: 1.5,
    training_system: 'VSP',
    pruning_type: 'cane',
    irrigation_type: 'drip',
    irrigation_zone: 'Zone A',
    emitter_spacing_m: 0.5,
    emitter_flow_lph: 2.2,
    soil_type: 'sandy loam',
    subsoil_notes: null,
    drainage_notes: 'good',
    slope_pct: 4,
    aspect: 'N',
    elevation_m: 250,
    frost_risk: false,
    heat_exposure: true,
    disease_prone: false,
    low_vigor_history: false,
    waterlogging_risk: false,
    target_yield_t_per_ha: 8,
    normal_harvest_start: null,
    normal_harvest_end: null,
    block_notes: null,
    irrigation_app_rate_mm_hr: 3.2,
    distribution_efficiency_pct: 88,
    crop_coefficient: 0.7,
    root_zone_depth_cm: 70,
    mad_pct: 45,
    soil_awc_mm_per_m: 150,
    ...overrides,
  };
}

export function buildDailyWeather(
  date: string,
  overrides: Partial<DailyWeather> = {}
): DailyWeather {
  return {
    date,
    tMax: 28,
    tMin: 14,
    tMean: 21,
    precipitation: 0,
    gdd: 11,
    ...overrides,
  };
}

export function buildSeason(
  overrides: Partial<WeatherSeason> = {}
): WeatherSeason {
  const days: DailyWeather[] = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date(Date.now() - (13 - i) * 24 * 3_600_000);
    return buildDailyWeather(d.toISOString().slice(0, 10), {
      tMax: 30,
      tMin: 15,
      tMean: 22.5,
      precipitation: i % 5 === 0 ? 3 : 0,
    });
  });
  return {
    seasonStart: daysAgo(120).slice(0, 10),
    today: days[days.length - 1].date,
    days,
    cumulativeGdd: 1500,
    gddToday: 12,
    avgTemp: 22,
    totalPrecip: 90,
    chillingHours: 250,
    sourceName: 'Open-Meteo Archive',
    sourceType: 'derived',
    observedAt: hoursAgo(2),
    ...overrides,
  };
}

export function buildForecastDay(
  offsetDays: number,
  overrides: Partial<ForecastDay> = {}
): ForecastDay {
  return {
    date: dateOnlyFromNow(offsetDays),
    tMax: 28,
    tMin: 14,
    precipitation: 0,
    precipProbability: 10,
    windSpeedMax: 10,
    weatherCode: 1,
    ...overrides,
  };
}

export function buildForecast(
  overrides: Partial<WeatherForecast> = {}
): WeatherForecast {
  return {
    current: {
      temperature: 22,
      humidity: 55,
      windSpeed: 8,
      weatherCode: 1,
      time: hoursAgo(0),
    },
    days: Array.from({ length: 7 }).map((_, i) => buildForecastDay(i)),
    frostRisk: false,
    nextFrostDate: null,
    sourceName: 'Open-Meteo Forecast',
    sourceType: 'derived',
    fetchedAt: hoursAgo(1),
    ...overrides,
  };
}

export function buildNdviSample(
  overrides: Partial<NdviSample> = {}
): NdviSample {
  return {
    acquiredAt: daysAgo(3),
    value: 0.72,
    source: 'sentinel-2',
    sceneId: 'S2-abc',
    cloudCover: 5,
    sourceType: 'derived',
    ...overrides,
  };
}

export function buildScoutTask(overrides: Partial<DbScoutTask> = {}): DbScoutTask {
  const now = new Date().toISOString();
  return {
    id: `task-${Math.random().toString(36).slice(2, 9)}`,
    vineyard_id: 'vine-1',
    owner_id: 'owner-1',
    trigger_kind: 'irrigation',
    trigger_rec_id: null,
    title: 'Check irrigation',
    reason: null,
    urgency: 'medium',
    confidence: 'medium',
    status: 'resolved',
    check_points: null,
    inspected_at: now,
    outcome: 'confirmed',
    action_taken: null,
    action_at: now,
    performed_by: null,
    resolution_notes: null,
    photos: null,
    pins: null,
    observations: null,
    follow_up_at: null,
    follow_up_result: null,
    follow_up_notes: null,
    effectiveness: 'effective',
    created_by: null,
    updated_by: null,
    source_inputs: null,
    created_at: daysAgo(5),
    updated_at: now,
    ...overrides,
  };
}

export function buildBlockSeason(
  overrides: Partial<DbBlockSeason> = {}
): DbBlockSeason {
  return {
    id: 'bs-1',
    vineyard_id: 'vine-1',
    owner_id: 'owner-1',
    season: new Date().getUTCFullYear(),
    budburst_date: daysAgo(60).slice(0, 10),
    flowering_date: daysAgo(30).slice(0, 10),
    fruit_set_date: null,
    veraison_date: null,
    harvest_date: null,
    target_yield_t_per_ha: 8,
    actual_yield_t_per_ha: null,
    notes: null,
    created_at: daysAgo(60),
    updated_at: daysAgo(1),
    ...overrides,
  };
}

export function buildIndexReading(
  overrides: Partial<DbIndexReading> = {}
): DbIndexReading {
  return {
    id: `ix-${Math.random().toString(36).slice(2, 9)}`,
    vineyard_id: 'vine-1',
    owner_id: 'owner-1',
    index_type: 'NDVI',
    value: 0.7,
    source: 'sentinel-2',
    scene_id: 'S2-xyz',
    cloud_cover: 5,
    acquired_at: daysAgo(5),
    created_at: daysAgo(5),
    ...overrides,
  };
}
