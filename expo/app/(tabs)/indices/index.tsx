import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Satellite, Inbox, Users, AlertTriangle, ShieldCheck, CloudOff } from 'lucide-react-native';
import Colors from '@/constants/colors';
import DataTrustBadge from '@/components/DataTrustBadge';
import { demoTrust, evaluateTrust } from '@/lib/dataTrust';
import IndexAnalysisCard from '@/components/IndexAnalysisCard';
import { analyzeIndexSeries, type IndexKey, type PeerBlockSnapshot, type IndexAnalysis } from '@/lib/indexAnalysis';
import { useVineyards } from '@/providers/VineyardProvider';
import { useIndexReadings, type IndexType } from '@/providers/IndexReadingsProvider';
import { useAuth } from '@/providers/AuthProvider';
import type { NdviSample } from '@/lib/ndvi';

const TABS: { key: IndexKey; label: string; sub: string; type: IndexType }[] = [
  { key: 'NDVI', label: 'NDVI', sub: 'Canopy vigor', type: 'NDVI' },
  { key: 'NDRE', label: 'NDRE', sub: 'Chlorophyll', type: 'NDRE' },
];

function demoSamples(seed: number, baseline: number): NdviSample[] {
  const out: NdviSample[] = [];
  const now = Date.now();
  for (let i = 0; i < 6; i += 1) {
    const t = now - (5 - i) * 10 * 24 * 60 * 60 * 1000;
    const noise = (((seed * 9301 + i * 49297) % 233280) / 233280 - 0.5) * 0.08;
    const drift = i * -0.01 * ((seed % 3) - 1);
    out.push({
      acquiredAt: new Date(t).toISOString(),
      value: Math.max(0.1, Math.min(0.95, baseline + noise + drift)),
      source: 'sentinel-2',
      sceneId: `demo-${seed}-${i}`,
      cloudCover: (seed + i) % 30,
    });
  }
  return out;
}

export default function IndicesScreen() {
  const router = useRouter();
  const { isDemoMode } = useAuth();
  const { vineyards } = useVineyards();
  const { readings } = useIndexReadings();
  const [active, setActive] = useState<IndexKey>('NDVI');

  const indexType: IndexType = TABS.find((t) => t.key === active)?.type ?? 'NDVI';

  const blockAnalyses = useMemo<
    { vineyardId: string; name: string; analysis: IndexAnalysis }[]
  >(() => {
    // Build samples per vineyard
    const samplesByBlock = new Map<string, NdviSample[]>();
    if (isDemoMode) {
      vineyards.forEach((v, idx) => {
        const baseline = active === 'NDVI' ? 0.55 - (idx % 4) * 0.05 : 0.4 - (idx % 4) * 0.04;
        samplesByBlock.set(v.id, demoSamples(idx + 1, baseline));
      });
    } else {
      for (const r of readings) {
        if (r.index_type !== indexType) continue;
        const arr = samplesByBlock.get(r.vineyard_id) ?? [];
        arr.push({
          acquiredAt: r.acquired_at,
          value: Number(r.value),
          source: (r.source as 'sentinel-2' | 'planet') ?? 'sentinel-2',
          sceneId: r.scene_id ?? undefined,
          cloudCover: r.cloud_cover ?? undefined,
        });
        samplesByBlock.set(r.vineyard_id, arr);
      }
      samplesByBlock.forEach((arr) => {
        arr.sort((a, b) => (a.acquiredAt < b.acquiredAt ? -1 : 1));
      });
    }

    // Latest value peers snapshot
    const peerSnapshots: PeerBlockSnapshot[] = vineyards.map((v) => {
      const arr = samplesByBlock.get(v.id) ?? [];
      const latest = arr[arr.length - 1];
      return {
        vineyardId: v.id,
        vineyardName: v.name,
        latest: latest ? latest.value : null,
        acquiredAt: latest?.acquiredAt ?? null,
      };
    });

    const out = vineyards
      .map((v) => {
        const samples = samplesByBlock.get(v.id) ?? [];
        const peers = peerSnapshots.filter((p) => p.vineyardId !== v.id);
        const analysis = analyzeIndexSeries({
          indexKey: active,
          samples,
          blockName: v.name,
          peers,
        });
        return { vineyardId: v.id, name: v.name, analysis };
      })
      .filter((b) => b.analysis.latest != null);

    // Sort: anomalies first, then by latest value ascending (weaker first)
    out.sort((a, b) => {
      if (b.analysis.anomalyScore !== a.analysis.anomalyScore) {
        return b.analysis.anomalyScore - a.analysis.anomalyScore;
      }
      return (a.analysis.latest?.value ?? 0) - (b.analysis.latest?.value ?? 0);
    });

    return out;
  }, [vineyards, readings, active, indexType, isDemoMode]);

  const decisionGrade = blockAnalyses.filter((b) => b.analysis.isDecisionGrade);
  const advisoryOnly = blockAnalyses.filter((b) => !b.analysis.isDecisionGrade);
  const needsAttention = decisionGrade.filter((b) => b.analysis.anomalyScore > 0.25).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.infoCard}>
        <Satellite size={20} color={Colors.sentinel} />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>Block-level scouting</Text>
          <Text style={styles.infoText}>
            Blocks are ranked by change versus their own baseline and nearby peers, with
            scene quality honestly reported so stale or cloudy imagery never drives strong
            recommendations.
          </Text>
          <View style={styles.infoTrust}>
            <DataTrustBadge
              trust={
                isDemoMode
                  ? demoTrust('Demo satellite indices', 'vineyard')
                  : evaluateTrust({
                      sourceType: 'derived',
                      sourceName: 'Sentinel-2 L2A · Element84 STAC',
                      observedAt: new Date().toISOString(),
                      scopeType: 'estate',
                      methodVersion: 'indices-v2',
                      kind: 'satellite',
                    })
              }
            />
          </View>
        </View>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setActive(t.key)}
            style={({ pressed }) => [
              styles.tab,
              active === t.key && styles.tabActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.tabText, active === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
            <Text style={[styles.tabSub, active === t.key && styles.tabSubActive]}>
              {t.sub}
            </Text>
          </Pressable>
        ))}
      </View>

      {blockAnalyses.length === 0 ? (
        <View style={styles.emptyCard}>
          <Inbox size={28} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No imagery yet</Text>
          <Text style={styles.emptyText}>
            Open a block with a drawn boundary to pull in Sentinel-2 scenes. Once scenes
            load, this screen will compare every block against its own baseline and its
            peers.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCell}>
              <ShieldCheck size={14} color={Colors.primary} />
              <Text style={styles.summaryValue}>{decisionGrade.length}</Text>
              <Text style={styles.summaryLabel}>Decision-grade</Text>
            </View>
            <View
              style={[
                styles.summaryCell,
                needsAttention > 0 && { backgroundColor: Colors.warningMuted, borderColor: Colors.warning + '40' },
              ]}
            >
              <AlertTriangle size={14} color={needsAttention > 0 ? Colors.warning : Colors.textMuted} />
              <Text
                style={[
                  styles.summaryValue,
                  needsAttention > 0 && { color: Colors.warning },
                ]}
              >
                {needsAttention}
              </Text>
              <Text style={styles.summaryLabel}>Need scouting</Text>
            </View>
            <View style={styles.summaryCell}>
              <CloudOff size={14} color={Colors.textMuted} />
              <Text style={styles.summaryValue}>{advisoryOnly.length}</Text>
              <Text style={styles.summaryLabel}>Advisory only</Text>
            </View>
          </View>

          {decisionGrade.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <ShieldCheck size={13} color={Colors.primary} />
                <Text style={styles.sectionHeaderText}>Decision-grade imagery</Text>
              </View>
              {decisionGrade.map((b) => (
                <Pressable
                  key={b.vineyardId}
                  onPress={() =>
                    router.push({ pathname: '/field-detail', params: { id: b.vineyardId } })
                  }
                  style={({ pressed }) => [styles.blockCard, pressed && styles.pressed]}
                  testID={`index-block-${b.vineyardId}`}
                >
                  <View style={styles.blockHeader}>
                    <Text style={styles.blockName} numberOfLines={1}>
                      {b.name}
                    </Text>
                    <Text style={styles.blockValue}>
                      {(b.analysis.latest?.value ?? 0).toFixed(2)}
                    </Text>
                  </View>
                  <IndexAnalysisCard analysis={b.analysis} compact />
                </Pressable>
              ))}
            </>
          )}

          {advisoryOnly.length > 0 && (
            <>
              <View style={[styles.sectionHeader, { marginTop: decisionGrade.length > 0 ? 12 : 0 }]}>
                <CloudOff size={13} color={Colors.textMuted} />
                <Text style={[styles.sectionHeaderText, { color: Colors.textSecondary }]}>
                  Advisory only · stale, cloudy, or fallback scenes
                </Text>
              </View>
              <Text style={styles.sectionNote}>
                These blocks have imagery but it’s not reliable enough to drive action.
                Use for context only until a cleaner scene arrives.
              </Text>
              {advisoryOnly.map((b) => (
                <Pressable
                  key={b.vineyardId}
                  onPress={() =>
                    router.push({ pathname: '/field-detail', params: { id: b.vineyardId } })
                  }
                  style={({ pressed }) => [
                    styles.blockCard,
                    styles.blockCardAdvisory,
                    pressed && styles.pressed,
                  ]}
                  testID={`index-block-${b.vineyardId}`}
                >
                  <View style={styles.blockHeader}>
                    <Text style={styles.blockName} numberOfLines={1}>
                      {b.name}
                    </Text>
                    <Text style={[styles.blockValue, { color: Colors.textSecondary }]}>
                      {(b.analysis.latest?.value ?? 0).toFixed(2)}
                    </Text>
                  </View>
                  <IndexAnalysisCard analysis={b.analysis} compact />
                </Pressable>
              ))}
            </>
          )}
        </>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.infoMuted,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.info + '30',
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    color: Colors.info,
    fontSize: 13,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  infoTrust: {
    marginTop: 10,
    flexDirection: 'row' as const,
  },
  tabRow: {
    flexDirection: 'row' as const,
    gap: 8,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  tabActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary + '60',
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  tabSub: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  tabSubActive: {
    color: Colors.primary + 'CC',
  },
  pressed: {
    opacity: 0.8,
  },
  summaryRow: {
    flexDirection: 'row' as const,
    gap: 10,
    marginBottom: 14,
  },
  summaryCell: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 12,
    gap: 4,
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800' as const,
    marginTop: 2,
  },
  summaryLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  blockCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 10,
    gap: 10,
  },
  blockHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  blockName: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '800' as const,
  },
  blockValue: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 40,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center' as const,
    gap: 10,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700' as const,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  bottomSpacer: {
    height: 20,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionHeaderText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '800' as const,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  sectionNote: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 10,
  },
  blockCardAdvisory: {
    opacity: 0.85,
    borderStyle: 'dashed' as const,
  },
});
