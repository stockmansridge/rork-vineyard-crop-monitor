import type { DbScoutTask, ScoutTriggerKind } from '@/lib/scoutTasks';

export interface TriggerStats {
  trigger: ScoutTriggerKind;
  count: number;
  confirmed: number;
  falseAlarms: number;
  lastOccurredAt: string | null;
  recurring: boolean;
}

export interface BlockHistorySummary {
  totalInspections: number;
  openCount: number;
  resolvedCount: number;
  monitoringCount: number;
  confirmedRate: number;
  falseAlarmRate: number;
  effectivenessRate: number;
  topTriggers: TriggerStats[];
  recurringTriggers: ScoutTriggerKind[];
  lastInspectionAt: string | null;
  seasonalPattern: { month: number; count: number }[];
}

export function summarizeBlockHistory(tasks: DbScoutTask[]): BlockHistorySummary {
  const total = tasks.length;
  const open = tasks.filter((t) => t.status === 'open' || t.status === 'in_progress').length;
  const resolved = tasks.filter((t) => t.status === 'resolved').length;
  const monitoring = tasks.filter((t) => t.status === 'monitoring').length;

  const withOutcome = tasks.filter((t) => t.outcome);
  const confirmed = withOutcome.filter((t) => t.outcome === 'confirmed' || t.outcome === 'partial').length;
  const falseAlarm = withOutcome.filter((t) => t.outcome === 'false_alarm').length;

  const withEffectiveness = tasks.filter((t) => t.effectiveness && t.effectiveness !== 'unknown');
  const effective = withEffectiveness.filter((t) => t.effectiveness === 'effective').length;

  const grouped = new Map<ScoutTriggerKind, DbScoutTask[]>();
  for (const t of tasks) {
    const list = grouped.get(t.trigger_kind) ?? [];
    list.push(t);
    grouped.set(t.trigger_kind, list);
  }

  const triggerStats: TriggerStats[] = Array.from(grouped.entries()).map(([trigger, list]) => {
    const sorted = [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const cConfirmed = list.filter(
      (t) => t.outcome === 'confirmed' || t.outcome === 'partial' || t.follow_up_result === 'recurring'
    ).length;
    const cFalse = list.filter((t) => t.outcome === 'false_alarm').length;
    return {
      trigger,
      count: list.length,
      confirmed: cConfirmed,
      falseAlarms: cFalse,
      lastOccurredAt: sorted[0]?.created_at ?? null,
      recurring: list.length >= 2 && cConfirmed >= 2,
    };
  });

  triggerStats.sort((a, b) => b.count - a.count);

  const seasonalMap = new Map<number, number>();
  for (const t of tasks) {
    const d = new Date(t.created_at);
    if (Number.isFinite(d.getTime())) {
      const m = d.getMonth();
      seasonalMap.set(m, (seasonalMap.get(m) ?? 0) + 1);
    }
  }
  const seasonalPattern = Array.from({ length: 12 }).map((_, i) => ({
    month: i,
    count: seasonalMap.get(i) ?? 0,
  }));

  const lastInspection = tasks
    .filter((t) => t.inspected_at)
    .sort((a, b) => ((a.inspected_at ?? '') < (b.inspected_at ?? '') ? 1 : -1))[0]?.inspected_at ?? null;

  return {
    totalInspections: total,
    openCount: open,
    resolvedCount: resolved,
    monitoringCount: monitoring,
    confirmedRate: withOutcome.length ? confirmed / withOutcome.length : 0,
    falseAlarmRate: withOutcome.length ? falseAlarm / withOutcome.length : 0,
    effectivenessRate: withEffectiveness.length ? effective / withEffectiveness.length : 0,
    topTriggers: triggerStats,
    recurringTriggers: triggerStats.filter((s) => s.recurring).map((s) => s.trigger),
    lastInspectionAt: lastInspection,
    seasonalPattern,
  };
}

export function priorityBoostForTrigger(
  summary: BlockHistorySummary,
  trigger: ScoutTriggerKind
): { confidenceBoost: number; urgencyBoost: number; note: string | null } {
  const stats = summary.topTriggers.find((s) => s.trigger === trigger);
  if (!stats || stats.count < 2) return { confidenceBoost: 0, urgencyBoost: 0, note: null };

  if (stats.recurring) {
    return {
      confidenceBoost: 0.25,
      urgencyBoost: 1,
      note: `Recurring on this block (${stats.count} past cases, ${stats.confirmed} confirmed)`,
    };
  }
  if (stats.falseAlarms >= 2 && stats.falseAlarms > stats.confirmed) {
    return {
      confidenceBoost: -0.25,
      urgencyBoost: -1,
      note: `Frequently false alarm on this block (${stats.falseAlarms}/${stats.count})`,
    };
  }
  return { confidenceBoost: 0, urgencyBoost: 0, note: null };
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function monthLabel(m: number): string {
  return MONTH_LABELS[m] ?? '';
}
