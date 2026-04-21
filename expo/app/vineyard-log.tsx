import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Plus,
  Scissors,
  SprayCan,
  Wheat,
  Droplet,
  Leaf,
  ClipboardList,
  Sprout,
  FlaskConical,
  CheckCircle2,
  Clock,
  Trash2,
  Download,
  TrendingUp,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useVineyards } from '@/providers/VineyardProvider';
import { useRecords, TaskType, PhenologyStage } from '@/providers/RecordsProvider';
import { useVineyardPermissions } from '@/hooks/usePermissions';

type Tab = 'tasks' | 'phenology' | 'sprays' | 'harvests';

const TASK_ICONS: Record<TaskType, React.ComponentType<{ size?: number; color?: string }>> = {
  pruning: Scissors,
  spraying: SprayCan,
  harvesting: Wheat,
  irrigation: Droplet,
  fertilizing: Sprout,
  canopy: Leaf,
  scouting: ClipboardList,
  other: ClipboardList,
};

const PHENOLOGY_LABELS: Record<PhenologyStage, string> = {
  dormant: 'Dormant',
  budbreak: 'Budbreak',
  leaf_out: 'Leaf Out',
  flowering: 'Flowering',
  fruit_set: 'Fruit Set',
  veraison: 'Véraison',
  ripening: 'Ripening',
  harvest: 'Harvest',
  post_harvest: 'Post-Harvest',
  leaf_fall: 'Leaf Fall',
};

const PHENOLOGY_COLORS: Record<PhenologyStage, string> = {
  dormant: '#6B7280',
  budbreak: '#A7F3D0',
  leaf_out: '#34D399',
  flowering: '#FBBF24',
  fruit_set: '#FB923C',
  veraison: '#A855F7',
  ripening: '#DC2626',
  harvest: '#7C2D12',
  post_harvest: '#78350F',
  leaf_fall: '#92400E',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function VineyardLogScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: Tab }>();
  const router = useRouter();
  const { vineyards } = useVineyards();
  const vineyard = vineyards.find((v) => v.id === id);
  const [tab, setTab] = useState<Tab>((initialTab as Tab) ?? 'tasks');

  const {
    getVineyardTasks,
    getVineyardPhenology,
    getVineyardSprays,
    getVineyardHarvests,
    deleteTask,
    deletePhenology,
    deleteSpray,
    deleteHarvest,
    updateTask,
    isLoading,
  } = useRecords();

  const perms = useVineyardPermissions(id ?? null);
  const tasks = useMemo(() => (id ? getVineyardTasks(id) : []), [id, getVineyardTasks]);
  const phenology = useMemo(() => (id ? getVineyardPhenology(id) : []), [id, getVineyardPhenology]);
  const sprays = useMemo(() => (id ? getVineyardSprays(id) : []), [id, getVineyardSprays]);
  const harvests = useMemo(() => (id ? getVineyardHarvests(id) : []), [id, getVineyardHarvests]);

  if (!vineyard) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Activity Log' }} />
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </View>
    );
  }

  const handleAdd = () => {
    const routes: Record<Tab, string> = {
      tasks: '/add-task',
      phenology: '/add-phenology',
      sprays: '/add-spray',
      harvests: '/add-harvest',
    };
    router.push({ pathname: routes[tab] as never, params: { id: vineyard.id } });
  };

  const confirmDelete = (fn: () => Promise<unknown>, label: string) => {
    Alert.alert('Delete', `Delete this ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await fn();
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to delete';
            Alert.alert('Error', msg);
          }
        },
      },
    ]);
  };

  const exportSpraysCSV = async () => {
    if (sprays.length === 0) {
      Alert.alert('No records', 'There are no spray records to export.');
      return;
    }
    const header = [
      'applied_on',
      'product_name',
      'active_ingredient',
      'target',
      'rate',
      'rate_unit',
      'total_volume',
      'volume_unit',
      'water_volume',
      'phi_days',
      'rei_hours',
      'weather',
      'wind_speed',
      'temperature',
      'applicator',
      'equipment',
      'notes',
    ].join(',');
    const esc = (v: unknown) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const rows = sprays.map((s) =>
      [
        s.applied_on,
        s.product_name,
        s.active_ingredient,
        s.target,
        s.rate,
        s.rate_unit,
        s.total_volume,
        s.volume_unit,
        s.water_volume,
        s.phi_days,
        s.rei_hours,
        s.weather_conditions,
        s.wind_speed,
        s.temperature,
        s.applicator,
        s.equipment,
        s.notes,
      ]
        .map(esc)
        .join(',')
    );
    const csv = [header, ...rows].join('\n');
    console.log('[Log] Exporting CSV, rows:', rows.length);
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${vineyard.name.replace(/\s+/g, '_')}_sprays.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({
          title: `${vineyard.name} – Spray Records`,
          message: csv,
        });
      }
    } catch (e) {
      console.log('[Log] Export error', e);
    }
  };

  const renderTasks = () => {
    if (tasks.length === 0) return renderEmpty('No tasks logged yet', 'Log pruning, irrigation, fertilizing and more.');
    return tasks.map((t) => {
      const Icon = TASK_ICONS[t.task_type];
      const isDone = t.status === 'completed';
      return (
        <View key={t.id} style={styles.card}>
          <View style={styles.rowHeader}>
            <View style={[styles.iconCircle, isDone && styles.iconCircleDone]}>
              <Icon size={16} color={isDone ? Colors.primary : Colors.secondary} />
            </View>
            <View style={styles.rowHeaderText}>
              <Text style={styles.cardTitle}>{t.title}</Text>
              <Text style={styles.cardSub}>
                {t.task_type.replace('_', ' ')} · {formatDate(t.scheduled_for ?? t.completed_at)}
              </Text>
            </View>
            <Pressable
              onPress={() =>
                void updateTask(t.id, {
                  status: isDone ? 'planned' : 'completed',
                  completed_at: isDone ? null : new Date().toISOString(),
                })
              }
              hitSlop={10}
              style={({ pressed }) => pressed && styles.pressed}
            >
              {isDone ? (
                <CheckCircle2 size={22} color={Colors.primary} />
              ) : (
                <Clock size={22} color={Colors.textMuted} />
              )}
            </Pressable>
          </View>
          {t.notes ? <Text style={styles.notes}>{t.notes}</Text> : null}
          <View style={styles.metaRow}>
            {t.labor_hours != null && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{t.labor_hours}h labor</Text>
              </View>
            )}
            {t.cost != null && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>${t.cost.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.flexFill} />
            {perms.canDeleteRecord && (
              <Pressable onPress={() => confirmDelete(() => deleteTask(t.id), 'task')} hitSlop={8}>
                <Trash2 size={14} color={Colors.danger} />
              </Pressable>
            )}
          </View>
        </View>
      );
    });
  };

  const renderPhenology = () => {
    if (phenology.length === 0)
      return renderEmpty('No phenology events', 'Track budbreak, flowering, véraison, harvest.');
    return (
      <>
        <View style={styles.timeline}>
          {phenology
            .slice()
            .reverse()
            .map((p) => (
              <View key={`t-${p.id}`} style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: PHENOLOGY_COLORS[p.stage] }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineStage}>{PHENOLOGY_LABELS[p.stage]}</Text>
                  <Text style={styles.timelineDate}>{formatDate(p.observed_on)}</Text>
                </View>
              </View>
            ))}
        </View>
        {phenology.map((p) => (
          <View key={p.id} style={styles.card}>
            <View style={styles.rowHeader}>
              <View style={[styles.iconCircle, { backgroundColor: PHENOLOGY_COLORS[p.stage] + '22' }]}>
                <TrendingUp size={16} color={PHENOLOGY_COLORS[p.stage]} />
              </View>
              <View style={styles.rowHeaderText}>
                <Text style={styles.cardTitle}>{PHENOLOGY_LABELS[p.stage]}</Text>
                <Text style={styles.cardSub}>
                  {formatDate(p.observed_on)}
                  {p.percent_complete != null ? ` · ${p.percent_complete}% complete` : ''}
                  {p.gdd_at_event != null ? ` · ${Math.round(p.gdd_at_event)} GDD` : ''}
                </Text>
              </View>
              {perms.canDeleteRecord && (
                <Pressable onPress={() => confirmDelete(() => deletePhenology(p.id), 'event')} hitSlop={8}>
                  <Trash2 size={14} color={Colors.danger} />
                </Pressable>
              )}
            </View>
            {p.notes ? <Text style={styles.notes}>{p.notes}</Text> : null}
          </View>
        ))}
      </>
    );
  };

  const renderSprays = () => {
    if (sprays.length === 0) return renderEmpty('No sprays logged', 'Maintain compliance with PHI & REI tracking.');
    const today = new Date();
    return sprays.map((s) => {
      const applied = new Date(s.applied_on);
      const phiEnd = s.phi_days != null ? new Date(applied.getTime() + s.phi_days * 86400000) : null;
      const phiActive = phiEnd ? phiEnd.getTime() > today.getTime() : false;
      const daysLeft = phiEnd ? Math.ceil((phiEnd.getTime() - today.getTime()) / 86400000) : 0;
      return (
        <View key={s.id} style={styles.card}>
          <View style={styles.rowHeader}>
            <View style={styles.iconCircle}>
              <SprayCan size={16} color={Colors.info} />
            </View>
            <View style={styles.rowHeaderText}>
              <Text style={styles.cardTitle}>{s.product_name}</Text>
              <Text style={styles.cardSub}>
                {formatDate(s.applied_on)} · {s.active_ingredient ?? 'n/a'}
              </Text>
            </View>
            {perms.canDeleteRecord && (
              <Pressable onPress={() => confirmDelete(() => deleteSpray(s.id), 'spray record')} hitSlop={8}>
                <Trash2 size={14} color={Colors.danger} />
              </Pressable>
            )}
          </View>
          <View style={styles.sprayGrid}>
            {s.target && (
              <View style={styles.sprayCell}>
                <Text style={styles.sprayLabel}>Target</Text>
                <Text style={styles.sprayValue}>{s.target}</Text>
              </View>
            )}
            {s.rate != null && (
              <View style={styles.sprayCell}>
                <Text style={styles.sprayLabel}>Rate</Text>
                <Text style={styles.sprayValue}>
                  {s.rate} {s.rate_unit ?? ''}
                </Text>
              </View>
            )}
            {s.water_volume != null && (
              <View style={styles.sprayCell}>
                <Text style={styles.sprayLabel}>Water</Text>
                <Text style={styles.sprayValue}>{s.water_volume} L/ha</Text>
              </View>
            )}
            {s.phi_days != null && (
              <View style={styles.sprayCell}>
                <Text style={styles.sprayLabel}>PHI</Text>
                <Text style={[styles.sprayValue, phiActive && { color: Colors.warning }]}>
                  {s.phi_days}d
                </Text>
              </View>
            )}
          </View>
          {phiActive && (
            <View style={styles.phiBanner}>
              <Text style={styles.phiBannerText}>
                PHI active · harvest cleared on {formatDate(phiEnd!.toISOString())} ({daysLeft}d left)
              </Text>
            </View>
          )}
          {!phiActive && s.phi_days != null && (
            <View style={[styles.phiBanner, styles.phiBannerClear]}>
              <Text style={[styles.phiBannerText, styles.phiBannerTextClear]}>PHI cleared · harvest window open — verify product label before picking</Text>
            </View>
          )}
          {s.notes ? <Text style={styles.notes}>{s.notes}</Text> : null}
        </View>
      );
    });
  };

  const renderHarvests = () => {
    if (harvests.length === 0)
      return renderEmpty('No harvest records', 'Log yield, Brix, pH and TA per pick.');
    const totalYield = harvests.reduce((sum, h) => sum + (h.yield_kg ?? 0), 0);
    const avgBrix =
      harvests.filter((h) => h.brix != null).length > 0
        ? harvests.reduce((sum, h) => sum + (h.brix ?? 0), 0) /
          harvests.filter((h) => h.brix != null).length
        : null;
    return (
      <>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{(totalYield / 1000).toFixed(2)}t</Text>
            <Text style={styles.summaryLabel}>Total Yield</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{avgBrix != null ? avgBrix.toFixed(1) : '—'}°</Text>
            <Text style={styles.summaryLabel}>Avg Brix</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {vineyard.area > 0 ? (totalYield / 1000 / vineyard.area).toFixed(2) : '—'}
            </Text>
            <Text style={styles.summaryLabel}>t/ha</Text>
          </View>
        </View>
        {harvests.map((h) => (
          <View key={h.id} style={styles.card}>
            <View style={styles.rowHeader}>
              <View style={[styles.iconCircle, { backgroundColor: Colors.secondaryMuted }]}>
                <Wheat size={16} color={Colors.secondary} />
              </View>
              <View style={styles.rowHeaderText}>
                <Text style={styles.cardTitle}>{formatDate(h.harvested_on)}</Text>
                <Text style={styles.cardSub}>
                  {h.yield_kg != null ? `${(h.yield_kg / 1000).toFixed(2)}t` : '—'}
                  {h.destination ? ` · ${h.destination}` : ''}
                </Text>
              </View>
              {perms.canDeleteRecord && (
                <Pressable onPress={() => confirmDelete(() => deleteHarvest(h.id), 'harvest')} hitSlop={8}>
                  <Trash2 size={14} color={Colors.danger} />
                </Pressable>
              )}
            </View>
            <View style={styles.sprayGrid}>
              {h.brix != null && (
                <View style={styles.sprayCell}>
                  <Text style={styles.sprayLabel}>Brix</Text>
                  <Text style={styles.sprayValue}>{h.brix.toFixed(1)}°</Text>
                </View>
              )}
              {h.ph != null && (
                <View style={styles.sprayCell}>
                  <Text style={styles.sprayLabel}>pH</Text>
                  <Text style={styles.sprayValue}>{h.ph.toFixed(2)}</Text>
                </View>
              )}
              {h.ta != null && (
                <View style={styles.sprayCell}>
                  <Text style={styles.sprayLabel}>TA</Text>
                  <Text style={styles.sprayValue}>{h.ta.toFixed(2)} g/L</Text>
                </View>
              )}
              {h.berry_weight_g != null && (
                <View style={styles.sprayCell}>
                  <Text style={styles.sprayLabel}>Berry</Text>
                  <Text style={styles.sprayValue}>{h.berry_weight_g}g</Text>
                </View>
              )}
            </View>
            {h.notes ? <Text style={styles.notes}>{h.notes}</Text> : null}
          </View>
        ))}
      </>
    );
  };

  const renderEmpty = (title: string, subtitle: string) => (
    <View style={styles.empty}>
      <FlaskConical size={32} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{subtitle}</Text>
      <Pressable
        style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
        onPress={handleAdd}
      >
        <Plus size={16} color={Colors.background} />
        <Text style={styles.addBtnText}>Log new entry</Text>
      </Pressable>
    </View>
  );

  const counts: Record<Tab, number> = {
    tasks: tasks.length,
    phenology: phenology.length,
    sprays: sprays.length,
    harvests: harvests.length,
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: `${vineyard.name} Log`,
          headerRight: () => (
            <View style={styles.headerActions}>
              {tab === 'sprays' && sprays.length > 0 && perms.canExport && (
                <Pressable onPress={() => void exportSpraysCSV()} hitSlop={8}>
                  <Download size={18} color={Colors.info} />
                </Pressable>
              )}
              {perms.canCreateRecord && (
                <Pressable onPress={handleAdd} hitSlop={8}>
                  <Plus size={22} color={Colors.primary} />
                </Pressable>
              )}
            </View>
          ),
        }}
      />
      <View style={styles.container}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {(['tasks', 'phenology', 'sprays', 'harvests'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'tasks'
                  ? 'Tasks'
                  : t === 'phenology'
                  ? 'Phenology'
                  : t === 'sprays'
                  ? 'Sprays'
                  : 'Harvests'}
              </Text>
              <View style={[styles.tabCount, tab === t && styles.tabCountActive]}>
                <Text style={[styles.tabCountText, tab === t && styles.tabCountTextActive]}>
                  {counts[t]}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <>
              {tab === 'tasks' && renderTasks()}
              {tab === 'phenology' && renderPhenology()}
              {tab === 'sprays' && renderSprays()}
              {tab === 'harvests' && renderHarvests()}
            </>
          )}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    paddingVertical: 40,
    alignItems: 'center' as const,
  },
  headerActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 16,
  },
  pressed: {
    opacity: 0.7,
  },
  tabs: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  tabActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  tabCount: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center' as const,
  },
  tabCountActive: {
    backgroundColor: Colors.primary,
  },
  tabCountText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  tabCountTextActive: {
    color: Colors.background,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 10,
  },
  rowHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  rowHeaderText: {
    flex: 1,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  iconCircleDone: {
    backgroundColor: Colors.primaryMuted,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  cardSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  notes: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  chip: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  flexFill: {
    flex: 1,
  },
  sprayGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  sprayCell: {
    flexBasis: '47%',
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 10,
    padding: 10,
  },
  sprayLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  sprayValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
    marginTop: 2,
  },
  phiBanner: {
    backgroundColor: Colors.warningMuted,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  phiBannerClear: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  phiBannerText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  phiBannerTextClear: {
    color: Colors.primary,
  },
  empty: {
    alignItems: 'center' as const,
    padding: 40,
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center' as const,
  },
  addBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  addBtnText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  timeline: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 8,
  },
  timelineItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineContent: {
    flex: 1,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
  timelineStage: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  timelineDate: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  summaryGrid: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center' as const,
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800' as const,
  },
  summaryLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  bottomSpacer: {
    height: 24,
  },
});
