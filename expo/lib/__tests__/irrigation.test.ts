import { describe, it, expect } from 'bun:test';
import { computeIrrigation, toRecommendation } from '@/lib/irrigation';
import {
  buildVineyard,
  buildSeason,
  buildForecast,
  buildForecastDay,
  buildDailyWeather,
  hoursAgo,
  daysAgo,
} from './fixtures';

function dryDays(n: number) {
  return Array.from({ length: n }).map((_, i) => {
    const d = new Date(Date.now() - (n - 1 - i) * 24 * 3_600_000);
    return buildDailyWeather(d.toISOString().slice(0, 10), {
      tMax: 34,
      tMin: 18,
      tMean: 26,
      precipitation: 0,
    });
  });
}

describe('computeIrrigation', () => {
  it('returns low-confidence when nothing is available', () => {
    const rec = computeIrrigation({
      vineyard: buildVineyard(),
      season: null,
      forecast: null,
      probeMoisturePct: null,
      probeObservedAt: null,
    });
    expect(rec.state).toBe('low-confidence');
    expect(rec.confidence).toBe('low');
    expect(toRecommendation(rec)).toBeNull();
  });

  it('recommends irrigation when deficit high and no rain', () => {
    const season = buildSeason({ days: dryDays(14) });
    const forecast = buildForecast({
      days: Array.from({ length: 7 }).map((_, i) =>
        buildForecastDay(i, {
          tMax: 34,
          tMin: 18,
          precipitation: 0,
          precipProbability: 5,
        })
      ),
    });
    const rec = computeIrrigation({
      vineyard: buildVineyard(),
      season,
      forecast,
      probeMoisturePct: 14,
      probeObservedAt: hoursAgo(2),
    });
    expect(['irrigate-today', 'irrigate-48h']).toContain(rec.state);
    expect(rec.suggestedApplicationMm).toBeGreaterThan(0);
    expect(rec.usedProbeData).toBe(true);
  });

  it('holds irrigation when rain forecast is material', () => {
    const season = buildSeason({ days: dryDays(14) });
    const forecast = buildForecast({
      days: [
        buildForecastDay(0, { precipitation: 25, precipProbability: 90 }),
        buildForecastDay(1, { precipitation: 15, precipProbability: 80 }),
        ...Array.from({ length: 5 }).map((_, i) => buildForecastDay(i + 2)),
      ],
    });
    const rec = computeIrrigation({
      vineyard: buildVineyard(),
      season,
      forecast,
      probeMoisturePct: 20,
      probeObservedAt: hoursAgo(2),
    });
    expect(['no-irrigation', 'monitor']).toContain(rec.state);
  });

  it('reduces confidence when calibration is default-based', () => {
    const rec = computeIrrigation({
      vineyard: buildVineyard({
        irrigation_app_rate_mm_hr: null,
        root_zone_depth_cm: null,
        soil_awc_mm_per_m: null,
        crop_coefficient: null,
        mad_pct: null,
        soil_type: null,
        distribution_efficiency_pct: null,
        drainage_notes: null,
        slope_pct: null,
        waterlogging_risk: null,
      }),
      season: buildSeason({ days: dryDays(14) }),
      forecast: buildForecast(),
      probeMoisturePct: 20,
      probeObservedAt: hoursAgo(1),
    });
    expect(rec.calibration.label).toBe('default-based');
    expect(['low', 'medium']).toContain(rec.confidence);
  });

  it('gradeResult blocks operational when forecast is stale', () => {
    const rec = computeIrrigation({
      vineyard: buildVineyard(),
      season: buildSeason({ observedAt: daysAgo(2) }),
      forecast: buildForecast({ fetchedAt: daysAgo(2) }),
      probeMoisturePct: 20,
      probeObservedAt: hoursAgo(2),
    });
    expect(rec.gradeResult.canBeOperational).toBe(false);
  });

  it('toRecommendation surfaces downgrade reasons for default-based blocks', () => {
    const rec = computeIrrigation({
      vineyard: buildVineyard({
        irrigation_app_rate_mm_hr: null,
        root_zone_depth_cm: null,
        soil_awc_mm_per_m: null,
      }),
      season: buildSeason({ days: dryDays(14) }),
      forecast: buildForecast(),
      probeMoisturePct: 14,
      probeObservedAt: hoursAgo(1),
    });
    const mapped = toRecommendation(rec);
    if (mapped) {
      expect(mapped.grade).not.toBe('operational');
      expect(mapped.downgradeReasons?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
