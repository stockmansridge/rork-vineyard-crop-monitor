import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import {
  X,
  ShieldCheck,
  Info,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Sigma,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import {
  type Recommendation,
  type RecommendationGrade,
  type RecommendationInput,
  gradeLabel,
  gradeDescription,
} from '@/lib/recommendations';
import { freshnessLabel } from '@/lib/dataTrust';

interface Props {
  recommendation: Recommendation | null;
  visible: boolean;
  onClose: () => void;
}

function gradeStyle(g: RecommendationGrade) {
  switch (g) {
    case 'operational':
      return { color: Colors.primary, bg: Colors.primaryMuted, Icon: ShieldCheck };
    case 'advisory':
      return { color: Colors.info, bg: Colors.infoMuted, Icon: Info };
    case 'monitor':
      return { color: Colors.secondary, bg: Colors.secondaryMuted, Icon: Sigma };
    case 'insufficient-data':
      return { color: Colors.warning, bg: Colors.warningMuted, Icon: AlertTriangle };
  }
}

function impactIcon(impact: RecommendationInput['impact']) {
  switch (impact) {
    case 'negative':
      return { Icon: TrendingUp, color: Colors.warning };
    case 'positive':
      return { Icon: TrendingDown, color: Colors.primary };
    default:
      return { Icon: Minus, color: Colors.textMuted };
  }
}

export default function RecommendationExplainModal({
  recommendation,
  visible,
  onClose,
}: Props) {
  if (!recommendation) return null;
  const cfg = gradeStyle(recommendation.grade);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} testID="explain-backdrop">
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
              <cfg.Icon size={18} color={cfg.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>Why this recommendation</Text>
              <Text style={styles.title} numberOfLines={2}>
                {recommendation.title}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} testID="explain-close">
              <X size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.gradePill, { backgroundColor: cfg.bg, borderColor: cfg.color + '50' }]}>
              <cfg.Icon size={12} color={cfg.color} />
              <Text style={[styles.gradePillText, { color: cfg.color }]}>
                {gradeLabel(recommendation.grade)}
              </Text>
            </View>
            <Text style={styles.gradeDesc}>{gradeDescription(recommendation.grade)}</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Logic summary</Text>
              <Text style={styles.sectionBody}>
                {recommendation.logicSummary ?? recommendation.reason}
              </Text>
            </View>

            {recommendation.inputs && recommendation.inputs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Inputs used</Text>
                <View style={styles.inputList}>
                  {recommendation.inputs.map((inp, i) => {
                    const { Icon, color } = impactIcon(inp.impact);
                    return (
                      <View key={`${inp.label}-${i}`} style={styles.inputRow}>
                        <Icon size={12} color={color} />
                        <Text style={styles.inputLabel} numberOfLines={2}>
                          {inp.label}
                        </Text>
                        {inp.value ? (
                          <Text style={styles.inputValue} numberOfLines={2}>
                            {inp.value}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Freshness & confidence</Text>
              <View style={styles.metaRow}>
                <Clock size={12} color={Colors.textMuted} />
                <Text style={styles.metaText}>
                  Generated {freshnessLabel(recommendation.timestamp)}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <ShieldCheck size={12} color={Colors.textMuted} />
                <Text style={styles.metaText}>
                  Confidence: {recommendation.confidence}
                </Text>
              </View>
              {recommendation.freshnessNote ? (
                <View style={styles.metaRow}>
                  <Info size={12} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{recommendation.freshnessNote}</Text>
                </View>
              ) : null}
              {recommendation.trustNote ? (
                <View style={styles.metaRow}>
                  <Sigma size={12} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{recommendation.trustNote}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.disclaimer}>
              Recommendations are designed as decision support. Ground-truth in the field before
              acting on operational items.
            </Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end' as const,
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    maxHeight: '85%' as const,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    padding: 20,
    paddingBottom: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  kicker: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  title: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800' as const,
    marginTop: 2,
  },
  body: {
    paddingHorizontal: 20,
  },
  bodyContent: {
    paddingBottom: 28,
    gap: 16,
  },
  gradePill: {
    alignSelf: 'flex-start' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  gradePillText: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 0.3,
  },
  gradeDesc: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: -8,
  },
  section: {
    gap: 8,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 14,
    padding: 14,
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  sectionBody: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  inputList: {
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
    flex: 1,
  },
  inputValue: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700' as const,
    maxWidth: '50%' as const,
    textAlign: 'right' as const,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  metaText: {
    color: Colors.textSecondary,
    fontSize: 12,
    flex: 1,
    textTransform: 'capitalize' as const,
  },
  disclaimer: {
    color: Colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic' as const,
    lineHeight: 16,
  },
});
