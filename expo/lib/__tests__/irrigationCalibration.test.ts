import { describe, it, expect } from 'bun:test';
import {
  computeIrrigationCalibration,
  effectiveRainfall,
  analyzeProbeTrend,
  describeEtSource,
} from '@/lib/irrigationCalibration';
import { buildVineyard, hoursAgo } from './fixtures';

describe('computeIrrigationCalibration', () => {
  it('labels a fully configured block as calibrated', () => {
    const cal = computeIrrigationCalibration(buildVineyard());
    expect(cal.label).toBe('calibrated');
    expect(cal.defaultsUsed).toEqual([]);
  });

  it('labels as default-based when critical fields missing', () => {
    const cal = computeIrrigationCalibration(
      buildVineyard({
        irrigation_app_rate_mm_hr: null,
        root_zone_depth_cm: null,
        soil_awc_mm_per_m: null,
        soil_type: null,
        crop_coefficient: null,
      })
    );
    expect(cal.label).toBe('default-based');
  });

  it('marks AWC derived when soil type provided', () => {
    const cal = computeIrrigationCalibration(
      buildVineyard({ soil_awc_mm_per_m: null, soil_type: 'sandy loam' })
    );
    const awcField = cal.fields.find((f) => f.key === 'soil_awc_mm_per_m');
    expect(awcField?.state).toBe('derived');
  });
});

describe('effectiveRainfall', () => {
  it('returns zero for no rain', () => {
    const r = effectiveRainfall(0, {
      soilType: 'loam',
      drainageNotes: null,
      slopePct: 0,
      waterloggingRisk: false,
    });
    expect(r.effectiveMm).toBe(0);
  });

  it('penalizes sandy soils', () => {
    const loam = effectiveRainfall(20, {
      soilType: 'loam',
      drainageNotes: null,
      slopePct: 0,
      waterloggingRisk: false,
    });
    const sand = effectiveRainfall(20, {
      soilType: 'sand',
      drainageNotes: null,
      slopePct: 0,
      waterloggingRisk: false,
    });
    expect(sand.effectiveMm).toBeLessThan(loam.effectiveMm);
    expect(sand.notes.length).toBeGreaterThan(0);
  });

  it('penalizes steep slopes', () => {
    const flat = effectiveRainfall(20, {
      soilType: 'loam',
      drainageNotes: null,
      slopePct: 0,
      waterloggingRisk: false,
    });
    const steep = effectiveRainfall(20, {
      soilType: 'loam',
      drainageNotes: null,
      slopePct: 20,
      waterloggingRisk: false,
    });
    expect(steep.effectiveMm).toBeLessThan(flat.effectiveMm);
  });

  it('reduces effectiveness on waterlogging-prone blocks with heavy rain', () => {
    const normal = effectiveRainfall(40, {
      soilType: 'loam',
      drainageNotes: null,
      slopePct: 0,
      waterloggingRisk: false,
    });
    const logged = effectiveRainfall(40, {
      soilType: 'loam',
      drainageNotes: null,
      slopePct: 0,
      waterloggingRisk: true,
    });
    expect(logged.effectiveMm).toBeLessThan(normal.effectiveMm);
  });

  it('clamps output within [0, rain * 1.15]', () => {
    const r = effectiveRainfall(10, {
      soilType: 'silt loam',
      drainageNotes: null,
      slopePct: 0,
      waterloggingRisk: false,
    });
    expect(r.effectiveMm).toBeGreaterThanOrEqual(0);
    expect(r.effectiveMm).toBeLessThanOrEqual(10 * 1.15);
  });
});

describe('analyzeProbeTrend', () => {
  it('reports drying trend when moisture falls', () => {
    const r = analyzeProbeTrend([
      { observedAt: hoursAgo(48), moisturePct: 35 },
      { observedAt: hoursAgo(24), moisturePct: 30 },
      { observedAt: hoursAgo(12), moisturePct: 27 },
      { observedAt: hoursAgo(2), moisturePct: 25 },
    ]);
    expect(r.usable).toBe(true);
    expect(r.trend).toBe('drying');
    expect(r.dryDownPctPerDay).not.toBeNull();
    expect(r.depletionRatePctPerDay ?? 0).toBeGreaterThan(0);
  });

  it('flags stale reading in notes', () => {
    const r = analyzeProbeTrend([
      { observedAt: hoursAgo(72), moisturePct: 30 },
    ]);
    expect(r.confidence).toBe('low');
    expect(r.notes.join(' ')).toMatch(/older than 24h|Not enough points/);
  });

  it('returns unusable for empty input', () => {
    const r = analyzeProbeTrend([]);
    expect(r.usable).toBe(false);
    expect(r.trend).toBe('unknown');
  });
});

describe('describeEtSource', () => {
  it('returns fallback note when no season source', () => {
    expect(describeEtSource(null).source).toBe('fallback');
    expect(describeEtSource(null).isApproximation).toBe(true);
  });
  it('returns approx-hargreaves when season source present', () => {
    expect(describeEtSource('derived').source).toBe('approx-hargreaves');
  });
});
