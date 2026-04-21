import type { DbScoutTask, ScoutTriggerKind } from '@/lib/scoutTasks';

export interface TriggerStats {
  trigger: ScoutTriggerKind;
  count: number;
  confirmed: number;
  falseAlarms: number;
  unresolved: number;
  ineffective: number;
  lastOccurredAt: string | null;
  recurring: boolean;
  recentScore: number;
  confirmedRate: number;
  falseAlarmRate: number;
  ineffectiveRate: number;
}

export interface BlockHistorySummary {
  totalInspections: number;
  openCount: number;
  resolvedCount: number;
  monitoringCount: number;
  unresolvedCount: number;
  confirmedRate: number;
  falseAlarmRate: number;
  effectivenessRate: number;
  ineffectivenessRate: number;
  topTriggers: TriggerStats[];
  recurringTriggers: ScoutTriggerKind[];
  persistentTriggers: ScoutTriggerKind[];
  lastInspectionAt: string | null;
  seasonalPattern: { month: number; count: number }[];
  learningNotes: string[];
}

const RECENT_HALF_LIFE_DAYS = 45;

function recencyWeight(iso: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  const ageDays = Math.max(0, (Date.now() - t) / (1000 * 60 * 60 * 24));
  return Math.pow(0.5, ageDays / RECENT_HALF_LIFE_DAYS);
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
  const ineffective = withEffectiveness.filter((t) => t.effectiveness === 'ineffective').length;

  const unresolvedTasks = tasks.filter(
    (t) =>
      t.follow_up_result === 'unresolved' ||
      t.follow_up_result === 'worsened' ||
      t.follow_up_result === 'recurring' ||
      t.status === 'monitoring'
  );

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
    const cUnresolved = list.filter(
      (t) =>
        t.follow_up_result === 'unresolved' ||
        t.follow_up_result === 'worsened' ||
        t.follow_up_result === 'recurring'
    ).length;
    const cIneffective = list.filter((t) => t.effectiveness === 'ineffective').length;

    const recentScore = list.reduce((sum, t) => sum + recencyWeight(t.created_at), 0);
    const withOutcomeList = list.filter((t) => t.outcome);
    const withEffList = list.filter((t) => t.effectiveness && t.effectiveness !== 'unknown');

    return {
      trigger,
      count: list.length,
      confirmed: cConfirmed,
      falseAlarms: cFalse,
      unresolved: cUnresolved,
      ineffective: cIneffective,
      lastOccurredAt: sorted[0]?.created_at ?? null,
      recurring: list.length >= 2 && cConfirmed >= 2,
      recentScore,
      confirmedRate: withOutcomeList.length ? cConfirmed / withOutcomeList.length : 0,
      falseAlarmRate: withOutcomeList.length ? cFalse / withOutcomeList.length : 0,
      ineffectiveRate: withEffList.length ? cIneffective / withEffList.length : 0,
    };
  });

  triggerStats.sort((a, b) => b.recentScore - a.recentScore || b.count - a.count);

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

  const persistentTriggers = triggerStats.filter((s) => s.unresolved >= 2).map((s) => s.trigger);

  const learningNotes: string[] = [];
  for (const s of triggerStats) {
    if (s.recurring) {
      learningNotes.push(
        `${humanTrigger(s.trigger)}: recurring on this block (${s.confirmed}/${s.count} confirmed). Future alerts boosted.`
      );
    }
    if (s.falseAlarms >= 2 && s.falseAlarms > s.confirmed) {
      learningNotes.push(
        `${humanTrigger(s.trigger)}: frequent false alarms (${s.falseAlarms}/${s.count}). Future alerts de-prioritised.`
      );
    }
    if (s.ineffective >= 2) {
      learningNotes.push(
        `${humanTrigger(s.trigger)}: previous responses were ineffective ${s.ineffective} time(s). Stronger follow-up suggested.`
      );
    }
    if (s.unresolved >= 2) {
      learningNotes.push(
        `${humanTrigger(s.trigger)}: ${s.unresolved} unresolved follow-ups. Monitoring priority raised.`
      );
    }
  }

  return {
    totalInspections: total,
    openCount: open,
    resolvedCount: resolved,
    monitoringCount: monitoring,
    unresolvedCount: unresolvedTasks.length,
    confirmedRate: withOutcome.length ? confirmed / withOutcome.length : 0,
    falseAlarmRate: withOutcome.length ? falseAlarm / withOutcome.length : 0,
    effectivenessRate: withEffectiveness.length ? effective / withEffectiveness.length : 0,
    ineffectivenessRate: withEffectiveness.length ? ineffective / withEffectiveness.length : 0,
    topTriggers: triggerStats,
    recurringTriggers: triggerStats.filter((s) => s.recurring).map((s) => s.trigger),
    persistentTriggers,
    lastInspectionAt: lastInspection,
    seasonalPattern,
    learningNotes,
  };
}

export interface TriggerBoost {
  confidenceBoost: number;
  urgencyBoost: number;
  note: string | null;
  followUpNote: string | null;
}

export function priorityBoostForTrigger(
  summary: BlockHistorySummary,
  trigger: ScoutTriggerKind
): TriggerBoost {
  const stats = summary.topTriggers.find((s) => s.trigger === trigger);
  if (!stats || stats.count < 2) {
    return { confidenceBoost: 0, urgencyBoost: 0, note: null, followUpNote: null };
  }

  let confidenceBoost = 0;
  let urgencyBoost = 0;
  const notes: string[] = [];
  let followUpNote: string | null = null;

  const recentWeight = Math.min(1, stats.recentScore / 2);

  if (stats.recurring) {
    confidenceBoost += 0.25 * (0.5 + 0.5 * recentWeight);
    urgencyBoost += 1;
    notes.push(
      `Recurring on this block (${stats.count} cases, ${stats.confirmed} confirmed)`
    );
  }

  if (stats.falseAlarms >= 2 && stats.falseAlarms > stats.confirmed) {
    confidenceBoost -= 0.25 * (0.5 + 0.5 * recentWeight);
    urgencyBoost -= 1;
    notes.push(`Frequent false alarms on this block (${stats.falseAlarms}/${stats.count})`);
  }

  if (stats.unresolved >= 2) {
    urgencyBoost += 1;
    notes.push(`${stats.unresolved} unresolved follow-ups — monitoring priority raised`);
  }

  if (stats.ineffective >= 2) {
    followUpNote =
      'Previous responses were ineffective here — consider a stronger follow-up action.';
    notes.push(`Previous response ineffective ×${stats.ineffective}`);
  }

  // Clamp
  urgencyBoost = Math.max(-1, Math.min(2, urgencyBoost));
  confidenceBoost = Math.max(-0.35, Math.min(0.35, confidenceBoost));

  return {
    confidenceBoost,
    urgencyBoost,
    note: notes.length > 0 ? notes.join(' · ') : null,
    followUpNote,
  };
}

function humanTrigger(t: ScoutTriggerKind): string {
  switch (t) {
    case 'falling-vigor':
      return 'Vigor decline';
    case 'moisture-pattern':
      return 'Moisture pattern';
    case 'irrigation':
      return 'Irrigation';
    case 'disease':
      return 'Disease';
    case 'frost':
      return 'Frost';
    case 'heat':
      return 'Heat stress';
    case 'drainage':
      return 'Drainage';
    case 'manual':
      return 'Manual scout';
    case 'other':
      return 'Scouting';
  }
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function monthLabel(m: number): string {
  return MONTH_LABELS[m] ?? '';
}
