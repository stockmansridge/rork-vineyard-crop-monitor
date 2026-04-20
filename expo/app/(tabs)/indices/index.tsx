import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Satellite, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import TrendChart from '@/components/TrendChart';
import { satelliteIndices as demoIndices } from '@/mocks/indices';
import { SatelliteIndex } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import { Inbox } from 'lucide-react-native';

function getStatusColor(status: SatelliteIndex['status']) {
  switch (status) {
    case 'healthy': return Colors.primary;
    case 'moderate': return Colors.warning;
    case 'stressed': return Colors.danger;
    case 'critical': return Colors.danger;
  }
}

function getTrendIcon(trend: number[]) {
  if (trend.length < 2) return Minus;
  const last = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  if (last > prev) return TrendingUp;
  if (last < prev) return TrendingDown;
  return Minus;
}

export default function IndicesScreen() {
  const router = useRouter();
  const { isDemoMode } = useAuth();
  const satelliteIndices = isDemoMode ? demoIndices : [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.infoCard}>
        <Satellite size={20} color={Colors.sentinel} />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>Sentinel Hub + Copernicus STAC</Text>
          <Text style={styles.infoText}>
            Data sourced from Sentinel-2 Level-2A via Copernicus Data Space STAC API.
            Indices computed from bottom-of-atmosphere corrected reflectance bands.
          </Text>
        </View>
      </View>

      {satelliteIndices.length === 0 && (
        <View style={styles.emptyCard}>
          <Inbox size={28} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No indices yet</Text>
          <Text style={styles.emptyText}>
            Add a vineyard to start viewing satellite indices from Sentinel-2.
          </Text>
        </View>
      )}

      {satelliteIndices.map((idx) => {
        const TrendIcon = getTrendIcon(idx.trend);
        const statusColor = getStatusColor(idx.status);

        return (
          <Pressable
            key={idx.id}
            style={({ pressed }) => [styles.indexCard, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: '/index-detail', params: { id: idx.id } })}
          >
            <View style={styles.indexHeader}>
              <View style={[styles.indexBadge, { backgroundColor: idx.color + '20' }]}>
                <Text style={[styles.indexAbbr, { color: idx.color }]}>{idx.abbreviation}</Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {idx.status.charAt(0).toUpperCase() + idx.status.slice(1)}
              </Text>
              <ChevronRight size={16} color={Colors.textMuted} style={styles.chevron} />
            </View>

            <Text style={styles.indexName}>{idx.name}</Text>
            <Text style={styles.indexPlainEnglish} numberOfLines={2}>{idx.plainEnglish}</Text>

            <View style={styles.indexValueRow}>
              <View style={styles.valueSection}>
                <Text style={styles.indexValue}>{idx.value.toFixed(2)}</Text>
                {idx.unit ? <Text style={styles.indexUnit}>{idx.unit}</Text> : null}
                <TrendIcon size={16} color={idx.color} style={styles.trendIcon} />
              </View>
              <TrendChart data={idx.trend} color={idx.color} width={110} height={36} />
            </View>

            <View style={styles.rangeRow}>
              <Text style={styles.rangeLabel}>Range: {idx.min} to {idx.max}</Text>
              <Text style={styles.updated}>
                Updated {new Date(idx.lastUpdated).toLocaleDateString()}
              </Text>
            </View>
          </Pressable>
        );
      })}

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
    marginBottom: 16,
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
  indexCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.8,
  },
  indexHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  indexBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  indexAbbr: {
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    flex: 1,
  },
  chevron: {
    marginLeft: 'auto' as const,
  },
  indexName: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 10,
    fontWeight: '500' as const,
  },
  indexPlainEnglish: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  indexValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  valueSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  indexValue: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  indexUnit: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  trendIcon: {
    marginLeft: 4,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  rangeLabel: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  updated: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  bottomSpacer: {
    height: 20,
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
  },
});
