import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';

export interface DbProbeReading {
  id: string;
  probe_id: string;
  owner_id: string;
  recorded_at: string;
  moisture: number | null;
  temperature: number | null;
  ph: number | null;
  ec: number | null;
  nitrogen: number | null;
  phosphorus: number | null;
  potassium: number | null;
  battery_level: number | null;
  created_at: string;
}

export interface ProbeReadingInput {
  probeId: string;
  moisture?: number;
  temperature?: number;
  ph?: number;
  ec?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  batteryLevel?: number;
  recordedAt?: string;
}

export const [ProbeReadingsProvider, useProbeReadings] = createContextHook(() => {
  const { user, isDemoMode } = useAuth();
  const queryClient = useQueryClient();

  const readingsQuery = useQuery({
    queryKey: ['probe_readings', user?.id, isDemoMode ? 'demo' : 'live'],
    queryFn: async (): Promise<DbProbeReading[]> => {
      if (isDemoMode || !user) return [];
      const { data, error } = await supabase
        .from('probe_readings')
        .select('*')
        .order('recorded_at', { ascending: true })
        .limit(2000);
      if (error) {
        console.log('[ProbeReadings] fetch error', error.message);
        return [];
      }
      return (data ?? []) as DbProbeReading[];
    },
    enabled: !!user && !isDemoMode,
    staleTime: 1000 * 60 * 2,
  });

  const addMutation = useMutation({
    mutationFn: async (input: ProbeReadingInput): Promise<DbProbeReading | null> => {
      if (!user || isDemoMode) return null;
      const { data, error } = await supabase
        .from('probe_readings')
        .insert({
          probe_id: input.probeId,
          owner_id: user.id,
          recorded_at: input.recordedAt ?? new Date().toISOString(),
          moisture: input.moisture ?? null,
          temperature: input.temperature ?? null,
          ph: input.ph ?? null,
          ec: input.ec ?? null,
          nitrogen: input.nitrogen ?? null,
          phosphorus: input.phosphorus ?? null,
          potassium: input.potassium ?? null,
          battery_level: input.batteryLevel ?? null,
        })
        .select()
        .single();
      if (error) {
        console.log('[ProbeReadings] insert error', error.message);
        throw error;
      }
      return data as DbProbeReading;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['probe_readings'] });
    },
  });

  const readings = useMemo(() => readingsQuery.data ?? [], [readingsQuery.data]);

  const getProbeReadings = useCallback(
    (probeId: string, sinceDaysAgo?: number): DbProbeReading[] => {
      let list = readings.filter((r) => r.probe_id === probeId);
      if (sinceDaysAgo != null) {
        const cutoff = Date.now() - sinceDaysAgo * 86400000;
        list = list.filter((r) => new Date(r.recorded_at).getTime() >= cutoff);
      }
      return list;
    },
    [readings]
  );

  const addReading = useCallback(
    (input: ProbeReadingInput) => addMutation.mutateAsync(input),
    [addMutation]
  );

  return useMemo(
    () => ({
      readings,
      isLoading: readingsQuery.isLoading,
      getProbeReadings,
      addReading,
    }),
    [readings, readingsQuery.isLoading, getProbeReadings, addReading]
  );
});
