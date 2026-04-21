import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Leaf, TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import Colors from '@/constants/colors';
import SeriesChart, { SeriesPoint } from '@/components/SeriesChart';
import { useNdviSeries } from '@/hooks/useNdviSeries';
import { ndviStatus, ndviStatusColor, type IndexKind } from '@/lib/ndvi';
import type { PolygonPoint } from '@/lib/planet';
import DataTrustBadge from '@/components/DataTrustBadge';
import { evaluateTrust } from '@/lib/dataTrust';
import IndexAnalysisCard from '@/components/IndexAnalysisCard';
import { analyzeIndexSeries, type PeerBlockSnapshot } from '@/lib/indexAnalysis';
import { useVineyards } from '@/providers/VineyardProvider';
import { useIndexReadings } from '@/providers/IndexReadingsProvider';

interface Props {
  vineyardId: string;
  polygon: PolygonPoint[] | null;
  blockName: string;
}

export default function NdviTrendSection({ vineyardId, polygon, blockName }: Props) {
  const [kind, setKind] = useState<IndexKind>('NDVI');
  const { samples, isLoading, isFetching } = useNdviSeries(vineyardId, polygon, 6, kind);
  const { vineyards } = useVineyards();
  const { readings } = useIndexReadings();
  const vineyard = useMemo(
    () => vineyards.find((v) => v.id === vineyardId) ?? null,
    [vineyards, vineyardId]
  );

  const points = useMemo<SeriesPoint[]>(
    () =>
      samples.map((s) => ({
        x: new Date(s.acquiredAt).getTime(),
        y: s.value,
      })),
    [samples]
  );

  const peers = useMemo<PeerBlockSnapshot[]>(() => {
    return vineyards
      .filter((v) => v.id !== vineyardId)
      .map((v) => {
        const peerSamples = readings
          .filter((r) => r.vineyard_id === v.id && r.index_type === kind)
          .sort((a, b) => (a.acquired_at < b.acquired_at ? 1 : -1));
        const latest = peerSamples[0];
        return {
          vineyardId: v.id,
          vineyardName: v.name,
          latest: latest ? Number(latest.value) : null,
          acquiredAt: latest?.acquired_at ?? null,
        };
      });
  }, [vineyards, readings, vineyardId, kind]);

  const analysis = useMemo(
    () =>
      analyzeIndexSeries({
        indexKey: kind === 'NDVI' ? 'NDVI' : 'NDRE',
        samples,
        blockName,
        peers,
        vineyard,
      }),
    [kind, samples, blockName, peers, vineyard]
  );

  const last = samples.length > 0 ? samples[samples.length - 1] : null;
  const prev = samples.length > 1 ? samples[samples.length - 2] : null;
  const delta = last && prev ? last.value - prev.value : 0;
  const TrendIcon = delta > 0.005 ? TrendingUp : delta < -0.005 ? TrendingDown : Minus;
  const deltaColor =
    delta > 0.005 ? Colors.primary : delta < -0.005 ? Colors.danger : Colors.textMuted;

  const hasPolygon = polygon && polygon.length >= 3;

  const isSimulated = !!last && last.sourceType === 'simulated';
  const trust = last
    ? evaluateTrust({
        sourceType: isSimulated ? 'simulated' : 'derived',
        sourceName: isSimulated
          ? `Simulated ${kind} (fallback model)`
          : `Sentinel-2 L2A · ${kind}`,
        observedAt: last.acquiredAt,
        scopeType: 'vineyard',
        methodVersion: `${kind.toLowerCase()}-v1`,
        kind: 'satellite',
        note: isSimulated
          ? 'Estimated from fallback logic because real reflectance statistics were unavailable for this scene.'
          : undefined,
      })
    : null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Leaf size={16} color={Colors.primary} />
          <Text style={styles.title}>Canopy & Chlorophyll</Text>
        </View>
        {isFetching && !isLoading && (
          <ActivityIndicator size="small" color={Colors.textMuted} />
        )}
      </View>

      <View style={styles.tabRow}>
        {(['NDVI', 'NDRE'] as IndexKind[]).map((k) => (
          <Pressable
            key={k}
            onPress={() => setKind(k)}
            style={({ pressed }) => [
              styles.tab,
              kind === k && styles.tabActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.tabText, kind === k && styles.tabTextActive]}>
              {k}
            </Text>
            <Text style={[styles.tabSub, kind === k && styles.tabSubActive]}>
              {k === 'NDVI' ? 'Canopy vigor' : 'Chlorophyll'}
            </Text>
          </Pressable>
        ))}
      </View>

      {!hasPolygon ? (
        <Text style={styles.empty}>Draw a field boundary to track {kind} over time.</Text>
      ) : isLoading && samples.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Fetching Sentinel-2 imagery…</Text>
        </View>
      ) : samples.length === 0 ? (
        <Text style={styles.empty}>
          No cloud-free Sentinel-2 imagery found for this field in the last 6 months.
        </Text>
      ) : (
        <>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroValue}>
                {(last?.value ?? 0).toFixed(2)}
              </Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: ndviStatusColor(last?.value ?? 0) },
                  ]}
                />
                <Text
                  style={[styles.statusText, { color: ndviStatusColor(last?.value ?? 0) }]}
                >
                  {ndviStatus(last?.value ?? 0)[0].toUpperCase() +
                    ndviStatus(last?.value ?? 0).slice(1)}
                </Text>
              </View>
            </View>
            {last && (
              <View style={styles.heroRight}>
                <View
                  style={[
                    styles.deltaChip,
                    { backgroundColor: deltaColor + '20' },
                  ]}
                >
                  <TrendIcon size={12} color={deltaColor} />
                  <Text style={[styles.deltaText, { color: deltaColor }]}>
                    {delta >= 0 ? '+' : ''}
                    {delta.toFixed(3)}
                  </Text>
                </View>
                <Text style={styles.acquiredText}>
                  {new Date(last.acquiredAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
            )}
          </View>

          <SeriesChart
            points={points}
            color={Colors.primary}
            height={140}
            width={300}
            yMin={0}
            yMax={1}
            showDots
            showGrid
            showFill
            formatY={(v) => v.toFixed(1)}
          />

          <View style={styles.legendRow}>
            <Text style={styles.legendText}>
              {samples.length} observation{samples.length !== 1 ? 's' : ''} · Sentinel-2 L2A
            </Text>
            {last?.cloudCover != null && (
              <Text style={styles.legendText}>
                Clouds: {Math.round(last.cloudCover)}%
              </Text>
            )}
          </View>

          <View style={styles.analysisWrap}>
            <IndexAnalysisCard analysis={analysis} />
          </View>

          {trust ? (
            <View style={styles.trustRow}>
              <DataTrustBadge trust={trust} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    margin: 16,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  tabRow: {
    flexDirection: 'row' as const,
    gap: 8,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  tabActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary + '60',
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  tabSub: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  tabSubActive: {
    color: Colors.primary + 'CC',
  },
  pressed: {
    opacity: 0.75,
  },
  empty: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  loading: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingVertical: 8,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  heroValue: {
    color: Colors.text,
    fontSize: 40,
    fontWeight: '800' as const,
    letterSpacing: -1.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  heroRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  deltaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  acquiredText: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  legendText: {
    color: Colors.textMuted,
    fontSize: 10,
  },
  analysisWrap: {
    marginTop: 12,
  },
  trustRow: {
    marginTop: 10,
    flexDirection: 'row' as const,
  },
});
