import type { DbVineyard } from '@/providers/VineyardProvider';
import type { DbBlockSeason } from '@/providers/BlockSeasonsProvider';
import type { DbIndexReading } from '@/providers/IndexReadingsProvider';

export type ReadinessEngine =
  | 'irrigation'
  | 'frost'
  | 'disease'
  | 'satellite'
  | 'scouting';

export type ReadinessState =
  | 'not-ready'
  | 'partial'
  | 'ready'
  | 'high-confidence';

export interface ReadinessRequirement {
  key: string;
  label: string;
  ok: boolean;
  critical: boolean;
  hint?: string;
}

export type EngineMaturity = 'operational-capable' | 'advisory-only';

export interface EngineReadiness {
  engine: ReadinessEngine;
  state: ReadinessState;
  score: number;
  missing: ReadinessRequirement[];
  satisfied: ReadinessRequirement[];
  criticalMissing: ReadinessRequirement[];
  summary: string;
  advisoryOnly: boolean;
  maturity: EngineMaturity;
  maturityNote: string;
}

export function engineMaturity(engine: ReadinessEngine): EngineMaturity {
  switch (engine) {
    case 'disease':
    case 'frost':
      return 'advisory-only';
    case 'irrigation':
    case 'satellite':
    case 'scouting':
      return 'operational-capable';
  }
}

export function engineMaturityNote(engine: ReadinessEngine): string {
  switch (engine) {
    case 'disease':
      return 'Disease engine remains advisory even when readiness is high — it supports decisions but should not replace in-field inspection.';
    case 'frost':
      return 'Frost engine remains advisory even when readiness is high — use alongside local forecast and on-block monitoring.';
    case 'irrigation':
      return 'Irrigation engine can reach operational grade when all critical inputs are configured and supporting data is fresh.';
    case 'satellite':
      return 'Satellite engine can produce operational-grade anomaly detection once enough scenes and a block baseline exist.';
    case 'scouting':
      return 'Scouting engine supports operational task workflows once the block is fully configured.';
  }
}

export const READINESS_MEANING: string =
  'Readiness reflects how many block inputs are configured for this advisory engine. It is not a measure of model certainty or authority.';

export interface BlockReadinessSnapshot {
  vineyardId: string;
  engines: Record<ReadinessEngine, EngineReadiness>;
  overallState: ReadinessState;
  overallScore: number;
  blockingCount: number;
}

export interface ReadinessInputs {
  vineyard: DbVineyard;
  seasons?: DbBlockSeason[];
  indexReadings?: DbIndexReading[];
}

function evaluate(requirements: ReadinessRequirement[]): {
  state: ReadinessState;
  score: number;
  missing: ReadinessRequirement[];
  satisfied: ReadinessRequirement[];
  criticalMissing: ReadinessRequirement[];
} {
  const total = requirements.length;
  const satisfied = requirements.filter((r) => r.ok);
  const missing = requirements.filter((r) => !r.ok);
  const criticalMissing = missing.filter((r) => r.critical);
  const score = total === 0 ? 1 : satisfied.length / total;

  let state: ReadinessState;
  if (criticalMissing.length > 0) {
    state = score >= 0.4 ? 'partial' : 'not-ready';
  } else if (score >= 0.95) {
    state = 'high-confidence';
  } else if (score >= 0.7) {
    state = 'ready';
  } else if (score >= 0.4) {
    state = 'partial';
  } else {
    state = 'not-ready';
  }

  return { state, score, missing, satisfied, criticalMissing };
}

function summaryFor(
  engine: ReadinessEngine,
  state: ReadinessState,
  criticalMissing: ReadinessRequirement[],
  missing: ReadinessRequirement[]
): string {
  const maturity = engineMaturity(engine);
  if (state === 'high-confidence') {
    if (maturity === 'advisory-only') {
      return `All inputs configured. ${engineLabel(engine)} remains an advisory engine — use alongside field verification.`;
    }
    return 'All inputs configured — recommendations can reach operational grade when supporting data is fresh.';
  }
  if (state === 'ready') {
    const base = missing.length > 0
      ? `Enough inputs configured. Missing ${missing.map((m) => m.label).join(', ')} would strengthen confidence.`
      : 'Enough inputs configured for this advisory engine.';
    return maturity === 'advisory-only'
      ? `${base} ${engineLabel(engine)} stays advisory by design.`
      : base;
  }
  if (state === 'partial') {
    if (criticalMissing.length > 0) {
      return `${engineLabel(engine)} recommendations are advisory only — missing ${criticalMissing
        .map((m) => m.label)
        .join(', ')}.`;
    }
    return `Partial setup. Add ${missing.slice(0, 3).map((m) => m.label).join(', ')} to improve confidence.`;
  }
  return `Not configured for ${engineLabel(engine).toLowerCase()} — complete setup to unlock recommendations.`;
}

export function engineLabel(engine: ReadinessEngine): string {
  switch (engine) {
    case 'irrigation':
      return 'Irrigation';
    case 'frost':
      return 'Frost';
    case 'disease':
      return 'Disease';
    case 'satellite':
      return 'Satellite';
    case 'scouting':
      return 'Scouting';
  }
}

export function readinessStateLabel(state: ReadinessState): string {
  switch (state) {
    case 'high-confidence':
      return 'High confidence';
    case 'ready':
      return 'Ready';
    case 'partial':
      return 'Partially ready';
    case 'not-ready':
      return 'Not ready';
  }
}

function hasPolygon(v: DbVineyard): boolean {
  return Array.isArray(v.polygon_coords) && v.polygon_coords.length >= 3;
}

function getIrrigationRequirements(v: DbVineyard): ReadinessRequirement[] {
  return [
    { key: 'area', label: 'Block area', ok: v.area != null && v.area > 0, critical: true },
    { key: 'row_spacing', label: 'Row spacing', ok: v.row_spacing_m != null, critical: false },
    { key: 'vine_spacing', label: 'Vine spacing', ok: v.vine_spacing_m != null, critical: false },
    { key: 'emitter_spacing', label: 'Emitter spacing', ok: v.emitter_spacing_m != null, critical: false },
    { key: 'emitter_flow', label: 'Emitter flow rate', ok: v.emitter_flow_lph != null, critical: false },
    {
      key: 'app_rate',
      label: 'Application rate',
      ok: v.irrigation_app_rate_mm_hr != null,
      critical: true,
      hint: 'mm/hr — required to translate runtime into applied depth',
    },
    { key: 'kc', label: 'Crop coefficient (Kc)', ok: v.crop_coefficient != null, critical: false },
    {
      key: 'root_zone',
      label: 'Root zone depth',
      ok: v.root_zone_depth_cm != null,
      critical: true,
    },
    {
      key: 'awc',
      label: 'Soil AWC',
      ok: v.soil_awc_mm_per_m != null,
      critical: true,
      hint: 'Available water capacity mm/m',
    },
    { key: 'mad', label: 'MAD threshold', ok: v.mad_pct != null, critical: false },
    { key: 'soil_type', label: 'Soil type', ok: !!v.soil_type, critical: false },
  ];
}

function getFrostRequirements(v: DbVineyard, seasons: DbBlockSeason[]): ReadinessRequirement[] {
  const currentSeason = seasons[0] ?? null;
  const hasStage = !!(
    currentSeason?.budburst_date ||
    currentSeason?.flowering_date ||
    currentSeason?.veraison_date
  );
  return [
    {
      key: 'frost_flag',
      label: 'Frost-risk flag',
      ok: v.frost_risk != null,
      critical: true,
      hint: 'Marks block as frost-prone (on/off)',
    },
    { key: 'elevation', label: 'Elevation', ok: v.elevation_m != null, critical: false },
    { key: 'aspect', label: 'Aspect', ok: !!v.aspect, critical: false },
    { key: 'slope', label: 'Slope', ok: v.slope_pct != null, critical: false },
    {
      key: 'phenology',
      label: 'Phenology stage',
      ok: hasStage,
      critical: false,
      hint: 'Log budburst / flowering for stage-sensitive calls',
    },
    { key: 'coords', label: 'Coordinates', ok: v.latitude != null && v.longitude != null, critical: true },
  ];
}

function getDiseaseRequirements(v: DbVineyard, seasons: DbBlockSeason[]): ReadinessRequirement[] {
  const currentSeason = seasons[0] ?? null;
  const hasStage = !!(
    currentSeason?.budburst_date ||
    currentSeason?.flowering_date ||
    currentSeason?.veraison_date
  );
  return [
    {
      key: 'disease_flag',
      label: 'Disease-prone flag',
      ok: v.disease_prone != null,
      critical: false,
      hint: 'History of mildew/botrytis pressure',
    },
    { key: 'coords', label: 'Coordinates', ok: v.latitude != null && v.longitude != null, critical: true },
    {
      key: 'canopy',
      label: 'Training / canopy info',
      ok: !!v.training_system,
      critical: false,
    },
    {
      key: 'phenology',
      label: 'Phenology stage',
      ok: hasStage,
      critical: false,
    },
    {
      key: 'waterlogging',
      label: 'Waterlogging flag',
      ok: v.waterlogging_risk != null,
      critical: false,
    },
  ];
}

function getSatelliteRequirements(
  v: DbVineyard,
  indexReadings: DbIndexReading[]
): ReadinessRequirement[] {
  const blockReadings = indexReadings.filter((r) => r.vineyard_id === v.id);
  const ndviCount = blockReadings.filter((r) => r.index_type === 'NDVI').length;
  const latest = blockReadings.sort((a, b) => (a.acquired_at < b.acquired_at ? 1 : -1))[0];
  const latestAgeDays = latest
    ? (Date.now() - new Date(latest.acquired_at).getTime()) / (1000 * 60 * 60 * 24)
    : null;
  return [
    {
      key: 'geometry',
      label: 'Valid block geometry',
      ok: hasPolygon(v),
      critical: true,
      hint: 'Polygon with ≥3 points for per-block extraction',
    },
    {
      key: 'history',
      label: 'Image history (≥3 scenes)',
      ok: ndviCount >= 3,
      critical: false,
    },
    {
      key: 'baseline',
      label: 'Block baseline (≥5 scenes)',
      ok: ndviCount >= 5,
      critical: false,
    },
    {
      key: 'recent',
      label: 'Recent scene (<14d)',
      ok: latestAgeDays != null && latestAgeDays <= 14,
      critical: false,
      hint: 'Keeps scene quality fresh enough for trend detection',
    },
  ];
}

function getScoutingRequirements(v: DbVineyard, seasons: DbBlockSeason[]): ReadinessRequirement[] {
  const currentSeason = seasons[0] ?? null;
  const hasStage = !!(
    currentSeason?.budburst_date ||
    currentSeason?.flowering_date ||
    currentSeason?.veraison_date ||
    currentSeason?.harvest_date
  );
  return [
    { key: 'name', label: 'Block name', ok: !!v.name, critical: true },
    {
      key: 'geometry',
      label: 'Coordinates or polygon',
      ok: (v.latitude != null && v.longitude != null) || hasPolygon(v),
      critical: true,
    },
    {
      key: 'variety',
      label: 'Variety',
      ok: !!v.variety,
      critical: false,
    },
    {
      key: 'risks',
      label: 'Risk flags configured',
      ok:
        v.frost_risk != null ||
        v.heat_exposure != null ||
        v.disease_prone != null ||
        v.waterlogging_risk != null,
      critical: false,
    },
    {
      key: 'phenology',
      label: 'Phenology tracking',
      ok: hasStage,
      critical: false,
    },
  ];
}

function buildEngine(
  engine: ReadinessEngine,
  requirements: ReadinessRequirement[]
): EngineReadiness {
  const { state, score, missing, satisfied, criticalMissing } = evaluate(requirements);
  const summary = summaryFor(engine, state, criticalMissing, missing);
  const maturity = engineMaturity(engine);
  const advisoryOnly = maturity === 'advisory-only' || state !== 'high-confidence';
  return {
    engine,
    state,
    score,
    missing,
    satisfied,
    criticalMissing,
    summary,
    advisoryOnly,
    maturity,
    maturityNote: engineMaturityNote(engine),
  };
}

export function computeBlockReadiness(inputs: ReadinessInputs): BlockReadinessSnapshot {
  const { vineyard, seasons = [], indexReadings = [] } = inputs;

  const engines: Record<ReadinessEngine, EngineReadiness> = {
    irrigation: buildEngine('irrigation', getIrrigationRequirements(vineyard)),
    frost: buildEngine('frost', getFrostRequirements(vineyard, seasons)),
    disease: buildEngine('disease', getDiseaseRequirements(vineyard, seasons)),
    satellite: buildEngine('satellite', getSatelliteRequirements(vineyard, indexReadings)),
    scouting: buildEngine('scouting', getScoutingRequirements(vineyard, seasons)),
  };

  const values = Object.values(engines);
  const overallScore = values.reduce((sum, e) => sum + e.score, 0) / values.length;
  const blockingCount = values.filter((e) => e.state === 'not-ready').length;

  let overallState: ReadinessState;
  if (values.every((e) => e.state === 'high-confidence')) overallState = 'high-confidence';
  else if (values.every((e) => e.state === 'ready' || e.state === 'high-confidence'))
    overallState = 'ready';
  else if (overallScore >= 0.4) overallState = 'partial';
  else overallState = 'not-ready';

  return {
    vineyardId: vineyard.id,
    engines,
    overallState,
    overallScore,
    blockingCount,
  };
}

export function readinessColor(state: ReadinessState): {
  color: string;
  bg: string;
  border: string;
} {
  switch (state) {
    case 'high-confidence':
      return { color: '#4ADE80', bg: '#1A4D2E', border: '#4ADE8040' };
    case 'ready':
      return { color: '#38BDF8', bg: '#153040', border: '#38BDF840' };
    case 'partial':
      return { color: '#F59E0B', bg: '#3D3015', border: '#F59E0B40' };
    case 'not-ready':
      return { color: '#EF4444', bg: '#3D1515', border: '#EF444440' };
  }
}
