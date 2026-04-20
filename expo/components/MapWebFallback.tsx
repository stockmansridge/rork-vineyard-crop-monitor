import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface MapWebFallbackProps {
  style?: any;
  message?: string;
  testID?: string;
}

export default function MapWebFallback({ style, message, testID }: MapWebFallbackProps) {
  return (
    <View style={[styles.container, style]} testID={testID ?? 'mapWebFallback'}>
      <View style={styles.grid} pointerEvents="none">
        {Array.from({ length: 10 }).map((_, r) => (
          <View key={`r-${r}`} style={styles.gridRow} />
        ))}
        {Array.from({ length: 10 }).map((_, c) => (
          <View key={`c-${c}`} style={[styles.gridCol, { left: `${c * 10}%` }]} />
        ))}
      </View>
      <View style={styles.badge}>
        <MapPin size={16} color={Colors.primary} />
        <Text style={styles.title}>Map preview unavailable on web</Text>
        <Text style={styles.subtitle}>
          {message ?? 'Open the app on your phone to view the interactive map.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f2419',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
  },
  gridRow: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(74, 222, 128, 0.08)',
  },
  gridCol: {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
  },
  badge: {
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(11, 26, 18, 0.9)',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    maxWidth: 320,
  },
  title: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    textAlign: 'center' as const,
  },
});
