import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Dimensions,
  Keyboard,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MapPin, Check, X, Maximize2 } from 'lucide-react-native';
import MapView, { Polygon, Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import MapWebFallback from '@/components/MapWebFallback';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { useVineyards } from '@/providers/VineyardProvider';
import BoundaryEditor from '@/components/BoundaryEditor';

const CUSTOM_VARIETIES_KEY = 'custom_grape_varieties';
const DEFAULT_VARIETIES = [
  'Pinot Noir',
  'Chardonnay',
  'Shiraz',
  'Cabernet Sauvignon',
  'Merlot',
  'Sauvignon Blanc',
  'Riesling',
  'Tempranillo',
  'Grenache',
  'Other',
];

interface LatLng {
  latitude: number;
  longitude: number;
}

function calculatePolygonArea(coords: LatLng[]): number {
  if (coords.length < 3) return 0;
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const lat1 = toRadians(coords[i].latitude);
    const lat2 = toRadians(coords[j].latitude);
    const lon1 = toRadians(coords[i].longitude);
    const lon2 = toRadians(coords[j].longitude);
    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  area = Math.abs((area * R * R) / 2);
  return area / 10000;
}

function calculateCentroid(coords: LatLng[]): LatLng {
  if (coords.length === 0) return { latitude: 0, longitude: 0 };
  const sum = coords.reduce(
    (acc, c) => ({ latitude: acc.latitude + c.latitude, longitude: acc.longitude + c.longitude }),
    { latitude: 0, longitude: 0 }
  );
  return {
    latitude: sum.latitude / coords.length,
    longitude: sum.longitude / coords.length,
  };
}

const FALLBACK_REGION: Region = {
  latitude: -37.8136,
  longitude: 144.9631,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function AddFieldScreen() {
  const router = useRouter();
  const [name, setName] = useState<string>('');
  const [variety, setVariety] = useState<string>('');
  const [customVarietyInput, setCustomVarietyInput] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
  const [customVarieties, setCustomVarieties] = useState<string[]>([]);
  const [polygonCoords, setPolygonCoords] = useState<LatLng[]>([]);
  const [area, setArea] = useState<number>(0);
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [locatingUser, setLocatingUser] = useState<boolean>(true);
  const [initialRegion, setInitialRegion] = useState<Region>(FALLBACK_REGION);
  const [showBoundaryEditor, setShowBoundaryEditor] = useState<boolean>(false);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const mapRef = useRef<MapView>(null);
  const pendingRegion = useRef<Region | null>(null);

  useEffect(() => {
    void loadCustomVarieties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void getUserLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animateToRegionSafe = useCallback((region: Region) => {
    if (mapRef.current && mapReady) {
      mapRef.current.animateToRegion(region, 800);
      console.log('Animating map to region:', region);
    } else {
      pendingRegion.current = region;
      console.log('Map not ready, queuing region:', region);
    }
  }, [mapReady]);

  const handleMapReady = useCallback(() => {
    console.log('Map is ready');
    setMapReady(true);
    if (pendingRegion.current) {
      mapRef.current?.animateToRegion(pendingRegion.current, 800);
      pendingRegion.current = null;
    }
  }, []);

  const getUserLocation = async () => {
    setLocatingUser(true);
    try {
      if (Platform.OS === 'web') {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const region: Region = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              };
              setInitialRegion(region);
              animateToRegionSafe(region);
              console.log('Web location:', region);
              setLocatingUser(false);
            },
            (err) => {
              console.log('Web geolocation error:', err);
              setLocatingUser(false);
            },
            { enableHighAccuracy: true, timeout: 15000 }
          );
        } else {
          setLocatingUser(false);
        }
        return;
      }

      let permissionGranted = false;
      try {
        const existingPerms = await Location.getForegroundPermissionsAsync();
        console.log('Existing location permissions:', existingPerms.status);
        if (existingPerms.status === 'granted') {
          permissionGranted = true;
        } else {
          const { status } = await Location.requestForegroundPermissionsAsync();
          permissionGranted = status === 'granted';
        }
      } catch (permError) {
        console.log('Permission request error (Expo Go scoping issue), trying direct access:', permError);
        permissionGranted = true;
      }

      if (!permissionGranted) {
        console.log('Location permission denied');
        Alert.alert(
          'Location Permission Required',
          'VineWatch needs access to your location to center the map on your vineyard. Please enable location access in your device settings.',
          [{ text: 'OK' }]
        );
        setLocatingUser(false);
        return;
      }

      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) {
          console.log('Using last known location as quick start:', lastKnown.coords);
          const quickRegion: Region = {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          };
          setInitialRegion(quickRegion);
          animateToRegionSafe(quickRegion);
        }
      } catch (lastKnownErr) {
        console.log('Could not get last known position, continuing to precise location:', lastKnownErr);
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const region: Region = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      setInitialRegion(region);
      animateToRegionSafe(region);
      console.log('User location (precise):', region);
    } catch (e) {
      console.log('Error getting location:', e);
      Alert.alert(
        'Location Error',
        'Could not determine your location. You can still add a vineyard by tapping on the map to place boundary points manually.',
        [{ text: 'OK' }]
      );
    } finally {
      setLocatingUser(false);
    }
  };

  useEffect(() => {
    if (polygonCoords.length >= 3) {
      const ha = calculatePolygonArea(polygonCoords);
      setArea(ha);
      const centroid = calculateCentroid(polygonCoords);
      setLatitude(centroid.latitude.toFixed(6));
      setLongitude(centroid.longitude.toFixed(6));
    } else {
      setArea(0);
      setLatitude('');
      setLongitude('');
    }
  }, [polygonCoords]);

  const loadCustomVarieties = async () => {
    try {
      const stored = await AsyncStorage.getItem(CUSTOM_VARIETIES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        setCustomVarieties(parsed);
        console.log('Loaded custom varieties:', parsed);
      }
    } catch (e) {
      console.log('Error loading custom varieties:', e);
    }
  };

  const saveCustomVariety = async (newVariety: string) => {
    try {
      const trimmed = newVariety.trim();
      if (!trimmed) return;
      const exists = [...DEFAULT_VARIETIES, ...customVarieties].some(
        (v) => v.toLowerCase() === trimmed.toLowerCase()
      );
      if (exists) {
        setVariety(trimmed);
        setShowCustomInput(false);
        setCustomVarietyInput('');
        return;
      }
      const updated = [...customVarieties, trimmed];
      setCustomVarieties(updated);
      await AsyncStorage.setItem(CUSTOM_VARIETIES_KEY, JSON.stringify(updated));
      setVariety(trimmed);
      setShowCustomInput(false);
      setCustomVarietyInput('');
      console.log('Saved custom variety:', trimmed);
    } catch (e) {
      console.log('Error saving custom variety:', e);
    }
  };

  const handleVarietyPress = useCallback(
    (v: string) => {
      if (v === 'Other') {
        setShowCustomInput(true);
        setVariety('');
      } else {
        setVariety(v);
        setShowCustomInput(false);
        setCustomVarietyInput('');
      }
    },
    []
  );

  const { addVineyard, isAdding } = useVineyards();

  const handleSave = async () => {
    if (!name.trim() || !variety) {
      Alert.alert('Missing Fields', 'Please fill in the vineyard name and select a grape variety.');
      return;
    }
    if (polygonCoords.length < 3) {
      Alert.alert('No Boundary', 'Please draw a vineyard boundary on the map (at least 3 points).');
      return;
    }
    try {
      await addVineyard({
        name: name.trim(),
        variety,
        area,
        area_unit: 'ha',
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        polygon_coords: polygonCoords,
      });
      console.log('Vineyard saved to Supabase:', name);
      Alert.alert('Vineyard Added', `${name} (${area.toFixed(2)} ha) has been added successfully.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save vineyard';
      Alert.alert('Error', msg);
    }
  };

  const handleBoundarySave = useCallback((coords: LatLng[]) => {
    console.log('[AddField] Boundary saved with', coords.length, 'points');
    setPolygonCoords(coords);
    setShowBoundaryEditor(false);
  }, []);

  const handleBoundaryCancel = useCallback(() => {
    setShowBoundaryEditor(false);
  }, []);

  const allVarieties = [...DEFAULT_VARIETIES.filter((v) => v !== 'Other'), ...customVarieties, 'Other'];

  const previewRegion: Region = polygonCoords.length >= 3
    ? {
        latitude: calculateCentroid(polygonCoords).latitude,
        longitude: calculateCentroid(polygonCoords).longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }
    : initialRegion;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add Vineyard',
          headerRight: () => (
            <Pressable onPress={() => void handleSave()} disabled={isAdding} style={({ pressed }) => [pressed && styles.pressed]}>
              <Text style={[styles.saveBtn, isAdding && { opacity: 0.5 }]}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionHeader}>VINEYARD BOUNDARY</Text>
        <Pressable
          style={styles.mapContainer}
          onPress={() => setShowBoundaryEditor(true)}
        >
          {Platform.OS === 'web' ? (
            <MapWebFallback
              style={styles.map}
              message="Draw your boundary on iOS or Android for full map support."
            />
          ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={initialRegion}
            region={polygonCoords.length >= 3 ? previewRegion : undefined}
            mapType="satellite"
            onMapReady={handleMapReady}
            showsUserLocation={true}
            showsMyLocationButton={false}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            pointerEvents="none"
          >
            {polygonCoords.length >= 3 && (
              <Polygon
                coordinates={polygonCoords}
                fillColor="rgba(74, 222, 128, 0.2)"
                strokeColor={Colors.primary}
                strokeWidth={2}
              />
            )}
            {polygonCoords.map((coord, idx) => (
              <Marker
                key={`point-${idx}`}
                coordinate={coord}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View
                  style={[
                    styles.markerDot,
                    idx === 0 && styles.markerDotFirst,
                  ]}
                />
              </Marker>
            ))}
          </MapView>
          )}

          {locatingUser && polygonCoords.length === 0 && (
            <View style={styles.mapOverlay}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.mapOverlayText}>Getting location...</Text>
            </View>
          )}

          <View style={styles.mapTapOverlay}>
            <Maximize2 size={18} color={Colors.text} />
            <Text style={styles.mapTapText}>
              {polygonCoords.length >= 3
                ? `${polygonCoords.length} points · ${area.toFixed(2)} ha — Tap to edit`
                : 'Tap to draw boundary'}
            </Text>
          </View>

          {area > 0 && (
            <View style={styles.areaBadge}>
              <Text style={styles.areaBadgeValue}>{area.toFixed(2)}</Text>
              <Text style={styles.areaBadgeUnit}>ha</Text>
            </View>
          )}
        </Pressable>

        <Text style={styles.sectionHeader}>VINEYARD DETAILS</Text>
        <View style={styles.section}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Hillside Block A"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Area (hectares)</Text>
            <Text style={styles.areaDisplay}>
              {area > 0 ? `${area.toFixed(2)} ha` : 'Draw boundary on map'}
            </Text>
            <Text style={styles.areaHint}>Calculated from polygon boundary</Text>
          </View>
        </View>

        <Text style={styles.sectionHeader}>GRAPE VARIETY</Text>
        <View style={styles.varietyGrid}>
          {allVarieties.map((v) => (
            <Pressable
              key={v}
              style={[styles.varietyChip, variety === v && styles.varietyChipActive]}
              onPress={() => handleVarietyPress(v)}
            >
              <Text style={[styles.varietyText, variety === v && styles.varietyTextActive]}>{v}</Text>
            </Pressable>
          ))}
        </View>

        {showCustomInput && (
          <View style={styles.customVarietyContainer}>
            <View style={styles.customVarietyRow}>
              <TextInput
                style={styles.customVarietyInput}
                value={customVarietyInput}
                onChangeText={setCustomVarietyInput}
                placeholder="Enter grape variety name"
                placeholderTextColor={Colors.textMuted}
                autoFocus
                onSubmitEditing={() => {
                  if (customVarietyInput.trim()) {
                    void saveCustomVariety(customVarietyInput);
                    Keyboard.dismiss();
                  }
                }}
                returnKeyType="done"
              />
              <Pressable
                style={({ pressed }) => [styles.customBtn, styles.customBtnSave, pressed && styles.pressed]}
                onPress={() => {
                  if (customVarietyInput.trim()) {
                    void saveCustomVariety(customVarietyInput);
                    Keyboard.dismiss();
                  }
                }}
              >
                <Check size={16} color={Colors.background} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.customBtn, styles.customBtnCancel, pressed && styles.pressed]}
                onPress={() => {
                  setShowCustomInput(false);
                  setCustomVarietyInput('');
                }}
              >
                <X size={16} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.customVarietyHint}>This variety will be saved for future use</Text>
          </View>
        )}

        <Text style={styles.sectionHeader}>LOCATION</Text>
        <View style={styles.section}>
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <MapPin size={14} color={Colors.textMuted} />
              <Text style={styles.label}>Latitude</Text>
            </View>
            <Text style={styles.coordDisplay}>
              {latitude || 'Auto-populated from boundary'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <MapPin size={14} color={Colors.textMuted} />
              <Text style={styles.label}>Longitude</Text>
            </View>
            <Text style={styles.coordDisplay}>
              {longitude || 'Auto-populated from boundary'}
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed, isAdding && styles.saveButtonPressed]}
          onPress={() => void handleSave()}
          disabled={isAdding}
        >
          <Text style={styles.saveButtonText}>Add Vineyard</Text>
        </Pressable>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal
        visible={showBoundaryEditor}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
      >
        <BoundaryEditor
          initialCoords={polygonCoords}
          initialRegion={previewRegion}
          onSave={handleBoundarySave}
          onCancel={handleBoundaryCancel}
        />
      </Modal>
    </>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_HEIGHT = Math.min(SCREEN_WIDTH * 0.6, 260);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
  },
  saveBtn: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  pressed: {
    opacity: 0.7,
  },
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 4,
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  inputGroup: {
    padding: 14,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginBottom: 6,
  },
  input: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '500' as const,
    padding: 0,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginLeft: 14,
  },
  mapContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    height: MAP_HEIGHT,
    position: 'relative' as const,
  },
  map: {
    flex: 1,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 26, 18, 0.6)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  mapOverlayText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  mapTapOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: 'rgba(11, 26, 18, 0.85)',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  mapTapText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  areaBadge: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: 3,
    backgroundColor: 'rgba(11, 26, 18, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  areaBadgeValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800' as const,
  },
  areaBadgeUnit: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600' as const,
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerDotFirst: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primaryDark,
    borderWidth: 2,
    borderColor: '#fff',
  },
  areaDisplay: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  areaHint: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  coordDisplay: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  varietyGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  varietyChip: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  varietyChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  varietyText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  varietyTextActive: {
    color: Colors.primary,
  },
  customVarietyContainer: {
    marginTop: 10,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primary,
    padding: 12,
  },
  customVarietyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  customVarietyInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500' as const,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  customBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  customBtnSave: {
    backgroundColor: Colors.primary,
  },
  customBtnCancel: {
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  customVarietyHint: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 8,
    marginLeft: 2,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center' as const,
    marginTop: 24,
  },
  saveButtonPressed: {
    opacity: 0.8,
  },
  saveButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  bottomSpacer: {
    height: 40,
  },
});
