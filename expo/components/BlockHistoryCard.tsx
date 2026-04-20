import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  History,
  TrendingUp,
  Repeat,
  ChevronRight,
  ShieldCheck,
  AlertOctagon,
  CheckCircle2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import type { DbScoutTask } from '@/lib/scoutTasks';
import { triggerLabel, followUpResultLabel } from '@/lib/scoutTasks';
import { summarizeBlockHistory, monthLabel } from '@/lib/blockHistory';
import { freshnessLabel } from '@/lib/dataTrust';

interface Props {
  vineyardId: string;
  tasks: DbScoutTask[];
}

export default function BlockHistoryCard({ vineyardId, tasks }: Props) {
  const router = useRouter();
  const summary = useMemo(() => summarizeBlockHistory(tasks), [tasks]);
  const recent = useMemo(
    () => [...tasks].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 4),
    [tasks]
  );
  const maxSeason = useMemo(
    () => Math.max(1, ...summary.seasonalPattern.map((s) => s.count)),
    [summary]
  );

  if (tasks.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <History size={16} color={Colors.primary} />
          <Text style={styles.title}>Block history</Text>
        </View>
        <Text style={styles.hint}>
          Past alerts, inspections and outcomes will appear here once you start logging scout tasks.
        </Text>
      </View>
    );
  }

  const confirmedPct = Math.round(summary.confirmedRate * 100);
  const effectivePct = Math.round(summary.effectivenessRate * 100);

  return (
    <View style={styles.card} testID={`block-history-${vineyardId}`}>
      <View style={styles.headerRow}>
        <History size={16} color={Colors.primary} />
        <Text style={styles.title}>Block history</Text>
        {summary.lastInspectionAt && (
          <Text style={styles.headerSub}>
            Last check {freshnessLabel(summary.lastInspectionAt)}
          </Text>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{summary.totalInspections}</Text>
          <Text style={styles.statLabel}>Inspections</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={[styles.statValue, { color: Colors.warning }]}>
            {summary.openCount + summary.monitoringCount}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={[styles.statValue, { color: Colors.primary }]}>{confirmedPct}%</Text>
          <Text style={styles.statLabel}>Confirmed</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={[styles.statValue, { color: Colors.info }]}>{effectivePct}%</Text>
          <Text style={styles.statLabel}>Effective</Text>
        </View>
      </View>

      {summary.recurringTriggers.length > 0 && (
        <View style={styles.recurringBox}>
          <Repeat size={12} color={Colors.danger} />
          <Text style={styles.recurringText}>
            Recurring on this block:{' '}
            {summary.recurringTriggers.map((t) => triggerLabel(t)).join(', ')}
          </Text>
        </View>
      )}

      {summary.topTriggers.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Repeated problem types</Text>
          <View style={styles.triggerList}>
            {summary.topTriggers.slice(0, 4).map((s) => {
              const ratio = summary.totalInspections > 0 ? s.count / summary.totalInspections : 0;
              return (
                <View key={s.trigger} style={styles.triggerRow}>
                  <View style={styles.triggerTop}>
                    <Text style={styles.triggerName}>{triggerLabel(s.trigger)}</Text>
                    <Text style={styles.triggerCount}>
                      {s.count} · {s.confirmed} confirmed
                      {s.falseAlarms > 0 ? ` · ${s.falseAlarms} false` : ''}
                    </Text>
                  </View>
                  <View style={styles.triggerBar}>
                    <View
                      style={[
                        styles.triggerFill,
                        {
                          width: `${Math.round(ratio * 100)}%`,
                          backgroundColor: s.recurring
                            ? Colors.danger
                            : s.falseAlarms > s.confirmed
                            ? Colors.warning
                            : Colors.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      <Text style={styles.sectionLabel}>Seasonal pattern</Text>
      <View style={styles.seasonRow}>
        {summary.seasonalPattern.map((m) => (
          <View key={m.month} style={styles.seasonCell}>
            <View
              style={[
                styles.seasonBar,
                {
                  height: 4 + Math.round((m.count / maxSeason) * 32),
                  backgroundColor: m.count > 0 ? Colors.primary : Colors.cardBorder,
                },
              ]}
            />
            <Text style={styles.seasonLabel}>{monthLabel(m.month)[0]}</Text>
          </View>
        ))}
      </View>

      {recent.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Recent inspections</Text>
          {recent.map((t) => {
            const Icon = t.status === 'resolved' ? CheckCircle2 : t.status === 'monitoring' ? TrendingUp : ShieldCheck;
            const color =
              t.status === 'resolved'
                ? Colors.primary
                : t.status === 'monitoring'
                ? Colors.info
                : t.outcome === 'false_alarm'
                ? Colors.textMuted
                : Colors.warning;
            return (
              <Pressable
                key={t.id}
                onPress={() => router.push({ pathname: '/scout-task-detail', params: { id: t.id } })}
                style={({ pressed }) => [styles.recentRow, pressed && styles.pressed]}
              >
                <Icon size={14} color={color} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentTitle} numberOfLines={1}>{t.title}</Text>
                  <Text style={styles.recentSub} numberOfLines={1}>
                    {triggerLabel(t.trigger_kind)} · {freshnessLabel(t.created_at)}
                    {t.follow_up_result ? ` · ${followUpResultLabel(t.follow_up_result)}` : ''}
                  </Text>
                </View>
                <ChevronRight size={14} color={Colors.textMuted} />
              </Pressable>
            );
          })}
        </>
      )}

      {summary.falseAlarmRate > 0.4 && summary.totalInspections >= 3 && (
        <View style={styles.insightBox}>
          <AlertOctagon size={12} color={Colors.warning} />
          <Text style={styles.insightText}>
            High false-alarm rate here. Future alerts on this block will be shown with reduced urgency.
          </Text>
        </View>
      )}
      {summary.recurringTriggers.length > 0 && (
        <View style={[styles.insightBox, { backgroundColor: Colors.dangerMuted }]}>
          <Repeat size={12} color={Colors.danger} />
          <Text style={[styles.insightText, { color: Colors.danger }]}>
            Recurring patterns boost confidence and urgency for similar alerts on this block.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 10,
  },
  headerRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  title: { color: Colors.text, fontSize: 15, fontWeight: '700' as const, flex: 1 },
  headerSub: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' as const },
  hint: { color: Colors.textMuted, fontSize: 12, lineHeight: 16 },
  statsRow: { flexDirection: 'row' as const, gap: 8 },
  statCell: {
    flex: 1,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center' as const,
  },
  statValue: { color: Colors.text, fontSize: 18, fontWeight: '800' as const },
  statLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' as const, marginTop: 2, textTransform: 'uppercase' as const, letterSpacing: 0.3 },
  recurringBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.dangerMuted,
    borderRadius: 10,
    padding: 9,
  },
  recurringText: { color: Colors.danger, fontSize: 11, fontWeight: '700' as const, flex: 1 },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    marginTop: 4,
  },
  triggerList: { gap: 8 },
  triggerRow: { gap: 5 },
  triggerTop: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  triggerName: { color: Colors.text, fontSize: 12, fontWeight: '700' as const },
  triggerCount: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' as const },
  triggerBar: { height: 5, backgroundColor: Colors.backgroundAlt, borderRadius: 3, overflow: 'hidden' as const },
  triggerFill: { height: 5, borderRadius: 3 },
  seasonRow: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, gap: 4, height: 48 },
  seasonCell: { flex: 1, alignItems: 'center' as const, gap: 4 },
  seasonBar: { width: '60%' as const, borderRadius: 2 },
  seasonLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '600' as const },
  recentRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 10,
    padding: 10,
  },
  recentTitle: { color: Colors.text, fontSize: 12, fontWeight: '700' as const },
  recentSub: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' as const, marginTop: 2, textTransform: 'capitalize' as const },
  insightBox: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 6,
    backgroundColor: Colors.warningMuted,
    borderRadius: 10,
    padding: 9,
  },
  insightText: { color: Colors.warning, fontSize: 11, fontWeight: '600' as const, flex: 1, lineHeight: 15 },
  pressed: { opacity: 0.8 },
});
