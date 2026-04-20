import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Droplets,
  Thermometer,
  Snowflake,
  SprayCan,
  CloudRain,
  Eye,
  ShieldCheck,
  Clock,
  Sparkles,
  ChevronRight,
  Zap,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import {
  computeRecommendations,
  type Recommendation,
  type RecommendationPriority,
  type RecommendationKind,
  type ProbeSnapshot,
} from '@/lib/recommendations';
import { useVineyards } from '@/providers/VineyardProvider';
import { useAlerts } from '@/providers/AlertsProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useScoutTasks } from '@/providers/ScoutTasksProvider';
import { recommendationToDraft } from '@/lib/scoutTasks';

function priorityConfig(p: RecommendationPriority) {
  switch (p) {
    case 'critical':
      return { color: Colors.danger, bg: Colors.dangerMuted, label: 'Critical' };
    case 'high':
      return { color: Colors.warning, bg: Colors.warningMuted, label: 'High' };
    case 'medium':
      return { color: Colors.info, bg: Colors.infoMuted, label: 'Medium' };
    case 'low':
      return { color: Colors.textSecondary, bg: Colors.backgroundAlt, label: 'Low' };
  }
}

function kindIcon(k: RecommendationKind) {
  switch (k) {
    case 'frost-watch':
      return Snowflake;
    case 'heat-watch':
      return Thermometer;
    case 'irrigate':
      return Droplets;
    case 'hold-irrigation':
      return CloudRain;
    case 'avoid-spray':
      return AlertTriangle;
    case 'spray-ok':
      return SprayCan;
    case 'disease-risk':
      return AlertCircle;
    case 'drainage':
      return CloudRain;
    case 'inspect':
      return Eye;
    case 'stale-data':
      return Clock;
    case 'setup':
      return Sparkles;
    default:
      return Info;
  }
}

function RecommendationRow({
  rec,
  onPress,
  onScout,
  existingTask,
}: {
  rec: Recommendation;
  onPress: () => void;
  onScout?: () => void;
  existingTask: boolean;
}) {
  const cfg = priorityConfig(rec.priority);
  const Icon = kindIcon(rec.kind);
  const canScout = !!rec.vineyardId && rec.kind !== 'setup' && rec.kind !== 'spray-ok';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={`rec-${rec.id}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
        <Icon size={16} color={cfg.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{rec.title}</Text>
          <View style={[styles.pill, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.pillText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <Text style={styles.reason} numberOfLines={2}>{rec.reason}</Text>
        <View style={styles.metaRow}>
          <View style={styles.conf}>
            <ShieldCheck size={10} color={Colors.textMuted} />
            <Text style={styles.confText}>{rec.confidence} confidence</Text>
          </View>
          {rec.trustNote && (
            <Text style={styles.trustNote} numberOfLines={1}>· {rec.trustNote}</Text>
          )}
        </View>
        {canScout && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onScout?.();
            }}
            style={({ pressed }) => [
              styles.scoutBtn,
              existingTask && styles.scoutBtnActive,
              pressed && styles.pressed,
            ]}
            hitSlop={6}
            testID={`scout-btn-${rec.id}`}
          >
            <Eye size={11} color={existingTask ? Colors.primary : Colors.textSecondary} />
            <Text
              style={[styles.scoutBtnText, existingTask && { color: Colors.primary }]}
            >
              {existingTask ? 'Open scout task' : 'Create scout task'}
            </Text>
          </Pressable>
        )}
      </View>
      <ChevronRight size={14} color={Colors.textMuted} />
    </Pressable>
  );
}

export default function TodayActions() {
  const router = useRouter();
  const { vineyards } = useVineyards();
  const { forecasts, probes, prefs } = useAlerts();
  const { isDemoMode } = useAuth();
  const { findByRecId, createTask, tasks: scoutTasks } = useScoutTasks();

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
        scoutTasks,
        thresholds: {
          frostTempC: prefs.thresholds.frostTempC,
          heatTempC: prefs.thresholds.heatTempC,
          windSprayMaxKmh: 20,
          rainHoldMm: 3,
          lowMoisturePct: prefs.thresholds.lowMoisturePct,
          highMoisturePct: prefs.thresholds.highMoisturePct,
        },
      }),
    [vineyards, forecasts, probeSnapshots, isDemoMode, prefs.thresholds, scoutTasks]
  );

  const topRecs = useMemo(() => recs.slice(0, 5), [recs]);

  const handlePress = (rec: Recommendation) => {
    if (rec.action?.route) {
      router.push(rec.action.route as never);
    } else if (rec.vineyardId) {
      router.push({ pathname: '/field-detail', params: { id: rec.vineyardId } });
    }
  };

  const handleScout = async (rec: Recommendation) => {
    const existing = findByRecId(rec.id);
    if (existing) {
      router.push({ pathname: '/scout-task-detail', params: { id: existing.id } });
      return;
    }
    const draft = recommendationToDraft(rec);
    if (!draft) return;
    const created = await createTask(draft);
    router.push({ pathname: '/scout-task-detail', params: { id: created.id } });
  };

  return (
    <View style={styles.container} testID="today-actions">
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Zap size={14} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>What to do today</Text>
            <Text style={styles.headerSub}>
              {topRecs.length > 0
                ? `${recs.length} action${recs.length !== 1 ? 's' : ''} across your estate`
                : 'No priority actions right now'}
            </Text>
          </View>
        </View>
      </View>

      {topRecs.length === 0 ? (
        <View style={styles.emptyCard}>
          <ShieldCheck size={22} color={Colors.primary} />
          <Text style={styles.emptyTitle}>All clear</Text>
          <Text style={styles.emptyText}>
            No immediate actions detected from current forecasts or probe data. Keep scouting blocks in person.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {topRecs.map((rec) => (
            <RecommendationRow
              key={rec.id}
              rec={rec}
              onPress={() => handlePress(rec)}
              onScout={() => void handleScout(rec)}
              existingTask={!!findByRecId(rec.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  headerLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    flex: 1,
  },
  headerIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700' as const,
  },
  headerSub: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 2,
  },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  title: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
    flex: 1,
  },
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  reason: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 6,
  },
  conf: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
  },
  confText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600' as const,
    textTransform: 'capitalize' as const,
  },
  trustNote: {
    color: Colors.textMuted,
    fontSize: 10,
    flex: 1,
  },
  pressed: {
    opacity: 0.75,
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center' as const,
    gap: 6,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 12,
    textAlign: 'center' as const,
    lineHeight: 17,
  },
  scoutBtn: {
    alignSelf: 'flex-start' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  scoutBtnActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary + '60',
  },
  scoutBtnText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '700' as const,
  },
});
