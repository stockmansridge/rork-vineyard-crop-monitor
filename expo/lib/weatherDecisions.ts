import type { WeatherForecast, ForecastDay, ForecastCurrent } from '@/lib/weather';
import type { DbVineyard } from '@/providers/VineyardProvider';
import { evaluateTrust, isStale, type DataTrust } from '@/lib/dataTrust';

export type SprayStatus = 'suitable' | 'caution' | 'not-suitable' | 'unknown';
export type FrostStatus = 'none' | 'watch' | 'elevated' | 'critical' | 'unknown';
export type DiseaseStatus = 'low' | 'monitor' | 'elevated' | 'inspect' | 'unknown';
export type DecisionConfidence = 'high' | 'medium' | 'low';

export interface DecisionReason {
  label: string;
  impact: 'positive' | 'neutral' | 'negative';
}

export interface SprayAssessment {
  status: SprayStatus;
  headline: string;
  reasons: DecisionReason[];
  confidence: DecisionConfidence;
  nextWindow: { date: string; label: string } | null;
  trust: DataTrust;
}

export interface FrostAssessment {
  status: FrostStatus;
  headline: string;
  reasons: DecisionReason[];
  confidence: DecisionConfidence;
  coldestNight: { date: string; tMin: number } | null;
  trust: DataTrust;
}

export interface DiseaseAssessment {
  status: DiseaseStatus;
  headline: string;
  reasons: DecisionReason[];
  confidence: DecisionConfidence;
  trust: DataTrust;
}

export interface WeatherDecisions {
  spray: SprayAssessment;
  frost: FrostAssessment;
  disease: DiseaseAssessment;
  forecastStale: boolean;
}

export interface SprayThresholds {
  windMaxKmh: number;
  windCautionKmh: number;
  rainProbMaxPct: number;
  rainProbCautionPct: number;
  rainAmountMm: number;
  tMinC: number;
  tMaxC: number;
}

export const DEFAULT_SPRAY: SprayThresholds = {
  windMaxKmh: 20,
  windCautionKmh: 12,
  rainProbMaxPct: 60,
  rainProbCautionPct: 30,
  rainAmountMm: 2,
  tMinC: 5,
  tMaxC: 30,
};

function classifyDaySpray(day: ForecastDay, t: SprayThresholds): {
  status: SprayStatus;
  reasons: DecisionReason[];
} {
  const reasons: DecisionReason[] = [];
  let worst: SprayStatus = 'suitable';

  if (day.windSpeedMax >= t.windMaxKmh) {
    reasons.push({ label: `Wind ${day.windSpeedMax.toFixed(0)} km/h`, impact: 'negative' });
    worst = 'not-suitable';
  } else if (day.windSpeedMax >= t.windCautionKmh) {
    reasons.push({ label: `Breezy ${day.windSpeedMax.toFixed(0)} km/h`, impact: 'neutral' });
    if (worst === 'suitable') worst = 'caution';
  } else {
    reasons.push({ label: `Calm wind ${day.windSpeedMax.toFixed(0)} km/h`, impact: 'positive' });
  }

  if (day.precipitation >= t.rainAmountMm || day.precipProbability >= t.rainProbMaxPct) {
    reasons.push({
      label: `${day.precipitation.toFixed(0)}mm rain likely (${Math.round(day.precipProbability)}%)`,
      impact: 'negative',
    });
    worst = 'not-suitable';
  } else if (day.precipProbability >= t.rainProbCautionPct) {
    reasons.push({ label: `Rain chance ${Math.round(day.precipProbability)}%`, impact: 'neutral' });
    if (worst === 'suitable') worst = 'caution';
  } else {
    reasons.push({ label: 'Dry forecast', impact: 'positive' });
  }

  if (day.tMax >= t.tMaxC) {
    reasons.push({ label: `Hot ${day.tMax.toFixed(0)}°C — volatility risk`, impact: 'negative' });
    if (worst !== 'not-suitable') worst = 'caution';
  }
  if (day.tMin <= t.tMinC) {
    reasons.push({ label: `Cold min ${day.tMin.toFixed(0)}°C`, impact: 'neutral' });
    if (worst === 'suitable') worst = 'caution';
  }

  return { status: worst, reasons };
}

export function assessSpray(
  forecast: WeatherForecast | null | undefined,
  opts?: { isDemo?: boolean; thresholds?: SprayThresholds }
): SprayAssessment {
  const t = opts?.thresholds ?? DEFAULT_SPRAY;
  const trustBase = evaluateTrust({
    sourceType: forecast?.sourceType ?? 'estimated',
    sourceName: forecast?.sourceName ?? 'No forecast',
    observedAt: forecast?.fetchedAt ?? null,
    scopeType: 'vineyard',
    methodVersion: 'spray-v1',
    kind: 'weather-forecast',
    isDemo: opts?.isDemo,
    note: 'Spray suitability derived from forecast wind, rain and temperature.',
  });

  if (!forecast || forecast.days.length === 0) {
    return {
      status: 'unknown',
      headline: 'No forecast available',
      reasons: [],
      confidence: 'low',
      nextWindow: null,
      trust: trustBase,
    };
  }

  const today = forecast.days[0];
  const todayClass = classifyDaySpray(today, t);

  let nextWindow: { date: string; label: string } | null = null;
  if (todayClass.status !== 'suitable') {
    for (let i = 1; i < forecast.days.length; i++) {
      const c = classifyDaySpray(forecast.days[i], t);
      if (c.status === 'suitable') {
        const d = new Date(forecast.days[i].date);
        nextWindow = {
          date: forecast.days[i].date,
          label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
        };
        break;
      }
    }
  }

  const headline =
    todayClass.status === 'suitable'
      ? 'Spray window looks suitable today'
      : todayClass.status === 'caution'
      ? 'Spray with caution today — marginal conditions'
      : 'Not suitable for spraying today';

  const stale = isStale('weather-forecast', forecast.fetchedAt);
  const confidence: DecisionConfidence = stale ? 'low' : opts?.isDemo ? 'low' : 'medium';

  return {
    status: todayClass.status,
    headline,
    reasons: todayClass.reasons,
    confidence,
    nextWindow,
    trust: trustBase,
  };
}

export function assessFrost(
  forecast: WeatherForecast | null | undefined,
  vineyard: Pick<DbVineyard, 'frost_risk' | 'elevation_m' | 'aspect'> | null,
  opts?: { frostTempC?: number; isDemo?: boolean; currentHumidity?: number | null }
): FrostAssessment {
  const critical = opts?.frostTempC ?? 0;
  const watch = critical + 3;
  const trust = evaluateTrust({
    sourceType: forecast?.sourceType ?? 'estimated',
    sourceName: forecast?.sourceName ?? 'No forecast',
    observedAt: forecast?.fetchedAt ?? null,
    scopeType: 'block',
    methodVersion: 'frost-v1',
    kind: 'weather-forecast',
    isDemo: opts?.isDemo,
    note: 'Frost risk derived from overnight minimum forecast and block flags.',
  });

  if (!forecast || forecast.days.length === 0) {
    return {
      status: 'unknown',
      headline: 'No forecast available',
      reasons: [],
      confidence: 'low',
      coldestNight: null,
      trust,
    };
  }

  const nights = forecast.days.slice(0, 5);
  const coldest = nights.reduce((min, d) => (min == null || d.tMin < min.tMin ? d : min), null as ForecastDay | null);

  let status: FrostStatus = 'none';
  const reasons: DecisionReason[] = [];

  if (coldest) {
    if (coldest.tMin <= critical) status = 'critical';
    else if (coldest.tMin <= critical + 1.5) status = 'elevated';
    else if (coldest.tMin <= watch) status = 'watch';
    else status = 'none';

    reasons.push({
      label: `Min ${coldest.tMin.toFixed(1)}°C on ${coldest.date.slice(5)}`,
      impact: status === 'none' ? 'positive' : 'negative',
    });
  }

  if (vineyard?.frost_risk && status !== 'none') {
    reasons.push({ label: 'Block flagged frost-prone', impact: 'negative' });
    if (status === 'watch') status = 'elevated';
  }

  if (opts?.currentHumidity != null && opts.currentHumidity > 80 && status !== 'none') {
    reasons.push({ label: `High humidity ${Math.round(opts.currentHumidity)}% — radiative frost risk`, impact: 'negative' });
  }

  if (vineyard?.elevation_m != null && vineyard.elevation_m < 400 && status !== 'none') {
    reasons.push({ label: 'Low-lying block — cold-air pooling', impact: 'negative' });
  }

  const headline =
    status === 'critical'
      ? 'Critical frost risk forecast'
      : status === 'elevated'
      ? 'Elevated frost risk'
      : status === 'watch'
      ? 'Frost watch — monitor overnight'
      : 'No frost concern based on current forecast';

  const stale = isStale('weather-forecast', forecast.fetchedAt);
  const confidence: DecisionConfidence = stale ? 'low' : opts?.isDemo ? 'low' : 'medium';

  return {
    status,
    headline,
    reasons,
    confidence,
    coldestNight: coldest ? { date: coldest.date, tMin: coldest.tMin } : null,
    trust,
  };
}

export function assessDisease(
  forecast: WeatherForecast | null | undefined,
  vineyard: Pick<DbVineyard, 'disease_prone'> | null,
  current: ForecastCurrent | null | undefined,
  opts?: { isDemo?: boolean }
): DiseaseAssessment {
  const trust = evaluateTrust({
    sourceType: forecast?.sourceType ?? 'estimated',
    sourceName: forecast?.sourceName ?? 'No forecast',
    observedAt: forecast?.fetchedAt ?? null,
    scopeType: 'block',
    methodVersion: 'disease-generic-v1',
    kind: 'disease',
    isDemo: opts?.isDemo,
    baseQuality: 'medium',
    note: 'General disease-supportive conditions proxy. Not a specific pathogen model.',
  });

  if (!forecast || forecast.days.length === 0) {
    return {
      status: 'unknown',
      headline: 'No forecast available',
      reasons: [],
      confidence: 'low',
      trust,
    };
  }

  const next5 = forecast.days.slice(0, 5);
  const wetDays = next5.filter((d) => d.precipitation >= 2 || d.precipProbability >= 60).length;
  const mildDays = next5.filter((d) => d.tMax >= 18 && d.tMax <= 28 && d.tMin >= 10).length;
  const heavyRainDay = next5.find((d) => d.precipitation >= 15);
  const humid = current?.humidity != null && current.humidity >= 75;

  let score = 0;
  const reasons: DecisionReason[] = [];

  if (wetDays >= 3) {
    score += 2;
    reasons.push({ label: `${wetDays}/5 days with rain — prolonged leaf wetness`, impact: 'negative' });
  } else if (wetDays >= 2) {
    score += 1;
    reasons.push({ label: `${wetDays}/5 days with rain`, impact: 'neutral' });
  } else {
    reasons.push({ label: 'Mostly dry window', impact: 'positive' });
  }

  if (mildDays >= 3) {
    score += 1;
    reasons.push({ label: `${mildDays}/5 days in 18–28°C range`, impact: 'negative' });
  }

  if (humid) {
    score += 1;
    reasons.push({ label: `Humidity ${Math.round(current?.humidity ?? 0)}%`, impact: 'negative' });
  }

  if (heavyRainDay) {
    score += 1;
    reasons.push({
      label: `${heavyRainDay.precipitation.toFixed(0)}mm on ${heavyRainDay.date.slice(5)}`,
      impact: 'negative',
    });
  }

  if (vineyard?.disease_prone) {
    score += 1;
    reasons.push({ label: 'Block flagged disease-prone', impact: 'negative' });
  }

  let status: DiseaseStatus = 'low';
  if (score >= 4) status = 'inspect';
  else if (score >= 3) status = 'elevated';
  else if (score >= 2) status = 'monitor';

  const headline =
    status === 'inspect'
      ? 'Recommended inspection for disease'
      : status === 'elevated'
      ? 'Elevated disease-supportive conditions'
      : status === 'monitor'
      ? 'Monitor disease-supportive conditions'
      : 'Low disease-supportive pressure';

  const stale = isStale('weather-forecast', forecast.fetchedAt);
  const confidence: DecisionConfidence = stale || opts?.isDemo ? 'low' : score >= 3 ? 'medium' : 'low';

  return { status, headline, reasons, confidence, trust };
}

export function assessAll(
  forecast: WeatherForecast | null | undefined,
  vineyard: DbVineyard | null,
  opts?: { isDemo?: boolean; frostTempC?: number; sprayThresholds?: SprayThresholds }
): WeatherDecisions {
  const forecastStale = forecast ? isStale('weather-forecast', forecast.fetchedAt) : true;
  return {
    spray: assessSpray(forecast, { isDemo: opts?.isDemo, thresholds: opts?.sprayThresholds }),
    frost: assessFrost(forecast, vineyard, {
      frostTempC: opts?.frostTempC,
      isDemo: opts?.isDemo,
      currentHumidity: forecast?.current?.humidity ?? null,
    }),
    disease: assessDisease(forecast, vineyard, forecast?.current ?? null, { isDemo: opts?.isDemo }),
    forecastStale,
  };
}

export function sprayStatusColor(status: SprayStatus): { label: string; bg: string; fg: string } {
  switch (status) {
    case 'suitable':
      return { label: 'Spray OK', bg: '#1A4D2E', fg: '#4ADE80' };
    case 'caution':
      return { label: 'Caution', bg: '#3D3015', fg: '#F59E0B' };
    case 'not-suitable':
      return { label: 'Do not spray', bg: '#3D1515', fg: '#EF4444' };
    default:
      return { label: 'Unknown', bg: '#1E3A2B', fg: '#8BA496' };
  }
}

export function frostStatusColor(status: FrostStatus): { label: string; bg: string; fg: string } {
  switch (status) {
    case 'none':
      return { label: 'Clear', bg: '#1A4D2E', fg: '#4ADE80' };
    case 'watch':
      return { label: 'Watch', bg: '#153040', fg: '#38BDF8' };
    case 'elevated':
      return { label: 'Elevated', bg: '#3D3015', fg: '#F59E0B' };
    case 'critical':
      return { label: 'Critical', bg: '#3D1515', fg: '#EF4444' };
    default:
      return { label: 'Unknown', bg: '#1E3A2B', fg: '#8BA496' };
  }
}

export function diseaseStatusColor(status: DiseaseStatus): { label: string; bg: string; fg: string } {
  switch (status) {
    case 'low':
      return { label: 'Low', bg: '#1A4D2E', fg: '#4ADE80' };
    case 'monitor':
      return { label: 'Monitor', bg: '#153040', fg: '#38BDF8' };
    case 'elevated':
      return { label: 'Elevated', bg: '#3D3015', fg: '#F59E0B' };
    case 'inspect':
      return { label: 'Inspect', bg: '#3D1515', fg: '#EF4444' };
    default:
      return { label: 'Unknown', bg: '#1E3A2B', fg: '#8BA496' };
  }
}
