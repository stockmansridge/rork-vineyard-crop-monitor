import type { DbVineyard } from '@/providers/VineyardProvider';
import type { WeatherForecast, WeatherSeason, ForecastCurrent } from '@/lib/weather';
import type { NdviSample } from '@/lib/ndvi';
import { isStale } from '@/lib/dataTrust';
import type { RecommendationGrade, RecommendationConfidence } from '@/lib/recommendations';

export type EngineKey =
  | 'irrigation'
  | 'spray'
  | 'frost'
  | 'disease'
  | 'satellite';

export interface DecisionGradeResult {
  grade: RecommendationGrade;
  confidence: RecommendationConfidence;
  blockers: string[];
  defaultsUsed: string[];
  missingInputs: string[];
  notes: string[];
  usedObservedInputs: boolean;
  canBeOperational: boolean;
}

export interface IrrigationGradeInput {
  vineyard: Pick<
    DbVineyard,
    | 'irrigation_app_rate_mm_hr'
    | 'distribution_efficiency_pct'
    | 'crop_coefficient'
    | 'root_zone_depth_cm'
    | 'mad_pct'
    | 'soil_awc_mm_per_m'
    | 'soil_type'
    | 'emitter_spacing_m'
    | 'emitter_flow_lph'
    | 'row_spacing_m'
    | 'vine_spacing_m'
    | 'irrigation_zone'
  >;
  season: WeatherSeason | null;
  forecast: WeatherForecast | null;
  probeMoisturePct: number | null;
  probeObservedAt: string | null;
  isDemo?: boolean;
  desiredState:
    | 'no-irrigation'
    | 'monitor'
    | 'irrigate-48h'
    | 'irrigate-today'
    | 'low-confidence';
}

export interface WeatherGradeInput {
  forecast: WeatherForecast | null;
  current?: ForecastCurrent | null;
  vineyard?: Pick<DbVineyard, 'frost_risk' | 'elevation_m' | 'aspect' | 'disease_prone'> | null;
  isDemo?: boolean;
  severity: 'none' | 'monitor' | 'inspect' | 'elevated' | 'critical';
}

export interface SatelliteGradeInput {
  latest: NdviSample | null;
  sceneQuality: 'good' | 'fair' | 'poor' | 'stale' | 'none';
  sampleCount: number;
  hasBaseline: boolean;
  hasPeers: boolean;
  isDemo?: boolean;
  declineSignal: boolean;
  anomalyRepeated?: boolean;
  corroborated?: boolean;
}

function confidenceFromScore(score: number): RecommendationConfidence {
  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

function finalizeGrade(
  desiredSeverity: 'info' | 'monitor' | 'inspect' | 'advisory' | 'operational',
  canBeOperational: boolean,
  confidence: RecommendationConfidence,
  blockers: string[]
): RecommendationGrade {
  if (blockers.length > 0) return 'insufficient-data';
  if (desiredSeverity === 'info') return 'info';
  if (desiredSeverity === 'monitor') return 'monitor';
  if (desiredSeverity === 'inspect') return 'inspect';
  if (desiredSeverity === 'operational' && canBeOperational && confidence === 'high') {
    return 'operational';
  }
  return 'advisory';
}

export function getIrrigationDecisionGrade(input: IrrigationGradeInput): DecisionGradeResult {
  const blockers: string[] = [];
  const defaultsUsed: string[] = [];
  const missingInputs: string[] = [];
  const notes: string[] = [];

  const v = input.vineyard;

  if (input.isDemo) blockers.push('Demo data — not decision-grade');

  const seasonStale = !input.season || isStale('weather-history', input.season.observedAt);
  const probeFresh =
    !!input.probeObservedAt &&
    !isStale('probe', input.probeObservedAt) &&
    input.probeMoisturePct != null;
  const forecastOk = !!input.forecast && input.forecast.days.length > 0;
  const forecastStale = input.forecast ? isStale('weather-forecast', input.forecast.fetchedAt) : true;

  if (!input.season && !input.forecast && !probeFresh) {
    blockers.push('No weather or probe data available');
  } else if (seasonStale && !probeFresh) {
    blockers.push('Weather history stale and no fresh probe reading');
  }
  if (!forecastOk) {
    notes.push('Forecast not available — projection limited');
  } else if (forecastStale) {
    notes.push('Forecast is stale');
  }

  if (v.irrigation_app_rate_mm_hr == null) {
    defaultsUsed.push('Irrigation application rate');
    missingInputs.push('Irrigation application rate (mm/hr)');
  }
  if (v.distribution_efficiency_pct == null) defaultsUsed.push('Distribution efficiency');
  if (v.crop_coefficient == null) defaultsUsed.push('Crop coefficient (Kc)');
  if (v.root_zone_depth_cm == null) defaultsUsed.push('Root zone depth');
  if (v.mad_pct == null) defaultsUsed.push('MAD threshold');
  if (v.soil_awc_mm_per_m == null) defaultsUsed.push('Soil AWC');
  if (v.soil_type == null) missingInputs.push('Soil type');
  if (v.row_spacing_m == null || v.vine_spacing_m == null) {
    missingInputs.push('Row/vine spacing');
  }
  if (v.emitter_spacing_m == null || v.emitter_flow_lph == null) {
    missingInputs.push('Emitter spacing / flow rate');
  }
  if (v.irrigation_zone == null) missingInputs.push('Irrigation zone');

  // For operational irrigation grade we require:
  // - configured application rate
  // - fresh probe data OR fresh season + fresh forecast
  // - few-to-no defaults on critical agronomy inputs
  const criticalDefaults = defaultsUsed.filter((d) =>
    ['Irrigation application rate', 'Soil AWC', 'Root zone depth'].includes(d)
  );

  const hasGroundTruth = probeFresh;
  const hasFreshWeather = !seasonStale && forecastOk && !forecastStale;

  let score = 0;
  if (hasGroundTruth) score += 0.5;
  if (hasFreshWeather) score += 0.3;
  if (v.irrigation_app_rate_mm_hr != null) score += 0.1;
  if (v.soil_awc_mm_per_m != null) score += 0.05;
  if (criticalDefaults.length === 0) score += 0.05;
  if (defaultsUsed.length > 0) score -= 0.1;

  const confidence = confidenceFromScore(score);

  const canBeOperational =
    blockers.length === 0 &&
    hasGroundTruth &&
    hasFreshWeather &&
    criticalDefaults.length === 0 &&
    input.desiredState !== 'low-confidence';

  if (!canBeOperational && blockers.length === 0) {
    if (!hasGroundTruth) notes.push('No fresh probe data — cannot ground-truth root-zone moisture');
    if (!hasFreshWeather) notes.push('Weather inputs incomplete — projection only');
    if (criticalDefaults.length > 0)
      notes.push(`Using default values for: ${criticalDefaults.join(', ')}`);
  }

  const desiredSeverity: 'info' | 'monitor' | 'inspect' | 'advisory' | 'operational' =
    input.desiredState === 'irrigate-today'
      ? 'operational'
      : input.desiredState === 'irrigate-48h'
      ? 'operational'
      : input.desiredState === 'monitor'
      ? 'monitor'
      : input.desiredState === 'no-irrigation'
      ? 'info'
      : 'inspect';

  const grade = finalizeGrade(desiredSeverity, canBeOperational, confidence, blockers);

  return {
    grade,
    confidence,
    blockers,
    defaultsUsed,
    missingInputs,
    notes,
    usedObservedInputs: probeFresh,
    canBeOperational,
  };
}

export function getSprayDecisionGrade(input: WeatherGradeInput): DecisionGradeResult {
  const blockers: string[] = [];
  const notes: string[] = [];
  const missingInputs: string[] = [];
  const defaultsUsed: string[] = [];

  if (input.isDemo) blockers.push('Demo data — not decision-grade');
  if (!input.forecast || input.forecast.days.length === 0) {
    blockers.push('No forecast available');
  }
  const forecastStale = input.forecast ? isStale('weather-forecast', input.forecast.fetchedAt) : true;
  if (forecastStale && input.forecast) blockers.push('Forecast is stale');

  const today = input.forecast?.days[0];
  const hasWind = today ? Number.isFinite(today.windSpeedMax) : false;
  const hasRain = today ? Number.isFinite(today.precipProbability) && Number.isFinite(today.precipitation) : false;
  if (!hasWind) missingInputs.push('Wind forecast');
  if (!hasRain) missingInputs.push('Rain forecast');
  if (input.current?.humidity == null) defaultsUsed.push('Humidity');

  let score = 0.3;
  if (!forecastStale) score += 0.35;
  if (hasWind && hasRain) score += 0.2;
  if (input.current?.humidity != null) score += 0.1;
  if (input.forecast?.sourceType === 'observed' || input.forecast?.sourceType === 'derived') {
    score += 0.05;
  }

  const confidence = confidenceFromScore(score);

  // Spray is an operational call when forecast is fresh, wind+rain data present,
  // and severity is material (not-suitable / caution). Spray-OK at 'monitor'.
  const canBeOperational =
    blockers.length === 0 && !forecastStale && hasWind && hasRain;

  const severity = input.severity;
  const desiredSeverity: 'info' | 'monitor' | 'inspect' | 'advisory' | 'operational' =
    severity === 'critical' || severity === 'elevated'
      ? 'operational'
      : severity === 'inspect'
      ? 'inspect'
      : severity === 'monitor'
      ? 'monitor'
      : 'info';

  const grade = finalizeGrade(desiredSeverity, canBeOperational, confidence, blockers);

  if (grade === 'advisory') notes.push('Forecast-derived — ground-truth before treatment');

  return {
    grade,
    confidence,
    blockers,
    defaultsUsed,
    missingInputs,
    notes,
    usedObservedInputs: false,
    canBeOperational,
  };
}

export function getFrostDecisionGrade(input: WeatherGradeInput): DecisionGradeResult {
  const blockers: string[] = [];
  const notes: string[] = [];
  const missingInputs: string[] = [];
  const defaultsUsed: string[] = [];

  if (input.isDemo) blockers.push('Demo data — not decision-grade');
  if (!input.forecast || input.forecast.days.length === 0) {
    blockers.push('No forecast available');
  }
  const forecastStale = input.forecast ? isStale('weather-forecast', input.forecast.fetchedAt) : true;
  if (forecastStale && input.forecast) blockers.push('Forecast is stale');

  if (input.vineyard?.elevation_m == null) defaultsUsed.push('Elevation');
  if (input.vineyard?.aspect == null) defaultsUsed.push('Aspect');
  if (input.vineyard?.frost_risk == null) missingInputs.push('Block frost-risk flag');
  if (input.current?.humidity == null) defaultsUsed.push('Current humidity');

  let score = 0.3;
  if (!forecastStale) score += 0.4;
  if (input.vineyard?.frost_risk != null) score += 0.1;
  if (input.vineyard?.elevation_m != null) score += 0.1;
  if (input.current?.humidity != null) score += 0.1;

  const confidence = confidenceFromScore(score);

  // Frost is always advisory at best — overnight forecasts are inherently uncertain.
  const canBeOperational = false;

  const desiredSeverity: 'info' | 'monitor' | 'inspect' | 'advisory' | 'operational' =
    input.severity === 'critical' || input.severity === 'elevated'
      ? 'advisory'
      : input.severity === 'monitor'
      ? 'monitor'
      : 'info';

  const grade = finalizeGrade(desiredSeverity, canBeOperational, confidence, blockers);
  notes.push('Frost outputs stay advisory — forecasts carry overnight uncertainty');

  return {
    grade,
    confidence,
    blockers,
    defaultsUsed,
    missingInputs,
    notes,
    usedObservedInputs: false,
    canBeOperational,
  };
}

export function getDiseaseDecisionGrade(input: WeatherGradeInput): DecisionGradeResult {
  const blockers: string[] = [];
  const notes: string[] = [];
  const missingInputs: string[] = [];
  const defaultsUsed: string[] = [];

  if (input.isDemo) blockers.push('Demo data — not decision-grade');
  if (!input.forecast || input.forecast.days.length === 0) {
    blockers.push('No forecast available');
  }
  const forecastStale = input.forecast ? isStale('weather-forecast', input.forecast.fetchedAt) : true;
  if (forecastStale && input.forecast) blockers.push('Forecast is stale');

  if (input.current?.humidity == null) defaultsUsed.push('Humidity');
  if (input.vineyard?.disease_prone == null) missingInputs.push('Block disease-prone flag');
  // Leaf wetness proxy not yet tracked — always a default
  defaultsUsed.push('Leaf wetness (proxy only)');

  let score = 0.25;
  if (!forecastStale) score += 0.3;
  if (input.current?.humidity != null) score += 0.15;
  if (input.vineyard?.disease_prone != null) score += 0.1;

  const confidence = confidenceFromScore(score);

  // Disease model is generic, not pathogen-specific — never operational.
  const canBeOperational = false;

  const desiredSeverity: 'info' | 'monitor' | 'inspect' | 'advisory' | 'operational' =
    input.severity === 'critical'
      ? 'inspect'
      : input.severity === 'elevated'
      ? 'advisory'
      : input.severity === 'inspect'
      ? 'inspect'
      : input.severity === 'monitor'
      ? 'monitor'
      : 'info';

  const grade = finalizeGrade(desiredSeverity, canBeOperational, confidence, blockers);
  notes.push('Generic disease-supportive proxy — recommend field inspection before treatment');

  return {
    grade,
    confidence,
    blockers,
    defaultsUsed,
    missingInputs,
    notes,
    usedObservedInputs: false,
    canBeOperational,
  };
}

export function getSatelliteDecisionGrade(input: SatelliteGradeInput): DecisionGradeResult {
  const blockers: string[] = [];
  const notes: string[] = [];
  const missingInputs: string[] = [];
  const defaultsUsed: string[] = [];

  if (input.isDemo) blockers.push('Demo data — not decision-grade');
  if (!input.latest) blockers.push('No imagery available');
  if (input.latest?.sourceType === 'simulated') blockers.push('Simulated fallback imagery');
  if (input.sceneQuality === 'stale') blockers.push('Scene past its useful window');
  if (input.sceneQuality === 'poor') blockers.push('Scene quality too poor for decision-grade');
  if (input.sceneQuality === 'none') blockers.push('No scene available');

  if (!input.hasBaseline) defaultsUsed.push('Block baseline (not enough prior scenes)');
  if (!input.hasPeers) defaultsUsed.push('Peer comparison (no comparable blocks)');
  if (input.sampleCount < 3) missingInputs.push('Historical scenes (need ≥3 for trend)');
  if (input.sampleCount < 5) missingInputs.push('Baseline history (need ≥5 scenes for a stable baseline)');

  let score = 0.2;
  if (input.sceneQuality === 'good') score += 0.4;
  else if (input.sceneQuality === 'fair') score += 0.15;
  if (input.hasBaseline) score += 0.15;
  if (input.hasPeers) score += 0.1;
  if (input.sampleCount >= 5) score += 0.1;
  if (input.corroborated) score += 0.05;

  const confidence = confidenceFromScore(score);

  // Satellite indices inform scouting — treat as advisory at best.
  const canBeOperational = false;

  // Tighter severity ladder: most satellite outputs should resolve to monitor
  // or inspect. Only corroborated anomalies on good, well-referenced scenes
  // can earn 'inspect'; everything else stays advisory or softer.
  const strongScene =
    input.sceneQuality === 'good' && input.hasBaseline && input.sampleCount >= 5;
  const canInspect = strongScene && (input.corroborated === true || input.anomalyRepeated === true);

  const desiredSeverity: 'info' | 'monitor' | 'inspect' | 'advisory' | 'operational' =
    input.declineSignal
      ? canInspect
        ? 'inspect'
        : input.sceneQuality === 'good'
        ? 'advisory'
        : 'monitor'
      : 'monitor';

  const grade = finalizeGrade(desiredSeverity, canBeOperational, confidence, blockers);
  if (blockers.length === 0) {
    notes.push('Satellite signals support scouting — not standalone operational decisions');
    if (input.declineSignal && !canInspect) {
      notes.push('Single-source or weakly referenced signal — keep as advisory until corroborated');
    }
  }

  return {
    grade,
    confidence,
    blockers,
    defaultsUsed,
    missingInputs,
    notes,
    usedObservedInputs: input.sceneQuality === 'good' && input.latest?.sourceType !== 'simulated',
    canBeOperational,
  };
}

export function summarizeGradeNotes(result: DecisionGradeResult): string[] {
  const out: string[] = [];
  if (result.blockers.length > 0) {
    out.push(`Blockers: ${result.blockers.join(', ')}`);
  }
  if (result.defaultsUsed.length > 0) {
    out.push(`Using defaults for: ${result.defaultsUsed.join(', ')}`);
  }
  if (result.missingInputs.length > 0) {
    out.push(`Missing: ${result.missingInputs.join(', ')}`);
  }
  out.push(...result.notes);
  return out;
}
