import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  Eye,
  CheckCheck,
  Clock,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  MapPin,
  Sparkles,
  X,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useScoutTasks } from '@/providers/ScoutTasksProvider';
import { useVineyards } from '@/providers/VineyardProvider';
import { useAlerts } from '@/providers/AlertsProvider';
import { useAuth } from '@/providers/AuthProvider';
import {
  computeRecommendations,
  type ProbeSnapshot,
} from '@/lib/recommendations';
import {
  recommendationToDraft,
  statusLabel,
  triggerLabel,
  type ScoutStatus,
  type DbScoutTask,
} from '@/lib/scoutTasks';
import { freshnessLabel } from '@/lib/dataTrust';
import { useVineyardPermissions } from '@/hooks/usePermissions';
import { Alert } from 'react-native';

type Filter = 'all' | 'open' | 'in_progress' | 'resolved';

function urgencyConfig(u: DbScoutTask['urgency']) {
  switch (u) {
    case 'critical':
      return { color: Colors.danger, bg: Colors.dangerMuted, Icon: AlertCircle };
    case 'high':
      return { color: Colors.warning, bg: Colors.warningMuted, Icon: AlertTriangle };
    case 'medium':
      return { color: Colors.info, bg: Colors.infoMuted, Icon: Info };
    case 'low':
      return { color: Colors.textSecondary, bg: Colors.backgroundAlt, Icon: Eye };
  }
}

function statusConfig(s: ScoutStatus): { color: string; bg: string } {
  switch (s) {
    case 'open':
      return { color: Colors.warning, bg: Colors.warningMuted };
    case 'in_progress':
      return { color: Colors.info, bg: Colors.infoMuted };
    case 'resolved':
      return { color: Colors.primary, bg: Colors.primaryMuted };
    case 'monitoring':
      return { color: Colors.info, bg: Colors.infoMuted };
    case 'ignored':
      return { color: Colors.textMuted, bg: Colors.backgroundAlt };
    default:
      return { color: Colors.textMuted, bg: Colors.backgroundAlt };
  }
}

export default function ScoutTasksScreen() {
  const router = useRouter();
  const { tasks, createTask, findByRecId, isCreating } = useScoutTasks();
  const scoutTasksAll = tasks;
  const { vineyards, canOnVineyard } = useVineyards();
  const canCreateScoutOn = (vid: string) => canOnVineyard(vid, 'scout.create');
  const { forecasts, probes, prefs } = useAlerts();
  const { isDemoMode } = useAuth();
  const [filter, setFilter] = useState<Filter>('open');

  const probeSnapshots: ProbeSnapshot[] = useMemo(
    () =>
      probes.map((p) => ({
        id: p.id,
        name: p.name,
        vineyard_id: p.vineyard_id,
        moisture: p.moisture,
        temperature: p.temperature,
        ph: p.ph,
        last_reading: p.last_reading,
        is_online: p.is_online,
        battery_level: p.battery_level,
      })),
    [probes]
  );

  const recs = useMemo(
    () =>
      computeRecommendations({
        vineyards,
        forecasts,
        probes: probeSnapshots,
        isDemoMode,
        scoutTasks: scoutTasksAll,
        thresholds: {
          frostTempC: prefs.thresholds.frostTempC,
          heatTempC: prefs.thresholds.heatTempC,
          windSprayMaxKmh: 20,
          rainHoldMm: 3,
          lowMoisturePct: prefs.thresholds.lowMoisturePct,
          highMoisturePct: prefs.thresholds.highMoisturePct,
        },
      }),
    [vineyards, forecasts, probeSnapshots, isDemoMode, prefs.thresholds, scoutTasksAll]
  );

  const suggestions = useMemo(() => {
    return recs
      .filter((r) => r.vineyardId && !findByRecId(r.id))
      .filter(
        (r) =>
          r.kind === 'inspect' ||
          r.kind === 'disease-risk' ||
          r.kind === 'drainage' ||
          r.kind === 'frost-watch' ||
          r.kind === 'heat-watch' ||
          r.kind === 'irrigate'
      )
      .slice(0, 4);
  }, [recs, findByRecId]);

  const filtered = useMemo(() => {
    if (filter === 'all') return tasks;
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter]);

  const handleAccept = async (recId: string) => {
    const rec = recs.find((r) => r.id === recId);
    if (!rec) return;
    const draft = recommendationToDraft(rec);
    if (!draft) return;
    if (!canCreateScoutOn(draft.vineyard_id)) {
      Alert.alert('Not allowed', 'Your role cannot create scout tasks on this block. Ask an owner or manager.');
      return;
    }
    try {
      const created = await createTask(draft);
      router.push({ pathname: '/scout-task-detail', params: { id: created.id } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create scout task';
      Alert.alert('Error', msg);
    }
  };

  const vineyardName = (id: string) => vineyards.find((v) => v.id === id)?.name ?? 'Block';

  return (
    <>
      <Stack.Screen options={{ title: 'Scout Tasks' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {suggestions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeadLeft}>
                <Sparkles size={14} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Suggested inspections</Text>
              </View>
            </View>
            <Text style={styles.sectionHint}>
              Turn remote signals into field checks. Accept to create a task you can complete on the block.
            </Text>
            {suggestions.map((rec) => {
              const cfg = urgencyConfig(rec.priority);
              const canScoutHere = rec.vineyardId ? canCreateScoutOn(rec.vineyardId) : false;
              return (
                <View key={rec.id} style={styles.suggestionCard} testID={`scout-sugg-${rec.id}`}>
                  <View style={[styles.iconBox, { backgroundColor: cfg.bg }]}>
                    <cfg.Icon size={16} color={cfg.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionTitle} numberOfLines={2}>{rec.title}</Text>
                    <Text style={styles.suggestionReason} numberOfLines={2}>{rec.reason}</Text>
                    <View style={styles.metaRow}>
                      <Text style={[styles.metaText, { color: cfg.color }]}>{rec.priority}</Text>
                      <Text style={styles.metaDot}>·</Text>
                      <ShieldCheck size={10} color={Colors.textMuted} />
                      <Text style={styles.metaText}>{rec.confidence} confidence</Text>
                    </View>
                  </View>
                  {canScoutHere && (
                    <Pressable
                      disabled={isCreating}
                      onPress={() => void handleAccept(rec.id)}
                      style={({ pressed }) => [styles.acceptBtn, pressed && styles.pressed]}
                    >
                      <Text style={styles.acceptBtnText}>Scout</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.filterRow}>
          {(['open', 'in_progress', 'resolved', 'all'] as Filter[]).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={({ pressed }) => [
                styles.filterChip,
                filter === f && styles.filterChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? 'All' : f === 'in_progress' ? 'In progress' : f === 'open' ? 'Open' : 'Resolved'}
              </Text>
            </Pressable>
          ))}
        </View>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <CheckCheck size={28} color={Colors.primary} />
            <Text style={styles.emptyTitle}>No {filter === 'all' ? '' : filter.replace('_', ' ')} tasks</Text>
            <Text style={styles.emptyText}>
              When the system detects issues, they&apos;ll appear as field inspections you can complete and resolve.
            </Text>
          </View>
        ) : (
          filtered.map((task) => {
            const uCfg = urgencyConfig(task.urgency);
            const sCfg = statusConfig(task.status);
            return (
              <Pressable
                key={task.id}
                onPress={() =>
                  router.push({ pathname: '/scout-task-detail', params: { id: task.id } })
                }
                style={({ pressed }) => [styles.taskCard, pressed && styles.pressed]}
                testID={`scout-task-${task.id}`}
              >
                <View style={[styles.iconBox, { backgroundColor: uCfg.bg }]}>
                  <uCfg.Icon size={16} color={uCfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                    <View style={[styles.statusPill, { backgroundColor: sCfg.bg }]}>
                      <Text style={[styles.statusText, { color: sCfg.color }]}>
                        {statusLabel(task.status)}
                      </Text>
                    </View>
                  </View>
                  {task.reason && (
                    <Text style={styles.taskReason} numberOfLines={2}>{task.reason}</Text>
                  )}
                  <View style={styles.metaRow}>
                    <MapPin size={10} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{vineyardName(task.vineyard_id)}</Text>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.metaText}>{triggerLabel(task.trigger_kind)}</Text>
                    <Text style={styles.metaDot}>·</Text>
                    <Clock size={10} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{freshnessLabel(task.created_at)}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 10 },
  section: { gap: 10, marginBottom: 6 },
  sectionHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const },
  sectionHeadLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  sectionTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' as const },
  sectionHint: { color: Colors.textMuted, fontSize: 12, lineHeight: 16 },
  suggestionCard: {
    flexDirection: 'row' as const,
    gap: 12,
    alignItems: 'flex-start' as const,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  suggestionTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' as const },
  suggestionReason: { color: Colors.textSecondary, fontSize: 12, marginTop: 2, lineHeight: 16 },
  acceptBtn: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'center' as const,
  },
  acceptBtnText: { color: Colors.primary, fontSize: 12, fontWeight: '700' as const },
  filterRow: { flexDirection: 'row' as const, gap: 8, marginTop: 8, marginBottom: 4 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  filterChipActive: { backgroundColor: Colors.primaryMuted, borderColor: Colors.primary + '60' },
  filterText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' as const },
  filterTextActive: { color: Colors.primary },
  taskCard: {
    flexDirection: 'row' as const,
    gap: 12,
    alignItems: 'flex-start' as const,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  titleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  taskTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' as const, flex: 1 },
  statusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.3 },
  taskReason: { color: Colors.textSecondary, fontSize: 12, marginTop: 3, lineHeight: 16 },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 6,
    flexWrap: 'wrap' as const,
  },
  metaText: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' as const, textTransform: 'capitalize' as const },
  metaDot: { color: Colors.textMuted, fontSize: 10 },
  pressed: { opacity: 0.75 },
  empty: {
    alignItems: 'center' as const,
    padding: 32,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 8,
    marginTop: 20,
  },
  emptyTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' as const, textTransform: 'capitalize' as const },
  emptyText: { color: Colors.textSecondary, fontSize: 12, textAlign: 'center' as const, lineHeight: 17 },
});
