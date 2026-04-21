import type { DbVineyard } from '@/providers/VineyardProvider';

export type CalibrationState = 'configured' | 'derived' | 'default' | 'missing';

export type CalibrationFieldKey =
  | 'crop_coefficient'
  | 'root_zone_depth_cm'
  | 'soil_awc_mm_per_m'
  | 'mad_pct'
  | 'irrigation_app_rate_mm_hr'
  | 'distribution_efficiency_pct'
  | 'soil_type'
  | 'drainage_notes'
  | 'slope_pct'
  | 'waterlogging_risk';

export interface CalibrationField {
  key: CalibrationFieldKey;
  label: string;
  state: CalibrationState;
  value: string | number | boolean | null;
  usedValue: string | number | null;
  hint?: string;
}

export interface IrrigationCalibration {
  fields: CalibrationField[];
  configuredCount: number;
  totalCount: number;
  score: number;
  label: 'default-based' | 'semi-calibrated' | 'calibrated';
  summary: string;
  defaultsUsed: string[];
  missing: string[];
}

export const IRRIGATION_DEFAULTS = {
  kc: 0.65,
  rootZoneCm: 60,
  madPct: 50,
  awcMmPerM: 140,
  appRateMmHr: 3.5,
  distributionEff: 0.85,
} as const;

function deriveAwcFromSoil(soil: string | null | undefined): number | null {
  if (!soil) return null;
  const s = soil.toLowerCase();
  if (s.includes('sand')) return 80;
  if (s.includes('loam') && s.includes('sand')) return 120;
  if (s.includes('loam') && s.includes('clay')) return 170;
  if (s.includes('loam')) return 150;
  if (s.includes('clay')) return 180;
  if (s.includes('silt')) return 200;
  if (s.includes('gravel')) return 60;
  if (s.includes('volcanic')) return 160;
  if (s.includes('limestone')) return 100;
  return null;
}

function fieldState(
  configured: unknown,
  derived: unknown | null
): CalibrationState {
  if (configured != null && configured !== '') return 'configured';
  if (derived != null) return 'derived';
  return 'default';
}

export function computeIrrigationCalibration(
  v: Pick<
    DbVineyard,
    | 'crop_coefficient'
    | 'root_zone_depth_cm'
    | 'soil_awc_mm_per_m'
    | 'mad_pct'
    | 'irrigation_app_rate_mm_hr'
    | 'distribution_efficiency_pct'
    | 'soil_type'
    | 'drainage_notes'
    | 'slope_pct'
    | 'waterlogging_risk'
  >
): IrrigationCalibration {
  const derivedAwc = deriveAwcFromSoil(v.soil_type ?? null);

  const fields: CalibrationField[] = [
    {
      key: 'crop_coefficient',
      label: 'Crop coefficient (Kc)',
      state: fieldState(v.crop_coefficient, null),
      value: v.crop_coefficient ?? null,
      usedValue: v.crop_coefficient ?? IRRIGATION_DEFAULTS.kc,
      hint: 'Tune per phenology for better ETc',
    },
    {
      key: 'root_zone_depth_cm',
      label: 'Root zone depth',
      state: fieldState(v.root_zone_depth_cm, null),
      value: v.root_zone_depth_cm ?? null,
      usedValue: v.root_zone_depth_cm ?? IRRIGATION_DEFAULTS.rootZoneCm,
    },
    {
      key: 'soil_awc_mm_per_m',
      label: 'Soil AWC (mm/m)',
      state: fieldState(v.soil_awc_mm_per_m, derivedAwc),
      value: v.soil_awc_mm_per_m ?? null,
      usedValue: v.soil_awc_mm_per_m ?? derivedAwc ?? IRRIGATION_DEFAULTS.awcMmPerM,
      hint: derivedAwc != null && v.soil_awc_mm_per_m == null
        ? `Derived from soil type (${v.soil_type ?? ''})`
        : undefined,
    },
    {
      key: 'mad_pct',
      label: 'MAD threshold',
      state: fieldState(v.mad_pct, null),
      value: v.mad_pct ?? null,
      usedValue: v.mad_pct ?? IRRIGATION_DEFAULTS.madPct,
    },
    {
      key: 'irrigation_app_rate_mm_hr',
      label: 'Application rate',
      state: v.irrigation_app_rate_mm_hr != null ? 'configured' : 'missing',
      value: v.irrigation_app_rate_mm_hr ?? null,
      usedValue: v.irrigation_app_rate_mm_hr ?? null,
      hint: 'Required to convert runtime → depth',
    },
    {
      key: 'distribution_efficiency_pct',
      label: 'Distribution efficiency',
      state: fieldState(v.distribution_efficiency_pct, null),
      value: v.distribution_efficiency_pct ?? null,
      usedValue: v.distribution_efficiency_pct ?? IRRIGATION_DEFAULTS.distributionEff * 100,
    },
    {
      key: 'soil_type',
      label: 'Soil type',
      state: v.soil_type ? 'configured' : 'missing',
      value: v.soil_type ?? null,
      usedValue: v.soil_type ?? null,
    },
    {
      key: 'drainage_notes',
      label: 'Drainage notes',
      state: v.drainage_notes ? 'configured' : 'missing',
      value: v.drainage_notes ?? null,
      usedValue: v.drainage_notes ?? null,
    },
    {
      key: 'slope_pct',
      label: 'Slope',
      state: fieldState(v.slope_pct, null),
      value: v.slope_pct ?? null,
      usedValue: v.slope_pct ?? 0,
    },
    {
      key: 'waterlogging_risk',
      label: 'Waterlogging risk flag',
      state: v.waterlogging_risk != null ? 'configured' : 'missing',
      value: v.waterlogging_risk ?? null,
      usedValue: v.waterlogging_risk == null ? null : v.waterlogging_risk ? 1 : 0,
    },
  ];

  const configuredCount = fields.filter((f) => f.state === 'configured').length;
  const derivedCount = fields.filter((f) => f.state === 'derived').length;
  const totalCount = fields.length;
  const score = (configuredCount + derivedCount * 0.6) / totalCount;

  const critical: CalibrationFieldKey[] = [
    'irrigation_app_rate_mm_hr',
    'root_zone_depth_cm',
    'soil_awc_mm_per_m',
  ];
  const criticalOk = critical.every((k) => {
    const f = fields.find((x) => x.key === k);
    return f != null && (f.state === 'configured' || f.state === 'derived');
  });

  let label: IrrigationCalibration['label'];
  if (score >= 0.8 && criticalOk && configuredCount >= 6) label = 'calibrated';
  else if (score >= 0.45 && criticalOk) label = 'semi-calibrated';
  else label = 'default-based';

  const defaultsUsed = fields
    .filter((f) => f.state === 'default')
    .map((f) => f.label);
  const missing = fields
    .filter((f) => f.state === 'missing')
    .map((f) => f.label);

  const summary =
    label === 'calibrated'
      ? 'Block-level values drive the water balance.'
      : label === 'semi-calibrated'
      ? 'Critical inputs configured, but some values still use defaults.'
      : 'Recommendations rely on generic defaults — treat as advisory only.';

  return {
    fields,
    configuredCount,
    totalCount,
    score,
    label,
    summary,
    defaultsUsed,
    missing,
  };
}

export function calibrationColor(label: IrrigationCalibration['label']): {
  color: string;
  bg: string;
  border: string;
} {
  switch (label) {
    case 'calibrated':
      return { color: '#4ADE80', bg: '#1A4D2E', border: '#4ADE8040' };
    case 'semi-calibrated':
      return { color: '#38BDF8', bg: '#153040', border: '#38BDF840' };
    case 'default-based':
      return { color: '#F59E0B', bg: '#3D3015', border: '#F59E0B40' };
  }
}

export interface RainContext {
  soilType: string | null;
  drainageNotes: string | null;
  slopePct: number | null;
  waterloggingRisk: boolean | null;
}

export interface RainEffectivenessResult {
  effectiveMm: number;
  factor: number;
  notes: string[];
}

export function effectiveRainfall(
  rainMm: number,
  ctx: RainContext
): RainEffectivenessResult {
  const notes: string[] = [];
  if (rainMm <= 0) return { effectiveMm: 0, factor: 0, notes };

  let base: number;
  if (rainMm <= 5) base = rainMm * 0.6;
  else if (rainMm <= 25) base = 5 * 0.6 + (rainMm - 5) * 0.8;
  else base = 5 * 0.6 + 20 * 0.8 + (rainMm - 25) * 0.5;

  let factor = base / rainMm;

  const soil = (ctx.soilType ?? '').toLowerCase();
  if (soil.includes('sand') || soil.includes('gravel')) {
    factor *= 0.85;
    notes.push('Sandy/gravel soils drain fast — reduced capture');
  } else if (soil.includes('clay') && !soil.includes('loam')) {
    if (rainMm > 15) {
      factor *= 0.8;
      notes.push('Heavy clay runoff on large events');
    } else {
      factor *= 1.05;
      notes.push('Clay retains small rain events');
    }
  } else if (soil.includes('silt') || soil.includes('loam')) {
    factor *= 1.02;
  }

  const slope = ctx.slopePct ?? 0;
  if (slope >= 15) {
    factor *= 0.8;
    notes.push(`Steep slope (${slope}%) → runoff losses`);
  } else if (slope >= 8) {
    factor *= 0.9;
    notes.push(`Moderate slope (${slope}%) → some runoff`);
  }

  const drainage = (ctx.drainageNotes ?? '').toLowerCase();
  if (drainage.includes('poor') || drainage.includes('slow')) {
    if (rainMm > 20) {
      factor *= 0.85;
      notes.push('Poor drainage reduces effective refill on big events');
    }
  } else if (drainage.includes('excellent') || drainage.includes('free')) {
    factor *= 0.95;
  }

  if (ctx.waterloggingRisk === true && rainMm > 25) {
    factor *= 0.8;
    notes.push('Waterlogging-prone — excess rain not plant-available');
  }

  factor = Math.max(0.1, Math.min(1.15, factor));
  const effectiveMm = Math.max(0, Math.min(rainMm * 1.15, rainMm * factor));
  return { effectiveMm, factor, notes };
}

export interface ProbeReadingPoint {
  observedAt: string;
  moisturePct: number;
}

export interface ProbeTrendResult {
  usable: boolean;
  pointCount: number;
  latestPct: number | null;
  latestAt: string | null;
  dryDownPctPerDay: number | null;
  depletionRatePctPerDay: number | null;
  trend: 'drying' | 'stable' | 'wetting' | 'unknown';
  freshnessHours: number | null;
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
}

export function analyzeProbeTrend(
  points: ProbeReadingPoint[]
): ProbeTrendResult {
  const notes: string[] = [];
  const sorted = [...points]
    .filter((p) => Number.isFinite(p.moisturePct))
    .sort((a, b) => (a.observedAt < b.observedAt ? -1 : 1));

  if (sorted.length === 0) {
    return {
      usable: false,
      pointCount: 0,
      latestPct: null,
      latestAt: null,
      dryDownPctPerDay: null,
      depletionRatePctPerDay: null,
      trend: 'unknown',
      freshnessHours: null,
      confidence: 'low',
      notes: ['No probe readings'],
    };
  }

  const latest = sorted[sorted.length - 1];
  const latestTs = new Date(latest.observedAt).getTime();
  const freshnessHours = Math.max(0, (Date.now() - latestTs) / 3_600_000);

  const cutoff = latestTs - 7 * 24 * 3_600_000;
  const recent = sorted.filter(
    (p) => new Date(p.observedAt).getTime() >= cutoff
  );

  let dryDown: number | null = null;
  let depletion: number | null = null;
  if (recent.length >= 2) {
    const first = recent[0];
    const last = recent[recent.length - 1];
    const hours =
      (new Date(last.observedAt).getTime() -
        new Date(first.observedAt).getTime()) /
      3_600_000;
    if (hours >= 6) {
      const deltaPct = last.moisturePct - first.moisturePct;
      const perDay = (deltaPct / hours) * 24;
      dryDown = perDay;
      depletion = perDay < 0 ? Math.abs(perDay) : 0;
    }
  }

  let trend: ProbeTrendResult['trend'] = 'unknown';
  if (dryDown != null) {
    if (dryDown <= -0.3) trend = 'drying';
    else if (dryDown >= 0.3) trend = 'wetting';
    else trend = 'stable';
  }

  let confidence: ProbeTrendResult['confidence'] = 'low';
  if (freshnessHours <= 12 && recent.length >= 4) confidence = 'high';
  else if (freshnessHours <= 24 && recent.length >= 2) confidence = 'medium';

  if (freshnessHours > 24) notes.push('Reading older than 24h');
  if (recent.length < 2) notes.push('Not enough points for trend');

  return {
    usable: true,
    pointCount: sorted.length,
    latestPct: latest.moisturePct,
    latestAt: latest.observedAt,
    dryDownPctPerDay: dryDown,
    depletionRatePctPerDay: depletion,
    trend,
    freshnessHours,
    confidence,
    notes,
  };
}

export type EtSource = 'approx-hargreaves' | 'forecast-derived' | 'fallback';

export interface EtTransparency {
  source: EtSource;
  label: string;
  isApproximation: boolean;
  note: string;
}

export function describeEtSource(seasonSourceType: string | null): EtTransparency {
  if (!seasonSourceType) {
    return {
      source: 'fallback',
      label: 'ET fallback',
      isApproximation: true,
      note: 'No weather history — ET is a rough fallback.',
    };
  }
  return {
    source: 'approx-hargreaves',
    label: 'ET (approx Hargreaves)',
    isApproximation: true,
    note: 'ET estimated from daily min/max temperature — approximate, not Penman-Monteith.',
  };
}
