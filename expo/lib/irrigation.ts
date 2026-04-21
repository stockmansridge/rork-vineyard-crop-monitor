import type { DbVineyard } from '@/providers/VineyardProvider';
import type { WeatherForecast, WeatherSeason, DailyWeather, ForecastDay } from '@/lib/weather';
import { evaluateTrust, isStale, type DataTrust } from '@/lib/dataTrust';
import { getIrrigationDecisionGrade } from '@/lib/decisionGrade';

export type IrrigationState =
  | 'no-irrigation'
  | 'monitor'
  | 'irrigate-48h'
  | 'irrigate-today'
  | 'low-confidence';

export type IrrigationUrgency = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type IrrigationConfidence = 'high' | 'medium' | 'low';

export interface DailyBalanceDay {
  date: string;
  rainMm: number;
  effectiveRainMm: number;
  etoMm: number;
  etcMm: number;
  tMeanC: number;
  deficitMm: number;
  cumulativeDeficitMm: number;
  isForecast: boolean;
}

export interface IrrigationReasoning {
  label: string;
  value: string;
  impact?: 'positive' | 'negative' | 'neutral';
}

export interface IrrigationRecommendation {
  vineyardId: string;
  vineyardName: string;
  state: IrrigationState;
  urgency: IrrigationUrgency;
  confidence: IrrigationConfidence;
  headline: string;
  detail: string;
  currentDeficitMm: number;
  forecastRainMm48h: number;
  forecastRainMm7d: number;
  etcRecent7dMm: number;
  suggestedApplicationMm: number;
  suggestedRunHours: number | null;
  mad_mm: number;
  awc_mm: number;
  reasoning: IrrigationReasoning[];
  usedProbeData: boolean;
  rainChangedDecision: boolean;
  generatedAt: string;
  trust: DataTrust;
  missingInputs: string[];
  history: DailyBalanceDay[];
  appRateMmHr: number | null;
  distributionEfficiency: number;
  gradeResult: import('@/lib/decisionGrade').DecisionGradeResult;
}

export interface IrrigationInput {
  vineyard: DbVineyard;
  season: WeatherSeason | null;
  forecast: WeatherForecast | null;
  probeMoisturePct: number | null;
  probeObservedAt: string | null;
  isDemoMode?: boolean;
}

const DEFAULTS = {
  kc: 0.65,
  rootZoneCm: 60,
  madPct: 50,
  awcMmPerM: 140,
  appRateMmHr: 3.5,
  distributionEff: 0.85,
};

function effectiveRain(rain: number): number {
  if (rain <= 0) return 0;
  if (rain <= 5) return rain * 0.6;
  if (rain <= 25) return 5 * 0.6 + (rain - 5) * 0.8;
  return 5 * 0.6 + 20 * 0.8 + (rain - 25) * 0.5;
}

function approxEto(tMean: number, tMax: number, tMin: number): number {
  if (!Number.isFinite(tMean) || !Number.isFinite(tMax) || !Number.isFinite(tMin)) return 0;
  const range = Math.max(0, tMax - tMin);
  const eto = 0.0023 * (tMean + 17.8) * Math.sqrt(range) * 16;
  return Math.max(0, Math.min(12, eto));
}

function cropCoefficientFor(vineyard: DbVineyard): number {
  if (vineyard.crop_coefficient != null && vineyard.crop_coefficient > 0) {
    return Math.min(1.2, Math.max(0.2, vineyard.crop_coefficient));
  }
  return DEFAULTS.kc;
}

export function computeIrrigation(input: IrrigationInput): IrrigationRecommendation {
  const { vineyard, season, forecast, probeMoisturePct, probeObservedAt } = input;
  const now = new Date();
  const nowIso = now.toISOString();

  const kc = cropCoefficientFor(vineyard);
  const rootZoneCm = vineyard.root_zone_depth_cm ?? DEFAULTS.rootZoneCm;
  const madPct = vineyard.mad_pct ?? DEFAULTS.madPct;
  const awcMmPerM = vineyard.soil_awc_mm_per_m ?? DEFAULTS.awcMmPerM;
  const appRateMmHr = vineyard.irrigation_app_rate_mm_hr ?? null;
  const distributionEff = (vineyard.distribution_efficiency_pct ?? DEFAULTS.distributionEff * 100) / 100;

  const awc_mm = (awcMmPerM * rootZoneCm) / 100;
  const mad_mm = awc_mm * (madPct / 100);

  const missingInputs: string[] = [];
  if (vineyard.irrigation_app_rate_mm_hr == null && appRateMmHr == null) {
    missingInputs.push('Irrigation application rate');
  }
  if (vineyard.soil_type == null) missingInputs.push('Soil type');
  if (vineyard.row_spacing_m == null || vineyard.vine_spacing_m == null) {
    missingInputs.push('Row/vine spacing');
  }

  const historyWindowDays = 14;
  const seasonDays: DailyWeather[] = season?.days ?? [];
  const recent = seasonDays.slice(-historyWindowDays);

  const historyEntries: DailyBalanceDay[] = recent.map((d) => {
    const eto = approxEto(d.tMean, d.tMax, d.tMin);
    const etc = eto * kc;
    const effR = effectiveRain(d.precipitation);
    return {
      date: d.date,
      rainMm: d.precipitation,
      effectiveRainMm: effR,
      etoMm: eto,
      etcMm: etc,
      tMeanC: d.tMean,
      deficitMm: etc - effR,
      cumulativeDeficitMm: 0,
      isForecast: false,
    };
  });

  // Running deficit clamped to [0, awc_mm] over recent window
  let running = 0;
  for (const entry of historyEntries) {
    running = Math.max(0, Math.min(awc_mm, running + entry.deficitMm));
    entry.cumulativeDeficitMm = running;
  }

  const etcRecent7dMm = historyEntries.slice(-7).reduce((a, b) => a + b.etcMm, 0);

  // Forecast block
  const forecastDays: ForecastDay[] = forecast?.days ?? [];
  const forecastEntries: DailyBalanceDay[] = forecastDays.slice(0, 7).map((d) => {
    const tMean = (d.tMax + d.tMin) / 2;
    const eto = approxEto(tMean, d.tMax, d.tMin);
    const etc = eto * kc;
    const effR = effectiveRain(d.precipitation);
    return {
      date: d.date,
      rainMm: d.precipitation,
      effectiveRainMm: effR,
      etoMm: eto,
      etcMm: etc,
      tMeanC: tMean,
      deficitMm: etc - effR,
      cumulativeDeficitMm: 0,
      isForecast: true,
    };
  });

  const forecastRainMm48h = forecastEntries.slice(0, 2).reduce((a, b) => a + b.rainMm, 0);
  const forecastEffRain48h = forecastEntries.slice(0, 2).reduce((a, b) => a + b.effectiveRainMm, 0);
  const forecastRainMm7d = forecastEntries.reduce((a, b) => a + b.rainMm, 0);

  let currentDeficitMm = running;
  // Blend with probe data when available and fresh
  let usedProbeData = false;
  const probeFresh = !!probeObservedAt && !isStale('probe', probeObservedAt);
  if (probeFresh && probeMoisturePct != null && awc_mm > 0) {
    // Map moisture% to available water remaining.
    // Assume field capacity ~35%, wilting point ~12% for a loam baseline.
    const fc = 35;
    const wp = 12;
    const avail = Math.max(0, Math.min(1, (probeMoisturePct - wp) / (fc - wp)));
    const probeDeficit = awc_mm * (1 - avail);
    currentDeficitMm = 0.6 * probeDeficit + 0.4 * running;
    usedProbeData = true;
  }

  // Decision logic
  let state: IrrigationState = 'monitor';
  let urgency: IrrigationUrgency = 'low';
  let confidence: IrrigationConfidence = 'medium';
  let headline = '';
  let detail = '';
  let rainChangedDecision = false;

  const seasonStale = !season || isStale('weather-history', season.observedAt);
  const forecastOk = !!forecast && forecastEntries.length > 0;

  const projectedDeficit48h = Math.max(
    0,
    currentDeficitMm + (forecastEntries[0]?.etcMm ?? 0) + (forecastEntries[1]?.etcMm ?? 0) - forecastEffRain48h
  );

  if (!season && !forecast && !probeFresh) {
    state = 'low-confidence';
    urgency = 'none';
    confidence = 'low';
    headline = 'Insufficient data for irrigation recommendation';
    detail = 'Add a location, wait for weather history, or install a soil probe to enable irrigation recommendations.';
  } else if (seasonStale && !probeFresh) {
    state = 'low-confidence';
    urgency = 'low';
    confidence = 'low';
    headline = 'Waiting on fresher data';
    detail = 'Confidence reduced due to stale weather history and no fresh probe readings. Advisory only — not decision-grade.';
  } else {
    const preRainDeficit = currentDeficitMm;
    if (preRainDeficit >= mad_mm && forecastEffRain48h >= mad_mm * 0.8) {
      rainChangedDecision = true;
    }

    if (currentDeficitMm >= mad_mm && forecastEffRain48h < mad_mm * 0.5) {
      state = 'irrigate-today';
      urgency = currentDeficitMm >= mad_mm * 1.4 ? 'critical' : 'high';
      headline = `Recommended: irrigate ${vineyard.name} today`;
      detail = `Soil water deficit of ${currentDeficitMm.toFixed(1)} mm has reached the management threshold (${mad_mm.toFixed(1)} mm). Based on current forecast, rain is insufficient to close the gap.`;
    } else if (projectedDeficit48h >= mad_mm && forecastRainMm48h < 5) {
      state = 'irrigate-48h';
      urgency = 'medium';
      headline = `Plan irrigation within 48h · ${vineyard.name}`;
      detail = `Based on current forecast, projected deficit in 48h is ${projectedDeficit48h.toFixed(1)} mm with little rain expected.`;
    } else if (forecastEffRain48h >= mad_mm * 0.8 && currentDeficitMm < mad_mm * 1.2) {
      state = 'no-irrigation';
      urgency = 'none';
      headline = `Hold irrigation · ${vineyard.name}`;
      detail = `${forecastRainMm48h.toFixed(0)} mm rain expected in 48h should recharge the root zone. Re-evaluate after the rain event.`;
      if (preRainDeficit >= mad_mm) rainChangedDecision = true;
    } else if (currentDeficitMm < mad_mm * 0.4) {
      state = 'no-irrigation';
      urgency = 'none';
      headline = `Root zone looks adequate · ${vineyard.name}`;
      detail = `Current deficit (${currentDeficitMm.toFixed(1)} mm) is well below the management threshold.`;
    } else {
      state = 'monitor';
      urgency = 'low';
      headline = `Monitor ${vineyard.name}`;
      detail = `Deficit at ${currentDeficitMm.toFixed(1)} mm (threshold ${mad_mm.toFixed(1)} mm). Monitor and re-check after next weather update.`;
    }

    // Confidence
    if (usedProbeData && !seasonStale && forecastOk) confidence = 'high';
    else if (!seasonStale && forecastOk) confidence = 'medium';
    else confidence = 'low';
  }

  // Suggested application: refill to ~80% of MAD above current
  const targetRefillMm =
    state === 'irrigate-today' || state === 'irrigate-48h'
      ? Math.max(5, Math.min(awc_mm * 0.8, Math.max(0, currentDeficitMm - forecastEffRain48h * 0.5)))
      : 0;
  const suggestedApplicationMm = Math.round(targetRefillMm * 10) / 10;
  const suggestedRunHours =
    appRateMmHr && appRateMmHr > 0 && suggestedApplicationMm > 0
      ? Math.round((suggestedApplicationMm / (appRateMmHr * distributionEff)) * 10) / 10
      : null;

  const reasoning: IrrigationReasoning[] = [
    {
      label: 'Current deficit',
      value: `${currentDeficitMm.toFixed(1)} mm / ${mad_mm.toFixed(1)} mm MAD`,
      impact: currentDeficitMm >= mad_mm ? 'negative' : 'neutral',
    },
    {
      label: '7-day ETc',
      value: `${etcRecent7dMm.toFixed(1)} mm (Kc ${kc.toFixed(2)})`,
    },
    {
      label: 'Forecast rain (48h)',
      value: `${forecastRainMm48h.toFixed(1)} mm · effective ${forecastEffRain48h.toFixed(1)} mm`,
      impact: forecastEffRain48h >= mad_mm * 0.5 ? 'positive' : 'neutral',
    },
    {
      label: 'Forecast rain (7d)',
      value: `${forecastRainMm7d.toFixed(1)} mm`,
    },
    {
      label: 'Probe input',
      value: usedProbeData
        ? `Used · ${probeMoisturePct?.toFixed(0)}% moisture`
        : probeObservedAt
        ? 'Stale — not used'
        : 'No probe data',
      impact: usedProbeData ? 'positive' : 'neutral',
    },
    {
      label: 'Available water capacity',
      value: `${awc_mm.toFixed(0)} mm in ${rootZoneCm}cm root zone`,
    },
  ];

  if (rainChangedDecision) {
    reasoning.push({
      label: 'Rain impact',
      value: 'Forecast rain changed the recommendation',
      impact: 'positive',
    });
  }

  if (missingInputs.length > 0) {
    reasoning.push({
      label: 'Missing inputs',
      value: missingInputs.join(', '),
      impact: 'negative',
    });
  }

  const combinedHistory = [...historyEntries, ...forecastEntries];

  const gradeResult = getIrrigationDecisionGrade({
    vineyard,
    season,
    forecast,
    probeMoisturePct,
    probeObservedAt,
    isDemo: input.isDemoMode,
    desiredState: state,
  });

  const trust = evaluateTrust({
    sourceType: usedProbeData ? 'derived' : season ? 'derived' : 'estimated',
    sourceName: usedProbeData
      ? 'Water balance + soil probe'
      : season
      ? `Water balance · ${season.sourceName}`
      : 'Forecast water balance',
    observedAt: usedProbeData ? probeObservedAt : season?.observedAt ?? forecast?.fetchedAt ?? null,
    scopeType: 'block',
    methodVersion: 'irrigation-wb-v1',
    kind: 'irrigation',
    isDemo: input.isDemoMode,
    baseQuality:
      confidence === 'high' ? 'high' : confidence === 'medium' ? 'medium' : 'low',
    note:
      state === 'low-confidence'
        ? 'Insufficient data — advisory only.'
        : 'FAO-56 style water balance. Advisory for scheduling.',
  });

  return {
    vineyardId: vineyard.id,
    vineyardName: vineyard.name,
    state,
    urgency,
    confidence,
    headline,
    detail,
    currentDeficitMm,
    forecastRainMm48h,
    forecastRainMm7d,
    etcRecent7dMm,
    suggestedApplicationMm,
    suggestedRunHours,
    mad_mm,
    awc_mm,
    reasoning,
    usedProbeData,
    rainChangedDecision,
    generatedAt: nowIso,
    trust,
    missingInputs,
    history: combinedHistory,
    appRateMmHr,
    distributionEfficiency: distributionEff,
    gradeResult,
  };
}

import type { Recommendation } from '@/lib/recommendations';

export function toRecommendation(rec: IrrigationRecommendation): Recommendation | null {
  if (rec.state === 'no-irrigation' && rec.urgency === 'none') {
    return null;
  }
  if (rec.state === 'low-confidence') return null;
  const priority: Recommendation['priority'] =
    rec.urgency === 'critical' || rec.urgency === 'high'
      ? 'high'
      : rec.urgency === 'medium'
      ? 'medium'
      : 'low';
  const kind: Recommendation['kind'] = rec.state === 'no-irrigation' ? 'hold-irrigation' : 'irrigate';
  const runTxt = rec.suggestedRunHours != null
    ? ` → ~${rec.suggestedRunHours.toFixed(1)}h / ${rec.suggestedApplicationMm.toFixed(1)}mm`
    : rec.suggestedApplicationMm > 0
    ? ` → ${rec.suggestedApplicationMm.toFixed(1)}mm`
    : '';
  const gate = rec.gradeResult;
  const grade: Recommendation['grade'] = gate?.grade ?? 'advisory';
  const effectiveConfidence: Recommendation['confidence'] = gate?.confidence ?? rec.confidence;
  return {
    id: `irr-${rec.vineyardId}-${rec.state}`,
    kind,
    priority,
    confidence: effectiveConfidence,
    grade,
    title: rec.headline,
    reason: `${rec.detail}${runTxt}`,
    vineyardId: rec.vineyardId,
    vineyardName: rec.vineyardName,
    timestamp: rec.generatedAt,
    action: { label: 'Open block', route: `/field-detail?id=${rec.vineyardId}` },
    trustNote: rec.usedProbeData ? 'Water balance + probe' : 'Water balance · forecast',
    logicSummary:
      'FAO-56 style water balance: effective rain minus crop water use, bounded by the management-allowable depletion (MAD) threshold.' +
      (gate && gate.defaultsUsed.length > 0
        ? ` Confidence reduced — using defaults for: ${gate.defaultsUsed.join(', ')}.`
        : ''),
    inputs: [
      ...rec.reasoning.map((r) => ({ label: r.label, value: r.value, impact: r.impact })),
      ...(gate?.defaultsUsed.length
        ? [{ label: 'Defaults in use', value: gate.defaultsUsed.join(', '), impact: 'negative' as const }]
        : []),
      ...(gate?.missingInputs.length
        ? [{ label: 'Missing inputs', value: gate.missingInputs.join(', '), impact: 'negative' as const }]
        : []),
    ],
    freshnessNote: rec.usedProbeData ? 'Includes fresh probe input' : 'Forecast-only water balance',
  };
}

export function urgencyColor(u: IrrigationUrgency): {
  color: string;
  label: string;
} {
  switch (u) {
    case 'critical':
      return { color: '#EF4444', label: 'Critical' };
    case 'high':
      return { color: '#F59E0B', label: 'High' };
    case 'medium':
      return { color: '#38BDF8', label: 'Medium' };
    case 'low':
      return { color: '#8BA496', label: 'Low' };
    case 'none':
      return { color: '#4ADE80', label: 'No action' };
  }
}
