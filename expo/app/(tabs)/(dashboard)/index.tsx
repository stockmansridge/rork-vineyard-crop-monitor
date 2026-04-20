import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Leaf, Thermometer, Droplets, Wind, ChevronRight, Satellite, Inbox, Bell, AlertTriangle, AlertCircle, Info } from 'lucide-react-native';
import Colors from '@/constants/colors';
import MetricCard from '@/components/MetricCard';
import HealthBar from '@/components/HealthBar';
import { useVineyards } from '@/providers/VineyardProvider';
import { useAuth } from '@/providers/AuthProvider';
import { satelliteIndices } from '@/mocks/indices';
import { useWeatherStation } from '@/providers/WeatherStationProvider';
import { useAlerts, ComputedAlert } from '@/providers/AlertsProvider';

function DashboardAlert({ alert, onPress }: { alert: ComputedAlert; onPress: () => void }) {
  const cfg = alert.severity === 'danger'
    ? { color: Colors.danger, bg: Colors.dangerMuted, Icon: AlertCircle }
    : alert.severity === 'warning'
    ? { color: Colors.warning, bg: Colors.warningMuted, Icon: AlertTriangle }
    : { color: Colors.info, bg: Colors.infoMuted, Icon: Info };
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.dashAlertCard, pressed && styles.pressed]}
    >
      <View style={[styles.dashAlertIcon, { backgroundColor: cfg.bg }]}>
        <cfg.Icon size={16} color={cfg.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.dashAlertTitle} numberOfLines={1}>{alert.title}</Text>
        <Text style={styles.dashAlertMsg} numberOfLines={2}>{alert.message}</Text>
      </View>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { profile, isDemoMode } = useAuth();
  const { vineyards, isLoading, isRefetching, refetch } = useVineyards();
  const { station } = useWeatherStation();
  const { alerts: computedAlerts, unreadCount, markRead } = useAlerts();

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const avgHealth = vineyards.length > 0
    ? Math.round(vineyards.reduce((sum, v) => sum + v.health_score, 0) / vineyards.length)
    : 0;
  const totalAlerts = unreadCount;
  const topIndices = isDemoMode ? satelliteIndices.slice(0, 3) : [];
  const visibleAlerts = computedAlerts.slice(0, 3);

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
        <Text style={styles.greeting}>
          G'day, {profile.display_name}
        </Text>
      )}

      <Pressable
        style={({ pressed }) => [styles.alertBanner, pressed && styles.pressed]}
        onPress={() => router.push('/alerts')}
      >
        <View style={styles.alertBannerIcon}>
          <Bell size={16} color={totalAlerts > 0 ? Colors.warning : Colors.textMuted} />
        </View>
        <Text style={styles.alertBannerText}>
          {totalAlerts > 0 ? `${totalAlerts} active alert${totalAlerts !== 1 ? 's' : ''}` : 'All clear — no active alerts'}
        </Text>
        <ChevronRight size={14} color={Colors.textMuted} />
      </Pressable>

      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroLabel}>Estate Health</Text>
            <Text style={styles.heroValue}>{avgHealth}%</Text>
          </View>
          <View style={styles.heroBadge}>
            <Leaf size={16} color={Colors.primary} />
            <Text style={styles.heroBadgeText}>{vineyards.length} fields</Text>
          </View>
        </View>
        {vineyards.length > 0 && (
          <HealthBar score={avgHealth} height={8} showLabel={false} />
        )}
        <View style={styles.heroFooter}>
          <Text style={styles.heroFooterText}>
            {totalAlerts} unread alert{totalAlerts !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.heroFooterDate}>Last scan: Apr 1, 2026</Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <MetricCard
          label="Avg Temp"
          value="16.2"
          unit="°C"
          icon={<Thermometer size={18} color={Colors.warning} />}
          color={Colors.warning}
        />
        <MetricCard
          label="Soil Moisture"
          value="28.5"
          unit="%"
          icon={<Droplets size={18} color={Colors.info} />}
          color={Colors.info}
        />
        <MetricCard
          label="Wind"
          value="12"
          unit="km/h"
          icon={<Wind size={18} color={Colors.textSecondary} />}
          color={Colors.textSecondary}
        />
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

      {topIndices.length > 0 && (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Satellite Indices</Text>
          <Pressable onPress={() => router.push('/(tabs)/indices')}>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        </View>
        <View style={styles.indicesRow}>
          {topIndices.map((idx) => (
            <Pressable
              key={idx.id}
              style={({ pressed }) => [styles.indexChip, pressed && styles.pressed]}
              onPress={() => router.push({ pathname: '/index-detail', params: { id: idx.id } })}
            >
              <Satellite size={14} color={idx.color} />
              <Text style={styles.indexAbbr}>{idx.abbreviation}</Text>
              <Text style={[styles.indexVal, { color: idx.color }]}>{idx.value.toFixed(2)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Vineyards</Text>
          <Pressable onPress={() => router.push('/(tabs)/fields')}>
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
          vineyards.slice(0, 3).map((vineyard) => (
            <Pressable
              key={vineyard.id}
              style={({ pressed }) => [styles.vineyardCard, pressed && styles.pressed]}
              onPress={() => router.push({ pathname: '/field-detail', params: { id: vineyard.id } })}
            >
              <View style={styles.vineyardLeft}>
                <Text style={styles.vineyardName}>{vineyard.name}</Text>
                <Text style={styles.vineyardVariety}>{vineyard.variety} · {vineyard.area.toFixed(1)} {vineyard.area_unit}</Text>
              </View>
              <View style={styles.vineyardRight}>
                <HealthBar score={vineyard.health_score} height={4} />
                <ChevronRight size={16} color={Colors.textMuted} />
              </View>
            </Pressable>
          ))
        )}
      </View>

      {visibleAlerts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Alerts</Text>
            <Pressable onPress={() => router.push('/alerts')}>
              <Text style={styles.seeAll}>See All</Text>
            </Pressable>
          </View>
          <View style={styles.alertsList}>
            {visibleAlerts.map((a) => (
              <DashboardAlert
                key={a.id}
                alert={a}
                onPress={() => {
                  void markRead(a.id);
                  if (a.vineyardId) router.push({ pathname: '/field-detail', params: { id: a.vineyardId } });
                  else router.push('/alerts');
                }}
              />
            ))}
          </View>
        </View>
      )}

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
  heroCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 14,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500' as const,
    marginBottom: 2,
  },
  heroValue: {
    color: Colors.text,
    fontSize: 42,
    fontWeight: '800' as const,
    letterSpacing: -1,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  heroBadgeText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroFooterText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  heroFooterDate: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  indicesRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  indexChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  indexAbbr: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  indexVal: {
    fontSize: 14,
    fontWeight: '700' as const,
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
  alertsList: {
    gap: 8,
  },
  alertBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
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
  dashAlertCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  dashAlertIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  dashAlertTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  dashAlertMsg: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
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
    marginTop: 16,
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
