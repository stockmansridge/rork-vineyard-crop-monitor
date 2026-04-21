import { describe, it, expect } from 'bun:test';
import {
  summarizeBlockHistory,
  priorityBoostForTrigger,
} from '@/lib/blockHistory';
import { buildScoutTask, daysAgo } from './fixtures';

describe('summarizeBlockHistory', () => {
  it('flags recurring triggers when confirmed ≥ 2', () => {
    const tasks = [
      buildScoutTask({ trigger_kind: 'irrigation', outcome: 'confirmed', created_at: daysAgo(10) }),
      buildScoutTask({ trigger_kind: 'irrigation', outcome: 'confirmed', created_at: daysAgo(30) }),
      buildScoutTask({ trigger_kind: 'irrigation', outcome: 'partial', created_at: daysAgo(60) }),
    ];
    const summary = summarizeBlockHistory(tasks);
    expect(summary.recurringTriggers).toContain('irrigation');
    expect(summary.confirmedRate).toBeGreaterThan(0.5);
  });

  it('tracks false-alarm rate', () => {
    const tasks = [
      buildScoutTask({ trigger_kind: 'disease', outcome: 'false_alarm', created_at: daysAgo(5) }),
      buildScoutTask({ trigger_kind: 'disease', outcome: 'false_alarm', created_at: daysAgo(15) }),
      buildScoutTask({ trigger_kind: 'disease', outcome: 'confirmed', created_at: daysAgo(25) }),
    ];
    const summary = summarizeBlockHistory(tasks);
    expect(summary.falseAlarmRate).toBeGreaterThan(0);
    const disease = summary.topTriggers.find((t) => t.trigger === 'disease');
    expect(disease?.falseAlarms).toBe(2);
  });

  it('flags persistent triggers with unresolved follow-ups', () => {
    const tasks = [
      buildScoutTask({
        trigger_kind: 'drainage',
        follow_up_result: 'unresolved',
        created_at: daysAgo(10),
      }),
      buildScoutTask({
        trigger_kind: 'drainage',
        follow_up_result: 'recurring',
        created_at: daysAgo(30),
      }),
    ];
    const summary = summarizeBlockHistory(tasks);
    expect(summary.persistentTriggers).toContain('drainage');
  });
});

describe('priorityBoostForTrigger', () => {
  it('boosts confidence/urgency when trigger is recurring', () => {
    const tasks = [
      buildScoutTask({ trigger_kind: 'irrigation', outcome: 'confirmed', created_at: daysAgo(5) }),
      buildScoutTask({ trigger_kind: 'irrigation', outcome: 'confirmed', created_at: daysAgo(20) }),
    ];
    const summary = summarizeBlockHistory(tasks);
    const boost = priorityBoostForTrigger(summary, 'irrigation');
    expect(boost.urgencyBoost).toBeGreaterThan(0);
    expect(boost.confidenceBoost).toBeGreaterThan(0);
    expect(boost.note).not.toBeNull();
  });

  it('lowers confidence/urgency on frequent false alarms', () => {
    const tasks = [
      buildScoutTask({ trigger_kind: 'disease', outcome: 'false_alarm', created_at: daysAgo(5) }),
      buildScoutTask({ trigger_kind: 'disease', outcome: 'false_alarm', created_at: daysAgo(15) }),
      buildScoutTask({ trigger_kind: 'disease', outcome: 'false_alarm', created_at: daysAgo(25) }),
    ];
    const summary = summarizeBlockHistory(tasks);
    const boost = priorityBoostForTrigger(summary, 'disease');
    expect(boost.confidenceBoost).toBeLessThan(0);
    expect(boost.urgencyBoost).toBeLessThan(0);
  });

  it('suggests stronger follow-up when previous responses ineffective', () => {
    const tasks = [
      buildScoutTask({ trigger_kind: 'drainage', effectiveness: 'ineffective', created_at: daysAgo(5) }),
      buildScoutTask({ trigger_kind: 'drainage', effectiveness: 'ineffective', created_at: daysAgo(20) }),
    ];
    const summary = summarizeBlockHistory(tasks);
    const boost = priorityBoostForTrigger(summary, 'drainage');
    expect(boost.followUpNote).not.toBeNull();
  });

  it('no boost when trigger has fewer than 2 cases', () => {
    const tasks = [buildScoutTask({ trigger_kind: 'frost', created_at: daysAgo(5) })];
    const summary = summarizeBlockHistory(tasks);
    const boost = priorityBoostForTrigger(summary, 'frost');
    expect(boost.urgencyBoost).toBe(0);
    expect(boost.confidenceBoost).toBe(0);
  });

  it('clamps urgency boost within [-1, 2]', () => {
    const tasks = Array.from({ length: 6 }).map((_, i) =>
      buildScoutTask({
        trigger_kind: 'irrigation',
        outcome: 'confirmed',
        follow_up_result: 'unresolved',
        effectiveness: 'ineffective',
        created_at: daysAgo(i * 5 + 1),
      })
    );
    const summary = summarizeBlockHistory(tasks);
    const boost = priorityBoostForTrigger(summary, 'irrigation');
    expect(boost.urgencyBoost).toBeLessThanOrEqual(2);
    expect(boost.urgencyBoost).toBeGreaterThanOrEqual(-1);
    expect(boost.confidenceBoost).toBeLessThanOrEqual(0.35);
    expect(boost.confidenceBoost).toBeGreaterThanOrEqual(-0.35);
  });
});
