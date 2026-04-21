import { describe, it, expect } from 'bun:test';
import { isStale, evaluateTrust, trustConfidenceWeight } from '@/lib/dataTrust';
import { hoursAgo, daysAgo } from './fixtures';

describe('isStale', () => {
  it('returns true for null observedAt', () => {
    expect(isStale('probe', null)).toBe(true);
  });
  it('fresh probe reading within 12h is not stale', () => {
    expect(isStale('probe', hoursAgo(2))).toBe(false);
  });
  it('probe reading older than 12h is stale', () => {
    expect(isStale('probe', hoursAgo(24))).toBe(true);
  });
  it('satellite scene is not stale within 14 days', () => {
    expect(isStale('satellite', daysAgo(10))).toBe(false);
  });
  it('satellite scene older than 14 days is stale', () => {
    expect(isStale('satellite', daysAgo(20))).toBe(true);
  });
});

describe('evaluateTrust', () => {
  it('marks demo inputs as demo regardless of source', () => {
    const t = evaluateTrust({
      sourceType: 'derived',
      sourceName: 'x',
      observedAt: hoursAgo(1),
      scopeType: 'block',
      methodVersion: 'v1',
      kind: 'probe',
      isDemo: true,
    });
    expect(t.qualityFlag).toBe('demo');
    expect(t.isDecisionGrade).toBe(false);
  });

  it('stale observedAt degrades quality', () => {
    const t = evaluateTrust({
      sourceType: 'derived',
      sourceName: 'x',
      observedAt: daysAgo(2),
      scopeType: 'block',
      methodVersion: 'v1',
      kind: 'probe',
    });
    expect(t.qualityFlag).toBe('stale');
    expect(t.isDecisionGrade).toBe(false);
  });

  it('simulated source caps quality at low', () => {
    const t = evaluateTrust({
      sourceType: 'simulated',
      sourceName: 'sim',
      observedAt: hoursAgo(1),
      scopeType: 'block',
      methodVersion: 'v1',
      kind: 'satellite',
    });
    expect(t.qualityFlag).toBe('low');
  });

  it('observed source with fresh timestamp is decision-grade', () => {
    const t = evaluateTrust({
      sourceType: 'observed',
      sourceName: 'probe-A',
      observedAt: hoursAgo(1),
      scopeType: 'probe',
      methodVersion: 'v1',
      kind: 'probe',
    });
    expect(t.isDecisionGrade).toBe(true);
  });
});

describe('trustConfidenceWeight', () => {
  it('demo weight is zero', () => {
    const weight = trustConfidenceWeight({
      sourceType: 'simulated',
      sourceName: 'x',
      observedAt: null,
      ingestedAt: hoursAgo(1),
      qualityFlag: 'demo',
      scopeType: 'block',
      methodVersion: 'v1',
      isDecisionGrade: false,
    });
    expect(weight).toBe(0);
  });
  it('high weight is 1', () => {
    expect(
      trustConfidenceWeight({
        sourceType: 'observed',
        sourceName: 'x',
        observedAt: hoursAgo(1),
        ingestedAt: hoursAgo(1),
        qualityFlag: 'high',
        scopeType: 'block',
        methodVersion: 'v1',
        isDecisionGrade: true,
      })
    ).toBe(1);
  });
});
