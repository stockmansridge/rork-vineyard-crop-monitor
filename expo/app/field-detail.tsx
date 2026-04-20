import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MapPin, Calendar, Leaf, Satellite, Droplets, Share2, Trash2, Layers, Thermometer, CloudRain, Flame, Snowflake, ClipboardList, Scissors, SprayCan, Wheat, TrendingUp, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import HealthBar from '@/components/HealthBar';
import { useVineyards } from '@/providers/VineyardProvider';
import { useAuth } from '@/providers/AuthProvider';
import { satelliteIndices as demoIndices } from '@/mocks/indices';
import { soilProbes as demoProbes } from '@/mocks/soilProbes';
import { Alert } from 'react-native';
import { useWeather } from '@/hooks/useWeather';
import NdviTrendSection from '@/components/NdviTrendSection';
import ForecastSection from '@/components/ForecastSection';
import { useRecords } from '@/providers/RecordsProvider';

export default function FieldDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, isDemoMode } = useAuth();
  const { vineyards, deleteVineyard, shares } = useVineyards();
  const satelliteIndices = isDemoMode ? demoIndices : [];
  const soilProbes = isDemoMode ? demoProbes : [];

  const vineyard = vineyards.find(v => v.id === id);
  const { getVineyardTasks, getVineyardPhenology, getVineyardSprays, getVineyardHarvests } = useRecords();
  const taskCount = id ? getVineyardTasks(id).length : 0;
  const phenologyCount = id ? getVineyardPhenology(id).length : 0;
  const sprayCount = id ? getVineyardSprays(id).length : 0;
  const harvestCount = id ? getVineyardHarvests(id).length : 0;

  if (!vineyard) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Vineyard' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.errorText}>Loading vineyard...</Text>
        </View>
      </View>
    );
  }

  const isOwner = vineyard.owner_id === user?.id;
  const vineyardShareCount = shares.filter(s => s.vineyard_id === vineyard.id).length;
  const fieldProbes = soilProbes.filter(p => p.vineyardId === vineyard.id);
  const weather = useWeather(vineyard.latitude, vineyard.longitude);
  const plantYear = vineyard.planting_date ? new Date(vineyard.planting_date).getFullYear() : null;
  const age = plantYear ? new Date().getFullYear() - plantYear : null;

  const handleDelete = () => {
    Alert.alert('Delete Vineyard', `Are you sure you want to delete "${vineyard.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteVineyard(vineyard.id);
            router.back();
          } catch {
            Alert.alert('Error', 'Failed to delete vineyard');
          }
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: vineyard.name,
          headerRight: () => (
            <View style={styles.headerActions}>
              {isOwner && (
                <>
                  <Pressable
                    onPress={() => router.push({ pathname: '/share-vineyard', params: { id: vineyard.id } })}
                    style={({ pressed }) => [pressed && styles.pressed]}
                    hitSlop={8}
                  >
                    <Share2 size={18} color={Colors.primary} />
                  </Pressable>
                  <Pressable
                    onPress={handleDelete}
                    style={({ pressed }) => [pressed && styles.pressed]}
                    hitSlop={8}
                  >
                    <Trash2 size={18} color={Colors.danger} />
                  </Pressable>
                </>
              )}
            </View>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.variety}>{vineyard.variety}</Text>
              <Text style={styles.name}>{vineyard.name}</Text>
            </View>
            {!isOwner && (
              <View style={styles.sharedBadge}>
                <Text style={styles.sharedBadgeText}>Shared with you</Text>
              </View>
            )}
          </View>
          <View style={styles.healthSection}>
            <Text style={styles.healthLabel}>Canopy Health Score</Text>
            <HealthBar score={vineyard.health_score} height={8} />
          </View>
          {isOwner && vineyardShareCount > 0 && (
            <Pressable
              style={({ pressed }) => [styles.shareInfo, pressed && styles.pressed]}
              onPress={() => router.push({ pathname: '/share-vineyard', params: { id: vineyard.id } })}
            >
              <Share2 size={13} color={Colors.info} />
              <Text style={styles.shareInfoText}>
                Shared with {vineyardShareCount} collaborator{vineyardShareCount !== 1 ? 's' : ''}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCard}>
            <MapPin size={16} color={Colors.primary} />
            <Text style={styles.metaValue}>{vineyard.area.toFixed(1)} {vineyard.area_unit}</Text>
            <Text style={styles.metaLabel}>Area</Text>
          </View>
          <View style={styles.metaCard}>
            <Calendar size={16} color={Colors.secondary} />
            <Text style={styles.metaValue}>{plantYear ?? '—'}</Text>
            <Text style={styles.metaLabel}>Planted</Text>
          </View>
          <View style={styles.metaCard}>
            <Leaf size={16} color={Colors.primary} />
            <Text style={styles.metaValue}>{age != null ? `${age} yrs` : '—'}</Text>
            <Text style={styles.metaLabel}>Vine Age</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Satellite size={16} color={Colors.sentinel} />
            <Text style={styles.sectionTitle}>Latest Indices</Text>
          </View>
          {satelliteIndices.slice(0, 4).map((idx) => (
            <View key={idx.id} style={styles.indexRow}>
              <View style={[styles.indexDot, { backgroundColor: idx.color }]} />
              <Text style={styles.indexLabel}>{idx.abbreviation}</Text>
              <View style={styles.indexBarTrack}>
                <View
                  style={[
                    styles.indexBarFill,
                    {
                      backgroundColor: idx.color,
                      width: `${((idx.value - idx.min) / (idx.max - idx.min)) * 100}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.indexValue, { color: idx.color }]}>{idx.value.toFixed(2)}</Text>
            </View>
          ))}

          {vineyard.polygon_coords && vineyard.polygon_coords.length >= 3 && (
            <Pressable
              style={({ pressed }) => [styles.overlayButton, pressed && styles.overlayButtonPressed]}
              onPress={() => router.push({ pathname: '/vineyard-overlay', params: { id: vineyard.id } })}
            >
              <Layers size={16} color={Colors.background} />
              <Text style={styles.overlayButtonText}>View Satellite Overlay</Text>
            </Pressable>
          )}
        </View>

        <NdviTrendSection
          vineyardId={vineyard.id}
          polygon={vineyard.polygon_coords ?? null}
        />

        <ForecastSection
          latitude={vineyard.latitude}
          longitude={vineyard.longitude}
        />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ClipboardList size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Activity Log</Text>
          </View>
          <View style={styles.logGrid}>
            <Pressable
              style={({ pressed }) => [styles.logCell, pressed && styles.pressed]}
              onPress={() => router.push({ pathname: '/vineyard-log', params: { id: vineyard.id, tab: 'tasks' } })}
            >
              <Scissors size={18} color={Colors.secondary} />
              <Text style={styles.logValue}>{taskCount}</Text>
              <Text style={styles.logLabel}>Tasks</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.logCell, pressed && styles.pressed]}
              onPress={() => router.push({ pathname: '/vineyard-log', params: { id: vineyard.id, tab: 'phenology' } })}
            >
              <TrendingUp size={18} color={Colors.primary} />
              <Text style={styles.logValue}>{phenologyCount}</Text>
              <Text style={styles.logLabel}>Phenology</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.logCell, pressed && styles.pressed]}
              onPress={() => router.push({ pathname: '/vineyard-log', params: { id: vineyard.id, tab: 'sprays' } })}
            >
              <SprayCan size={18} color={Colors.info} />
              <Text style={styles.logValue}>{sprayCount}</Text>
              <Text style={styles.logLabel}>Sprays</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.logCell, pressed && styles.pressed]}
              onPress={() => router.push({ pathname: '/vineyard-log', params: { id: vineyard.id, tab: 'harvests' } })}
            >
              <Wheat size={18} color={Colors.secondary} />
              <Text style={styles.logValue}>{harvestCount}</Text>
              <Text style={styles.logLabel}>Harvests</Text>
            </Pressable>
          </View>
          <Pressable
            style={({ pressed }) => [styles.logOpenBtn, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: '/vineyard-log', params: { id: vineyard.id } })}
          >
            <Text style={styles.logOpenText}>Open full activity log</Text>
            <ChevronRight size={16} color={Colors.primary} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Flame size={16} color={Colors.warning} />
            <Text style={styles.sectionTitle}>Growing Degree Days</Text>
          </View>
          {weather.isLoading ? (
            <View style={styles.weatherLoading}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.weatherLoadingText}>Loading weather data...</Text>
            </View>
          ) : weather.error ? (
            <Text style={styles.weatherError}>Unable to load weather data</Text>
          ) : weather.data ? (
            <>
              <View style={styles.gddHero}>
                <Text style={styles.gddHeroValue}>{Math.round(weather.data.cumulativeGdd)}</Text>
                <Text style={styles.gddHeroUnit}>GDD</Text>
              </View>
              <Text style={styles.gddHeroCaption}>
                Season total since {new Date(weather.data.seasonStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · base 10°C
              </Text>
              <View style={styles.gddGrid}>
                <View style={styles.gddCell}>
                  <Flame size={14} color={Colors.warning} />
                  <Text style={styles.gddCellValue}>+{weather.data.gddToday.toFixed(1)}</Text>
                  <Text style={styles.gddCellLabel}>Today</Text>
                </View>
                <View style={styles.gddCell}>
                  <Thermometer size={14} color={Colors.danger} />
                  <Text style={styles.gddCellValue}>{weather.data.avgTemp.toFixed(1)}°</Text>
                  <Text style={styles.gddCellLabel}>Avg Temp</Text>
                </View>
                <View style={styles.gddCell}>
                  <CloudRain size={14} color={Colors.info} />
                  <Text style={styles.gddCellValue}>{Math.round(weather.data.totalPrecip)}mm</Text>
                  <Text style={styles.gddCellLabel}>Rainfall</Text>
                </View>
                <View style={styles.gddCell}>
                  <Snowflake size={14} color={Colors.info} />
                  <Text style={styles.gddCellValue}>{Math.round(weather.data.chillingHours)}h</Text>
                  <Text style={styles.gddCellLabel}>Chill Hrs</Text>
                </View>
              </View>
              {weather.data.days.length > 0 && (
                <View style={styles.gddChart}>
                  {(() => {
                    const days = weather.data.days;
                    const slice = days.slice(-30);
                    const maxGdd = Math.max(...slice.map(d => d.gdd), 1);
                    return slice.map((d, i) => (
                      <View key={`${d.date}-${i}`} style={styles.gddBarCol}>
                        <View style={[styles.gddBar, { height: `${(d.gdd / maxGdd) * 100}%`, backgroundColor: d.gdd > 0 ? Colors.warning : Colors.cardBorder }]} />
                      </View>
                    ));
                  })()}
                </View>
              )}
              <Text style={styles.gddFootnote}>Last 30 days · daily GDD</Text>
            </>
          ) : null}
        </View>

        {fieldProbes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Droplets size={16} color={Colors.info} />
              <Text style={styles.sectionTitle}>Soil Probes ({fieldProbes.length})</Text>
            </View>
            {fieldProbes.map((probe) => (
              <View key={probe.id} style={styles.probeRow}>
                <View style={[styles.onlineDot, { backgroundColor: probe.isOnline ? Colors.primary : Colors.danger }]} />
                <View style={styles.probeInfo}>
                  <Text style={styles.probeName}>{probe.name}</Text>
                  <Text style={styles.probeDepth}>{probe.depth}cm depth</Text>
                </View>
                <View style={styles.probeReadings}>
                  <Text style={styles.probeReading}>{probe.readings.moisture}% moisture</Text>
                  <Text style={styles.probeReading}>{probe.readings.temperature}°C</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {vineyard.latitude && vineyard.longitude && (
          <View style={styles.coordSection}>
            <Text style={styles.coordLabel}>Coordinates</Text>
            <Text style={styles.coordValue}>
              {vineyard.latitude.toFixed(4)}, {vineyard.longitude.toFixed(4)}
            </Text>
          </View>
        )}

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
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 12,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  headerActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 16,
  },
  pressed: {
    opacity: 0.7,
  },
  headerCard: {
    margin: 16,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  variety: {
    color: Colors.secondary,
    fontSize: 13,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  name: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800' as const,
  },
  sharedBadge: {
    backgroundColor: Colors.infoMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sharedBadgeText: {
    color: Colors.info,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  healthSection: {
    gap: 6,
  },
  healthLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  shareInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  shareInfoText: {
    color: Colors.info,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
  },
  metaCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    gap: 6,
  },
  metaValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800' as const,
  },
  metaLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  section: {
    margin: 16,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  indexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  indexDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  indexLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700' as const,
    width: 48,
  },
  indexBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 3,
    overflow: 'hidden',
  },
  indexBarFill: {
    height: 6,
    borderRadius: 3,
  },
  indexValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    width: 40,
    textAlign: 'right' as const,
  },
  probeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  probeInfo: {
    flex: 1,
  },
  probeName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  probeDepth: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  probeReadings: {
    alignItems: 'flex-end' as const,
  },
  probeReading: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  coordSection: {
    marginHorizontal: 16,
    padding: 14,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coordLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  coordValue: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  bottomSpacer: {
    height: 20,
  },
  weatherLoading: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 8,
  },
  weatherLoadingText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  weatherError: {
    color: Colors.danger,
    fontSize: 12,
  },
  gddHero: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: 6,
  },
  gddHeroValue: {
    color: Colors.text,
    fontSize: 44,
    fontWeight: '800' as const,
    letterSpacing: -1.5,
  },
  gddHeroUnit: {
    color: Colors.warning,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  gddHeroCaption: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    marginBottom: 14,
  },
  gddGrid: {
    flexDirection: 'row' as const,
    gap: 8,
    marginBottom: 14,
  },
  gddCell: {
    flex: 1,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 10,
    padding: 10,
    alignItems: 'flex-start' as const,
    gap: 4,
  },
  gddCellValue: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  gddCellLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '500' as const,
  },
  gddChart: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    height: 60,
    gap: 2,
    marginTop: 4,
  },
  gddBarCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end' as const,
  },
  gddBar: {
    width: '100%',
    borderRadius: 2,
    minHeight: 2,
  },
  gddFootnote: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 6,
  },
  logGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  logCell: {
    flexBasis: '47%',
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  logValue: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800' as const,
    marginTop: 4,
  },
  logLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  logOpenBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    paddingVertical: 12,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primaryMuted,
  },
  logOpenText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  overlayButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 12,
  },
  overlayButtonPressed: {
    opacity: 0.8,
  },
  overlayButtonText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '700' as const,
  },
});
