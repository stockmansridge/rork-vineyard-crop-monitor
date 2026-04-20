import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import {
  Droplets,
  ChevronDown,
  ChevronUp,
  CloudRain,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  AlertCircle,
  Settings2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import DataTrustBadge from '@/components/DataTrustBadge';
import {
  urgencyColor,
  type IrrigationRecommendation,
  type IrrigationReasoning,
} from '@/lib/irrigation';

interface Props {
  recommendation: IrrigationRecommendation | null;
  isLoading?: boolean;
  onEditProfile?: () => void;
  testID?: string;
}

function impactIcon(impact: IrrigationReasoning['impact']) {
  switch (impact) {
    case 'positive':
      return { Icon: TrendingDown, color: Colors.primary };
    case 'negative':
      return { Icon: TrendingUp, color: Colors.warning };
    default:
      return { Icon: Minus, color: Colors.textMuted };
  }
}

export default function IrrigationCard({
  recommendation,
  isLoading,
  onEditProfile,
  testID,
}: Props) {
  const [expanded, setExpanded] = useState<boolean>(false);

  if (isLoading && !recommendation) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.iconWrap}>
            <Droplets size={16} color={Colors.info} />
          </View>
          <Text style={styles.title}>Irrigation</Text>
        </View>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Calculating water balance…</Text>
        </View>
      </View>
    );
  }

  if (!recommendation) return null;

  const urgency = urgencyColor(recommendation.urgency);
  const deficitPct = Math.min(
    100,
    Math.max(0, (recommendation.currentDeficitMm / Math.max(1, recommendation.awc_mm)) * 100)
  );
  const madPct = Math.min(
    100,
    Math.max(0, (recommendation.mad_mm / Math.max(1, recommendation.awc_mm)) * 100)
  );

  return (
    <View style={styles.card} testID={testID ?? 'irrigation-card'}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Droplets size={16} color={Colors.info} />
        </View>
        <Text style={styles.title}>Irrigation recommendation</Text>
        <View style={[styles.pill, { backgroundColor: urgency.color + '20', borderColor: urgency.color + '50' }]}>
          <Text style={[styles.pillText, { color: urgency.color }]}>{urgency.label}</Text>
        </View>
      </View>

      <Text style={styles.headline}>{recommendation.headline}</Text>
      <Text style={styles.detail}>{recommendation.detail}</Text>

      <View style={styles.trustRow}>
        <DataTrustBadge trust={recommendation.trust} />
      </View>

      <View style={styles.barWrap}>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              {
                width: `${deficitPct}%`,
                backgroundColor: deficitPct >= madPct ? Colors.warning : Colors.info,
              },
            ]}
          />
          <View style={[styles.madTick, { left: `${madPct}%` }]} />
        </View>
        <View style={styles.barLegend}>
          <Text style={styles.legendText}>
            {recommendation.currentDeficitMm.toFixed(1)} mm deficit
          </Text>
          <Text style={styles.legendText}>
            MAD {recommendation.mad_mm.toFixed(0)} / AWC {recommendation.awc_mm.toFixed(0)} mm
          </Text>
        </View>
      </View>

      {recommendation.suggestedApplicationMm > 0 && (
        <View style={styles.applyBox}>
          <View style={styles.applyCell}>
            <Text style={styles.applyLabel}>Apply</Text>
            <Text style={styles.applyValue}>
              {recommendation.suggestedApplicationMm.toFixed(1)} mm
            </Text>
          </View>
          <View style={styles.applyDivider} />
          <View style={styles.applyCell}>
            <Text style={styles.applyLabel}>Run time</Text>
            <Text style={styles.applyValue}>
              {recommendation.suggestedRunHours != null
                ? `${recommendation.suggestedRunHours.toFixed(1)} h`
                : '— h'}
            </Text>
          </View>
          <View style={styles.applyDivider} />
          <View style={styles.applyCell}>
            <Text style={styles.applyLabel}>Rain 48h</Text>
            <Text style={styles.applyValue}>
              {recommendation.forecastRainMm48h.toFixed(0)} mm
            </Text>
          </View>
        </View>
      )}

      {recommendation.rainChangedDecision && (
        <View style={styles.rainBanner}>
          <CloudRain size={12} color={Colors.info} />
          <Text style={styles.rainBannerText}>
            Forecast rain materially changed this recommendation.
          </Text>
        </View>
      )}

      {recommendation.missingInputs.length > 0 && onEditProfile && (
        <Pressable
          style={({ pressed }) => [styles.missingBanner, pressed && styles.pressed]}
          onPress={onEditProfile}
        >
          <AlertCircle size={12} color={Colors.warning} />
          <Text style={styles.missingText} numberOfLines={2}>
            Add to block profile for better accuracy: {recommendation.missingInputs.join(', ')}
          </Text>
          <Settings2 size={12} color={Colors.warning} />
        </Pressable>
      )}

      <Pressable
        style={({ pressed }) => [styles.expandBtn, pressed && styles.pressed]}
        onPress={() => setExpanded((e) => !e)}
        hitSlop={6}
      >
        <Text style={styles.expandText}>
          {expanded ? 'Hide reasoning' : 'Why this recommendation'}
        </Text>
        {expanded ? (
          <ChevronUp size={14} color={Colors.primary} />
        ) : (
          <ChevronDown size={14} color={Colors.primary} />
        )}
      </Pressable>

      {expanded && (
        <View style={styles.reasoningList}>
          {recommendation.reasoning.map((r) => {
            const { Icon, color } = impactIcon(r.impact);
            return (
              <View key={r.label} style={styles.reasoningRow}>
                <Icon size={12} color={color} />
                <Text style={styles.reasoningLabel}>{r.label}</Text>
                <Text style={styles.reasoningValue} numberOfLines={2}>
                  {r.value}
                </Text>
              </View>
            );
          })}
          <View style={styles.generatedRow}>
            <Clock size={10} color={Colors.textMuted} />
            <Text style={styles.generatedText}>
              Generated {new Date(recommendation.generatedAt).toLocaleString()} · method irrigation-wb-v1
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 16,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 10,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Colors.infoMuted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  title: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 0.3,
  },
  headline: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800' as const,
    marginTop: 4,
    letterSpacing: -0.3,
  },
  detail: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  trustRow: {
    flexDirection: 'row' as const,
    marginTop: 10,
  },
  barWrap: {
    marginTop: 14,
    gap: 6,
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.backgroundAlt,
    overflow: 'visible' as const,
    position: 'relative' as const,
  },
  barFill: {
    height: 10,
    borderRadius: 5,
  },
  madTick: {
    position: 'absolute' as const,
    top: -2,
    width: 2,
    height: 14,
    backgroundColor: Colors.warning,
  },
  barLegend: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
  legendText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600' as const,
  },
  applyBox: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 12,
    marginTop: 12,
    paddingVertical: 10,
  },
  applyCell: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 2,
  },
  applyDivider: {
    width: 1,
    backgroundColor: Colors.cardBorder,
  },
  applyLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  applyValue: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '800' as const,
  },
  rainBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.infoMuted,
    borderRadius: 8,
  },
  rainBannerText: {
    color: Colors.info,
    fontSize: 11,
    fontWeight: '600' as const,
    flex: 1,
  },
  missingBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: Colors.warningMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.warning + '30',
  },
  missingText: {
    color: Colors.warning,
    fontSize: 11,
    fontWeight: '600' as const,
    flex: 1,
  },
  expandBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primaryMuted,
  },
  expandText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  reasoningList: {
    marginTop: 10,
    gap: 8,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 12,
    padding: 12,
  },
  reasoningRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  reasoningLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600' as const,
    width: 110,
  },
  reasoningValue: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600' as const,
    flex: 1,
    textAlign: 'right' as const,
  },
  generatedRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  generatedText: {
    color: Colors.textMuted,
    fontSize: 10,
  },
  loadingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.7,
  },
});
