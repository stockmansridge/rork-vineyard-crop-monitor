import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import {
  ShieldCheck,
  Info,
  AlertTriangle,
  Clock,
  Beaker,
  X,
  Radio,
  Satellite as SatIcon,
  Hand,
  Sigma,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import {
  DataTrust,
  freshnessLabel,
  qualityLabel,
  sourceTypeLabel,
} from '@/lib/dataTrust';

interface Props {
  trust: DataTrust;
  compact?: boolean;
  showTimestamp?: boolean;
  testID?: string;
}

function flagStyle(trust: DataTrust) {
  switch (trust.qualityFlag) {
    case 'high':
      return {
        color: Colors.primary,
        bg: Colors.primaryMuted,
        Icon: ShieldCheck,
      };
    case 'medium':
      return { color: Colors.info, bg: Colors.infoMuted, Icon: Info };
    case 'low':
      return {
        color: Colors.warning,
        bg: Colors.warningMuted,
        Icon: AlertTriangle,
      };
    case 'stale':
      return { color: Colors.warning, bg: Colors.warningMuted, Icon: Clock };
    case 'demo':
      return { color: Colors.secondary, bg: Colors.secondaryMuted, Icon: Beaker };
  }
}

function sourceIcon(trust: DataTrust) {
  const name = (trust.sourceName ?? '').toLowerCase();
  if (name.includes('sentinel') || name.includes('planet') || name.includes('satellite')) {
    return SatIcon;
  }
  if (name.includes('probe') || name.includes('sensor')) return Radio;
  if (name.includes('manual') || name.includes('user')) return Hand;
  return Sigma;
}

export default function DataTrustBadge({
  trust,
  compact,
  showTimestamp = true,
  testID,
}: Props) {
  const [open, setOpen] = useState<boolean>(false);
  const cfg = flagStyle(trust);
  const SourceIcon = sourceIcon(trust);
  const fresh = freshnessLabel(trust.observedAt);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        testID={testID ?? 'data-trust-badge'}
        style={({ pressed }) => [
          styles.chip,
          { backgroundColor: cfg.bg, borderColor: cfg.color + '40' },
          compact && styles.chipCompact,
          pressed && styles.pressed,
        ]}
        hitSlop={6}
      >
        <cfg.Icon size={compact ? 10 : 11} color={cfg.color} />
        <Text
          style={[
            styles.chipText,
            { color: cfg.color },
            compact && styles.chipTextCompact,
          ]}
          numberOfLines={1}
        >
          {qualityLabel(trust.qualityFlag)}
        </Text>
        {showTimestamp && !compact && (
          <>
            <View style={[styles.dot, { backgroundColor: cfg.color + '60' }]} />
            <Text style={[styles.chipMeta, { color: cfg.color + 'CC' }]} numberOfLines={1}>
              {fresh}
            </Text>
          </>
        )}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <View style={[styles.sheetIcon, { backgroundColor: cfg.bg }]}>
                <cfg.Icon size={18} color={cfg.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Data trust</Text>
                <Text style={[styles.sheetFlag, { color: cfg.color }]}>
                  {qualityLabel(trust.qualityFlag)}
                </Text>
              </View>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <X size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.row}>
              <SourceIcon size={14} color={Colors.textSecondary} />
              <Text style={styles.rowLabel}>Source</Text>
              <Text style={styles.rowValue}>{trust.sourceName}</Text>
            </View>
            <View style={styles.row}>
              <Info size={14} color={Colors.textSecondary} />
              <Text style={styles.rowLabel}>Type</Text>
              <Text style={styles.rowValue}>{sourceTypeLabel(trust.sourceType)}</Text>
            </View>
            <View style={styles.row}>
              <Clock size={14} color={Colors.textSecondary} />
              <Text style={styles.rowLabel}>Observed</Text>
              <Text style={styles.rowValue}>
                {trust.observedAt
                  ? `${new Date(trust.observedAt).toLocaleString()} · ${fresh}`
                  : 'Unknown'}
              </Text>
            </View>
            <View style={styles.row}>
              <Clock size={14} color={Colors.textMuted} />
              <Text style={styles.rowLabel}>Ingested</Text>
              <Text style={styles.rowValue}>
                {new Date(trust.ingestedAt).toLocaleString()}
              </Text>
            </View>
            <View style={styles.row}>
              <Sigma size={14} color={Colors.textMuted} />
              <Text style={styles.rowLabel}>Scope</Text>
              <Text style={styles.rowValue}>{trust.scopeType}</Text>
            </View>
            <View style={styles.row}>
              <Sigma size={14} color={Colors.textMuted} />
              <Text style={styles.rowLabel}>Method</Text>
              <Text style={styles.rowValue}>{trust.methodVersion}</Text>
            </View>

            <View
              style={[
                styles.decisionPill,
                {
                  backgroundColor: trust.isDecisionGrade
                    ? Colors.primaryMuted
                    : Colors.warningMuted,
                  borderColor: trust.isDecisionGrade
                    ? Colors.primary + '40'
                    : Colors.warning + '40',
                },
              ]}
            >
              {trust.isDecisionGrade ? (
                <ShieldCheck size={14} color={Colors.primary} />
              ) : (
                <AlertTriangle size={14} color={Colors.warning} />
              )}
              <Text
                style={[
                  styles.decisionText,
                  {
                    color: trust.isDecisionGrade ? Colors.primary : Colors.warning,
                  },
                ]}
              >
                {trust.isDecisionGrade
                  ? 'Reliable enough for operational decisions'
                  : 'Advisory only — not decision-grade'}
              </Text>
            </View>

            {trust.note && <Text style={styles.note}>{trust.note}</Text>}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start' as const,
  },
  chipCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  chipTextCompact: {
    fontSize: 9,
  },
  chipMeta: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end' as const,
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sheetHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 4,
  },
  sheetIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sheetTitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  sheetFlag: {
    fontSize: 18,
    fontWeight: '800' as const,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  rowLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600' as const,
    width: 80,
  },
  rowValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500' as const,
    flex: 1,
    textAlign: 'right' as const,
  },
  decisionPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  decisionText: {
    fontSize: 12,
    fontWeight: '700' as const,
    flex: 1,
  },
  note: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});
