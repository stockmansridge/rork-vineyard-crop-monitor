import { describe, it, expect } from 'bun:test';
import { computeBlockReadiness } from '@/lib/blockReadiness';
import {
  buildVineyard,
  buildBlockSeason,
  buildIndexReading,
  daysAgo,
} from './fixtures';

describe('computeBlockReadiness', () => {
  it('rates a fully configured irrigation block ready or high-confidence', () => {
    const snap = computeBlockReadiness({
      vineyard: buildVineyard(),
      seasons: [buildBlockSeason()],
      indexReadings: Array.from({ length: 6 }).map((_, i) =>
        buildIndexReading({ acquired_at: daysAgo(i + 1) })
      ),
    });
    expect(['ready', 'high-confidence']).toContain(snap.engines.irrigation.state);
    expect(snap.engines.irrigation.criticalMissing).toEqual([]);
  });

  it('flags partial/not-ready when AWC and root zone missing', () => {
    const snap = computeBlockReadiness({
      vineyard: buildVineyard({
        soil_awc_mm_per_m: null,
        root_zone_depth_cm: null,
      }),
    });
    const irr = snap.engines.irrigation;
    expect(['partial', 'not-ready']).toContain(irr.state);
    expect(irr.criticalMissing.length).toBeGreaterThanOrEqual(2);
    expect(irr.summary.toLowerCase()).toMatch(/advisory|not configured/);
  });

  it('flags frost as not-ready when coordinates missing', () => {
    const snap = computeBlockReadiness({
      vineyard: buildVineyard({ latitude: null, longitude: null }),
    });
    expect(['partial', 'not-ready']).toContain(snap.engines.frost.state);
    expect(
      snap.engines.frost.criticalMissing.some((r) => r.key === 'coords')
    ).toBe(true);
  });

  it('satellite readiness requires geometry', () => {
    const snap = computeBlockReadiness({
      vineyard: buildVineyard({ polygon_coords: null }),
      indexReadings: [],
    });
    expect(
      snap.engines.satellite.criticalMissing.some((r) => r.key === 'geometry')
    ).toBe(true);
  });

  it('scouting still usable with just coords and no polygon', () => {
    const snap = computeBlockReadiness({
      vineyard: buildVineyard({ polygon_coords: null }),
    });
    expect(['ready', 'high-confidence', 'partial']).toContain(
      snap.engines.scouting.state
    );
  });

  it('overall score blends engines', () => {
    const snap = computeBlockReadiness({
      vineyard: buildVineyard(),
      seasons: [buildBlockSeason()],
      indexReadings: Array.from({ length: 6 }).map((_, i) =>
        buildIndexReading({ acquired_at: daysAgo(i + 1) })
      ),
    });
    expect(snap.overallScore).toBeGreaterThan(0.5);
    expect(snap.blockingCount).toBeGreaterThanOrEqual(0);
  });
});
