import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';

export interface DbBlockSeason {
  id: string;
  vineyard_id: string;
  owner_id: string;
  season: number;
  budburst_date: string | null;
  flowering_date: string | null;
  fruit_set_date: string | null;
  veraison_date: string | null;
  harvest_date: string | null;
  target_yield_t_per_ha: number | null;
  actual_yield_t_per_ha: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type BlockSeasonInput = Omit<DbBlockSeason, 'id' | 'owner_id' | 'created_at' | 'updated_at'>;

export const [BlockSeasonsProvider, useBlockSeasons] = createContextHook(() => {
  const { user, isDemoMode } = useAuth();
  const queryClient = useQueryClient();
  const enabled = !!user && !isDemoMode;

  const seasonsQuery = useQuery({
    queryKey: ['block_seasons', user?.id],
    queryFn: async (): Promise<DbBlockSeason[]> => {
      if (!enabled) return [];
      const { data, error } = await supabase
        .from('block_seasons')
        .select('*')
        .order('season', { ascending: false });
      if (error) {
        console.log('[BlockSeasons] fetch error', error.message);
        return [];
      }
      return (data ?? []) as DbBlockSeason[];
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });

  const upsertMutation = useMutation({
    mutationFn: async (input: BlockSeasonInput): Promise<DbBlockSeason> => {
      if (!user) throw new Error('Not authenticated');
      const payload = { ...input, owner_id: user.id };
      console.log('[BlockSeasons] upsert', payload.vineyard_id, payload.season);
      const { data, error } = await supabase
        .from('block_seasons')
        .upsert(payload, { onConflict: 'vineyard_id,season' })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as DbBlockSeason;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['block_seasons'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('block_seasons').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['block_seasons'] });
    },
  });

  const seasons = useMemo(() => seasonsQuery.data ?? [], [seasonsQuery.data]);

  const getVineyardSeasons = useCallback(
    (vineyardId: string) => seasons.filter((s) => s.vineyard_id === vineyardId),
    [seasons]
  );

  const getSeason = useCallback(
    (vineyardId: string, season: number) =>
      seasons.find((s) => s.vineyard_id === vineyardId && s.season === season) ?? null,
    [seasons]
  );

  const upsertSeason = useCallback(
    (input: BlockSeasonInput) => upsertMutation.mutateAsync(input),
    [upsertMutation]
  );

  const deleteSeason = useCallback(
    (id: string) => deleteMutation.mutateAsync(id),
    [deleteMutation]
  );

  return useMemo(
    () => ({
      seasons,
      isLoading: seasonsQuery.isLoading,
      getVineyardSeasons,
      getSeason,
      upsertSeason,
      deleteSeason,
      isSaving: upsertMutation.isPending,
    }),
    [
      seasons,
      seasonsQuery.isLoading,
      getVineyardSeasons,
      getSeason,
      upsertSeason,
      deleteSeason,
      upsertMutation.isPending,
    ]
  );
});
