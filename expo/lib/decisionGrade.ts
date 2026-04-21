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
  | 'satellite'
  | 'drainage';

/**
 * Standard per-engine grading contract.
 *
 * Every engine grader returns this exact shape so downstream consumers
 * (recommendation builders, explainability panels, tests) can treat grades,
 * blockers, defaults, missing inputs and stale inputs uniformly.
 */
export interface DecisionGradeResult {
  grade: RecommendationGrade;
  confidence: RecommendationConfidence;
  /** Hard-blocks on any decision (demo data, no imagery, stale-and-no-probe, etc.). */
  blockers: string[];
  /** Human-readable list of agronomic or model inputs that fell back to defaults. */
  usedDefaults: string[];
  /** Required inputs that must be present for a trustworthy output but are missing. */
  missingCriticalInputs: string[];
  /** Stale data sources that forced the grade down. */
  staleInputs: string[];
  /** Free-form advisory notes for the UI. */
  notes: string[];
  /** Structured, uniform downgrade rationale for the UI. */
  downgradeReasons: string[];
  /** True when observed (non-forecast, non-default) inputs drove the decision. */
  usedObservedInputs: boolean;
  /** True when the engine's operational-grade preconditions are all satisfied. */
  canBeOperational: boolean;
  /** @deprecated alias of usedDefaults, retained for backward compatibility */
  defaultsUsed: string[];
  /** @deprecated alias of missingCriticalInputs, retained for backward compatibility */
  missingInputs: string[];
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

export interface DrainageGradeInput {
  kind: 'wet-probe' | 'rain-heavy';
  probeFresh: boolean;
  probeExceedsThreshold: boolean;
  waterloggingFlag: boolean;
  forecastRainMm?: number | null;
  isDemo?: boolean;
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

type SeverityLevel = 'info' | 'monitor' | 'inspect' | 'advisory' | 'operational';
const SEVERITY_ORDER: SeverityLevel[] = ['info', 'monitor', 'inspect', 'advisory', 'operational'];

function capSeverity(current: SeverityLevel, max: SeverityLevel): SeverityLevel {
  const ci = SEVERITY_ORDER.indexOf(current);
  const mi = SEVERITY_ORDER.indexOf(max);
  return SEVERITY_ORDER[Math.min(ci, mi)];
}

function confidenceFromScore(score: number): RecommendationConfidence {
  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

function finalizeGrade(
  desiredSeverity: SeverityLevel,
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

/**
 * Shared downgrade-rule application.
 *
 * This is the SINGLE place where per-engine signals (stale inputs, missing
 * critical inputs, use of defaults, poor satellite scenes) are translated
 * into severity caps. Keeping this logic in one place means every engine
 * downgrades in a consistent way and the explainability wording stays uniform.
 *
 * Rules (max grade caps):
 *   - stale critical input            → max 'inspect'
 *   - missing required block config    → max 'inspect'
 *   - default-based agronomic input    → max 'advisory'
 *   - low-quality satellite scene      → max 'inspect'
 *
 * Blockers still short-circuit to 'insufficient-data' via finalizeGrade.
 */
export interface DowngradeInputs {
  desiredSeverity: SeverityLevel;
  blockers: string[];
  staleInputs: string[];
  missingCriticalInputs: string[];
  usedDefaults: string[];
  canBeOperational: boolean;
  confidence: RecommendationConfidence;
  sceneQuality?: 'good' | 'fair' | 'poor' | 'stale' | 'none';
}

export function applyDowngradeRules(i: DowngradeInputs): {
  grade: RecommendationGrade;
  effectiveSeverity: SeverityLevel;
  downgradeReasons: string[];
} {
  const reasons: string[] = [];
  let effective: SeverityLevel = i.desiredSeverity;

  if (i.staleInputs.length > 0) {
    effective = capSeverity(effective, 'inspect');
    reasons.push(
      `Stale critical input${i.staleInputs.length === 1 ? '' : 's'}: ${i.staleInputs.join(', ')} — capped at Inspect. Refresh the data to reach Operational.`
    );
  }
  if (i.missingCriticalInputs.length > 0) {
    effective = capSeverity(effective, 'inspect');
    reasons.push(
      `Required block config missing: ${i.missingCriticalInputs.join(', ')} — capped at Inspect. Complete block setup to reach Operational.`
    );
  }
  if (i.usedDefaults.length > 0) {
    effective = capSeverity(effective, 'advisory');
    reasons.push(
      `Default-based assumption${i.usedDefaults.length === 1 ? '' : 's'} in use: ${i.usedDefaults.join(', ')} — capped at Advisory. Configure block-specific values to strengthen confidence.`
    );
  }
  if (i.sceneQuality === 'fair') {
    effective = capSeverity(effective, 'inspect');
    reasons.push('Satellite scene quality is moderate — capped at Inspect until a better scene is available.');
  } else if (i.sceneQuality === 'poor' || i.sceneQuality === 'stale' || i.sceneQuality === 'none') {
    reasons.push('Satellite scene is not usable for a decision-grade output.');
  }
  if (!i.canBeOperational && i.desiredSeverity === 'operational' && i.blockers.length === 0) {
    reasons.push(
      'Not all operational-grade preconditions are met (fresh observed input + clean block config + no blockers).'
    );
  }

  const grade = finalizeGrade(effective, i.canBeOperational, i.confidence, i.blockers);
  return { grade, effectiveSeverity: effective, downgradeReasons: reasons };
}

function makeResult(params: {
  blockers: string[];
  usedDefaults: string[];
  missingCriticalInputs: string[];
  staleInputs: string[];
  notes: string[];
  confidence: RecommendationConfidence;
  canBeOperational: boolean;
  usedObservedInputs: boolean;
  grade: RecommendationGrade;
  downgradeReasons: string[];
}): DecisionGradeResult {
  return {
    grade: params.grade,
    confidence: params.confidence,
    blockers: params.blockers,
    usedDefaults: params.usedDefaults,
    missingCriticalInputs: params.missingCriticalInputs,
    staleInputs: params.staleInputs,
    notes: params.notes,
    downgradeReasons: params.downgradeReasons,
    usedObservedInputs: params.usedObservedInputs,
    canBeOperational: params.canBeOperational,
    defaultsUsed: params.usedDefaults,
    missingInputs: params.missingCriticalInputs,
  };
}

export function getIrrigationDecisionGrade(input: IrrigationGradeInput): DecisionGradeResult {
  const blockers: string[] = [];
  const usedDefaults: string[] = [];
  const missingCriticalInputs: string[] = [];
  const staleInputs: string[] = [];
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
    staleInputs.push('Weather forecast');
    notes.push('Forecast is stale');
  }
  if (input.probeObservedAt && !probeFresh) {
    staleInputs.push('Probe reading');
  }
  if (input.season && seasonStale) {
    staleInputs.push('Weather history');
  }

  if (v.irrigation_app_rate_mm_hr == null) {
    missingCriticalInputs.push('Irrigation application rate (mm/hr)');
  }
  if (v.distribution_efficiency_pct == null) usedDefaults.push('Distribution efficiency');
  if (v.crop_coefficient == null) usedDefaults.push('Crop coefficient (Kc)');
  if (v.root_zone_depth_cm == null) usedDefaults.push('Root zone depth');
  if (v.mad_pct == null) usedDefaults.push('MAD threshold');
  if (v.soil_awc_mm_per_m == null) usedDefaults.push('Soil AWC');
  if (v.soil_type == null) missingCriticalInputs.push('Soil type');
  if (v.row_spacing_m == null || v.vine_spacing_m == null) {
    missingCriticalInputs.push('Row/vine spacing');
  }
  if (v.emitter_spacing_m == null || v.emitter_flow_lph == null) {
    missingCriticalInputs.push('Emitter spacing / flow rate');
  }
  if (v.irrigation_zone == null) missingCriticalInputs.push('Irrigation zone');

  const criticalDefaults = usedDefaults.filter((d) =>
    ['Soil AWC', 'Root zone depth'].includes(d)
  );

  const hasGroundTruth = probeFresh;
  const hasFreshWeather = !seasonStale && forecastOk && !forecastStale;

  let score = 0;
  if (hasGroundTruth) score += 0.5;
  if (hasFreshWeather) score += 0.3;
  if (v.irrigation_app_rate_mm_hr != null) score += 0.1;
  if (v.soil_awc_mm_per_m != null) score += 0.05;
  if (criticalDefaults.length === 0) score += 0.05;
  if (usedDefaults.length > 0) score -= 0.1;

  const confidence = confidenceFromScore(score);

  const canBeOperational =
    blockers.length === 0 &&
    hasGroundTruth &&
    hasFreshWeather &&
    criticalDefaults.length === 0 &&
    missingCriticalInputs.length === 0 &&
    input.desiredState !== 'low-confidence';

  if (!canBeOperational && blockers.length === 0) {
    if (!hasGroundTruth) notes.push('No fresh probe data — cannot ground-truth root-zone moisture');
    if (!hasFreshWeather) notes.push('Weather inputs incomplete — projection only');
    if (criticalDefaults.length > 0)
      notes.push(`Using default values for: ${criticalDefaults.join(', ')}`);
  }

  const desiredSeverity: SeverityLevel =
    input.desiredState === 'irrigate-today'
      ? 'operational'
      : input.desiredState === 'irrigate-48h'
      ? 'operational'
      : input.desiredState === 'monitor'
      ? 'monitor'
      : input.desiredState === 'no-irrigation'
      ? 'info'
      : 'inspect';

  const { grade, downgradeReasons } = applyDowngradeRules({
    desiredSeverity,
    blockers,
    staleInputs,
    missingCriticalInputs,
    usedDefaults: criticalDefaults,
    canBeOperational,
    confidence,
  });

  return makeResult({
    blockers,
    usedDefaults,
    missingCriticalInputs,
    staleInputs,
    notes,
    confidence,
    canBeOperational,
    usedObservedInputs: probeFresh,
    grade,
    downgradeReasons,
  });
}

export function getSprayDecisionGrade(input: WeatherGradeInput): DecisionGradeResult {
  const blockers: string[] = [];
  const notes: string[] = [];
  const missingCriticalInputs: string[] = [];
  const usedDefaults: string[] = [];
  const staleInputs: string[] = [];

  if (input.isDemo) blockers.push('Demo data — not decision-grade');
  if (!input.forecast || input.forecast.days.length === 0) {
    blockers.push('No forecast available');
  }
  const forecastStale = input.forecast ? isStale('weather-forecast', input.forecast.fetchedAt) : true;
  if (forecastStale && input.forecast) {
    blockers.push('Forecast is stale');
    staleInputs.push('Weather forecast');
  }

  const today = input.forecast?.days[0];
  const hasWind = today ? Number.isFinite(today.windSpeedMax) : false;
  const hasRain = today ? Number.isFinite(today.precipProbability) && Number.isFinite(today.precipitation) : false;
  if (!hasWind) missingCriticalInputs.push('Wind forecast');
  if (!hasRain) missingCriticalInputs.push('Rain forecast');
  if (input.current?.humidity == null) usedDefaults.push('Humidity');

  let score = 0.3;
  if (!forecastStale) score += 0.35;
  if (hasWind && hasRain) score += 0.2;
  if (input.current?.humidity != null) score += 0.1;
  if (input.forecast?.sourceType === 'observed' || input.forecast?.sourceType === 'derived') {
    score += 0.05;
  }

  const confidence = confidenceFromScore(score);

  const canBeOperational =
    blockers.length === 0 && !forecastStale && hasWind && hasRain;

  const severity = input.severity;
  const desiredSeverity: SeverityLevel =
    severity === 'critical' || severity === 'elevated'
      ? 'operational'
      : severity === 'inspect'
      ? 'inspect'
      : severity === 'monitor'
      ? 'monitor'
      : 'info';

  const { grade, downgradeReasons } = applyDowngradeRules({
    desiredSeverity,
    blockers,
    staleInputs,
    missingCriticalInputs,
    usedDefaults,
    canBeOperational,
    confidence,
  });

  if (grade === 'advisory') notes.push('Forecast-derived — ground-truth before treatment');

  return makeResult({
    blockers,
    usedDefaults,
    missingCriticalInputs,
    staleInputs,
    notes,
    confidence,
    canBeOperational,
    usedObservedInputs: false,
    grade,
    downgradeReasons,
  });
}

export function getFrostDecisionGrade(input: WeatherGradeInput): DecisionGradeResult {
  const blockers: string[] = [];
  const notes: string[] = [];
  const missingCriticalInputs: string[] = [];
  const usedDefaults: string[] = [];
  const staleInputs: string[] = [];

  if (input.isDemo) blockers.push('Demo data — not decision-grade');
  if (!input.forecast || input.forecast.days.length === 0) {
    blockers.push('No forecast available');
  }
  const forecastStale = input.forecast ? isStale('weather-forecast', input.forecast.fetchedAt) : true;
  if (forecastStale && input.forecast) {
    blockers.push('Forecast is stale');
    staleInputs.push('Weather forecast');
  }

  if (input.vineyard?.elevation_m == null) usedDefaults.push('Elevation');
  if (input.vineyard?.aspect == null) usedDefaults.push('Aspect');
  if (input.vineyard?.frost_risk == null) missingCriticalInputs.push('Block frost-risk flag');
  if (input.current?.humidity == null) usedDefaults.push('Current humidity');

  let score = 0.3;
  if (!forecastStale) score += 0.4;
  if (input.vineyard?.frost_risk != null) score += 0.1;
  if (input.vineyard?.elevation_m != null) score += 0.1;
  if (input.current?.humidity != null) score += 0.1;

  const confidence = confidenceFromScore(score);
  const canBeOperational = false;

  const desiredSeverity: SeverityLevel =
    input.severity === 'critical' || input.severity === 'elevated'
      ? 'advisory'
      : input.severity === 'monitor'
      ? 'monitor'
      : 'info';

  const { grade, downgradeReasons } = applyDowngradeRules({
    desiredSeverity,
    blockers,
    staleInputs,
    missingCriticalInputs,
    usedDefaults,
    canBeOperational,
    confidence,
  });
  notes.push('Frost outputs stay advisory — forecasts carry overnight uncertainty');

  return makeResult({
    blockers,
    usedDefaults,
    missingCriticalInputs,
    staleInputs,
    notes,
    confidence,
    canBeOperational,
    usedObservedInputs: false,
    grade,
    downgradeReasons,
  });
}

export function getDiseaseDecisionGrade(input: WeatherGradeInput): DecisionGradeResult {
  const blockers: string[] = [];
  const notes: string[] = [];
  const missingCriticalInputs: string[] = [];
  const usedDefaults: string[] = [];
  const staleInputs: string[] = [];

  if (input.isDemo) blockers.push('Demo data — not decision-grade');
  if (!input.forecast || input.forecast.days.length === 0) {
    blockers.push('No forecast available');
  }
  const forecastStale = input.forecast ? isStale('weather-forecast', input.forecast.fetchedAt) : true;
  if (forecastStale && input.forecast) {
    blockers.push('Forecast is stale');
    staleInputs.push('Weather forecast');
  }

  if (input.current?.humidity == null) usedDefaults.push('Humidity');
  if (input.vineyard?.disease_prone == null) missingCriticalInputs.push('Block disease-prone flag');
  usedDefaults.push('Leaf wetness (proxy only)');

  let score = 0.25;
  if (!forecastStale) score += 0.3;
  if (input.current?.humidity != null) score += 0.15;
  if (input.vineyard?.disease_prone != null) score += 0.1;

  const confidence = confidenceFromScore(score);
  const canBeOperational = false;

  const desiredSeverity: SeverityLevel =
    input.severity === 'critical'
      ? 'inspect'
      : input.severity === 'elevated'
      ? 'advisory'
      : input.severity === 'inspect'
      ? 'inspect'
      : input.severity === 'monitor'
      ? 'monitor'
      : 'info';

  const { grade, downgradeReasons } = applyDowngradeRules({
    desiredSeverity,
    blockers,
    staleInputs,
    missingCriticalInputs,
    usedDefaults,
    canBeOperational,
    confidence,
  });
  notes.push('Generic disease-supportive proxy — recommend field inspection before treatment');

  return makeResult({
    blockers,
    usedDefaults,
    missingCriticalInputs,
    staleInputs,
    notes,
    confidence,
    canBeOperational,
    usedObservedInputs: false,
    grade,
    downgradeReasons,
  });
}

export function getSatelliteDecisionGrade(input: SatelliteGradeInput): DecisionGradeResult {
  const blockers: string[] = [];
  const notes: string[] = [];
  const missingCriticalInputs: string[] = [];
  const usedDefaults: string[] = [];
  const staleInputs: string[] = [];

  if (input.isDemo) blockers.push('Demo data — not decision-grade');
  if (!input.latest) blockers.push('No imagery available');
  if (input.latest?.sourceType === 'simulated') blockers.push('Simulated fallback imagery');
  if (input.sceneQuality === 'stale') {
    blockers.push('Scene past its useful window');
    staleInputs.push('Satellite scene');
  }
  if (input.sceneQuality === 'poor') blockers.push('Scene quality too poor for decision-grade');
  if (input.sceneQuality === 'none') blockers.push('No scene available');

  if (!input.hasBaseline) usedDefaults.push('Block baseline (not enough prior scenes)');
  if (!input.hasPeers) usedDefaults.push('Peer comparison (no comparable blocks)');
  if (input.sampleCount < 3) missingCriticalInputs.push('Historical scenes (need ≥3 for trend)');
  if (input.sampleCount < 5) missingCriticalInputs.push('Baseline history (need ≥5 scenes)');

  let score = 0.2;
  if (input.sceneQuality === 'good') score += 0.4;
  else if (input.sceneQuality === 'fair') score += 0.15;
  if (input.hasBaseline) score += 0.15;
  if (input.hasPeers) score += 0.1;
  if (input.sampleCount >= 5) score += 0.1;
  if (input.corroborated) score += 0.05;

  const confidence = confidenceFromScore(score);
  const canBeOperational = false;

  const strongScene =
    input.sceneQuality === 'good' && input.hasBaseline && input.sampleCount >= 5;
  const canInspect = strongScene && (input.corroborated === true || input.anomalyRepeated === true);

  const desiredSeverity: SeverityLevel = input.declineSignal
    ? canInspect
      ? 'inspect'
      : input.sceneQuality === 'good'
      ? 'advisory'
      : 'monitor'
    : 'monitor';

  const { grade, downgradeReasons } = applyDowngradeRules({
    desiredSeverity,
    blockers,
    staleInputs,
    missingCriticalInputs,
    usedDefaults,
    canBeOperational,
    confidence,
    sceneQuality: input.sceneQuality,
  });

  if (blockers.length === 0) {
    notes.push('Satellite signals support scouting — not standalone operational decisions');
    if (input.declineSignal && !canInspect) {
      notes.push('Single-source or weakly referenced signal — keep as advisory until corroborated');
    }
  }

  return makeResult({
    blockers,
    usedDefaults,
    missingCriticalInputs,
    staleInputs,
    notes,
    confidence,
    canBeOperational,
    usedObservedInputs: input.sceneQuality === 'good' && input.latest?.sourceType !== 'simulated',
    grade,
    downgradeReasons,
  });
}

export function getDrainageDecisionGrade(input: DrainageGradeInput): DecisionGradeResult {
  const blockers: string[] = [];
  const usedDefaults: string[] = [];
  const missingCriticalInputs: string[] = [];
  const staleInputs: string[] = [];
  const notes: string[] = [];

  if (input.isDemo) blockers.push('Demo data — not decision-grade');

  if (input.kind === 'wet-probe' && !input.probeFresh) {
    blockers.push('Probe data is stale');
    staleInputs.push('Probe reading');
  }
  if (input.kind === 'rain-heavy' && input.forecastRainMm == null) {
    missingCriticalInputs.push('Forecast rainfall');
  }
  if (!input.waterloggingFlag && input.kind === 'rain-heavy') {
    usedDefaults.push('Block waterlogging flag');
  }

  let score = 0.3;
  if (input.kind === 'wet-probe') {
    if (input.probeFresh) score += 0.5;
    if (input.probeExceedsThreshold) score += 0.1;
    if (input.waterloggingFlag) score += 0.05;
  } else {
    if (input.waterloggingFlag) score += 0.2;
    if ((input.forecastRainMm ?? 0) >= 25) score += 0.2;
    if ((input.forecastRainMm ?? 0) >= 40) score += 0.1;
  }
  const confidence = confidenceFromScore(score);

  const canBeOperational =
    input.kind === 'wet-probe' &&
    blockers.length === 0 &&
    input.probeFresh &&
    input.probeExceedsThreshold;

  const desiredSeverity: SeverityLevel =
    input.kind === 'wet-probe' && input.probeExceedsThreshold
      ? 'operational'
      : input.kind === 'rain-heavy' && input.waterloggingFlag
      ? 'advisory'
      : 'monitor';

  const { grade, downgradeReasons } = applyDowngradeRules({
    desiredSeverity,
    blockers,
    staleInputs,
    missingCriticalInputs,
    usedDefaults,
    canBeOperational,
    confidence,
  });

  return makeResult({
    blockers,
    usedDefaults,
    missingCriticalInputs,
    staleInputs,
    notes,
    confidence,
    canBeOperational,
    usedObservedInputs: input.kind === 'wet-probe' && input.probeFresh,
    grade,
    downgradeReasons,
  });
}

export type EngineContext =
  | { engine: 'irrigation'; input: IrrigationGradeInput }
  | { engine: 'spray'; input: WeatherGradeInput }
  | { engine: 'frost'; input: WeatherGradeInput }
  | { engine: 'disease'; input: WeatherGradeInput }
  | { engine: 'satellite'; input: SatelliteGradeInput }
  | { engine: 'drainage'; input: DrainageGradeInput };

/**
 * Shared grading entry point. All recommendation builders MUST obtain their
 * grade through this helper (or one of the engine-specific helpers it
 * delegates to). No builder is allowed to hardcode 'operational' directly —
 * operational status is only ever returned by engine logic after readiness,
 * staleness, default-usage and scene-quality checks.
 */
export function resolveRecommendationGrade(ctx: EngineContext): DecisionGradeResult {
  switch (ctx.engine) {
    case 'irrigation':
      return getIrrigationDecisionGrade(ctx.input);
    case 'spray':
      return getSprayDecisionGrade(ctx.input);
    case 'frost':
      return getFrostDecisionGrade(ctx.input);
    case 'disease':
      return getDiseaseDecisionGrade(ctx.input);
    case 'satellite':
      return getSatelliteDecisionGrade(ctx.input);
    case 'drainage':
      return getDrainageDecisionGrade(ctx.input);
  }
}

export function resolveRecommendationConfidence(ctx: EngineContext): RecommendationConfidence {
  return resolveRecommendationGrade(ctx).confidence;
}

export function summarizeGradeNotes(result: DecisionGradeResult): string[] {
  const out: string[] = [];
  if (result.blockers.length > 0) {
    out.push(`Blockers: ${result.blockers.join(', ')}`);
  }
  if (result.usedDefaults.length > 0) {
    out.push(`Using defaults for: ${result.usedDefaults.join(', ')}`);
  }
  if (result.missingCriticalInputs.length > 0) {
    out.push(`Missing: ${result.missingCriticalInputs.join(', ')}`);
  }
  if (result.staleInputs.length > 0) {
    out.push(`Stale: ${result.staleInputs.join(', ')}`);
  }
  out.push(...result.notes);
  return out;
}
