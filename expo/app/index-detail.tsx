import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { TrendingUp, TrendingDown, Minus, Clock, Target, BarChart3, BookOpen, Crosshair, Grape, Activity, Lightbulb } from 'lucide-react-native';
import Colors from '@/constants/colors';
import TrendChart from '@/components/TrendChart';
import { satelliteIndices as demoIndices } from '@/mocks/indices';
import { SatelliteIndex, IndexRange } from '@/types';
import { useAuth } from '@/providers/AuthProvider';

function getStatusColor(status: SatelliteIndex['status']) {
  switch (status) {
    case 'healthy': return Colors.primary;
    case 'moderate': return Colors.warning;
    case 'stressed': return Colors.danger;
    case 'critical': return Colors.danger;
  }
}

function getCurrentRange(idx: SatelliteIndex): IndexRange | null {
  return idx.interpretationRanges.find(r => idx.value >= r.min && idx.value <= r.max) ?? null;
}

export default function IndexDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDemoMode } = useAuth();
  const satelliteIndices = isDemoMode ? demoIndices : [];
  const idx = satelliteIndices.find(i => i.id === id);

  if (!idx) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Index not found</Text>
      </View>
    );
  }

  const statusColor = getStatusColor(idx.status);
  const trend = idx.trend;
  const lastVal = trend[trend.length - 1];
  const prevVal = trend.length > 1 ? trend[trend.length - 2] : lastVal;
  const change = lastVal - prevVal;
  const TrendIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const currentRange = getCurrentRange(idx);

  return (
    <>
      <Stack.Screen options={{ title: idx.abbreviation }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={[styles.badge, { backgroundColor: idx.color + '20' }]}>
            <Text style={[styles.badgeText, { color: idx.color }]}>{idx.abbreviation}</Text>
          </View>
          <Text style={styles.fullName}>{idx.name}</Text>
          <View style={styles.valueRow}>
            <Text style={styles.heroValue}>{idx.value.toFixed(2)}</Text>
            {idx.unit ? <Text style={styles.heroUnit}>{idx.unit}</Text> : null}
            <View style={[styles.changeBadge, { backgroundColor: change >= 0 ? Colors.primaryMuted : Colors.dangerMuted }]}>
              <TrendIcon size={14} color={change >= 0 ? Colors.primary : Colors.danger} />
              <Text style={[styles.changeText, { color: change >= 0 ? Colors.primary : Colors.danger }]}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)}
              </Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {idx.status.charAt(0).toUpperCase() + idx.status.slice(1)}
            </Text>
          </View>
        </View>

        {currentRange && (
          <View style={[styles.currentRangeCard, { borderLeftColor: currentRange.color }]}>
            <Text style={styles.currentRangeHeader}>Your vines right now</Text>
            <View style={styles.currentRangeRow}>
              <View style={[styles.currentRangeDot, { backgroundColor: currentRange.color }]} />
              <Text style={[styles.currentRangeLabel, { color: currentRange.color }]}>{currentRange.label}</Text>
            </View>
            <Text style={styles.currentRangeMeaning}>{currentRange.meaning}</Text>
          </View>
        )}

        <View style={styles.plainEnglishCard}>
          <View style={styles.plainEnglishHeader}>
            <Lightbulb size={18} color={Colors.secondary} />
            <Text style={styles.plainEnglishTitle}>In Plain English</Text>
          </View>
          <Text style={styles.plainEnglishText}>{idx.plainEnglish}</Text>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <BarChart3 size={16} color={Colors.textSecondary} />
            <Text style={styles.chartTitle}>6-Period Trend</Text>
          </View>
          <View style={styles.chartContainer}>
            <TrendChart data={idx.trend} color={idx.color} width={300} height={100} />
          </View>
          <View style={styles.chartLabels}>
            {idx.trend.map((val, i) => (
              <Text key={i} style={styles.chartLabel}>{val.toFixed(2)}</Text>
            ))}
          </View>
        </View>

        <View style={styles.guideSection}>
          <View style={styles.guideSectionHeader}>
            <Crosshair size={16} color={Colors.ndmi} />
            <Text style={styles.guideSectionTitle}>What It Measures</Text>
          </View>
          <Text style={styles.guideSectionBody}>{idx.whatItMeasures}</Text>
        </View>

        <View style={styles.guideSection}>
          <View style={styles.guideSectionHeader}>
            <Grape size={16} color={Colors.secondary} />
            <Text style={styles.guideSectionTitle}>Why It Matters for Your Vineyard</Text>
          </View>
          <Text style={styles.guideSectionBody}>{idx.whyItMatters}</Text>
        </View>

        <View style={styles.guideSection}>
          <View style={styles.guideSectionHeader}>
            <BookOpen size={16} color={Colors.reci} />
            <Text style={styles.guideSectionTitle}>How to Read the Values</Text>
          </View>
          <Text style={styles.guideSectionBody}>{idx.howToRead}</Text>
        </View>

        <View style={styles.rangesCard}>
          <Text style={styles.rangesTitle}>Interpretation Guide</Text>
          {idx.interpretationRanges.map((range, i) => {
            const isActive = currentRange?.label === range.label;
            return (
              <View
                key={i}
                style={[
                  styles.rangeItem,
                  isActive && styles.rangeItemActive,
                  i < idx.interpretationRanges.length - 1 && styles.rangeItemBorder,
                ]}
              >
                <View style={styles.rangeHeader}>
                  <View style={[styles.rangeDot, { backgroundColor: range.color }]} />
                  <Text style={[styles.rangeLabel, isActive && { color: range.color }]}>{range.label}</Text>
                  <Text style={styles.rangeValues}>{range.min} to {range.max}</Text>
                  {isActive && (
                    <View style={[styles.activeTag, { backgroundColor: range.color + '25' }]}>
                      <Text style={[styles.activeTagText, { color: range.color }]}>Current</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.rangeMeaning}>{range.meaning}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.guideSection}>
          <View style={styles.guideSectionHeader}>
            <Activity size={16} color={Colors.primary} />
            <Text style={styles.guideSectionTitle}>What Action to Take</Text>
          </View>
          <Text style={styles.guideSectionBody}>{idx.actionGuidance}</Text>
        </View>

        <View style={styles.detailsGrid}>
          <View style={styles.detailCard}>
            <Target size={16} color={Colors.textSecondary} />
            <Text style={styles.detailLabel}>Range</Text>
            <Text style={styles.detailValue}>{idx.min} to {idx.max}</Text>
          </View>
          <View style={styles.detailCard}>
            <Clock size={16} color={Colors.textSecondary} />
            <Text style={styles.detailLabel}>Last Updated</Text>
            <Text style={styles.detailValue}>
              {new Date(idx.lastUpdated).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.sourceCard}>
          <Text style={styles.sourceTitle}>Data Source</Text>
          <Text style={styles.sourceText}>Sentinel Hub Process API</Text>
          <Text style={styles.sourceText}>Copernicus Data Space STAC</Text>
          <Text style={styles.sourceText}>Collection: sentinel-2-l2a</Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </>
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
  errorText: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 60,
  },
  heroCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  fullName: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500' as const,
    marginBottom: 12,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  heroValue: {
    color: Colors.text,
    fontSize: 48,
    fontWeight: '800' as const,
    letterSpacing: -2,
  },
  heroUnit: {
    color: Colors.textSecondary,
    fontSize: 18,
    fontWeight: '500' as const,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  changeText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  currentRangeCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderLeftWidth: 4,
    marginTop: 12,
  },
  currentRangeHeader: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 8,
  },
  currentRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  currentRangeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  currentRangeLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  currentRangeMeaning: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  plainEnglishCard: {
    backgroundColor: Colors.secondaryMuted,
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.secondary + '30',
  },
  plainEnglishHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  plainEnglishTitle: {
    color: Colors.secondary,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  plainEnglishText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500' as const,
  },
  chartCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginTop: 12,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  chartTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  chartContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  chartLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: 'monospace',
  },
  guideSection: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginTop: 12,
  },
  guideSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  guideSectionTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  guideSectionBody: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 21,
  },
  rangesCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginTop: 12,
  },
  rangesTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
    marginBottom: 14,
  },
  rangeItem: {
    paddingVertical: 12,
  },
  rangeItemActive: {
    backgroundColor: Colors.backgroundAlt,
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  rangeItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  rangeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  rangeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rangeLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  rangeValues: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
    marginLeft: 'auto' as const,
  },
  activeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  activeTagText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  rangeMeaning: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 16,
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  detailCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  detailValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  sourceCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginTop: 12,
    gap: 4,
  },
  sourceTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  sourceText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  bottomSpacer: {
    height: 20,
  },
});
