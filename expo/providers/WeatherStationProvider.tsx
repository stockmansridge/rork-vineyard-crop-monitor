import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';

const STORAGE_KEY = 'weather_station_v1';
const API_KEY_STORAGE = 'weather_underground_api_key_v1';
const DEFAULT_API_KEY = '508f9903b13e48be8f9903b13e78be4a';

export interface WeatherStation {
  stationId: string;
  stationName: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
}

interface Stored {
  station: WeatherStation | null;
}

export const [WeatherStationProvider, useWeatherStation] = createContextHook(() => {
  const { user, isDemoMode } = useAuth();
  const [station, setStation] = useState<WeatherStation | null>(null);
  const [apiKey, setApiKeyState] = useState<string>(DEFAULT_API_KEY);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const [raw, rawKey] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(API_KEY_STORAGE),
        ]);
        if (raw) {
          const parsed = JSON.parse(raw) as Stored;
          setStation(parsed.station ?? null);
        }
        if (rawKey) {
          setApiKeyState(rawKey);
        }
      } catch (e) {
        console.log('[WeatherStation] Load error', e);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user || isDemoMode) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('user_weather_station')
          .select('station_id,station_name,latitude,longitude')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) {
          console.log('[WeatherStation] remote load error', error.message);
          return;
        }
        if (data?.station_id) {
          setStation({
            stationId: data.station_id as string,
            stationName: (data.station_name as string) ?? (data.station_id as string),
            latitude: Number(data.latitude ?? 0),
            longitude: Number(data.longitude ?? 0),
          });
        }
      } catch (e) {
        console.log('[WeatherStation] remote load exception', e);
      }
    })();
  }, [user, isDemoMode]);

  const persistStation = useCallback(
    async (next: WeatherStation | null) => {
      setStation(next);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ station: next } as Stored));
      } catch (e) {
        console.log('[WeatherStation] Persist error', e);
      }
      if (user && !isDemoMode) {
        try {
          if (next) {
            const { error } = await supabase
              .from('user_weather_station')
              .upsert(
                {
                  user_id: user.id,
                  station_id: next.stationId,
                  station_name: next.stationName,
                  latitude: next.latitude,
                  longitude: next.longitude,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id' }
              );
            if (error) console.log('[WeatherStation] remote upsert error', error.message);
          } else {
            const { error } = await supabase
              .from('user_weather_station')
              .delete()
              .eq('user_id', user.id);
            if (error) console.log('[WeatherStation] remote delete error', error.message);
          }
        } catch (e) {
          console.log('[WeatherStation] remote persist exception', e);
        }
      }
    },
    [user, isDemoMode]
  );

  const setApiKey = useCallback(async (key: string) => {
    setApiKeyState(key);
    try {
      await AsyncStorage.setItem(API_KEY_STORAGE, key);
    } catch (e) {
      console.log('[WeatherStation] API key persist error', e);
    }
  }, []);

  const clearStation = useCallback(() => {
    void persistStation(null);
  }, [persistStation]);

  return useMemo(
    () => ({ station, apiKey, isLoaded, setStation: persistStation, setApiKey, clearStation }),
    [station, apiKey, isLoaded, persistStation, setApiKey, clearStation]
  );
});

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function findNearbyStations(
  latitude: number,
  longitude: number,
  apiKey: string
): Promise<WeatherStation[]> {
  const url = `https://api.weather.com/v3/location/near?geocode=${latitude},${longitude}&product=pws&format=json&apiKey=${apiKey}`;
  console.log('[WeatherStation] Fetching nearby', url);
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch nearby stations (${res.status}): ${text}`);
  }
  const json = (await res.json()) as {
    location?: {
      stationId?: string[];
      stationName?: string[];
      latitude?: number[];
      longitude?: number[];
    };
  };
  const ids = json.location?.stationId ?? [];
  const names = json.location?.stationName ?? [];
  const lats = json.location?.latitude ?? [];
  const lons = json.location?.longitude ?? [];

  const stations: WeatherStation[] = ids.map((id, i) => ({
    stationId: id,
    stationName: names[i] ?? id,
    latitude: lats[i] ?? 0,
    longitude: lons[i] ?? 0,
    distanceKm: haversineKm(latitude, longitude, lats[i] ?? 0, lons[i] ?? 0),
  }));

  stations.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  return stations.slice(0, 10);
}
