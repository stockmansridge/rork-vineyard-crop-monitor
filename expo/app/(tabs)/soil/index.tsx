import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Wifi, WifiOff, Battery, ChevronRight, Droplets, Thermometer, FlaskConical, Zap } from 'lucide-react-native';
import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import { soilProbes as demoProbes } from '@/mocks/soilProbes';
import { useAuth } from '@/providers/AuthProvider';

export default function SoilScreen() {
  const router = useRouter();
  const { isDemoMode } = useAuth();
  const soilProbes = isDemoMode ? demoProbes : [];

  const onlineCount = soilProbes.filter(p => p.isOnline).length;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/add-probe')}
              style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
            >
              <Plus size={20} color={Colors.primary} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusRow}>
          <View style={[styles.statusCard, styles.statusOnline]}>
            <Wifi size={18} color={Colors.primary} />
            <Text style={styles.statusValue}>{onlineCount}</Text>
            <Text style={styles.statusLabel}>Online</Text>
          </View>
          <View style={[styles.statusCard, styles.statusOffline]}>
            <WifiOff size={18} color={Colors.danger} />
            <Text style={styles.statusValue}>{soilProbes.length - onlineCount}</Text>
            <Text style={styles.statusLabel}>Offline</Text>
          </View>
          <View style={styles.statusCard}>
            <Battery size={18} color={Colors.warning} />
            <Text style={styles.statusValue}>
              {soilProbes.filter(p => p.batteryLevel < 20).length}
            </Text>
            <Text style={styles.statusLabel}>Low Battery</Text>
          </View>
        </View>

        {soilProbes.length === 0 && (
          <View style={styles.emptyCard}>
            <WifiOff size={28} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No soil probes yet</Text>
            <Text style={styles.emptyText}>Add your first probe to monitor soil conditions.</Text>
            <Pressable
              style={({ pressed }) => [styles.emptyBtn, pressed && styles.pressed]}
              onPress={() => router.push('/add-probe')}
            >
              <Plus size={16} color={Colors.background} />
              <Text style={styles.emptyBtnText}>Add Probe</Text>
            </Pressable>
          </View>
        )}

        {soilProbes.map((probe) => (
          <Pressable
            key={probe.id}
            style={({ pressed }) => [styles.probeCard, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: '/probe-detail', params: { id: probe.id } })}
          >
            <View style={styles.probeHeader}>
              <View style={styles.probeInfo}>
                <View style={styles.probeTitleRow}>
                  <View style={[
                    styles.onlineDot,
                    { backgroundColor: probe.isOnline ? Colors.primary : Colors.danger }
                  ]} />
                  <Text style={styles.probeName}>{probe.name}</Text>
                </View>
                <Text style={styles.probeVineyard}>{probe.vineyardName} · {probe.depth}cm depth</Text>
              </View>
              <View style={styles.batteryContainer}>
                <Battery
                  size={14}
                  color={probe.batteryLevel < 20 ? Colors.danger : Colors.textMuted}
                />
                <Text style={[
                  styles.batteryText,
                  { color: probe.batteryLevel < 20 ? Colors.danger : Colors.textMuted }
                ]}>
                  {probe.batteryLevel}%
                </Text>
                <ChevronRight size={16} color={Colors.textMuted} />
              </View>
            </View>

            <View style={styles.readingsGrid}>
              <View style={styles.readingItem}>
                <Droplets size={14} color={Colors.info} />
                <Text style={styles.readingValue}>{probe.readings.moisture}%</Text>
                <Text style={styles.readingLabel}>Moisture</Text>
              </View>
              <View style={styles.readingItem}>
                <Thermometer size={14} color={Colors.warning} />
                <Text style={styles.readingValue}>{probe.readings.temperature}°C</Text>
                <Text style={styles.readingLabel}>Temp</Text>
              </View>
              <View style={styles.readingItem}>
                <FlaskConical size={14} color={Colors.msavi} />
                <Text style={styles.readingValue}>{probe.readings.pH}</Text>
                <Text style={styles.readingLabel}>pH</Text>
              </View>
              <View style={styles.readingItem}>
                <Zap size={14} color={Colors.secondary} />
                <Text style={styles.readingValue}>{probe.readings.ec}</Text>
                <Text style={styles.readingLabel}>EC (dS/m)</Text>
              </View>
            </View>

            <View style={styles.nutrientsRow}>
              <View style={styles.nutrientChip}>
                <Text style={styles.nutrientLabel}>N</Text>
                <Text style={styles.nutrientValue}>{probe.readings.nitrogen}</Text>
              </View>
              <View style={styles.nutrientChip}>
                <Text style={styles.nutrientLabel}>P</Text>
                <Text style={styles.nutrientValue}>{probe.readings.phosphorus}</Text>
              </View>
              <View style={styles.nutrientChip}>
                <Text style={styles.nutrientLabel}>K</Text>
                <Text style={styles.nutrientValue}>{probe.readings.potassium}</Text>
              </View>
              <Text style={styles.nutrientUnit}>mg/kg</Text>
            </View>
          </Pressable>
        ))}

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
  addBtn: {
    padding: 4,
  },
  pressed: {
    opacity: 0.8,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statusCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    gap: 4,
  },
  statusOnline: {
    borderColor: Colors.primary + '30',
  },
  statusOffline: {
    borderColor: Colors.danger + '30',
  },
  statusValue: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800' as const,
  },
  statusLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  probeCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 12,
  },
  probeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  probeInfo: {
    flex: 1,
  },
  probeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  probeName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  probeVineyard: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
    marginLeft: 15,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batteryText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  readingsGrid: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 8,
  },
  readingItem: {
    flex: 1,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    gap: 4,
  },
  readingValue: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  readingLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '500' as const,
  },
  nutrientsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  nutrientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.backgroundAlt,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  nutrientLabel: {
    color: Colors.secondary,
    fontSize: 12,
    fontWeight: '800' as const,
  },
  nutrientValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  nutrientUnit: {
    color: Colors.textMuted,
    fontSize: 11,
    marginLeft: 'auto' as const,
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
  emptyBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyBtnText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '700' as const,
  },
});
