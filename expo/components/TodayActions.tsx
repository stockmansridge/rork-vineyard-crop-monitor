import React, { useMemo, useState } from 'react';
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
  Wrench,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import {
  computeRecommendations,
  type Recommendation,
  type RecommendationPriority,
  type RecommendationKind,
  type RecommendationGrade,
  type ProbeSnapshot,
  gradeLabel,
} from '@/lib/recommendations';
import RecommendationExplainModal from '@/components/RecommendationExplainModal';
import { useVineyards } from '@/providers/VineyardProvider';
import { useAlerts } from '@/providers/AlertsProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useScoutTasks } from '@/providers/ScoutTasksProvider';
import { recommendationToDraft } from '@/lib/scoutTasks';
import { summarizeBlockHistory } from '@/lib/blockHistory';

type SectionKey = 'act-now' | 'inspect' | 'setup';

interface SectionConfig {
  key: SectionKey;
  title: string;
  subtitle: string;
  Icon: typeof Zap;
  accent: string;
  accentBg: string;
}

const SECTIONS: Record<SectionKey, SectionConfig> = {
  'act-now': {
    key: 'act-now',
    title: 'Act now',
    subtitle: 'Operational recommendations backed by fresh, site-specific data',
    Icon: Zap,
    accent: Colors.primary,
    accentBg: Colors.primaryMuted,
  },
  inspect: {
    key: 'inspect',
    title: 'Inspect / verify',
    subtitle: 'Advisory signals that warrant a field check before acting',
    Icon: Eye,
    accent: Colors.warning,
    accentBg: Colors.warningMuted,
  },
  setup: {
    key: 'setup',
    title: 'Data & setup attention',
    subtitle: 'Stale data, missing inputs and readiness gaps weakening confidence',
    Icon: Wrench,
    accent: Colors.info,
    accentBg: Colors.infoMuted,
  },
};

function sectionForRec(rec: Recommendation): SectionKey {
  if (rec.kind === 'stale-data' || rec.kind === 'setup') return 'setup';
  if (rec.grade === 'insufficient-data') return 'setup';
  if (rec.grade === 'operational') return 'act-now';
  // advisory / inspect / monitor / info → inspect bucket
  return 'inspect';
}

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

function gradeColor(g: RecommendationGrade): { color: string; bg: string } {
  switch (g) {
    case 'operational':
      return { color: Colors.primary, bg: Colors.primaryMuted };
    case 'advisory':
      return { color: Colors.info, bg: Colors.infoMuted };
    case 'inspect':
      return { color: Colors.warning, bg: Colors.warningMuted };
    case 'monitor':
      return { color: Colors.secondary, bg: Colors.secondaryMuted };
    case 'info':
      return { color: Colors.textSecondary, bg: Colors.backgroundAlt };
    case 'insufficient-data':
      return { color: Colors.warning, bg: Colors.warningMuted };
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

const PRIORITY_WEIGHT: Record<RecommendationPriority, number> = {
  critical: 100,
  high: 60,
  medium: 30,
  low: 10,
};
const CONF_WEIGHT: Record<'high' | 'medium' | 'low', number> = {
  high: 25,
  medium: 12,
  low: 0,
};
const GRADE_WEIGHT: Record<RecommendationGrade, number> = {
  operational: 40,
  advisory: 15,
  inspect: 20,
  monitor: 5,
  info: 0,
  'insufficient-data': 0,
};

function blockImportanceScore(areaHa: number | null | undefined): number {
  if (!areaHa || areaHa <= 0) return 0;
  // Log-scaled so huge blocks don't dominate, but >5ha still matters
  return Math.min(20, Math.log2(areaHa + 1) * 6);
}

function scoreRecommendation(
  rec: Recommendation,
  blockAreaHa: number | null,
  repeatBoost: number
): number {
  return (
    PRIORITY_WEIGHT[rec.priority] +
    CONF_WEIGHT[rec.confidence] +
    GRADE_WEIGHT[rec.grade] +
    blockImportanceScore(blockAreaHa) +
    repeatBoost
  );
}

function RecommendationRow({
  rec,
  section,
  onPress,
  onScout,
  onExplain,
  existingTask,
  emphasis,
}: {
  rec: Recommendation;
  section: SectionKey;
  onPress: () => void;
  onScout?: () => void;
  onExplain: () => void;
  existingTask: boolean;
  emphasis: 'strong' | 'soft' | 'muted';
}) {
  const cfg = priorityConfig(rec.priority);
  const gcfg = gradeColor(rec.grade);
  const Icon = kindIcon(rec.kind);
  const canScout = !!rec.vineyardId && rec.kind !== 'setup' && rec.kind !== 'spray-ok';

  const rowStyles = [
    styles.row,
    emphasis === 'strong' && styles.rowStrong,
    emphasis === 'muted' && styles.rowMuted,
  ];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [...rowStyles, pressed && styles.pressed]}
      testID={`rec-${rec.id}`}
    >
      {emphasis === 'strong' && <View style={styles.strongBar} />}
      <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
        <Icon size={16} color={cfg.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.title,
              emphasis === 'muted' && styles.titleMuted,
            ]}
            numberOfLines={1}
          >
            {rec.title}
          </Text>
          {section !== 'setup' && (
            <View style={[styles.pill, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.pillText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          )}
        </View>
        <Text
          style={[
            styles.reason,
            emphasis === 'muted' && styles.reasonMuted,
          ]}
          numberOfLines={2}
        >
          {rec.reason}
        </Text>
        <View style={styles.metaRow}>
          <View
            style={[
              styles.gradeTag,
              { backgroundColor: gcfg.bg, borderColor: gcfg.color + '40' },
            ]}
          >
            <Text style={[styles.gradeTagText, { color: gcfg.color }]}>
              {gradeLabel(rec.grade)}
            </Text>
          </View>
          {section !== 'setup' && (
            <View style={styles.conf}>
              <ShieldCheck size={10} color={Colors.textMuted} />
              <Text style={styles.confText}>{rec.confidence} confidence</Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onExplain();
          }}
          style={({ pressed }) => [styles.explainBtn, pressed && styles.pressed]}
          hitSlop={6}
          testID={`explain-btn-${rec.id}`}
        >
          <Info size={11} color={Colors.textSecondary} />
          <Text style={styles.explainBtnText}>Why this recommendation</Text>
        </Pressable>
        {canScout && section !== 'setup' && (
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
            <Text style={[styles.scoutBtnText, existingTask && { color: Colors.primary }]}>
              {existingTask ? 'Open scout task' : 'Create scout task'}
            </Text>
          </Pressable>
        )}
      </View>
      <ChevronRight size={14} color={Colors.textMuted} />
    </Pressable>
  );
}

function SectionHeader({
  section,
  count,
}: {
  section: SectionConfig;
  count: number;
}) {
  const Icon = section.Icon;
  return (
    <View style={styles.sectionHeader} testID={`section-header-${section.key}`}>
      <View style={[styles.sectionIcon, { backgroundColor: section.accentBg }]}>
        <Icon size={14} color={section.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={[styles.countPill, { backgroundColor: section.accentBg }]}>
            <Text style={[styles.countPillText, { color: section.accent }]}>{count}</Text>
          </View>
        </View>
        <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
      </View>
    </View>
  );
}

export default function TodayActions() {
  const router = useRouter();
  const { vineyards } = useVineyards();
  const { forecasts, probes, prefs } = useAlerts();
  const { isDemoMode } = useAuth();
  const { findByRecId, createTask, tasks: scoutTasks } = useScoutTasks();
  const [explainRec, setExplainRec] = useState<Recommendation | null>(null);

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

  const blockAreaById = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of vineyards) {
      const unit = (v.area_unit ?? 'ha').toLowerCase();
      const areaHa = unit === 'ac' ? v.area * 0.404686 : v.area;
      map.set(v.id, areaHa);
    }
    return map;
  }, [vineyards]);

  const repeatBoostById = useMemo(() => {
    const map = new Map<string, number>();
    const byVineyard = new Map<string, typeof scoutTasks>();
    for (const t of scoutTasks) {
      const list = byVineyard.get(t.vineyard_id) ?? [];
      list.push(t);
      byVineyard.set(t.vineyard_id, list);
    }
    for (const [vid, list] of byVineyard.entries()) {
      if (list.length < 2) continue;
      const summary = summarizeBlockHistory(list);
      let score = 0;
      score += summary.recurringTriggers.length * 8;
      score += summary.persistentTriggers.length * 6;
      score += Math.round(summary.confirmedRate * 10);
      score -= Math.round(summary.falseAlarmRate * 10);
      map.set(vid, score);
    }
    return map;
  }, [scoutTasks]);

  const grouped = useMemo(() => {
    const buckets: Record<SectionKey, Recommendation[]> = {
      'act-now': [],
      inspect: [],
      setup: [],
    };
    for (const rec of recs) {
      buckets[sectionForRec(rec)].push(rec);
    }
    const rank = (rec: Recommendation): number => {
      const area = rec.vineyardId ? blockAreaById.get(rec.vineyardId) ?? null : null;
      const boost = rec.vineyardId ? repeatBoostById.get(rec.vineyardId) ?? 0 : 0;
      return scoreRecommendation(rec, area, boost);
    };
    (Object.keys(buckets) as SectionKey[]).forEach((k) => {
      buckets[k].sort((a, b) => rank(b) - rank(a));
    });
    return buckets;
  }, [recs, blockAreaById, repeatBoostById]);

  const totalCount = recs.length;
  const actNow = grouped['act-now'];
  const inspect = grouped.inspect;
  const setup = grouped.setup;

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

  const renderSection = (
    cfg: SectionConfig,
    items: Recommendation[],
    emphasis: 'strong' | 'soft' | 'muted',
    maxItems: number
  ) => {
    if (items.length === 0) return null;
    const visible = items.slice(0, maxItems);
    const remaining = items.length - visible.length;
    return (
      <View style={styles.section} testID={`section-${cfg.key}`}>
        <SectionHeader section={cfg} count={items.length} />
        <View style={styles.list}>
          {visible.map((rec) => (
            <RecommendationRow
              key={rec.id}
              rec={rec}
              section={cfg.key}
              onPress={() => handlePress(rec)}
              onScout={() => void handleScout(rec)}
              onExplain={() => setExplainRec(rec)}
              existingTask={!!findByRecId(rec.id)}
              emphasis={emphasis}
            />
          ))}
          {remaining > 0 && (
            <Text style={styles.moreText}>
              +{remaining} more {cfg.title.toLowerCase()} item{remaining !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container} testID="today-actions">
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Zap size={14} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>What to do today</Text>
            <Text style={styles.headerSub}>
              {totalCount > 0
                ? `${actNow.length} operational · ${inspect.length} to inspect · ${setup.length} data/setup`
                : 'No priority actions right now'}
            </Text>
          </View>
        </View>
      </View>

      {totalCount === 0 ? (
        <View style={styles.emptyCard}>
          <ShieldCheck size={22} color={Colors.primary} />
          <Text style={styles.emptyTitle}>All clear</Text>
          <Text style={styles.emptyText}>
            No immediate actions detected from current forecasts or probe data. Keep scouting
            blocks in person.
          </Text>
        </View>
      ) : (
        <View style={styles.sectionsWrap}>
          {renderSection(SECTIONS['act-now'], actNow, 'strong', 4)}
          {renderSection(SECTIONS.inspect, inspect, 'soft', 4)}
          {renderSection(SECTIONS.setup, setup, 'muted', 3)}
        </View>
      )}

      <RecommendationExplainModal
        recommendation={explainRec}
        visible={!!explainRec}
        onClose={() => setExplainRec(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
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
  sectionsWrap: {
    gap: 18,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  sectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sectionTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
    textTransform: 'uppercase' as const,
  },
  sectionSubtitle: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  countPill: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '800' as const,
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
  rowStrong: {
    backgroundColor: Colors.cardHover,
    borderColor: Colors.primary + '70',
    borderWidth: 1.5,
    paddingLeft: 16,
    shadowColor: Colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  rowMuted: {
    backgroundColor: Colors.backgroundAlt,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed' as const,
  },
  strongBar: {
    position: 'absolute' as const,
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
    backgroundColor: Colors.primary,
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
  titleMuted: {
    color: Colors.textSecondary,
    fontWeight: '600' as const,
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
  reasonMuted: {
    color: Colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap' as const,
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
  gradeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  gradeTagText: {
    fontSize: 9,
    fontWeight: '800' as const,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  explainBtn: {
    alignSelf: 'flex-start' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  explainBtnText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '700' as const,
    textDecorationLine: 'underline' as const,
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
  moreText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600' as const,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
});
