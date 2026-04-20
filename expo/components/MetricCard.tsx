import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Colors from '@/constants/colors';
import DataTrustBadge from '@/components/DataTrustBadge';
import type { DataTrust } from '@/lib/dataTrust';

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  color?: string;
  onPress?: () => void;
  trust?: DataTrust;
}

export default function MetricCard({ label, value, unit, icon, color = Colors.primary, onPress, trust }: MetricCardProps) {
  const dim = trust && (trust.qualityFlag === 'demo' || trust.qualityFlag === 'stale' || trust.qualityFlag === 'low');
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && onPress ? styles.pressed : null]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + '18' }]}>
        {icon}
      </View>
      <Text style={[styles.value, dim && styles.valueDim]} numberOfLines={1}>
        {value}
        {unit ? <Text style={styles.unit}> {unit}</Text> : null}
      </Text>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
      {trust ? (
        <View style={styles.trustRow}>
          <DataTrustBadge trust={trust} compact showTimestamp={false} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  value: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  unit: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  valueDim: {
    opacity: 0.75,
  },
  trustRow: {
    marginTop: 6,
    flexDirection: 'row' as const,
  },
});
