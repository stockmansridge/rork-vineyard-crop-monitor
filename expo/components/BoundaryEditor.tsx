import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, { Polygon, Marker, Polyline, MapPressEvent, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import MapWebFallback from '@/components/MapWebFallback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Undo2,
  Trash2,
  Pentagon,
  X,
  Navigation,
  Plus,
  Move,
  Hand,
  Crosshair,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import Colors from '@/constants/colors';

interface LatLng {
  latitude: number;
  longitude: number;
}

interface BoundaryEditorProps {
  initialCoords: LatLng[];
  initialRegion: Region;
  onSave: (coords: LatLng[]) => void;
  onCancel: () => void;
}

type EditorMode = 'draw' | 'move' | 'insert';

function getMidpoint(a: LatLng, b: LatLng): LatLng {
  return {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
  };
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

export default function BoundaryEditor({
  initialCoords,
  initialRegion,
  onSave,
  onCancel,
}: BoundaryEditorProps) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [coords, setCoords] = useState<LatLng[]>(initialCoords);
  const [mode, setMode] = useState<EditorMode>(initialCoords.length >= 3 ? 'move' : 'draw');
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [locatingUser, setLocatingUser] = useState<boolean>(false);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [mapCenter, setMapCenter] = useState<LatLng>({
    latitude: initialRegion.latitude,
    longitude: initialRegion.longitude,
  });
  const pendingRegion = useRef<Region | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const area = useMemo(() => calculatePolygonArea(coords), [coords]);

  const midpoints = useMemo(() => {
    if (coords.length < 2) return [];
    const mids: { point: LatLng; afterIndex: number }[] = [];
    for (let i = 0; i < coords.length; i++) {
      const next = (i + 1) % coords.length;
      if (coords.length < 3 && next === 0 && i === coords.length - 1) {
        continue;
      }
      mids.push({ point: getMidpoint(coords[i], coords[next]), afterIndex: i });
    }
    return mids;
  }, [coords]);

  useEffect(() => {
    if (mode === 'draw') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [mode, pulseAnim]);

  const animateToRegionSafe = useCallback((region: Region) => {
    if (mapRef.current && mapReady) {
      mapRef.current.animateToRegion(region, 800);
    } else {
      pendingRegion.current = region;
    }
  }, [mapReady]);

  const handleMapReady = useCallback(() => {
    setMapReady(true);
    if (pendingRegion.current) {
      mapRef.current?.animateToRegion(pendingRegion.current, 800);
      pendingRegion.current = null;
    }
  }, []);

  const handleMapPress = useCallback(
    (e: MapPressEvent) => {
      if (mode !== 'draw') return;
      const coord = e.nativeEvent.coordinate;
      console.log('[BoundaryEditor] Point added via tap:', coord);
      setCoords((prev) => [...prev, coord]);
    },
    [mode]
  );

  const handleRegionChange = useCallback((region: Region) => {
    setMapCenter({ latitude: region.latitude, longitude: region.longitude });
  }, []);

  const handleDropPinAtCenter = useCallback(() => {
    console.log('[BoundaryEditor] Point added at center:', mapCenter);
    setCoords((prev) => [...prev, { ...mapCenter }]);
  }, [mapCenter]);

  const handleUndo = useCallback(() => {
    setCoords((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    Alert.alert('Clear All Points', 'Remove all boundary points?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          setCoords([]);
          setMode('draw');
        },
      },
    ]);
  }, []);

  const handleMarkerDragEnd = useCallback((index: number, coord: LatLng) => {
    console.log('[BoundaryEditor] Point moved:', index, coord);
    setCoords((prev) => {
      const updated = [...prev];
      updated[index] = coord;
      return updated;
    });
    setDraggingIndex(null);
  }, []);

  const handleInsertPoint = useCallback((afterIndex: number, point: LatLng) => {
    console.log('[BoundaryEditor] Point inserted after index:', afterIndex, point);
    setCoords((prev) => {
      const updated = [...prev];
      updated.splice(afterIndex + 1, 0, point);
      return updated;
    });
  }, []);

  const handleRemovePoint = useCallback((index: number) => {
    setCoords((prev) => {
      if (prev.length <= 3) {
        Alert.alert('Minimum Points', 'A boundary needs at least 3 points.');
        return prev;
      }
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  const handleSave = useCallback(() => {
    if (coords.length < 3) {
      Alert.alert('Not Enough Points', 'Place at least 3 points to define a boundary.');
      return;
    }
    onSave(coords);
  }, [coords, onSave]);

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
              animateToRegionSafe(region);
              setLocatingUser(false);
            },
            () => setLocatingUser(false),
            { enableHighAccuracy: true, timeout: 15000 }
          );
        } else {
          setLocatingUser(false);
        }
        return;
      }

      try {
        const existingPerms = await Location.getForegroundPermissionsAsync();
        if (existingPerms.status !== 'granted') {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            setLocatingUser(false);
            return;
          }
        }
      } catch {
        console.log('[BoundaryEditor] Permission check failed, trying direct access');
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      animateToRegionSafe({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    } catch (e) {
      console.log('[BoundaryEditor] Location error:', e);
    } finally {
      setLocatingUser(false);
    }
  };

  const modeLabel = mode === 'draw'
    ? 'Tap map or drop pin at crosshair'
    : mode === 'move'
    ? 'Drag points to adjust · Tap to remove'
    : 'Tap + markers to insert points';

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={12} style={({ pressed }) => pressed && styles.pressed}>
          <X size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Edit Boundary</Text>
          {area > 0 && (
            <Text style={styles.headerArea}>{area.toFixed(2)} ha</Text>
          )}
        </View>
        <Pressable
          onPress={handleSave}
          hitSlop={12}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.modeBar}>
        <Pressable
          style={[styles.modeBtn, mode === 'draw' && styles.modeBtnActive]}
          onPress={() => setMode('draw')}
        >
          <Pentagon size={16} color={mode === 'draw' ? Colors.background : Colors.textSecondary} />
          <Text style={[styles.modeBtnText, mode === 'draw' && styles.modeBtnTextActive]}>Draw</Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === 'move' && styles.modeBtnActive]}
          onPress={() => setMode('move')}
          disabled={coords.length < 1}
        >
          <Move size={16} color={mode === 'move' ? Colors.background : coords.length < 1 ? Colors.textMuted : Colors.textSecondary} />
          <Text style={[styles.modeBtnText, mode === 'move' && styles.modeBtnTextActive, coords.length < 1 && styles.modeBtnTextDisabled]}>Move</Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === 'insert' && styles.modeBtnActive]}
          onPress={() => setMode('insert')}
          disabled={coords.length < 2}
        >
          <Plus size={16} color={mode === 'insert' ? Colors.background : coords.length < 2 ? Colors.textMuted : Colors.textSecondary} />
          <Text style={[styles.modeBtnText, mode === 'insert' && styles.modeBtnTextActive, coords.length < 2 && styles.modeBtnTextDisabled]}>Insert</Text>
        </Pressable>
      </View>

      <View style={styles.mapWrapper}>
        {Platform.OS === 'web' ? (
          <MapWebFallback
            style={styles.map}
            message="Boundary drawing requires a native map. Open the app on iOS or Android to draw."
          />
        ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={initialRegion}
          mapType="satellite"
          onPress={handleMapPress}
          onMapReady={handleMapReady}
          onRegionChangeComplete={handleRegionChange}
          showsUserLocation={true}
          showsMyLocationButton={false}
          scrollEnabled={true}
          zoomEnabled={true}
          pitchEnabled={false}
          rotateEnabled={false}
        >
          {coords.length >= 3 && (
            <Polygon
              coordinates={coords}
              fillColor="rgba(74, 222, 128, 0.18)"
              strokeColor={Colors.primary}
              strokeWidth={2}
            />
          )}

          {coords.length >= 2 && coords.length < 3 && (
            <Polyline
              coordinates={coords}
              strokeColor={Colors.primary}
              strokeWidth={2}
              lineDashPattern={[8, 4]}
            />
          )}

          {coords.map((coord, idx) => (
            <Marker
              key={`pt-${idx}-${coord.latitude.toFixed(6)}-${coord.longitude.toFixed(6)}`}
              coordinate={coord}
              anchor={{ x: 0.5, y: 0.5 }}
              draggable={mode === 'move'}
              tracksViewChanges={false}
              stopPropagation={true}
              onDragStart={() => {
                console.log('[BoundaryEditor] Drag started on point:', idx);
                setDraggingIndex(idx);
              }}
              onDragEnd={(e) => handleMarkerDragEnd(idx, e.nativeEvent.coordinate)}
              onPress={() => {
                if (mode === 'move') {
                  Alert.alert(
                    `Point ${idx + 1}`,
                    'What would you like to do?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      ...(coords.length > 3
                        ? [
                            {
                              text: 'Remove Point',
                              style: 'destructive' as const,
                              onPress: () => handleRemovePoint(idx),
                            },
                          ]
                        : []),
                    ]
                  );
                }
              }}
            >
              <View style={styles.markerTouchTarget}>
                <View
                  style={[
                    styles.markerOuter,
                    idx === 0 && styles.markerOuterFirst,
                    draggingIndex === idx && styles.markerOuterDragging,
                    mode === 'move' && styles.markerOuterMovable,
                  ]}
                >
                  <View
                    style={[
                      styles.markerInner,
                      idx === 0 && styles.markerInnerFirst,
                    ]}
                  />
                </View>
                {(mode === 'move' || mode === 'insert') && (
                  <View style={styles.markerLabel}>
                    <Text style={styles.markerLabelText}>{idx + 1}</Text>
                  </View>
                )}
              </View>
            </Marker>
          ))}

          {(mode === 'insert' || mode === 'move') && coords.length >= 3 && midpoints.map((mid, mIdx) => (
            <Marker
              key={`mid-${mIdx}-${mid.point.latitude.toFixed(6)}`}
              coordinate={mid.point}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              stopPropagation={true}
              onPress={() => handleInsertPoint(mid.afterIndex, mid.point)}
            >
              <View style={styles.midpointTouchTarget}>
                <View style={styles.midpointMarker}>
                  <Plus size={14} color={Colors.primary} />
                </View>
              </View>
            </Marker>
          ))}
        </MapView>
        )}

        {mode === 'draw' && (
          <View style={styles.crosshairContainer} pointerEvents="none">
            <View style={styles.crosshairRing}>
              <Crosshair size={24} color={Colors.primary} />
            </View>
          </View>
        )}

        <Animated.View
          style={[
            styles.drawingBadge,
            mode === 'draw' && { opacity: pulseAnim },
          ]}
          pointerEvents="none"
        >
          {mode === 'draw' && <Pentagon size={12} color={Colors.primary} />}
          {mode === 'move' && <Hand size={12} color={Colors.secondary} />}
          {mode === 'insert' && <Plus size={12} color={Colors.info} />}
          <Text
            style={[
              styles.drawingBadgeText,
              mode === 'move' && { color: Colors.secondary },
              mode === 'insert' && { color: Colors.info },
            ]}
          >
            {modeLabel}
          </Text>
        </Animated.View>

        {area > 0 && (
          <View style={styles.areaBadge} pointerEvents="none">
            <Text style={styles.areaBadgeValue}>{area.toFixed(2)}</Text>
            <Text style={styles.areaBadgeUnit}>ha</Text>
          </View>
        )}

        <View style={styles.mapControls}>
          {mode === 'draw' && (
            <Pressable
              style={({ pressed }) => [styles.mapBtn, styles.mapBtnPrimary, pressed && styles.pressed]}
              onPress={handleDropPinAtCenter}
            >
              <Plus size={20} color={Colors.background} />
            </Pressable>
          )}
          {coords.length > 0 && mode === 'draw' && (
            <Pressable
              style={({ pressed }) => [styles.mapBtn, pressed && styles.pressed]}
              onPress={handleUndo}
            >
              <Undo2 size={18} color={Colors.text} />
            </Pressable>
          )}
          {coords.length > 0 && (
            <Pressable
              style={({ pressed }) => [styles.mapBtn, styles.mapBtnDanger, pressed && styles.pressed]}
              onPress={handleClear}
            >
              <Trash2 size={18} color={Colors.danger} />
            </Pressable>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [styles.locateBtn, pressed && styles.pressed]}
          onPress={() => void getUserLocation()}
        >
          {locatingUser ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Navigation size={18} color={Colors.primary} />
          )}
        </Pressable>

        <View style={styles.pointCount} pointerEvents="none">
          <Text style={styles.pointCountText}>{coords.length} points</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  headerCenter: {
    alignItems: 'center' as const,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700' as const,
  },
  headerArea: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  doneText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  pressed: {
    opacity: 0.6,
  },
  modeBar: {
    flexDirection: 'row' as const,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: Colors.backgroundAlt,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modeBtnText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  modeBtnTextActive: {
    color: Colors.background,
  },
  modeBtnTextDisabled: {
    color: Colors.textMuted,
  },
  mapWrapper: {
    flex: 1,
    position: 'relative' as const,
  },
  map: {
    flex: 1,
  },
  crosshairContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  crosshairRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(74, 222, 128, 0.4)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  drawingBadge: {
    position: 'absolute' as const,
    top: 12,
    left: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: 'rgba(11, 26, 18, 0.88)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  drawingBadgeText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  areaBadge: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: 3,
    backgroundColor: 'rgba(11, 26, 18, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  areaBadgeValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800' as const,
  },
  areaBadgeUnit: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  mapControls: {
    position: 'absolute' as const,
    bottom: 24,
    left: 16,
    flexDirection: 'row' as const,
    gap: 10,
  },
  mapBtn: {
    backgroundColor: 'rgba(11, 26, 18, 0.88)',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  mapBtnPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  mapBtnDanger: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  locateBtn: {
    position: 'absolute' as const,
    bottom: 24,
    right: 16,
    backgroundColor: 'rgba(11, 26, 18, 0.88)',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  pointCount: {
    position: 'absolute' as const,
    bottom: 24,
    alignSelf: 'center' as const,
    backgroundColor: 'rgba(11, 26, 18, 0.88)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  pointCountText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  markerTouchTarget: {
    width: 44,
    height: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  markerOuter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(74, 222, 128, 0.25)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  markerOuterFirst: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderColor: Colors.primaryDark,
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
  },
  markerOuterDragging: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderColor: Colors.secondary,
    backgroundColor: 'rgba(200, 169, 81, 0.3)',
  },
  markerOuterMovable: {
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  markerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  markerInnerFirst: {
    backgroundColor: Colors.primaryDark,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  markerLabel: {
    position: 'absolute' as const,
    top: 0,
    backgroundColor: 'rgba(11, 26, 18, 0.9)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  markerLabelText: {
    color: Colors.text,
    fontSize: 9,
    fontWeight: '700' as const,
  },
  midpointTouchTarget: {
    width: 44,
    height: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  midpointMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(11, 26, 18, 0.92)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed' as const,
  },
});
