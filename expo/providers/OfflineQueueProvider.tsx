import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

export const [OfflineQueueProvider, useOfflineQueue] = createContextHook(() => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [wasOffline, setWasOffline] = useState<boolean>(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const updateOnline = () => {
        const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
        console.log('[Offline] web online:', online);
        setIsOnline(online);
        onlineManager.setOnline(online);
        if (!online) setWasOffline(true);
      };
      updateOnline();
      if (typeof window !== 'undefined') {
        window.addEventListener('online', updateOnline);
        window.addEventListener('offline', updateOnline);
        return () => {
          window.removeEventListener('online', updateOnline);
          window.removeEventListener('offline', updateOnline);
        };
      }
      return;
    }

    const unsub = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false && state.isInternetReachable !== false;
      console.log('[Offline] NetInfo:', state.type, 'online=', online);
      setIsOnline(online);
      onlineManager.setOnline(online);
      if (!online) setWasOffline(true);
    });
    return () => unsub();
  }, []);

  const clearWasOffline = useCallback(() => setWasOffline(false), []);

  return useMemo(
    () => ({ isOnline, wasOffline, clearWasOffline }),
    [isOnline, wasOffline, clearWasOffline]
  );
});
