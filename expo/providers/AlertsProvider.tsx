import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  configureNotifications,
  requestNotificationPermission,
  sendLocalNotification,
} from '@/lib/notifications';
import { useVineyards } from './VineyardProvider';
import { fetchForecast, WeatherForecast } from '@/lib/weather';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import { isStale } from '@/lib/dataTrust';
import { ALERT_TITLES } from '@/lib/wording';

export type AlertSeverity = 'danger' | 'warning' | 'info';
export type AlertCategory =
  | 'frost'
  | 'heat'
  | 'rain'
  | 'wind'
  | 'disease'
  | 'moisture'
  | 'temperature'
  | 'ph'
  | 'ec'
  | 'battery'
  | 'offline';

export interface ComputedAlert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  message: string;
  vineyardId: string | null;
  vineyardName: string;
  timestamp: string;
}

export interface AlertPreferences {
  enabled: boolean;
  frost: boolean;
  heat: boolean;
  rain: boolean;
  disease: boolean;
  moisture: boolean;
  battery: boolean;
  offline: boolean;
  thresholds: {
    frostTempC: number;
    heatTempC: number;
    rainMm: number;
    lowMoisturePct: number;
    highMoisturePct: number;
    lowBatteryPct: number;
    phMin: number;
    phMax: number;
  };
}

const DEFAULT_PREFS: AlertPreferences = {
  enabled: true,
  frost: true,
  heat: true,
  rain: true,
  disease: true,
  moisture: true,
  battery: true,
  offline: true,
  thresholds: {
    frostTempC: 2,
    heatTempC: 35,
    rainMm: 15,
    lowMoisturePct: 20,
    highMoisturePct: 45,
    lowBatteryPct: 20,
    phMin: 5.8,
    phMax: 7.5,
  },
};

const PREFS_KEY = 'alert_preferences_v1';
const READ_KEY = 'alert_read_ids_v1';
const SENT_KEY = 'alert_sent_ids_v1';

interface DbProbe {
  id: string;
  vineyard_id: string | null;
  name: string;
  is_online: boolean;
  battery_level: number | null;
  moisture: number | null;
  temperature: number | null;
  ph: number | null;
  ec: number | null;
  last_reading: string;
}

interface DbAlertAck {
  alert_id: string;
  read_at: string | null;
  sent_at: string | null;
}

export const [AlertsProvider, useAlerts] = createContextHook(() => {
  const { user, isDemoMode } = useAuth();
  const queryClient = useQueryClient();
  const { vineyards } = useVineyards();
  const [prefs, setPrefs] = useState<AlertPreferences>(DEFAULT_PREFS);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    configureNotifications();
    (async () => {
      try {
        const [p, r, s] = await Promise.all([
          AsyncStorage.getItem(PREFS_KEY),
          AsyncStorage.getItem(READ_KEY),
          AsyncStorage.getItem(SENT_KEY),
        ]);
        if (p) setPrefs({ ...DEFAULT_PREFS, ...(JSON.parse(p) as Partial<AlertPreferences>) });
        if (r) setReadIds(new Set(JSON.parse(r) as string[]));
        if (s) setSentIds(new Set(JSON.parse(s) as string[]));
      } catch (e) {
        console.log('[Alerts] load error', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const remotePrefsQuery = useQuery({
    queryKey: ['alert_prefs_remote', user?.id],
    queryFn: async (): Promise<AlertPreferences | null> => {
      if (!user || isDemoMode) return null;
      const { data, error } = await supabase
        .from('alert_preferences')
        .select('prefs')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        console.log('[Alerts] remote prefs load error', error.message);
        return null;
      }
      return (data?.prefs ?? null) as AlertPreferences | null;
    },
    enabled: !!user && !isDemoMode,
    staleTime: 1000 * 60 * 10,
  });

  const remoteAcksQuery = useQuery({
    queryKey: ['alert_acks_remote', user?.id],
    queryFn: async (): Promise<DbAlertAck[]> => {
      if (!user || isDemoMode) return [];
      const { data, error } = await supabase
        .from('alert_acks')
        .select('alert_id,read_at,sent_at')
        .eq('user_id', user.id);
      if (error) {
        console.log('[Alerts] remote acks load error', error.message);
        return [];
      }
      return (data ?? []) as DbAlertAck[];
    },
    enabled: !!user && !isDemoMode,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    const remote = remotePrefsQuery.data;
    if (remote) {
      setPrefs({ ...DEFAULT_PREFS, ...remote });
    }
  }, [remotePrefsQuery.data]);

  useEffect(() => {
    const acks = remoteAcksQuery.data;
    if (!acks || acks.length === 0) return;
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const a of acks) if (a.read_at) next.add(a.alert_id);
      return next;
    });
    setSentIds((prev) => {
      const next = new Set(prev);
      for (const a of acks) if (a.sent_at) next.add(a.alert_id);
      return next;
    });
  }, [remoteAcksQuery.data]);

  const savePrefs = useCallback(
    async (next: AlertPreferences) => {
      setPrefs(next);
      try {
        await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch (e) {
        console.log('[Alerts] prefs save error', e);
      }
      if (user && !isDemoMode) {
        try {
          const { error } = await supabase
            .from('alert_preferences')
            .upsert({ user_id: user.id, prefs: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
          if (error) console.log('[Alerts] remote prefs save error', error.message);
          else void queryClient.invalidateQueries({ queryKey: ['alert_prefs_remote'] });
        } catch (e) {
          console.log('[Alerts] remote prefs save exception', e);
        }
      }
    },
    [user, isDemoMode, queryClient]
  );

  const requestPermission = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setPermissionGranted(granted);
    return granted;
  }, []);

  const probesQuery = useQuery({
    queryKey: ['alerts_probes', user?.id, isDemoMode ? 'demo' : 'live'],
    queryFn: async (): Promise<DbProbe[]> => {
      if (isDemoMode || !user) return [];
      const { data, error } = await supabase
        .from('soil_probes')
        .select('id,vineyard_id,name,is_online,battery_level,moisture,temperature,ph,ec,last_reading');
      if (error) {
        console.log('[Alerts] probes error', error.message);
        return [];
      }
      return (data ?? []) as DbProbe[];
    },
    enabled: !!user && !isDemoMode,
    staleTime: 1000 * 60 * 5,
  });

  const forecastsQuery = useQuery({
    queryKey: [
      'alerts_forecasts',
      vineyards.map((v) => `${v.id}:${v.latitude},${v.longitude}`).join('|'),
    ],
    queryFn: async (): Promise<Record<string, WeatherForecast>> => {
      const out: Record<string, WeatherForecast> = {};
      for (const v of vineyards) {
        if (v.latitude == null || v.longitude == null) continue;
        try {
          const f = await fetchForecast(v.latitude, v.longitude);
          out[v.id] = f;
        } catch (e) {
          console.log('[Alerts] forecast error for', v.id, e);
        }
      }
      return out;
    },
    enabled: vineyards.length > 0,
    staleTime: 1000 * 60 * 30,
  });

  const alerts: ComputedAlert[] = useMemo(() => {
    const out: ComputedAlert[] = [];
    const t = prefs.thresholds;
    const forecasts = forecastsQuery.data ?? {};

    for (const v of vineyards) {
      const f = forecasts[v.id];
      if (!f) continue;

      if (prefs.frost) {
        const frostDay = f.days.find((d) => d.tMin <= t.frostTempC);
        if (frostDay) {
          out.push({
            id: `frost-${v.id}-${frostDay.date}`,
            severity: 'danger',
            category: 'frost',
            title: ALERT_TITLES.frostCritical,
            message: `Forecast overnight minimum ${frostDay.tMin.toFixed(1)}°C on ${frostDay.date} at ${v.name}. Advisory — verify local forecast and consider frost protection.`,
            vineyardId: v.id,
            vineyardName: v.name,
            timestamp: new Date().toISOString(),
          });
        }
      }

      if (prefs.heat) {
        const heatDay = f.days.find((d) => d.tMax >= t.heatTempC);
        if (heatDay) {
          out.push({
            id: `heat-${v.id}-${heatDay.date}`,
            severity: 'warning',
            category: 'heat',
            title: ALERT_TITLES.heatElevated,
            message: `Forecast daily maximum ${heatDay.tMax.toFixed(1)}°C on ${heatDay.date} at ${v.name}. Advisory — consider pre-irrigation and avoiding midday canopy work.`,
            vineyardId: v.id,
            vineyardName: v.name,
            timestamp: new Date().toISOString(),
          });
        }
      }

      if (prefs.rain) {
        const rainDay = f.days.find((d) => d.precipitation >= t.rainMm);
        if (rainDay) {
          out.push({
            id: `rain-${v.id}-${rainDay.date}`,
            severity: 'info',
            category: 'rain',
            title: ALERT_TITLES.rainHeavy,
            message: `${rainDay.precipitation.toFixed(0)}mm forecast on ${rainDay.date} at ${v.name}. Advisory — consider delaying spraying and checking drainage.`,
            vineyardId: v.id,
            vineyardName: v.name,
            timestamp: new Date().toISOString(),
          });
        }
      }

      if (prefs.disease) {
        const next3 = f.days.slice(0, 3);
        const wet = next3.filter((d) => d.precipitation >= 2).length;
        const warm = next3.filter((d) => d.tMax >= 20 && d.tMax <= 30).length;
        if (wet >= 2 && warm >= 2) {
          out.push({
            id: `pm-${v.id}-${next3[0]?.date ?? 'na'}`,
            severity: 'warning',
            category: 'disease',
            title: ALERT_TITLES.diseaseElevated,
            message: `Warm, wet conditions forecast at ${v.name} over the next 3 days. Generic disease-supportive proxy — advisory, not a pathogen-specific model.`,
            vineyardId: v.id,
            vineyardName: v.name,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    const probes = probesQuery.data ?? [];
    for (const p of probes) {
      const vy = vineyards.find((v) => v.id === p.vineyard_id);
      const vName = vy?.name ?? p.name;

      const probeStale = isStale('probe', p.last_reading);
      if (probeStale) {
        out.push({
          id: `stale-${p.id}`,
          severity: 'info',
          category: 'offline',
          title: ALERT_TITLES.probeStale,
          message: `${p.name} has not reported in over 12h. Confidence reduced — readings may not reflect current field conditions.`,
          vineyardId: p.vineyard_id,
          vineyardName: vName,
          timestamp: p.last_reading,
        });
        continue;
      }

      if (prefs.moisture && p.moisture != null) {
        if (p.moisture < t.lowMoisturePct) {
          out.push({
            id: `moist-low-${p.id}`,
            severity: 'danger',
            category: 'moisture',
            title: ALERT_TITLES.moistureLow,
            message: `${p.name} reading ${p.moisture.toFixed(0)}% moisture (below ${t.lowMoisturePct}%). Advisory — review the irrigation recommendation before acting.`,
            vineyardId: p.vineyard_id,
            vineyardName: vName,
            timestamp: p.last_reading,
          });
        } else if (p.moisture > t.highMoisturePct) {
          out.push({
            id: `moist-high-${p.id}`,
            severity: 'warning',
            category: 'moisture',
            title: ALERT_TITLES.moistureHigh,
            message: `${p.name} reading ${p.moisture.toFixed(0)}% moisture (above ${t.highMoisturePct}%). Recommended inspection of drainage — advisory.`,
            vineyardId: p.vineyard_id,
            vineyardName: vName,
            timestamp: p.last_reading,
          });
        }
      }

      if (prefs.moisture && p.ph != null) {
        if (p.ph < t.phMin || p.ph > t.phMax) {
          out.push({
            id: `ph-${p.id}`,
            severity: 'warning',
            category: 'ph',
            title: ALERT_TITLES.phOut,
            message: `${p.name} pH at ${p.ph.toFixed(1)} (target ${t.phMin}-${t.phMax}). Advisory — verify with a second measurement before amending.`,
            vineyardId: p.vineyard_id,
            vineyardName: vName,
            timestamp: p.last_reading,
          });
        }
      }

      if (prefs.battery && p.battery_level != null && p.battery_level < t.lowBatteryPct) {
        out.push({
          id: `bat-${p.id}`,
          severity: 'warning',
          category: 'battery',
          title: ALERT_TITLES.batteryLow,
          message: `${p.name} battery at ${p.battery_level}%. Schedule replacement or recharge.`,
          vineyardId: p.vineyard_id,
          vineyardName: vName,
          timestamp: p.last_reading,
        });
      }

      if (prefs.offline && !p.is_online) {
        out.push({
          id: `off-${p.id}`,
          severity: 'danger',
          category: 'offline',
          title: ALERT_TITLES.probeOffline,
          message: `${p.name} is offline. Last reading ${new Date(p.last_reading).toLocaleString()}.`,
          vineyardId: p.vineyard_id,
          vineyardName: vName,
          timestamp: p.last_reading,
        });
      }
    }

    out.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    return out;
  }, [vineyards, forecastsQuery.data, probesQuery.data, prefs]);

  useEffect(() => {
    if (!loaded) return;
    if (!prefs.enabled) return;
    if (Platform.OS === 'web') return;
    if (!permissionGranted) return;

    const newOnes = alerts.filter((a) => !sentIds.has(a.id));
    if (newOnes.length === 0) return;

    (async () => {
      for (const a of newOnes.slice(0, 5)) {
        await sendLocalNotification(a.title, a.message, { alertId: a.id, vineyardId: a.vineyardId });
      }
      const next = new Set(sentIds);
      for (const a of newOnes) next.add(a.id);
      setSentIds(next);
      try {
        await AsyncStorage.setItem(SENT_KEY, JSON.stringify(Array.from(next)));
      } catch (e) {
        console.log('[Alerts] sent persist error', e);
      }
      if (user && !isDemoMode) {
        try {
          const nowIso = new Date().toISOString();
          const rows = newOnes.map((a) => ({
            user_id: user.id,
            alert_id: a.id,
            sent_at: nowIso,
            vineyard_id: a.vineyardId,
            category: a.category,
          }));
          const { error } = await supabase
            .from('alert_acks')
            .upsert(rows, { onConflict: 'user_id,alert_id' });
          if (error) console.log('[Alerts] remote sent upsert error', error.message);
        } catch (e) {
          console.log('[Alerts] remote sent upsert exception', e);
        }
      }
    })();
  }, [alerts, loaded, prefs.enabled, permissionGranted, sentIds, user, isDemoMode]);

  const persistReadRemote = useCallback(
    async (ids: string[]) => {
      if (!user || isDemoMode || ids.length === 0) return;
      try {
        const nowIso = new Date().toISOString();
        const alertById = new Map(alerts.map((a) => [a.id, a]));
        const rows = ids.map((id) => {
          const a = alertById.get(id);
          return {
            user_id: user.id,
            alert_id: id,
            read_at: nowIso,
            vineyard_id: a?.vineyardId ?? null,
            category: a?.category ?? null,
          };
        });
        const { error } = await supabase
          .from('alert_acks')
          .upsert(rows, { onConflict: 'user_id,alert_id' });
        if (error) console.log('[Alerts] remote read upsert error', error.message);
      } catch (e) {
        console.log('[Alerts] remote read upsert exception', e);
      }
    },
    [user, isDemoMode, alerts]
  );

  const markRead = useCallback(
    async (id: string) => {
      const next = new Set(readIds);
      next.add(id);
      setReadIds(next);
      try {
        await AsyncStorage.setItem(READ_KEY, JSON.stringify(Array.from(next)));
      } catch (e) {
        console.log('[Alerts] read persist error', e);
      }
      await persistReadRemote([id]);
    },
    [readIds, persistReadRemote]
  );

  const markAllRead = useCallback(async () => {
    const ids = alerts.map((a) => a.id);
    const next = new Set(ids);
    setReadIds(next);
    try {
      await AsyncStorage.setItem(READ_KEY, JSON.stringify(Array.from(next)));
    } catch (e) {
      console.log('[Alerts] read persist error', e);
    }
    await persistReadRemote(ids);
  }, [alerts, persistReadRemote]);

  const unreadCount = useMemo(
    () => alerts.filter((a) => !readIds.has(a.id)).length,
    [alerts, readIds]
  );

  const forecasts = useMemo(() => forecastsQuery.data ?? {}, [forecastsQuery.data]);
  const probes = useMemo(() => probesQuery.data ?? [], [probesQuery.data]);

  return useMemo(
    () => ({
      alerts,
      unreadCount,
      prefs,
      savePrefs,
      requestPermission,
      permissionGranted,
      markRead,
      markAllRead,
      readIds,
      forecasts,
      probes,
      isLoading: probesQuery.isLoading || forecastsQuery.isLoading,
    }),
    [
      alerts,
      unreadCount,
      prefs,
      savePrefs,
      requestPermission,
      permissionGranted,
      markRead,
      markAllRead,
      readIds,
      forecasts,
      probes,
      probesQuery.isLoading,
      forecastsQuery.isLoading,
    ]
  );
});

export type { DbProbe };
