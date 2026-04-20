import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Leaf, TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import Colors from '@/constants/colors';
import SeriesChart, { SeriesPoint } from '@/components/SeriesChart';
import { useNdviSeries } from '@/hooks/useNdviSeries';
import { ndviStatus, ndviStatusColor } from '@/lib/ndvi';
import type { PolygonPoint } from '@/lib/planet';

interface Props {
  vineyardId: string;
  polygon: PolygonPoint[] | null;
}

export default function NdviTrendSection({ vineyardId, polygon }: Props) {
  const { samples, isLoading, isFetching } = useNdviSeries(vineyardId, polygon, 6);

  const points = useMemo<SeriesPoint[]>(
    () =>
      samples.map((s) => ({
        x: new Date(s.acquiredAt).getTime(),
        y: s.value,
      })),
    [samples]
  );

  const last = samples.length > 0 ? samples[samples.length - 1] : null;
  const prev = samples.length > 1 ? samples[samples.length - 2] : null;
  const delta = last && prev ? last.value - prev.value : 0;
  const TrendIcon = delta > 0.005 ? TrendingUp : delta < -0.005 ? TrendingDown : Minus;
  const deltaColor =
    delta > 0.005 ? Colors.primary : delta < -0.005 ? Colors.danger : Colors.textMuted;

  const hasPolygon = polygon && polygon.length >= 3;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Leaf size={16} color={Colors.primary} />
          <Text style={styles.title}>NDVI Vegetation Health</Text>
        </View>
        {isFetching && !isLoading && (
          <ActivityIndicator size="small" color={Colors.textMuted} />
        )}
      </View>

      {!hasPolygon ? (
        <Text style={styles.empty}>Draw a field boundary to track NDVI over time.</Text>
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
    marginBottom: 14,
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
});
