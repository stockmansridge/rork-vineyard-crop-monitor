import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Search, MapPin, CloudSun, Check, Trash2, Key } from 'lucide-react-native';
import Colors from '@/constants/colors';
import {
  useWeatherStation,
  findNearbyStations,
  WeatherStation,
} from '@/providers/WeatherStationProvider';
import { useVineyards } from '@/providers/VineyardProvider';

export default function WeatherStationScreen() {
  const router = useRouter();
  const { station, apiKey, setStation, setApiKey, clearStation } = useWeatherStation();
  const { vineyards } = useVineyards();

  const [apiKeyDraft, setApiKeyDraft] = useState<string>(apiKey);
  const [stations, setStations] = useState<WeatherStation[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const firstVineyard = useMemo(
    () => vineyards.find((v) => v.latitude != null && v.longitude != null),
    [vineyards]
  );

  const search = useCallback(
    async (lat: number, lon: number) => {
      setIsSearching(true);
      setError(null);
      setStations([]);
      try {
        const keyToUse = apiKeyDraft.trim() || apiKey;
        const results = await findNearbyStations(lat, lon, keyToUse);
        setStations(results);
        if (results.length === 0) {
          setError('No Weather Underground stations found nearby.');
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to search';
        console.log('[WeatherStation] Search error', msg);
        setError(msg);
      } finally {
        setIsSearching(false);
      }
    },
    [apiKey, apiKeyDraft]
  );

  const handleUseCurrentLocation = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          Alert.alert('Unavailable', 'Geolocation not supported in this browser.');
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => void search(pos.coords.latitude, pos.coords.longitude),
          (err) => setError(err.message)
        );
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      await search(pos.coords.latitude, pos.coords.longitude);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Location error';
      setError(msg);
    }
  }, [search]);

  const handleUseVineyard = useCallback(() => {
    if (firstVineyard && firstVineyard.latitude != null && firstVineyard.longitude != null) {
      void search(firstVineyard.latitude, firstVineyard.longitude);
    }
  }, [firstVineyard, search]);

  const handleSaveApiKey = useCallback(() => {
    const trimmed = apiKeyDraft.trim();
    if (!trimmed) {
      Alert.alert('API Key Required', 'Please enter your Weather Underground API key.');
      return;
    }
    void setApiKey(trimmed);
    Alert.alert('Saved', 'API key updated.');
  }, [apiKeyDraft, setApiKey]);

  const handleSelect = useCallback(
    async (s: WeatherStation) => {
      await setStation(s);
      Alert.alert('Station Selected', `${s.stationName} is now your weather source.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    [setStation, router]
  );

  const handleClear = useCallback(() => {
    Alert.alert('Remove Station', 'Stop using a personal weather station?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => clearStation(),
      },
    ]);
  }, [clearStation]);

  return (
    <>
      <Stack.Screen options={{ title: 'Weather Station' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.introCard}>
          <CloudSun size={22} color={Colors.info} />
          <View style={{ flex: 1 }}>
            <Text style={styles.introTitle}>Personal Weather Station</Text>
            <Text style={styles.introText}>
              Select a nearby Weather Underground station to power all weather data in the app.
            </Text>
          </View>
        </View>

        {station && (
          <View style={styles.currentCard}>
            <View style={styles.currentRow}>
              <View style={styles.currentDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.currentLabel}>ACTIVE STATION</Text>
                <Text style={styles.currentName}>{station.stationName}</Text>
                <Text style={styles.currentId}>{station.stationId}</Text>
              </View>
              <Pressable
                onPress={handleClear}
                style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}
                hitSlop={8}
              >
                <Trash2 size={16} color={Colors.danger} />
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.sectionHeader}>API KEY</Text>
        <View style={styles.apiKeyCard}>
          <View style={styles.apiKeyRow}>
            <Key size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.apiKeyInput}
              value={apiKeyDraft}
              onChangeText={setApiKeyDraft}
              placeholder="Weather Underground API Key"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </View>
          <Pressable
            style={({ pressed }) => [styles.saveKeyBtn, pressed && styles.pressed]}
            onPress={handleSaveApiKey}
          >
            <Text style={styles.saveKeyBtnText}>Save Key</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionHeader}>FIND STATIONS</Text>
        <View style={styles.searchRow}>
          <Pressable
            style={({ pressed }) => [styles.searchBtn, pressed && styles.pressed]}
            onPress={handleUseCurrentLocation}
            disabled={isSearching}
          >
            <MapPin size={16} color={Colors.primary} />
            <Text style={styles.searchBtnText}>Use My Location</Text>
          </Pressable>
          {firstVineyard && (
            <Pressable
              style={({ pressed }) => [styles.searchBtn, pressed && styles.pressed]}
              onPress={handleUseVineyard}
              disabled={isSearching}
            >
              <Search size={16} color={Colors.secondary} />
              <Text style={[styles.searchBtnText, { color: Colors.secondary }]} numberOfLines={1}>
                Near {firstVineyard.name}
              </Text>
            </Pressable>
          )}
        </View>

        {isSearching && (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>Searching nearby stations...</Text>
          </View>
        )}

        {error && !isSearching && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {stations.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>NEAREST 10 STATIONS</Text>
            <View style={styles.list}>
              {stations.map((s, idx) => {
                const isActive = station?.stationId === s.stationId;
                return (
                  <Pressable
                    key={s.stationId}
                    style={({ pressed }) => [
                      styles.stationRow,
                      isActive && styles.stationRowActive,
                      pressed && styles.pressed,
                      idx === stations.length - 1 && { borderBottomWidth: 0 },
                    ]}
                    onPress={() => void handleSelect(s)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stationName}>{s.stationName}</Text>
                      <Text style={styles.stationMeta}>
                        {s.stationId} · {(s.distanceKm ?? 0).toFixed(1)} km away
                      </Text>
                    </View>
                    {isActive ? (
                      <View style={styles.activePill}>
                        <Check size={14} color={Colors.primary} />
                      </View>
                    ) : (
                      <Text style={styles.selectText}>Select</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
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
  pressed: {
    opacity: 0.7,
  },
  introCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    backgroundColor: Colors.infoMuted,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.info + '30',
    marginBottom: 16,
  },
  introTitle: {
    color: Colors.info,
    fontSize: 14,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  introText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  currentCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    padding: 14,
    marginBottom: 8,
  },
  currentRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  currentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  currentLabel: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  currentName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
    marginTop: 2,
  },
  currentId: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  clearBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.dangerMuted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 18,
    marginLeft: 4,
  },
  apiKeyCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 12,
    gap: 10,
  },
  apiKeyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  apiKeyInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  saveKeyBtn: {
    alignSelf: 'flex-end' as const,
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  saveKeyBtnText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  searchRow: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  searchBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: 12,
  },
  searchBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  loading: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 18,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  errorCard: {
    backgroundColor: Colors.dangerMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.danger + '30',
    padding: 12,
    marginTop: 12,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
  },
  list: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  stationRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  stationRowActive: {
    backgroundColor: Colors.primaryMuted,
  },
  stationName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  stationMeta: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  activePill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  selectText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700' as const,
  },
});
