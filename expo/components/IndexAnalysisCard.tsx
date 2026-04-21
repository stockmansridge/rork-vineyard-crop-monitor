import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Cloud,
  Users,
  Crosshair,
  Lightbulb,
  Eye,
  Search,
  MapPin,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import type { IndexAnalysis } from '@/lib/indexAnalysis';
import { confidenceColor } from '@/lib/indexAnalysis';

interface Props {
  analysis: IndexAnalysis;
  compact?: boolean;
}

function DeltaChip({
  label,
  value,
  direction,
  significant,
  Icon,
}: {
  label: string;
  value: string;
  direction: 'up' | 'down' | 'flat';
  significant: boolean;
  Icon: React.ComponentType<{ size: number; color: string }>;
}) {
  const color =
    direction === 'down'
      ? significant
        ? Colors.danger
        : Colors.warning
      : direction === 'up'
      ? Colors.primary
      : Colors.textMuted;
  const TrendIcon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  return (
    <View style={[styles.deltaCell, { borderColor: color + '30' }]}>
      <View style={styles.deltaHeader}>
        <Icon size={11} color={Colors.textMuted} />
        <Text style={styles.deltaLabel}>{label}</Text>
      </View>
      <View style={styles.deltaValueRow}>
        <TrendIcon size={14} color={color} />
        <Text style={[styles.deltaValue, { color }]}>{value}</Text>
      </View>
    </View>
  );
}

export default function IndexAnalysisCard({ analysis, compact }: Props) {
  const conf = confidenceColor(analysis.confidence);
  const qualityTone =
    analysis.sceneQuality.quality === 'good'
      ? Colors.primary
      : analysis.sceneQuality.quality === 'fair'
      ? Colors.info
      : analysis.sceneQuality.quality === 'poor'
      ? Colors.warning
      : Colors.danger;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.headlineRow}>
        <View style={[styles.confDot, { backgroundColor: conf }]} />
        <Text style={styles.headline} numberOfLines={2}>
          {analysis.headline}
        </Text>
      </View>

      <View style={styles.categoryRow}>
        {(() => {
          const cat = analysis.outputCategory;
          const cfg =
            cat === 'corroborated-anomaly'
              ? { label: 'Scouting priority', Icon: Search, tone: Colors.warning }
              : cat === 'scouting-priority'
              ? { label: 'Inspect (advisory)', Icon: Search, tone: Colors.info }
              : cat === 'monitor'
              ? { label: 'Monitor', Icon: Eye, tone: Colors.textSecondary }
              : { label: 'Spatial context', Icon: Eye, tone: Colors.textMuted };
          const Icon = cfg.Icon;
          return (
            <View style={[styles.categoryPill, { borderColor: cfg.tone + '40', backgroundColor: cfg.tone + '14' }]}>
              <Icon size={11} color={cfg.tone} />
              <Text style={[styles.categoryLabel, { color: cfg.tone }]}>{cfg.label}</Text>
            </View>
          );
        })()}
        {analysis.corroborated ? (
          <View style={[styles.categoryPill, { borderColor: Colors.primary + '40', backgroundColor: Colors.primary + '12' }]}>
            <ShieldCheck size={11} color={Colors.primary} />
            <Text style={[styles.categoryLabel, { color: Colors.primary }]}>Corroborated</Text>
          </View>
        ) : analysis.anomalyRepeated ? (
          <View style={[styles.categoryPill, { borderColor: Colors.warning + '40', backgroundColor: Colors.warning + '12' }]}>
            <Clock size={11} color={Colors.warning} />
            <Text style={[styles.categoryLabel, { color: Colors.warning }]}>Repeated</Text>
          </View>
        ) : null}
        {analysis.locationHint ? (
          <View style={[styles.categoryPill, { borderColor: Colors.cardBorder, backgroundColor: Colors.card }]}>
            <MapPin size={11} color={Colors.textSecondary} />
            <Text style={[styles.categoryLabel, { color: Colors.textSecondary }]} numberOfLines={1}>
              {analysis.locationHint}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.narrative}>{analysis.narrative}</Text>

      <View style={styles.deltaGrid}>
        {analysis.sceneDelta && (
          <DeltaChip
            label="vs last scene"
            value={`${analysis.sceneDelta.value >= 0 ? '+' : ''}${analysis.sceneDelta.value.toFixed(2)}`}
            direction={analysis.sceneDelta.direction}
            significant={analysis.sceneDelta.significant}
            Icon={Clock}
          />
        )}
        {analysis.baselineDelta && (
          <DeltaChip
            label="vs baseline"
            value={`${analysis.baselineDelta.percent >= 0 ? '+' : ''}${analysis.baselineDelta.percent.toFixed(0)}%`}
            direction={analysis.baselineDelta.direction}
            significant={analysis.baselineDelta.significant}
            Icon={Crosshair}
          />
        )}
        {analysis.peerDelta && (
          <DeltaChip
            label="vs peers"
            value={`${analysis.peerDelta.value >= 0 ? '+' : ''}${analysis.peerDelta.value.toFixed(2)}`}
            direction={analysis.peerDelta.direction}
            significant={analysis.peerDelta.significant}
            Icon={Users}
          />
        )}
      </View>

      {analysis.trendDirection !== 'unknown' ? (
        <View style={styles.trendRow}>
          {analysis.trendDirection === 'rising' ? (
            <TrendingUp size={12} color={Colors.primary} />
          ) : analysis.trendDirection === 'declining' ? (
            <TrendingDown size={12} color={Colors.danger} />
          ) : (
            <Minus size={12} color={Colors.textMuted} />
          )}
          <Text style={styles.trendText}>
            {analysis.trendDirection === 'rising'
              ? 'Trend: rising over recent scenes'
              : analysis.trendDirection === 'declining'
              ? 'Trend: declining over recent scenes'
              : 'Trend: stable over recent scenes'}
          </Text>
        </View>
      ) : null}

      <View style={[styles.qualityRow, { borderColor: qualityTone + '30', backgroundColor: qualityTone + '12' }]}>
        <Cloud size={13} color={qualityTone} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.qualityTitle, { color: qualityTone }]}>
            Scene quality: {analysis.sceneQuality.quality}
            {analysis.sceneQuality.ageDays != null
              ? ` · ${Math.round(analysis.sceneQuality.ageDays)}d old`
              : ''}
            {analysis.sceneQuality.cloudCover != null
              ? ` · ${Math.round(analysis.sceneQuality.cloudCover)}% cloud`
              : ''}
          </Text>
          <Text style={styles.qualityReasons} numberOfLines={2}>
            {analysis.sceneQuality.reasons.join(' · ')}
          </Text>
        </View>
        {analysis.isDecisionGrade ? (
          <ShieldCheck size={14} color={Colors.primary} />
        ) : (
          <AlertTriangle size={14} color={Colors.warning} />
        )}
      </View>

      {analysis.suggestedAction ? (
        <View style={styles.actionRow}>
          <Lightbulb size={14} color={Colors.secondary} />
          <Text style={styles.actionText}>{analysis.suggestedAction}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 10,
  },
  cardCompact: {
    padding: 10,
    gap: 8,
  },
  headlineRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
  },
  confDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  headline: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800' as const,
    letterSpacing: -0.2,
  },
  narrative: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  deltaGrid: {
    flexDirection: 'row' as const,
    gap: 6,
  },
  deltaCell: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: Colors.card,
    gap: 4,
  },
  deltaHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  deltaLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600' as const,
  },
  deltaValueRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  deltaValue: {
    fontSize: 13,
    fontWeight: '800' as const,
  },
  qualityRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  qualityTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  qualityReasons: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    backgroundColor: Colors.secondaryMuted,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.secondary + '30',
  },
  actionText: {
    flex: 1,
    color: Colors.text,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500' as const,
  },
  trendRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  trendText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  categoryRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  categoryPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
});
