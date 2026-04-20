import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, Platform } from 'react-native';
import { CloudOff, CircleCheck } from 'lucide-react-native';
import { useOfflineQueue } from '@/providers/OfflineQueueProvider';
import Colors from '@/constants/colors';

export default function OfflineBanner() {
  const { isOnline, wasOffline, clearWasOffline } = useOfflineQueue();
  const opacity = useRef(new Animated.Value(0)).current;
  const showReconnected = isOnline && wasOffline;
  const visible = !isOnline || showReconnected;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 260,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    if (showReconnected) {
      const t = setTimeout(() => clearWasOffline(), 2500);
      return () => clearTimeout(t);
    }
  }, [visible, showReconnected, opacity, clearWasOffline]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        { opacity },
        !isOnline ? styles.offline : styles.online,
      ]}
    >
      {!isOnline ? (
        <CloudOff size={14} color={Colors.warning} />
      ) : (
        <CircleCheck size={14} color={Colors.primary} />
      )}
      <Text style={[styles.text, !isOnline ? styles.textOffline : styles.textOnline]}>
        {!isOnline
          ? 'Offline — changes will sync when reconnected'
          : 'Back online — syncing changes'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  offline: {
    backgroundColor: Colors.warningMuted,
    borderBottomWidth: 1,
    borderBottomColor: Colors.warning + '40',
  },
  online: {
    backgroundColor: Colors.primaryMuted,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary + '40',
  },
  text: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  textOffline: { color: Colors.warning },
  textOnline: { color: Colors.primary },
});
