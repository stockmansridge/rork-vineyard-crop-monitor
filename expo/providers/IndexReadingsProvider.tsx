import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import type { NdviSample } from '@/lib/ndvi';

export type IndexType = 'NDVI' | 'NDMI' | 'NDRE' | 'RECI' | 'MSAVI';

export interface DbIndexReading {
  id: string;
  vineyard_id: string;
  owner_id: string;
  index_type: IndexType;
  value: number;
  source: string | null;
  scene_id: string | null;
  cloud_cover: number | null;
  acquired_at: string;
  created_at: string;
}

export const [IndexReadingsProvider, useIndexReadings] = createContextHook(() => {
  const { user, isDemoMode } = useAuth();
  const queryClient = useQueryClient();

  const readingsQuery = useQuery({
    queryKey: ['index_readings', user?.id, isDemoMode ? 'demo' : 'live'],
    queryFn: async (): Promise<DbIndexReading[]> => {
      if (isDemoMode || !user) return [];
      const { data, error } = await supabase
        .from('vineyard_index_readings')
        .select('*')
        .order('acquired_at', { ascending: true });
      if (error) {
        console.log('[IndexReadings] fetch error', error.message);
        return [];
      }
      return (data ?? []) as DbIndexReading[];
    },
    enabled: !!user && !isDemoMode,
    staleTime: 1000 * 60 * 5,
  });

  const upsertMutation = useMutation({
    mutationFn: async ({
      vineyardId,
      samples,
      indexType,
    }: {
      vineyardId: string;
      samples: NdviSample[];
      indexType: IndexType;
    }) => {
      if (!user || isDemoMode) return;
      if (samples.length === 0) return;
      const rows = samples.map((s) => ({
        vineyard_id: vineyardId,
        owner_id: user.id,
        index_type: indexType,
        value: s.value,
        source: s.source,
        scene_id: s.sceneId ?? null,
        cloud_cover: s.cloudCover ?? null,
        acquired_at: s.acquiredAt,
      }));
      console.log('[IndexReadings] Upserting', rows.length, 'rows for', vineyardId, indexType);
      const { error } = await supabase
        .from('vineyard_index_readings')
        .upsert(rows, { onConflict: 'vineyard_id,index_type,acquired_at', ignoreDuplicates: true });
      if (error) {
        const { error: insertErr } = await supabase
          .from('vineyard_index_readings')
          .insert(rows);
        if (insertErr) {
          console.log('[IndexReadings] insert fallback error', insertErr.message);
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['index_readings'] });
    },
  });

  const addReading = useCallback(
    (vineyardId: string, samples: NdviSample[], indexType: IndexType = 'NDVI') =>
      upsertMutation.mutateAsync({ vineyardId, samples, indexType }),
    [upsertMutation]
  );

  const readings = useMemo(() => readingsQuery.data ?? [], [readingsQuery.data]);

  const getVineyardReadings = useCallback(
    (vineyardId: string, indexType: IndexType = 'NDVI') =>
      readings
        .filter((r) => r.vineyard_id === vineyardId && r.index_type === indexType)
        .sort((a, b) => (a.acquired_at < b.acquired_at ? -1 : 1)),
    [readings]
  );

  return useMemo(
    () => ({
      readings,
      isLoading: readingsQuery.isLoading,
      addReading,
      getVineyardReadings,
    }),
    [readings, readingsQuery.isLoading, addReading, getVineyardReadings]
  );
});
