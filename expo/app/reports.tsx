import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  FileText,
  FileSpreadsheet,
  Grape,
  SprayCan,
  Wheat,
  ClipboardList,
  TrendingUp,
  ChevronRight,
  Check,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useVineyards } from '@/providers/VineyardProvider';
import { useRecords } from '@/providers/RecordsProvider';
import { useVineyardPermissions } from '@/hooks/usePermissions';
import {
  buildCsv,
  exportCsv,
  exportPdf,
  htmlTable,
  wrapReportHtml,
} from '@/lib/reports';

type ReportKind = 'sprays' | 'harvests' | 'tasks' | 'phenology' | 'summary';

interface ReportDef {
  id: ReportKind;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
}

const REPORTS: ReportDef[] = [
  {
    id: 'summary',
    title: 'Vineyard Summary',
    subtitle: 'Overview of all vineyards, area, and health',
    icon: Grape,
    color: Colors.primary,
  },
  {
    id: 'sprays',
    title: 'Spray Records',
    subtitle: 'Chemical applications, rates, PHI compliance',
    icon: SprayCan,
    color: Colors.info,
  },
  {
    id: 'harvests',
    title: 'Harvest Records',
    subtitle: 'Yield, Brix, pH, TA by block',
    icon: Wheat,
    color: Colors.secondary,
  },
  {
    id: 'tasks',
    title: 'Activity Log',
    subtitle: 'Pruning, irrigation, scouting & more',
    icon: ClipboardList,
    color: Colors.warning,
  },
  {
    id: 'phenology',
    title: 'Phenology Events',
    subtitle: 'Budbreak, flowering, véraison, harvest',
    icon: TrendingUp,
    color: '#A855F7',
  },
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString();
}

export default function ReportsScreen() {
  const { vineyards, canOnVineyard } = useVineyards();
  const { tasks, phenology, sprays, harvests } = useRecords();
  const [vineyardFilter, setVineyardFilter] = useState<string | 'all'>('all');
  const singleVineyardPerms = useVineyardPermissions(
    vineyardFilter !== 'all' ? vineyardFilter : null
  );
  const canExport = vineyardFilter === 'all'
    ? vineyards.some((v) => canOnVineyard(v.id, 'vineyard.exportReports'))
    : singleVineyardPerms.canExport;
  const exportableVineyards = useMemo(
    () => vineyards.filter((v) => canOnVineyard(v.id, 'vineyard.exportReports')),
    [vineyards, canOnVineyard]
  );
  const [busy, setBusy] = useState<string | null>(null);

  const vineyardName = (vid: string | null): string => {
    if (!vid) return '—';
    return vineyards.find((v) => v.id === vid)?.name ?? '—';
  };

  const filteredVineyards = useMemo(
    () => (vineyardFilter === 'all' ? exportableVineyards : exportableVineyards.filter((v) => v.id === vineyardFilter)),
    [exportableVineyards, vineyardFilter]
  );

  const exportableIds = useMemo(() => new Set(exportableVineyards.map((v) => v.id)), [exportableVineyards]);

  const filter = <T extends { vineyard_id: string }>(rows: T[]): T[] => {
    const permitted = rows.filter((r) => exportableIds.has(r.vineyard_id));
    if (vineyardFilter === 'all') return permitted;
    return permitted.filter((r) => r.vineyard_id === vineyardFilter);
  };

  const filterScope = vineyardFilter === 'all' ? 'all-vineyards' : (vineyards.find((v) => v.id === vineyardFilter)?.name ?? 'vineyard');

  const counts = useMemo(
    () => ({
      sprays: filter(sprays).length,
      harvests: filter(harvests).length,
      tasks: filter(tasks).length,
      phenology: filter(phenology).length,
      summary: filteredVineyards.length,
    }),
    [sprays, harvests, tasks, phenology, filteredVineyards, vineyardFilter]
  );

  const handleExport = async (kind: ReportKind, fmt: 'csv' | 'pdf') => {
    if (!canExport) {
      Alert.alert('Export restricted', 'Your role does not allow exporting reports for this selection.');
      return;
    }
    const key = `${kind}-${fmt}`;
    setBusy(key);
    try {
      const base = `vinewatch_${kind}_${filterScope}`;
      if (fmt === 'csv') {
        const csv = buildCsvFor(kind);
        if (!csv) {
          Alert.alert('No records', 'Nothing to export in this report.');
          return;
        }
        await exportCsv(base, csv);
      } else {
        const html = buildPdfHtmlFor(kind);
        await exportPdf(base, html);
      }
    } catch (e) {
      console.log('[Reports] export failure', e);
      const msg = e instanceof Error ? e.message : 'Export failed';
      Alert.alert('Export failed', msg);
    } finally {
      setBusy(null);
    }
  };

  const buildCsvFor = (kind: ReportKind): string | null => {
    if (kind === 'summary') {
      if (filteredVineyards.length === 0) return null;
      return buildCsv(
        ['Name', 'Variety', 'Area', 'Unit', 'Health', 'Latitude', 'Longitude', 'Planted', 'LastScan'],
        filteredVineyards.map((v) => [
          v.name,
          v.variety,
          v.area,
          v.area_unit,
          v.health_score,
          v.latitude,
          v.longitude,
          v.planting_date,
          v.last_scan,
        ])
      );
    }
    if (kind === 'sprays') {
      const rows = filter(sprays);
      if (rows.length === 0) return null;
      return buildCsv(
        [
          'Vineyard',
          'AppliedOn',
          'Product',
          'ActiveIngredient',
          'Target',
          'Rate',
          'RateUnit',
          'WaterL/ha',
          'PHI(days)',
          'REI(h)',
          'Wind',
          'Temp',
          'Applicator',
          'Equipment',
          'Notes',
        ],
        rows.map((s) => [
          vineyardName(s.vineyard_id),
          s.applied_on,
          s.product_name,
          s.active_ingredient,
          s.target,
          s.rate,
          s.rate_unit,
          s.water_volume,
          s.phi_days,
          s.rei_hours,
          s.wind_speed,
          s.temperature,
          s.applicator,
          s.equipment,
          s.notes,
        ])
      );
    }
    if (kind === 'harvests') {
      const rows = filter(harvests);
      if (rows.length === 0) return null;
      return buildCsv(
        ['Vineyard', 'Date', 'YieldKg', 'YieldT', 'T/ha', 'Brix', 'pH', 'TA', 'Berry(g)', 'Clusters', 'Destination', 'Notes'],
        rows.map((h) => [
          vineyardName(h.vineyard_id),
          h.harvested_on,
          h.yield_kg,
          h.yield_tons,
          h.yield_per_ha,
          h.brix,
          h.ph,
          h.ta,
          h.berry_weight_g,
          h.cluster_count,
          h.destination,
          h.notes,
        ])
      );
    }
    if (kind === 'tasks') {
      const rows = filter(tasks);
      if (rows.length === 0) return null;
      return buildCsv(
        ['Vineyard', 'Type', 'Title', 'Status', 'Scheduled', 'Completed', 'LaborHours', 'Cost', 'Notes'],
        rows.map((t) => [
          vineyardName(t.vineyard_id),
          t.task_type,
          t.title,
          t.status,
          t.scheduled_for,
          t.completed_at,
          t.labor_hours,
          t.cost,
          t.notes,
        ])
      );
    }
    if (kind === 'phenology') {
      const rows = filter(phenology);
      if (rows.length === 0) return null;
      return buildCsv(
        ['Vineyard', 'Stage', 'Observed', 'PercentComplete', 'GDD', 'Notes'],
        rows.map((p) => [
          vineyardName(p.vineyard_id),
          p.stage,
          p.observed_on,
          p.percent_complete,
          p.gdd_at_event,
          p.notes,
        ])
      );
    }
    return null;
  };

  const buildPdfHtmlFor = (kind: ReportKind): string => {
    const scope =
      vineyardFilter === 'all'
        ? 'All Vineyards'
        : vineyards.find((v) => v.id === vineyardFilter)?.name ?? 'Vineyard';
    let body = `<h1>${REPORTS.find((r) => r.id === kind)?.title ?? 'Report'}</h1>`;
    body += `<div class="meta">${scope} · ${new Date().toLocaleDateString()}</div>`;

    if (kind === 'summary') {
      const totalArea = filteredVineyards.reduce((s, v) => s + v.area, 0);
      const avgHealth =
        filteredVineyards.length > 0
          ? Math.round(filteredVineyards.reduce((s, v) => s + v.health_score, 0) / filteredVineyards.length)
          : 0;
      body += `<div class="summary">
        <div class="chip">${filteredVineyards.length} vineyards</div>
        <div class="chip">${totalArea.toFixed(2)} ha</div>
        <div class="chip">${avgHealth}% avg health</div>
      </div>`;
      body += htmlTable(
        ['Name', 'Variety', 'Area', 'Health', 'Planted', 'Last Scan'],
        filteredVineyards.map((v) => [
          v.name,
          v.variety,
          `${v.area.toFixed(2)} ${v.area_unit}`,
          `${v.health_score}%`,
          formatDate(v.planting_date),
          formatDate(v.last_scan),
        ])
      );
    } else if (kind === 'sprays') {
      const rows = filter(sprays);
      body += htmlTable(
        ['Vineyard', 'Date', 'Product', 'Rate', 'PHI', 'Target', 'Applicator'],
        rows.map((s) => [
          vineyardName(s.vineyard_id),
          formatDate(s.applied_on),
          s.product_name,
          s.rate != null ? `${s.rate} ${s.rate_unit ?? ''}` : null,
          s.phi_days != null ? `${s.phi_days}d` : null,
          s.target,
          s.applicator,
        ])
      );
    } else if (kind === 'harvests') {
      const rows = filter(harvests);
      const totalKg = rows.reduce((s, h) => s + (h.yield_kg ?? 0), 0);
      const brixVals = rows.filter((h) => h.brix != null);
      const avgBrix =
        brixVals.length > 0
          ? brixVals.reduce((s, h) => s + (h.brix ?? 0), 0) / brixVals.length
          : null;
      body += `<div class="summary">
        <div class="chip">${(totalKg / 1000).toFixed(2)} t total</div>
        ${avgBrix != null ? `<div class="chip">${avgBrix.toFixed(1)}° avg Brix</div>` : ''}
        <div class="chip">${rows.length} picks</div>
      </div>`;
      body += htmlTable(
        ['Vineyard', 'Date', 'Yield (t)', 'Brix', 'pH', 'TA', 'Destination'],
        rows.map((h) => [
          vineyardName(h.vineyard_id),
          formatDate(h.harvested_on),
          h.yield_kg != null ? (h.yield_kg / 1000).toFixed(2) : null,
          h.brix?.toFixed(1),
          h.ph?.toFixed(2),
          h.ta?.toFixed(2),
          h.destination,
        ])
      );
    } else if (kind === 'tasks') {
      const rows = filter(tasks);
      body += htmlTable(
        ['Vineyard', 'Type', 'Title', 'Status', 'Scheduled', 'Labor (h)'],
        rows.map((t) => [
          vineyardName(t.vineyard_id),
          t.task_type,
          t.title,
          t.status,
          formatDate(t.scheduled_for ?? t.completed_at),
          t.labor_hours,
        ])
      );
    } else if (kind === 'phenology') {
      const rows = filter(phenology);
      body += htmlTable(
        ['Vineyard', 'Stage', 'Observed', '% Complete', 'GDD'],
        rows.map((p) => [
          vineyardName(p.vineyard_id),
          p.stage,
          formatDate(p.observed_on),
          p.percent_complete != null ? `${p.percent_complete}%` : null,
          p.gdd_at_event,
        ])
      );
    }

    return wrapReportHtml('VineWatch Report', body);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Reports & Export' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.header}>Export Records</Text>
        <Text style={styles.subheader}>
          Generate PDF or CSV reports for compliance, record-keeping, and sharing with consultants.
        </Text>
        {!canExport && (
          <View style={styles.infoCard}>
            <ChevronRight size={14} color={Colors.warning} />
            <Text style={[styles.infoText, { color: Colors.warning }]}>
              {exportableVineyards.length === 0
                ? 'Your role does not allow exporting any reports. Ask the owner or a manager for permission.'
                : 'Exports are restricted to vineyards where you are an owner or manager.'}
            </Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>FILTER</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Pressable
            style={[styles.filterChip, vineyardFilter === 'all' && styles.filterChipActive]}
            onPress={() => setVineyardFilter('all')}
          >
            {vineyardFilter === 'all' && <Check size={12} color={Colors.primary} />}
            <Text style={[styles.filterText, vineyardFilter === 'all' && styles.filterTextActive]}>
              All vineyards
            </Text>
          </Pressable>
          {vineyards.map((v) => {
            const active = vineyardFilter === v.id;
            return (
              <Pressable
                key={v.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setVineyardFilter(v.id)}
              >
                {active && <Check size={12} color={Colors.primary} />}
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{v.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionLabel}>REPORTS</Text>
        <View style={styles.list}>
          {REPORTS.map((r) => {
            const Icon = r.icon;
            const count = counts[r.id];
            const csvBusy = busy === `${r.id}-csv`;
            const pdfBusy = busy === `${r.id}-pdf`;
            return (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={[styles.iconWrap, { backgroundColor: r.color + '22' }]}>
                    <Icon size={18} color={r.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{r.title}</Text>
                    <Text style={styles.cardSub}>{r.subtitle}</Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{count}</Text>
                  </View>
                </View>
                <View style={styles.btnRow}>
                  <Pressable
                    style={({ pressed }) => [styles.btn, styles.btnPdf, pressed && styles.btnPressed]}
                    onPress={() => void handleExport(r.id, 'pdf')}
                    disabled={!!busy}
                  >
                    {pdfBusy ? (
                      <ActivityIndicator size="small" color={Colors.background} />
                    ) : (
                      <>
                        <FileText size={14} color={Colors.background} />
                        <Text style={styles.btnPdfText}>PDF</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.btn, styles.btnCsv, pressed && styles.btnPressed]}
                    onPress={() => void handleExport(r.id, 'csv')}
                    disabled={!!busy}
                  >
                    {csvBusy ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <>
                        <FileSpreadsheet size={14} color={Colors.primary} />
                        <Text style={styles.btnCsvText}>CSV</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.infoCard}>
          <ChevronRight size={14} color={Colors.textMuted} />
          <Text style={styles.infoText}>
            PDF reports include summaries and formatted tables suitable for printing. CSV exports can be
            opened in Excel, Numbers, or imported into vineyard-management systems.
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16 },
  header: { color: Colors.text, fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3 },
  subheader: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 20 },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },
  filters: { gap: 8, paddingVertical: 4, paddingRight: 8 },
  filterChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  filterChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  filterText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' as const },
  filterTextActive: { color: Colors.primary },
  list: { gap: 10, marginTop: 4 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
    gap: 12,
  },
  cardHead: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cardTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' as const },
  cardSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  countBadge: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 26,
    alignItems: 'center' as const,
  },
  countText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' as const },
  btnRow: { flexDirection: 'row' as const, gap: 8 },
  btn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
  },
  btnPressed: { opacity: 0.8 },
  btnPdf: { backgroundColor: Colors.primary },
  btnPdfText: { color: Colors.background, fontSize: 13, fontWeight: '700' as const },
  btnCsv: {
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  btnCsvText: { color: Colors.primary, fontSize: 13, fontWeight: '700' as const },
  infoCard: {
    flexDirection: 'row' as const,
    gap: 8,
    marginTop: 16,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  infoText: { flex: 1, color: Colors.textMuted, fontSize: 11, lineHeight: 16 },
});
