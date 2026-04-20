import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Thermometer,
  Droplets,
  Wind,
  ChevronRight,
  Satellite,
  Inbox,
  Bell,
  MapPin,
  Eye,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import MetricCard from '@/components/MetricCard';
import HealthBar from '@/components/HealthBar';
import { useVineyards } from '@/providers/VineyardProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useWeatherStation } from '@/providers/WeatherStationProvider';
import { useAlerts } from '@/providers/AlertsProvider';
import { demoTrust, evaluateTrust, freshnessLabel, isStale } from '@/lib/dataTrust';
import { useForecast } from '@/hooks/useForecast';
import TodayActions from '@/components/TodayActions';
import { useScoutTasks } from '@/providers/ScoutTasksProvider';

export default function DashboardScreen() {
  const router = useRouter();
  const { profile, isDemoMode } = useAuth();
  const { vineyards, isLoading, isRefetching, refetch } = useVineyards();
  const { station } = useWeatherStation();
  const { unreadCount, probes } = useAlerts();
  const { openCount: openScoutCount } = useScoutTasks();
  const firstVineyard = vineyards[0];
  const forecast = useForecast(
    firstVineyard?.latitude ?? null,
    firstVineyard?.longitude ?? null
  );

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const currentWx = forecast.data?.current ?? null;
  const wxTrust = currentWx
    ? evaluateTrust({
        sourceType: 'observed',
        sourceName: forecast.data?.sourceName ?? 'Open-Meteo',
        observedAt: currentWx.time,
        scopeType: 'estate',
        methodVersion: 'forecast-v1',
        kind: 'weather-current',
      })
    : isDemoMode
    ? demoTrust('Demo weather', 'estate')
    : null;

  // Pick the freshest probe for soil moisture tile (real data only)
  const freshestProbe = useMemo(() => {
    const candidates = probes
      .filter((p) => p.moisture != null && !isStale('probe', p.last_reading))
      .sort((a, b) => (a.last_reading < b.last_reading ? 1 : -1));
    return candidates[0] ?? null;
  }, [probes]);

  const soilTrust = freshestProbe
    ? evaluateTrust({
        sourceType: 'observed',
        sourceName: `Soil Probe · ${freshestProbe.name}`,
        observedAt: freshestProbe.last_reading,
        scopeType: 'probe',
        methodVersion: 'probe-v1',
        kind: 'probe',
      })
    : isDemoMode
    ? demoTrust('Demo soil probe', 'probe')
    : null;

  const windTrust = wxTrust;
  const totalAlerts = unreadCount;
  const wxFreshness = currentWx ? freshnessLabel(currentWx.time) : null;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading vineyards...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
    >
      {profile?.display_name && (
        <Text style={styles.greeting}>G'day, {profile.display_name}</Text>
      )}

      <View style={styles.bannerRow}>
        <Pressable
          style={({ pressed }) => [styles.alertBanner, pressed && styles.pressed]}
          onPress={() => router.push('/alerts')}
          testID="alerts-banner"
        >
          <View style={styles.alertBannerIcon}>
            <Bell size={16} color={totalAlerts > 0 ? Colors.warning : Colors.textMuted} />
          </View>
          <Text style={styles.alertBannerText} numberOfLines={1}>
            {totalAlerts > 0
              ? `${totalAlerts} alert${totalAlerts !== 1 ? 's' : ''}`
              : 'All clear'}
          </Text>
          <ChevronRight size={14} color={Colors.textMuted} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.alertBanner, pressed && styles.pressed]}
          onPress={() => router.push('/scout-tasks')}
          testID="scout-banner"
        >
          <View style={styles.alertBannerIcon}>
            <Eye size={16} color={openScoutCount > 0 ? Colors.primary : Colors.textMuted} />
          </View>
          <Text style={styles.alertBannerText} numberOfLines={1}>
            {openScoutCount > 0
              ? `${openScoutCount} scout task${openScoutCount !== 1 ? 's' : ''}`
              : 'No open scout tasks'}
          </Text>
          <ChevronRight size={14} color={Colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.topSection}>
        <TodayActions />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Verified conditions</Text>
          {wxFreshness && (
            <Text style={styles.freshness}>Updated {wxFreshness}</Text>
          )}
        </View>
        <View style={styles.metricsRow}>
          <MetricCard
            label="Air Temp"
            value={currentWx ? currentWx.temperature.toFixed(1) : isDemoMode ? '16.2' : '—'}
            unit="°C"
            icon={<Thermometer size={18} color={Colors.warning} />}
            color={Colors.warning}
            trust={wxTrust ?? undefined}
          />
          <MetricCard
            label="Soil Moisture"
            value={freshestProbe?.moisture != null ? freshestProbe.moisture.toFixed(0) : isDemoMode ? '28.5' : '—'}
            unit="%"
            icon={<Droplets size={18} color={Colors.info} />}
            color={Colors.info}
            trust={soilTrust ?? undefined}
          />
          <MetricCard
            label="Wind"
            value={currentWx ? Math.round(currentWx.windSpeed).toString() : isDemoMode ? '12' : '—'}
            unit="km/h"
            icon={<Wind size={18} color={Colors.textSecondary} />}
            color={Colors.textSecondary}
            trust={windTrust ?? undefined}
          />
        </View>
        {!freshestProbe && !isDemoMode && (
          <Text style={styles.hint}>
            No fresh probe data — add a probe to get block-specific soil readings.
          </Text>
        )}
      </View>

      {station && (
        <Pressable
          style={({ pressed }) => [styles.stationBanner, pressed && styles.pressed]}
          onPress={() => router.push('/weather-station')}
        >
          <Satellite size={14} color={Colors.info} />
          <Text style={styles.stationBannerText} numberOfLines={1}>
            Station: {station.stationName}
          </Text>
          <ChevronRight size={14} color={Colors.textMuted} />
        </Pressable>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Blocks</Text>
          <Pressable onPress={() => router.push('/(tabs)/fields')} hitSlop={6}>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        </View>
        {vineyards.length === 0 ? (
          <View style={styles.emptyCard}>
            <Inbox size={28} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No vineyards yet</Text>
            <Pressable
              style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
              onPress={() => router.push('/add-field')}
            >
              <Text style={styles.addBtnText}>Add Your First Vineyard</Text>
            </Pressable>
          </View>
        ) : (
          vineyards.slice(0, 4).map((vineyard) => {
            const scanStale = isStale('satellite', vineyard.last_scan);
            return (
              <Pressable
                key={vineyard.id}
                style={({ pressed }) => [styles.vineyardCard, pressed && styles.pressed]}
                onPress={() => router.push({ pathname: '/field-detail', params: { id: vineyard.id } })}
              >
                <View style={styles.vineyardLeft}>
                  <Text style={styles.vineyardName}>{vineyard.name}</Text>
                  <Text style={styles.vineyardVariety}>
                    {vineyard.variety} · {vineyard.area.toFixed(1)} {vineyard.area_unit}
                  </Text>
                  <View style={styles.vineyardMeta}>
                    <MapPin size={10} color={Colors.textMuted} />
                    <Text style={styles.vineyardMetaText}>
                      Scan {freshnessLabel(vineyard.last_scan)}{scanStale ? ' · stale' : ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.vineyardRight}>
                  <HealthBar score={vineyard.health_score} height={4} showLabel={false} />
                  <ChevronRight size={16} color={Colors.textMuted} />
                </View>
              </Pressable>
            );
          })
        )}
      </View>

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
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 12,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  greeting: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  topSection: {
    marginTop: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  section: {
    marginTop: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700' as const,
  },
  seeAll: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  freshness: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 8,
  },
  vineyardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.8,
  },
  vineyardLeft: {
    flex: 1,
    marginRight: 12,
  },
  vineyardName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  vineyardVariety: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  vineyardMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 6,
  },
  vineyardMetaText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '500' as const,
  },
  vineyardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 90,
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center' as const,
    gap: 10,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  addBtn: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  addBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  bannerRow: {
    flexDirection: 'row' as const,
    gap: 8,
    marginBottom: 14,
  },
  alertBanner: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  alertBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  alertBannerText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
    flex: 1,
  },
  stationBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.infoMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.info + '30',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
  },
  stationBannerText: {
    color: Colors.info,
    fontSize: 12,
    fontWeight: '600' as const,
    flex: 1,
  },
  bottomSpacer: {
    height: 20,
  },
});
