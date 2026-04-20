import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Wifi, WifiOff, Battery, Droplets, Thermometer, FlaskConical, Zap, Ruler, Clock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { soilProbes as demoProbes } from '@/mocks/soilProbes';
import { useAuth } from '@/providers/AuthProvider';
import ProbeChartsSection from '@/components/ProbeChartsSection';

function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function ProbeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDemoMode } = useAuth();
  const probes = isDemoMode ? demoProbes : [];
  const probe = probes.find(p => p.id === id);

  if (!probe) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Probe not found</Text>
      </View>
    );
  }

  const r = probe.readings;

  return (
    <>
      <Stack.Screen options={{ title: probe.name }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.probeName}>{probe.name}</Text>
              <Text style={styles.probeVineyard}>{probe.vineyardName}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: probe.isOnline ? Colors.primaryMuted : Colors.dangerMuted }]}>
              {probe.isOnline ? <Wifi size={14} color={Colors.primary} /> : <WifiOff size={14} color={Colors.danger} />}
              <Text style={[styles.statusText, { color: probe.isOnline ? Colors.primary : Colors.danger }]}>
                {probe.isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
          <View style={styles.heroMeta}>
            <View style={styles.metaItem}>
              <Battery size={14} color={probe.batteryLevel < 20 ? Colors.danger : Colors.textSecondary} />
              <Text style={[styles.metaText, { color: probe.batteryLevel < 20 ? Colors.danger : Colors.textSecondary }]}>
                {probe.batteryLevel}%
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ruler size={14} color={Colors.textSecondary} />
              <Text style={styles.metaText}>{probe.depth}cm depth</Text>
            </View>
            <View style={styles.metaItem}>
              <Clock size={14} color={Colors.textSecondary} />
              <Text style={styles.metaText}>{getTimeAgo(probe.lastReading)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionHeader}>PRIMARY READINGS</Text>
        <View style={styles.readingsGrid}>
          <View style={styles.readingCard}>
            <View style={[styles.readingIcon, { backgroundColor: Colors.info + '18' }]}>
              <Droplets size={20} color={Colors.info} />
            </View>
            <Text style={styles.readingValue}>{r.moisture}%</Text>
            <Text style={styles.readingLabel}>Soil Moisture</Text>
            <View style={styles.readingBar}>
              <View style={[styles.readingBarFill, { width: `${r.moisture}%`, backgroundColor: Colors.info }]} />
            </View>
          </View>
          <View style={styles.readingCard}>
            <View style={[styles.readingIcon, { backgroundColor: Colors.warning + '18' }]}>
              <Thermometer size={20} color={Colors.warning} />
            </View>
            <Text style={styles.readingValue}>{r.temperature}°C</Text>
            <Text style={styles.readingLabel}>Temperature</Text>
            <View style={styles.readingBar}>
              <View style={[styles.readingBarFill, { width: `${(r.temperature / 40) * 100}%`, backgroundColor: Colors.warning }]} />
            </View>
          </View>
        </View>

        <View style={styles.readingsGrid}>
          <View style={styles.readingCard}>
            <View style={[styles.readingIcon, { backgroundColor: Colors.msavi + '18' }]}>
              <FlaskConical size={20} color={Colors.msavi} />
            </View>
            <Text style={styles.readingValue}>{r.pH}</Text>
            <Text style={styles.readingLabel}>Soil pH</Text>
            <Text style={styles.readingNote}>
              {r.pH >= 6.0 && r.pH <= 7.0 ? 'Optimal' : r.pH < 6.0 ? 'Acidic' : 'Alkaline'}
            </Text>
          </View>
          <View style={styles.readingCard}>
            <View style={[styles.readingIcon, { backgroundColor: Colors.secondary + '18' }]}>
              <Zap size={20} color={Colors.secondary} />
            </View>
            <Text style={styles.readingValue}>{r.ec}</Text>
            <Text style={styles.readingLabel}>EC (dS/m)</Text>
            <Text style={styles.readingNote}>
              {r.ec < 1.0 ? 'Low salinity' : r.ec < 2.0 ? 'Normal' : 'High salinity'}
            </Text>
          </View>
        </View>

        <ProbeChartsSection
          probeId={probe.id}
          isOnline={probe.isOnline}
          current={{
            moisture: r.moisture,
            temperature: r.temperature,
            ph: r.pH,
            ec: r.ec,
          }}
          thresholds={{
            moistureMin: 20,
            moistureMax: 40,
            tempMin: 8,
            tempMax: 28,
            phMin: 6.0,
            phMax: 7.0,
            ecMin: 0.5,
            ecMax: 2.0,
          }}
        />

        <Text style={styles.sectionHeader}>NUTRIENT PROFILE (mg/kg)</Text>
        <View style={styles.nutrientCard}>
          <View style={styles.nutrientRow}>
            <View style={styles.nutrientLabelCol}>
              <Text style={[styles.nutrientSymbol, { color: Colors.primary }]}>N</Text>
              <Text style={styles.nutrientName}>Nitrogen</Text>
            </View>
            <View style={styles.nutrientBarTrack}>
              <View style={[styles.nutrientBarFill, { width: `${(r.nitrogen / 80) * 100}%`, backgroundColor: Colors.primary }]} />
            </View>
            <Text style={styles.nutrientValue}>{r.nitrogen}</Text>
          </View>
          <View style={styles.nutrientRow}>
            <View style={styles.nutrientLabelCol}>
              <Text style={[styles.nutrientSymbol, { color: Colors.ndre }]}>P</Text>
              <Text style={styles.nutrientName}>Phosphorus</Text>
            </View>
            <View style={styles.nutrientBarTrack}>
              <View style={[styles.nutrientBarFill, { width: `${(r.phosphorus / 40) * 100}%`, backgroundColor: Colors.ndre }]} />
            </View>
            <Text style={styles.nutrientValue}>{r.phosphorus}</Text>
          </View>
          <View style={styles.nutrientRow}>
            <View style={styles.nutrientLabelCol}>
              <Text style={[styles.nutrientSymbol, { color: Colors.secondary }]}>K</Text>
              <Text style={styles.nutrientName}>Potassium</Text>
            </View>
            <View style={styles.nutrientBarTrack}>
              <View style={[styles.nutrientBarFill, { width: `${(r.potassium / 250) * 100}%`, backgroundColor: Colors.secondary }]} />
            </View>
            <Text style={styles.nutrientValue}>{r.potassium}</Text>
          </View>
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
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 14,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  probeName: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800' as const,
  },
  probeVineyard: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  heroMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 4,
  },
  readingsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  readingCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    gap: 6,
  },
  readingIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  readingValue: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '800' as const,
  },
  readingLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  readingBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  readingBarFill: {
    height: 4,
    borderRadius: 2,
  },
  readingNote: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  nutrientCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 14,
  },
  nutrientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nutrientLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 110,
  },
  nutrientSymbol: {
    fontSize: 16,
    fontWeight: '900' as const,
    width: 20,
    textAlign: 'center',
  },
  nutrientName: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  nutrientBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 3,
    overflow: 'hidden',
  },
  nutrientBarFill: {
    height: 6,
    borderRadius: 3,
  },
  nutrientValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
    width: 36,
    textAlign: 'right',
  },
  bottomSpacer: {
    height: 40,
  },
});
