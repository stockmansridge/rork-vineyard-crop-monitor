import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SprayCan, Snowflake, Bug, AlertCircle, CheckCircle2, Clock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import DataTrustBadge from '@/components/DataTrustBadge';
import {
  type WeatherDecisions,
  type DecisionReason,
  sprayStatusColor,
  frostStatusColor,
  diseaseStatusColor,
} from '@/lib/weatherDecisions';

interface Props {
  decisions: WeatherDecisions;
  testID?: string;
}

function ReasonList({ reasons }: { reasons: DecisionReason[] }) {
  if (reasons.length === 0) return null;
  return (
    <View style={styles.reasonList}>
      {reasons.map((r, i) => {
        const dot =
          r.impact === 'negative'
            ? Colors.warning
            : r.impact === 'positive'
            ? Colors.primary
            : Colors.textMuted;
        return (
          <View key={`${r.label}-${i}`} style={styles.reasonRow}>
            <View style={[styles.reasonDot, { backgroundColor: dot }]} />
            <Text style={styles.reasonText} numberOfLines={2}>
              {r.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function WeatherDecisionsCard({ decisions, testID }: Props) {
  const spray = sprayStatusColor(decisions.spray.status);
  const frost = frostStatusColor(decisions.frost.status);
  const disease = diseaseStatusColor(decisions.disease.status);

  return (
    <View style={styles.card} testID={testID ?? 'weather-decisions'}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <CheckCircle2 size={16} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Weather-based decisions</Text>
      </View>

      {decisions.forecastStale && (
        <View style={styles.staleBanner}>
          <Clock size={12} color={Colors.warning} />
          <Text style={styles.staleText}>Forecast is stale — recommendations downgraded to advisory.</Text>
        </View>
      )}

      {/* Spray */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: spray.bg }]}>
            <SprayCan size={14} color={spray.fg} />
          </View>
          <Text style={styles.sectionTitle}>Spraying</Text>
          <View style={[styles.pill, { backgroundColor: spray.bg, borderColor: spray.fg + '50' }]}>
            <Text style={[styles.pillText, { color: spray.fg }]}>{spray.label}</Text>
          </View>
        </View>
        <Text style={styles.headline}>{decisions.spray.headline}</Text>
        <ReasonList reasons={decisions.spray.reasons} />
        {decisions.spray.nextWindow && decisions.spray.status !== 'suitable' && (
          <View style={styles.nextWindow}>
            <Text style={styles.nextWindowLabel}>Next better window</Text>
            <Text style={styles.nextWindowValue}>{decisions.spray.nextWindow.label}</Text>
          </View>
        )}
        <View style={styles.trustRow}>
          <DataTrustBadge trust={decisions.spray.trust} compact />
        </View>
      </View>

      <View style={styles.divider} />

      {/* Frost */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: frost.bg }]}>
            <Snowflake size={14} color={frost.fg} />
          </View>
          <Text style={styles.sectionTitle}>Frost watch</Text>
          <View style={[styles.pill, { backgroundColor: frost.bg, borderColor: frost.fg + '50' }]}>
            <Text style={[styles.pillText, { color: frost.fg }]}>{frost.label}</Text>
          </View>
        </View>
        <Text style={styles.headline}>{decisions.frost.headline}</Text>
        <ReasonList reasons={decisions.frost.reasons} />
        <View style={styles.trustRow}>
          <DataTrustBadge trust={decisions.frost.trust} compact />
        </View>
      </View>

      <View style={styles.divider} />

      {/* Disease */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: disease.bg }]}>
            <Bug size={14} color={disease.fg} />
          </View>
          <Text style={styles.sectionTitle}>Disease risk</Text>
          <View style={[styles.pill, { backgroundColor: disease.bg, borderColor: disease.fg + '50' }]}>
            <Text style={[styles.pillText, { color: disease.fg }]}>{disease.label}</Text>
          </View>
        </View>
        <Text style={styles.headline}>{decisions.disease.headline}</Text>
        <ReasonList reasons={decisions.disease.reasons} />
        {(decisions.disease.status === 'elevated' || decisions.disease.status === 'inspect') && (
          <View style={styles.advisoryBanner}>
            <AlertCircle size={12} color={Colors.info} />
            <Text style={styles.advisoryText}>
              Generic disease-supportive signal, not a pathogen-specific model. Ground-truth before spray decisions.
            </Text>
          </View>
        )}
        <View style={styles.trustRow}>
          <DataTrustBadge trust={decisions.disease.trust} compact />
        </View>
      </View>
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
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  staleBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.warningMuted,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.warning + '30',
    marginBottom: 10,
  },
  staleText: {
    color: Colors.warning,
    fontSize: 11,
    fontWeight: '600' as const,
    flex: 1,
  },
  section: {
    gap: 6,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  sectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sectionTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: 13,
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
    fontSize: 14,
    fontWeight: '700' as const,
    marginTop: 2,
  },
  reasonList: {
    marginTop: 4,
    gap: 4,
  },
  reasonRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  reasonDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  reasonText: {
    color: Colors.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  nextWindow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 10,
  },
  nextWindowLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  nextWindowValue: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  advisoryBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: Colors.infoMuted,
    borderRadius: 10,
  },
  advisoryText: {
    color: Colors.info,
    fontSize: 11,
    fontWeight: '500' as const,
    flex: 1,
  },
  trustRow: {
    flexDirection: 'row' as const,
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginVertical: 14,
  },
});
