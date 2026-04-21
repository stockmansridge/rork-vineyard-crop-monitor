import { describe, it, expect } from 'bun:test';
import {
  getIrrigationDecisionGrade,
  getSprayDecisionGrade,
  getFrostDecisionGrade,
  getDiseaseDecisionGrade,
  getSatelliteDecisionGrade,
  getDrainageDecisionGrade,
  resolveRecommendationGrade,
} from '@/lib/decisionGrade';
import {
  buildVineyard,
  buildSeason,
  buildForecast,
  buildNdviSample,
  hoursAgo,
  daysAgo,
} from './fixtures';

/**
 * Regression tests for grading bypasses.
 *
 * These tests exist to guarantee no engine can sneak past the grading framework
 * and emit an `operational` recommendation when the preconditions aren't met.
 * Any PR that loosens this behaviour should fail here first.
 */

describe('operational grade bypass protection — missing critical inputs', () => {
  it('irrigation cannot be operational when soil type is missing', () => {
    const v = buildVineyard({ soil_type: null });
    const res = getIrrigationDecisionGrade({
      vineyard: v,
      season: buildSeason(),
      forecast: buildForecast(),
      probeMoisturePct: 28,
      probeObservedAt: hoursAgo(2),
      desiredState: 'irrigate-today',
    });
    expect(res.canBeOperational).toBe(false);
    expect(res.grade).not.toBe('operational');
    expect(res.missingCriticalInputs).toEqual(
      expect.arrayContaining(['Soil type'])
    );
  });

  it('irrigation cannot be operational when irrigation app rate is missing', () => {
    const v = buildVineyard({ irrigation_app_rate_mm_hr: null });
    const res = getIrrigationDecisionGrade({
      vineyard: v,
      season: buildSeason(),
      forecast: buildForecast(),
      probeMoisturePct: 28,
      probeObservedAt: hoursAgo(2),
      desiredState: 'irrigate-today',
    });
    expect(res.canBeOperational).toBe(false);
    expect(res.grade).not.toBe('operational');
  });

  it('irrigation cannot be operational when row/vine spacing is missing', () => {
    const v = buildVineyard({ row_spacing_m: null, vine_spacing_m: null });
    const res = getIrrigationDecisionGrade({
      vineyard: v,
      season: buildSeason(),
      forecast: buildForecast(),
      probeMoisturePct: 28,
      probeObservedAt: hoursAgo(2),
      desiredState: 'irrigate-today',
    });
    expect(res.canBeOperational).toBe(false);
    expect(res.grade).not.toBe('operational');
  });

  it('spray cannot be operational when rain forecast is missing', () => {
    const forecast = buildForecast({
      days: [
        {
          date: new Date().toISOString().slice(0, 10),
          tMax: 28,
          tMin: 14,
          precipitation: Number.NaN,
          precipProbability: Number.NaN,
          windSpeedMax: 10,
          weatherCode: 1,
        },
      ],
    });
    const res = getSprayDecisionGrade({
      forecast,
      current: forecast.current,
      severity: 'elevated',
    });
    expect(res.canBeOperational).toBe(false);
    expect(res.grade).not.toBe('operational');
    expect(res.missingCriticalInputs).toEqual(
      expect.arrayContaining(['Rain forecast'])
    );
  });

  it('spray cannot be operational when wind forecast is missing', () => {
    const forecast = buildForecast({
      days: [
        {
          date: new Date().toISOString().slice(0, 10),
          tMax: 28,
          tMin: 14,
          precipitation: 0,
          precipProbability: 10,
          windSpeedMax: Number.NaN,
          weatherCode: 1,
        },
      ],
    });
    const res = getSprayDecisionGrade({
      forecast,
      current: forecast.current,
      severity: 'elevated',
    });
    expect(res.canBeOperational).toBe(false);
    expect(res.grade).not.toBe('operational');
    expect(res.missingCriticalInputs).toEqual(
      expect.arrayContaining(['Wind forecast'])
    );
  });
});

describe('operational grade bypass protection — stale critical inputs', () => {
  it('irrigation cannot be operational with stale probe', () => {
    const res = getIrrigationDecisionGrade({
      vineyard: buildVineyard(),
      season: buildSeason(),
      forecast: buildForecast(),
      probeMoisturePct: 28,
      probeObservedAt: daysAgo(5),
      desiredState: 'irrigate-today',
    });
    expect(res.canBeOperational).toBe(false);
    expect(res.grade).not.toBe('operational');
    expect(res.staleInputs).toEqual(expect.arrayContaining(['Probe reading']));
  });

  it('irrigation cannot be operational with stale forecast', () => {
    const res = getIrrigationDecisionGrade({
      vineyard: buildVineyard(),
      season: buildSeason(),
      forecast: buildForecast({ fetchedAt: daysAgo(2) }),
      probeMoisturePct: 28,
      probeObservedAt: hoursAgo(1),
      desiredState: 'irrigate-today',
    });
    expect(res.canBeOperational).toBe(false);
    expect(res.grade).not.toBe('operational');
    expect(res.staleInputs).toEqual(
      expect.arrayContaining(['Weather forecast'])
    );
  });

  it('spray is blocked when forecast is stale', () => {
    const forecast = buildForecast({ fetchedAt: daysAgo(2) });
    const res = getSprayDecisionGrade({
      forecast,
      current: forecast.current,
      severity: 'elevated',
    });
    expect(res.grade).toBe('insufficient-data');
    expect(res.blockers).toEqual(expect.arrayContaining(['Forecast is stale']));
  });
});

describe('operational grade bypass protection — engines not allowed to emit operational', () => {
  it('frost can never return operational even on critical severity with everything fresh', () => {
    const forecast = buildForecast();
    const res = getFrostDecisionGrade({
      forecast,
      current: forecast.current,
      vineyard: buildVineyard({ frost_risk: true, elevation_m: 250, aspect: 'N' }),
      severity: 'critical',
    });
    expect(res.canBeOperational).toBe(false);
    expect(res.grade).not.toBe('operational');
  });

  it('disease remains advisory-only on the strongest possible inputs', () => {
    const forecast = buildForecast();
    const res = getDiseaseDecisionGrade({
      forecast,
      current: forecast.current,
      vineyard: buildVineyard({ disease_prone: true }),
      severity: 'critical',
    });
    expect(res.canBeOperational).toBe(false);
    expect(res.grade).not.toBe('operational');
    expect(['advisory', 'inspect', 'monitor', 'info']).toContain(res.grade);
  });

  it('satellite can never emit operational — even with perfect scene, history, corroboration', () => {
    const res = getSatelliteDecisionGrade({
      latest: buildNdviSample(),
      sceneQuality: 'good',
      sampleCount: 20,
      hasBaseline: true,
      hasPeers: true,
      declineSignal: true,
      anomalyRepeated: true,
      corroborated: true,
    });
    expect(res.canBeOperational).toBe(false);
    expect(res.grade).not.toBe('operational');
  });
});

describe('satellite quality gating — cannot exceed inspect/advisory unless all quality conditions met', () => {
  it('good scene without baseline stays at advisory or below', () => {
    const res = getSatelliteDecisionGrade({
      latest: buildNdviSample(),
      sceneQuality: 'good',
      sampleCount: 2,
      hasBaseline: false,
      hasPeers: false,
      declineSignal: true,
    });
    expect(res.grade).not.toBe('operational');
    expect(['monitor', 'advisory', 'inspect']).toContain(res.grade);
  });

  it('good scene with baseline but not corroborated cannot exceed advisory', () => {
    const res = getSatelliteDecisionGrade({
      latest: buildNdviSample(),
      sceneQuality: 'good',
      sampleCount: 10,
      hasBaseline: true,
      hasPeers: true,
      declineSignal: true,
      anomalyRepeated: false,
      corroborated: false,
    });
    expect(['monitor', 'advisory']).toContain(res.grade);
    expect(res.grade).not.toBe('inspect');
  });

  it('fair scene even with full history/corroboration caps at inspect', () => {
    const res = getSatelliteDecisionGrade({
      latest: buildNdviSample(),
      sceneQuality: 'fair',
      sampleCount: 20,
      hasBaseline: true,
      hasPeers: true,
      declineSignal: true,
      anomalyRepeated: true,
      corroborated: true,
    });
    expect(['monitor', 'advisory', 'inspect']).toContain(res.grade);
    expect(res.grade).not.toBe('operational');
    expect(res.downgradeReasons.join(' ')).toMatch(/moderate|scene/i);
  });

  it('stale scene becomes insufficient-data', () => {
    const res = getSatelliteDecisionGrade({
      latest: buildNdviSample(),
      sceneQuality: 'stale',
      sampleCount: 10,
      hasBaseline: true,
      hasPeers: true,
      declineSignal: true,
      anomalyRepeated: true,
      corroborated: true,
    });
    expect(res.grade).toBe('insufficient-data');
    expect(res.staleInputs).toEqual(
      expect.arrayContaining(['Satellite scene'])
    );
  });

  it('inspect requires strong scene + baseline + (corroborated OR repeated)', () => {
    const res = getSatelliteDecisionGrade({
      latest: buildNdviSample(),
      sceneQuality: 'good',
      sampleCount: 8,
      hasBaseline: true,
      hasPeers: true,
      declineSignal: true,
      anomalyRepeated: true,
    });
    expect(res.grade).toBe('inspect');
  });
});

describe('spray operational only in explicitly allowed conditions', () => {
  it('spray reaches operational only on elevated/critical with fresh complete forecast', () => {
    const forecast = buildForecast();
    const res = getSprayDecisionGrade({
      forecast,
      current: forecast.current,
      severity: 'elevated',
    });
    expect(res.canBeOperational).toBe(true);
    expect(res.grade).toBe('operational');
  });

  it('spray never reaches operational on "monitor" severity', () => {
    const forecast = buildForecast();
    const res = getSprayDecisionGrade({
      forecast,
      current: forecast.current,
      severity: 'monitor',
    });
    expect(res.grade).not.toBe('operational');
  });

  it('spray never reaches operational on "inspect" severity', () => {
    const forecast = buildForecast();
    const res = getSprayDecisionGrade({
      forecast,
      current: forecast.current,
      severity: 'inspect',
    });
    expect(res.grade).not.toBe('operational');
  });

  it('spray never reaches operational on "none" severity', () => {
    const forecast = buildForecast();
    const res = getSprayDecisionGrade({
      forecast,
      current: forecast.current,
      severity: 'none',
    });
    expect(res.grade).not.toBe('operational');
  });
});

describe('drainage / wet-probe bypass protection', () => {
  it('fresh wet probe that exceeds threshold can reach operational (the allowed path)', () => {
    const res = getDrainageDecisionGrade({
      kind: 'wet-probe',
      probeFresh: true,
      probeExceedsThreshold: true,
      waterloggingFlag: true,
    });
    expect(res.canBeOperational).toBe(true);
    expect(res.grade).toBe('operational');
  });

  it('fresh wet probe that does NOT exceed threshold cannot be operational', () => {
    const res = getDrainageDecisionGrade({
      kind: 'wet-probe',
      probeFresh: true,
      probeExceedsThreshold: false,
      waterloggingFlag: true,
    });
    expect(res.canBeOperational).toBe(false);
    expect(res.grade).not.toBe('operational');
  });

  it('stale wet-probe reading is blocked even if it would otherwise exceed threshold', () => {
    const res = getDrainageDecisionGrade({
      kind: 'wet-probe',
      probeFresh: false,
      probeExceedsThreshold: true,
      waterloggingFlag: true,
    });
    expect(res.canBeOperational).toBe(false);
    expect(res.grade).not.toBe('operational');
    expect(res.blockers).toEqual(expect.arrayContaining(['Probe data is stale']));
    expect(res.staleInputs).toEqual(expect.arrayContaining(['Probe reading']));
  });

  it('rain-heavy path cannot reach operational even with waterlogging flag', () => {
    const res = getDrainageDecisionGrade({
      kind: 'rain-heavy',
      probeFresh: false,
      probeExceedsThreshold: false,
      waterloggingFlag: true,
      forecastRainMm: 50,
    });
    expect(res.canBeOperational).toBe(false);
    expect(res.grade).not.toBe('operational');
  });

  it('rain-heavy without forecast rainfall is flagged as missing critical input', () => {
    const res = getDrainageDecisionGrade({
      kind: 'rain-heavy',
      probeFresh: false,
      probeExceedsThreshold: false,
      waterloggingFlag: true,
      forecastRainMm: null,
    });
    expect(res.canBeOperational).toBe(false);
    expect(res.missingCriticalInputs).toEqual(
      expect.arrayContaining(['Forecast rainfall'])
    );
  });

  it('demo data blocks any drainage operational output', () => {
    const res = getDrainageDecisionGrade({
      kind: 'wet-probe',
      probeFresh: true,
      probeExceedsThreshold: true,
      waterloggingFlag: true,
      isDemo: true,
    });
    expect(res.grade).toBe('insufficient-data');
    expect(res.blockers).toEqual(
      expect.arrayContaining(['Demo data — not decision-grade'])
    );
  });
});

describe('resolveRecommendationGrade honours engine rules (no shared bypass)', () => {
  it('routes irrigation through engine rules', () => {
    const res = resolveRecommendationGrade({
      engine: 'irrigation',
      input: {
        vineyard: buildVineyard(),
        season: buildSeason(),
        forecast: buildForecast(),
        probeMoisturePct: null,
        probeObservedAt: null,
        desiredState: 'irrigate-today',
      },
    });
    expect(res.grade).not.toBe('operational');
  });

  it('routes satellite through engine rules and never returns operational', () => {
    const res = resolveRecommendationGrade({
      engine: 'satellite',
      input: {
        latest: buildNdviSample(),
        sceneQuality: 'good',
        sampleCount: 20,
        hasBaseline: true,
        hasPeers: true,
        declineSignal: true,
        anomalyRepeated: true,
        corroborated: true,
      },
    });
    expect(res.grade).not.toBe('operational');
  });

  it('routes disease through engine rules and never returns operational', () => {
    const forecast = buildForecast();
    const res = resolveRecommendationGrade({
      engine: 'disease',
      input: {
        forecast,
        current: forecast.current,
        vineyard: buildVineyard({ disease_prone: true }),
        severity: 'critical',
      },
    });
    expect(res.grade).not.toBe('operational');
  });

  it('routes frost through engine rules and never returns operational', () => {
    const forecast = buildForecast();
    const res = resolveRecommendationGrade({
      engine: 'frost',
      input: {
        forecast,
        current: forecast.current,
        vineyard: buildVineyard({ frost_risk: true }),
        severity: 'critical',
      },
    });
    expect(res.grade).not.toBe('operational');
  });
});
