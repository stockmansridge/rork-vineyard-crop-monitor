import { describe, it, expect } from 'bun:test';
import {
  getIrrigationDecisionGrade,
  getSprayDecisionGrade,
  getFrostDecisionGrade,
  getDiseaseDecisionGrade,
  getSatelliteDecisionGrade,
} from '@/lib/decisionGrade';
import {
  buildVineyard,
  buildSeason,
  buildForecast,
  buildNdviSample,
  hoursAgo,
  daysAgo,
} from './fixtures';

describe('getIrrigationDecisionGrade', () => {
  it('grants operational grade when all requirements met', () => {
    const v = buildVineyard();
    const res = getIrrigationDecisionGrade({
      vineyard: v,
      season: buildSeason(),
      forecast: buildForecast(),
      probeMoisturePct: 28,
      probeObservedAt: hoursAgo(2),
      desiredState: 'irrigate-today',
    });
    expect(res.blockers).toEqual([]);
    expect(res.canBeOperational).toBe(true);
    expect(res.confidence).toBe('high');
    expect(res.grade).toBe('operational');
  });

  it('downgrades when AWC and root zone use defaults', () => {
    const v = buildVineyard({ soil_awc_mm_per_m: null, root_zone_depth_cm: null });
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
    expect(res.defaultsUsed).toEqual(
      expect.arrayContaining(['Soil AWC', 'Root zone depth'])
    );
  });

  it('blocks when weather and probe are both stale/absent', () => {
    const v = buildVineyard();
    const res = getIrrigationDecisionGrade({
      vineyard: v,
      season: null,
      forecast: null,
      probeMoisturePct: null,
      probeObservedAt: null,
      desiredState: 'low-confidence',
    });
    expect(res.blockers.length).toBeGreaterThan(0);
    expect(res.grade).toBe('insufficient-data');
  });

  it('demo mode blocks operational grade', () => {
    const v = buildVineyard();
    const res = getIrrigationDecisionGrade({
      vineyard: v,
      season: buildSeason(),
      forecast: buildForecast(),
      probeMoisturePct: 28,
      probeObservedAt: hoursAgo(2),
      isDemo: true,
      desiredState: 'irrigate-today',
    });
    expect(res.blockers).toEqual(expect.arrayContaining(['Demo data — not decision-grade']));
    expect(res.grade).toBe('insufficient-data');
  });

  it('stays below operational when probe is stale even if weather is fresh', () => {
    const v = buildVineyard();
    const res = getIrrigationDecisionGrade({
      vineyard: v,
      season: buildSeason(),
      forecast: buildForecast(),
      probeMoisturePct: 28,
      probeObservedAt: hoursAgo(48),
      desiredState: 'irrigate-today',
    });
    expect(res.canBeOperational).toBe(false);
    expect(res.grade).not.toBe('operational');
  });
});

describe('getSprayDecisionGrade', () => {
  it('reaches operational only on elevated/critical severity with fresh forecast', () => {
    const forecast = buildForecast();
    const res = getSprayDecisionGrade({
      forecast,
      current: forecast.current,
      severity: 'elevated',
    });
    expect(res.canBeOperational).toBe(true);
    expect(res.grade).toBe('operational');
  });

  it('returns monitor for a clean suitable window', () => {
    const forecast = buildForecast();
    const res = getSprayDecisionGrade({
      forecast,
      current: forecast.current,
      severity: 'monitor',
    });
    expect(res.grade).toBe('monitor');
  });

  it('blocks when forecast missing', () => {
    const res = getSprayDecisionGrade({ forecast: null, severity: 'elevated' });
    expect(res.grade).toBe('insufficient-data');
    expect(res.blockers).toEqual(expect.arrayContaining(['No forecast available']));
  });
});

describe('getFrostDecisionGrade', () => {
  it('never reaches operational — always advisory at best', () => {
    const forecast = buildForecast();
    const res = getFrostDecisionGrade({
      forecast,
      current: forecast.current,
      vineyard: buildVineyard({ frost_risk: true }),
      severity: 'critical',
    });
    expect(res.canBeOperational).toBe(false);
    expect(res.grade).not.toBe('operational');
    expect(['advisory', 'inspect', 'monitor', 'info']).toContain(res.grade);
  });
});

describe('getDiseaseDecisionGrade', () => {
  it('never reaches operational for generic disease proxy', () => {
    const forecast = buildForecast();
    const res = getDiseaseDecisionGrade({
      forecast,
      current: forecast.current,
      vineyard: buildVineyard({ disease_prone: true }),
      severity: 'critical',
    });
    expect(res.canBeOperational).toBe(false);
    expect(res.grade).not.toBe('operational');
    expect(res.defaultsUsed).toEqual(
      expect.arrayContaining(['Leaf wetness (proxy only)'])
    );
  });
});

describe('getSatelliteDecisionGrade', () => {
  it('blocks on poor scene quality', () => {
    const res = getSatelliteDecisionGrade({
      latest: buildNdviSample(),
      sceneQuality: 'poor',
      sampleCount: 8,
      hasBaseline: true,
      hasPeers: true,
      declineSignal: true,
      anomalyRepeated: true,
    });
    expect(res.grade).toBe('insufficient-data');
    expect(res.blockers).toEqual(
      expect.arrayContaining(['Scene quality too poor for decision-grade'])
    );
  });

  it('never grants operational even on strong, corroborated signal', () => {
    const res = getSatelliteDecisionGrade({
      latest: buildNdviSample(),
      sceneQuality: 'good',
      sampleCount: 10,
      hasBaseline: true,
      hasPeers: true,
      declineSignal: true,
      anomalyRepeated: true,
      corroborated: true,
    });
    expect(res.canBeOperational).toBe(false);
    expect(res.grade).not.toBe('operational');
    expect(res.grade).toBe('inspect');
  });

  it('stays at monitor/advisory when scene is fair and not corroborated', () => {
    const res = getSatelliteDecisionGrade({
      latest: buildNdviSample(),
      sceneQuality: 'fair',
      sampleCount: 4,
      hasBaseline: false,
      hasPeers: false,
      declineSignal: true,
    });
    expect(['monitor', 'advisory']).toContain(res.grade);
  });

  it('blocks simulated fallback imagery', () => {
    const res = getSatelliteDecisionGrade({
      latest: buildNdviSample({ sourceType: 'simulated' }),
      sceneQuality: 'good',
      sampleCount: 10,
      hasBaseline: true,
      hasPeers: true,
      declineSignal: true,
    });
    expect(res.blockers).toEqual(
      expect.arrayContaining(['Simulated fallback imagery'])
    );
    expect(res.grade).toBe('insufficient-data');
  });
});

describe('operational grade regression protection', () => {
  it('no-probe + fresh weather + clean config stays advisory (needs ground truth)', () => {
    const res = getIrrigationDecisionGrade({
      vineyard: buildVineyard(),
      season: buildSeason(),
      forecast: buildForecast(),
      probeMoisturePct: null,
      probeObservedAt: null,
      desiredState: 'irrigate-today',
    });
    expect(res.canBeOperational).toBe(false);
    expect(res.grade).toBe('advisory');
  });

  it('stale weather + fresh probe still gates operational when forecast stale', () => {
    const staleForecast = buildForecast({ fetchedAt: daysAgo(2) });
    const res = getIrrigationDecisionGrade({
      vineyard: buildVineyard(),
      season: buildSeason(),
      forecast: staleForecast,
      probeMoisturePct: 28,
      probeObservedAt: hoursAgo(1),
      desiredState: 'irrigate-today',
    });
    expect(res.canBeOperational).toBe(false);
  });
});
