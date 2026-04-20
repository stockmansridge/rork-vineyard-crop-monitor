import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import MapView, { Polygon, PROVIDER_DEFAULT, Region, UrlTile } from 'react-native-maps';
import MapWebFallback from '@/components/MapWebFallback';
import { X, Layers, Info, Satellite, CloudOff } from 'lucide-react-native';
import { usePlanetScene } from '@/hooks/usePlanetScene';
import { getSceneTileUrlTemplate } from '@/lib/planet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useVineyards } from '@/providers/VineyardProvider';
import { satelliteIndices } from '@/mocks/indices';
import { SatelliteIndex } from '@/types';

interface LatLng {
  latitude: number;
  longitude: number;
}

interface GridCell {
  coords: LatLng[];
  value: number;
  color: string;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function smoothNoise(x: number, y: number, seed: number): number {
  const corners =
    (seededRandom(x - 1 + (y - 1) * 57 + seed) +
      seededRandom(x + 1 + (y - 1) * 57 + seed) +
      seededRandom(x - 1 + (y + 1) * 57 + seed) +
      seededRandom(x + 1 + (y + 1) * 57 + seed)) /
    16;
  const sides =
    (seededRandom(x - 1 + y * 57 + seed) +
      seededRandom(x + 1 + y * 57 + seed) +
      seededRandom(x + (y - 1) * 57 + seed) +
      seededRandom(x + (y + 1) * 57 + seed)) /
    8;
  const center = seededRandom(x + y * 57 + seed) / 4;
  return corners + sides + center;
}

function generateSpatialValue(
  row: number,
  col: number,
  totalRows: number,
  totalCols: number,
  indexSeed: number,
  minVal: number,
  maxVal: number
): number {
  const nx = col / totalCols;
  const ny = row / totalRows;

  const base = smoothNoise(col * 3, row * 3, indexSeed);
  const gradient = 0.3 * nx + 0.2 * ny;
  const combined = base * 0.7 + gradient * 0.3;

  const range = maxVal - minVal;
  const centerBias = 0.55;
  const value = minVal + range * (combined * 0.6 + centerBias * 0.4);

  return Math.max(minVal, Math.min(maxVal, value));
}

function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].latitude;
    const yi = polygon[i].longitude;
    const xj = polygon[j].latitude;
    const yj = polygon[j].longitude;
    const intersect =
      yi > point.longitude !== yj > point.longitude &&
      point.latitude < ((xj - xi) * (point.longitude - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function signedAreaLatX(poly: LatLng[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    sum += a.latitude * b.longitude - b.latitude * a.longitude;
  }
  return sum / 2;
}

function clipPolygon(subject: LatLng[], clip: LatLng[]): LatLng[] {
  if (subject.length === 0 || clip.length < 3) return [];
  const clipPoly = signedAreaLatX(clip) < 0 ? [...clip].reverse() : clip;

  let output = subject;

  for (let i = 0; i < clipPoly.length; i++) {
    if (output.length === 0) break;
    const input = output;
    output = [];
    const a = clipPoly[i];
    const b = clipPoly[(i + 1) % clipPoly.length];

    const inside = (p: LatLng): boolean => {
      return (
        (b.latitude - a.latitude) * (p.longitude - a.longitude) -
          (b.longitude - a.longitude) * (p.latitude - a.latitude) >=
        0
      );
    };

    const intersect = (p1: LatLng, p2: LatLng): LatLng => {
      const x1 = p1.latitude;
      const y1 = p1.longitude;
      const x2 = p2.latitude;
      const y2 = p2.longitude;
      const x3 = a.latitude;
      const y3 = a.longitude;
      const x4 = b.latitude;
      const y4 = b.longitude;
      const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(denom) < 1e-12) {
        return { latitude: x2, longitude: y2 };
      }
      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
      return {
        latitude: x1 + t * (x2 - x1),
        longitude: y1 + t * (y2 - y1),
      };
    };

    for (let j = 0; j < input.length; j++) {
      const current = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      const currentInside = inside(current);
      const prevInside = inside(prev);
      if (currentInside) {
        if (!prevInside) output.push(intersect(prev, current));
        output.push(current);
      } else if (prevInside) {
        output.push(intersect(prev, current));
      }
    }
  }
  return output;
}

function getColorForValue(value: number, index: SatelliteIndex): string {
  const ranges = index.interpretationRanges;
  for (const range of ranges) {
    if (value >= range.min && value <= range.max) {
      return range.color;
    }
  }
  return ranges[ranges.length - 1]?.color ?? Colors.textMuted;
}

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const GRID_SIZE = 8;
const INDEX_SEEDS: Record<string, number> = {
  NDMI: 42,
  NDRE: 137,
  RECI: 256,
  MSAVI: 389,
  S2L2A: 512,
};

export default function VineyardOverlayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { vineyards } = useVineyards();
  const mapRef = useRef<MapView>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [showPlanetTiles, setShowPlanetTiles] = useState<boolean>(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const vineyard = vineyards.find((v) => v.id === id);
  const polygonCoords = useMemo(() => vineyard?.polygon_coords ?? [], [vineyard?.polygon_coords]);
  const currentIndex = satelliteIndices[selectedIndex];

  const planetQuery = usePlanetScene(polygonCoords);
  const planetScene = planetQuery.data ?? null;
  const planetTileUrl = useMemo(() => {
    if (!planetScene) return null;
    try {
      return getSceneTileUrlTemplate(planetScene.itemType, planetScene.id);
    } catch (e) {
      console.log('[VineyardOverlay] Planet tile url error', e);
      return null;
    }
  }, [planetScene]);

  const mapRegion: Region = useMemo(() => {
    if (polygonCoords.length === 0) {
      return {
        latitude: vineyard?.latitude ?? -37.8136,
        longitude: vineyard?.longitude ?? 144.9631,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
    }
    const lats = polygonCoords.map((c) => c.latitude);
    const lngs = polygonCoords.map((c) => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latDelta = (maxLat - minLat) * 1.5;
    const lngDelta = (maxLng - minLng) * 1.5;
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(latDelta, 0.002),
      longitudeDelta: Math.max(lngDelta, 0.002),
    };
  }, [polygonCoords, vineyard?.latitude, vineyard?.longitude]);

  const gridCells = useMemo((): GridCell[] => {
    if (polygonCoords.length < 3 || !currentIndex) return [];

    const lats = polygonCoords.map((c) => c.latitude);
    const lngs = polygonCoords.map((c) => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latStep = (maxLat - minLat) / GRID_SIZE;
    const lngStep = (maxLng - minLng) / GRID_SIZE;

    const cells: GridCell[] = [];
    const seed = INDEX_SEEDS[currentIndex.abbreviation] ?? 42;

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const cellLat = minLat + row * latStep;
        const cellLng = minLng + col * lngStep;

        const corners: LatLng[] = [
          { latitude: cellLat, longitude: cellLng },
          { latitude: cellLat, longitude: cellLng + lngStep },
          { latitude: cellLat + latStep, longitude: cellLng + lngStep },
          { latitude: cellLat + latStep, longitude: cellLng },
        ];

        const clipped = clipPolygon(corners, polygonCoords);
        if (clipped.length < 3) continue;

        const value = generateSpatialValue(
          row,
          col,
          GRID_SIZE,
          GRID_SIZE,
          seed,
          currentIndex.min,
          currentIndex.max
        );

        const color = getColorForValue(value, currentIndex);

        cells.push({ coords: clipped, value, color });
      }
    }

    return cells;
  }, [polygonCoords, currentIndex]);

  const animateSwitch = useCallback(() => {
    fadeAnim.setValue(0.3);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleIndexChange = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      animateSwitch();
    },
    [animateSwitch]
  );

  useEffect(() => {
    console.log('[VineyardOverlay] Viewing vineyard:', vineyard?.name, 'Index:', currentIndex?.abbreviation);
  }, [vineyard?.name, currentIndex?.abbreviation]);

  if (!vineyard) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Vineyard not found</Text>
          <Pressable onPress={() => router.back()} style={styles.errorBtn}>
            <Text style={styles.errorBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const statusColor =
    currentIndex?.status === 'healthy'
      ? Colors.primary
      : currentIndex?.status === 'moderate'
      ? Colors.warning
      : currentIndex?.status === 'stressed'
      ? Colors.danger
      : Colors.danger;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {Platform.OS === 'web' ? (
        <MapWebFallback
          style={StyleSheet.absoluteFillObject}
          message="Satellite overlay and PlanetScope imagery are available on iOS and Android."
        />
      ) : (
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        initialRegion={mapRegion}
        mapType="satellite"
        showsUserLocation={false}
        showsMyLocationButton={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {showPlanetTiles && planetTileUrl && (
          <UrlTile
            urlTemplate={planetTileUrl}
            maximumZ={18}
            minimumZ={10}
            zIndex={0}
            flipY={false}
          />
        )}

        {polygonCoords.length >= 3 && (
          <Polygon
            coordinates={polygonCoords}
            fillColor="transparent"
            strokeColor={Colors.primary}
            strokeWidth={2.5}
          />
        )}

        {gridCells.map((cell, idx) => (
          <Polygon
            key={`cell-${currentIndex?.abbreviation}-${idx}`}
            coordinates={cell.coords}
            fillColor={hexToRgba(cell.color, 0.6)}
            strokeColor={hexToRgba(cell.color, 0.0)}
            strokeWidth={0}
            zIndex={2}
          />
        ))}
      </MapView>
      )}

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          hitSlop={12}
        >
          <X size={20} color={Colors.text} />
        </Pressable>

        <View style={styles.topBarCenter}>
          <Text style={styles.vineyardName} numberOfLines={1}>
            {vineyard.name}
          </Text>
          <View style={styles.currentIndexBadge}>
            <View style={[styles.indexDotSmall, { backgroundColor: currentIndex?.color }]} />
            <Text style={styles.currentIndexText}>{currentIndex?.abbreviation}</Text>
            <Text style={[styles.currentIndexValue, { color: statusColor }]}>
              {currentIndex?.value.toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.topBarActions}>
          {planetTileUrl && (
            <Pressable
              onPress={() => setShowPlanetTiles((prev) => !prev)}
              style={({ pressed }) => [
                styles.closeBtn,
                showPlanetTiles && styles.closeBtnActive,
                pressed && styles.pressed,
              ]}
              hitSlop={12}
              testID="togglePlanetTiles"
            >
              {showPlanetTiles ? (
                <Satellite size={18} color={Colors.primary} />
              ) : (
                <CloudOff size={18} color={Colors.textSecondary} />
              )}
            </Pressable>
          )}
          <Pressable
            onPress={() => setShowLegend((prev) => !prev)}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            hitSlop={12}
          >
            <Info size={20} color={Colors.text} />
          </Pressable>
        </View>
      </View>

      {planetQuery.isLoading && (
        <View style={[styles.planetBanner, { top: insets.top + 70 }]}>
          <Satellite size={12} color={Colors.primary} />
          <Text style={styles.planetBannerText}>Loading latest PlanetScope imagery…</Text>
        </View>
      )}

      {planetScene && !planetQuery.isLoading && showPlanetTiles && (
        <View style={[styles.planetBanner, { top: insets.top + 70 }]}>
          <Satellite size={12} color={Colors.primary} />
          <Text style={styles.planetBannerText}>
            Planet {planetScene.itemType} · {new Date(planetScene.acquired).toLocaleDateString()} · {(planetScene.cloudCover * 100).toFixed(0)}% cloud
          </Text>
        </View>
      )}

      {planetQuery.isError && (
        <View style={[styles.planetBanner, styles.planetBannerError, { top: insets.top + 70 }]}>
          <CloudOff size={12} color={Colors.danger} />
          <Text style={[styles.planetBannerText, { color: Colors.danger }]}>
            Planet imagery unavailable
          </Text>
        </View>
      )}

      {showLegend && currentIndex && (
        <Animated.View style={[styles.legendCard, { opacity: fadeAnim, top: insets.top + 108 }]}>
          <View style={styles.legendHeader}>
            <Layers size={14} color={currentIndex.color} />
            <Text style={styles.legendTitle}>{currentIndex.name}</Text>
          </View>
          <View style={styles.legendRanges}>
            {currentIndex.interpretationRanges.map((range, idx) => (
              <View key={idx} style={styles.legendRow}>
                <View style={[styles.legendSwatch, { backgroundColor: range.color }]} />
                <Text style={styles.legendLabel}>{range.label}</Text>
                <Text style={styles.legendRange}>
                  {range.min.toFixed(1)} – {range.max.toFixed(1)}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>
      )}

      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 8 }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.indexTabsContent}
          style={styles.indexTabs}
        >
          {satelliteIndices.map((idx, i) => {
            const isActive = i === selectedIndex;
            return (
              <Pressable
                key={idx.id}
                onPress={() => handleIndexChange(i)}
                style={({ pressed }) => [
                  styles.indexTab,
                  isActive && styles.indexTabActive,
                  isActive && { borderColor: idx.color },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.indexTabDot, { backgroundColor: idx.color }]} />
                <View style={styles.indexTabInfo}>
                  <Text
                    style={[
                      styles.indexTabAbbr,
                      isActive && { color: idx.color },
                    ]}
                  >
                    {idx.abbreviation}
                  </Text>
                  <Text style={styles.indexTabValue}>
                    {idx.value.toFixed(2)}
                    {idx.unit ? ` ${idx.unit}` : ''}
                  </Text>
                </View>
                {isActive && (
                  <View style={[styles.indexTabIndicator, { backgroundColor: idx.color }]} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {currentIndex && (
          <View style={styles.indexSummary}>
            <Text style={styles.indexSummaryText} numberOfLines={2}>
              {currentIndex.plainEnglish}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 16,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  errorBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorBtnText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  pressed: {
    opacity: 0.7,
  },
  topBar: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: 'rgba(11, 26, 18, 0.85)',
    zIndex: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(20, 42, 30, 0.9)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 4,
  },
  topBarActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  closeBtnActive: {
    borderColor: Colors.primary,
  },
  planetBanner: {
    position: 'absolute' as const,
    left: 12,
    right: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: 'rgba(11, 26, 18, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    zIndex: 9,
    alignSelf: 'center' as const,
  },
  planetBannerError: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  planetBannerText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600' as const,
    flexShrink: 1,
  },
  vineyardName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  currentIndexBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: 'rgba(20, 42, 30, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  indexDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  currentIndexText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  currentIndexValue: {
    fontSize: 12,
    fontWeight: '800' as const,
  },
  legendCard: {
    position: 'absolute' as const,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(11, 26, 18, 0.92)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    zIndex: 9,
  },
  legendHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 10,
  },
  legendTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
    flex: 1,
  },
  legendRanges: {
    gap: 6,
  },
  legendRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  legendSwatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
    flex: 1,
  },
  legendRange: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  bottomPanel: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(11, 26, 18, 0.92)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    zIndex: 10,
  },
  indexTabs: {
    maxHeight: 72,
  },
  indexTabsContent: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 6,
    gap: 8,
  },
  indexTab: {
    backgroundColor: 'rgba(20, 42, 30, 0.9)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  indexTabActive: {
    backgroundColor: 'rgba(30, 58, 43, 0.95)',
  },
  indexTabDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  indexTabInfo: {
    gap: 1,
  },
  indexTabAbbr: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '800' as const,
  },
  indexTabValue: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  indexTabIndicator: {
    position: 'absolute' as const,
    bottom: 0,
    left: 8,
    right: 8,
    height: 2.5,
    borderRadius: 2,
  },
  indexSummary: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    paddingTop: 4,
  },
  indexSummaryText: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
});
