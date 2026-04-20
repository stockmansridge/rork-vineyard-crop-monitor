import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';

export interface BlockAgronomy {
  clone: string | null;
  rootstock: string | null;
  row_spacing_m: number | null;
  vine_spacing_m: number | null;
  training_system: string | null;
  pruning_type: string | null;
  irrigation_type: string | null;
  irrigation_zone: string | null;
  emitter_spacing_m: number | null;
  emitter_flow_lph: number | null;
  soil_type: string | null;
  subsoil_notes: string | null;
  drainage_notes: string | null;
  slope_pct: number | null;
  aspect: string | null;
  elevation_m: number | null;
  frost_risk: boolean | null;
  heat_exposure: boolean | null;
  disease_prone: boolean | null;
  low_vigor_history: boolean | null;
  waterlogging_risk: boolean | null;
  target_yield_t_per_ha: number | null;
  normal_harvest_start: string | null;
  normal_harvest_end: string | null;
  block_notes: string | null;
}

export interface DbVineyard extends Partial<BlockAgronomy> {
  id: string;
  owner_id: string;
  name: string;
  variety: string;
  area: number;
  area_unit: string;
  latitude: number | null;
  longitude: number | null;
  polygon_coords: Array<{ latitude: number; longitude: number }> | null;
  planting_date: string | null;
  health_score: number;
  last_scan: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export type ShareRole = 'owner' | 'manager' | 'worker';

export interface DbVineyardShare {
  id: string;
  vineyard_id: string;
  owner_id: string;
  shared_with_email: string;
  shared_with_id: string | null;
  permission: 'view' | 'edit';
  role: ShareRole;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface CreateVineyardInput {
  name: string;
  variety: string;
  area: number;
  area_unit?: string;
  latitude?: number;
  longitude?: number;
  polygon_coords?: Array<{ latitude: number; longitude: number }>;
  planting_date?: string;
  image_url?: string;
}

const DEMO_VINEYARDS: DbVineyard[] = [
  {
    id: 'demo-v1',
    owner_id: 'demo-user-00000000-0000-0000-0000-000000000000',
    name: 'Hillside Block A',
    variety: 'Pinot Noir',
    area: 4.2,
    area_unit: 'ha',
    latitude: -33.3497,
    longitude: 149.1012,
    polygon_coords: [
      { latitude: -33.3490, longitude: 149.1000 },
      { latitude: -33.3490, longitude: 149.1025 },
      { latitude: -33.3505, longitude: 149.1025 },
      { latitude: -33.3505, longitude: 149.1000 },
    ],
    planting_date: '2018-03-15',
    health_score: 87,
    last_scan: '2026-04-01T14:30:00Z',
    image_url: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=400&h=300&fit=crop',
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2026-04-01T14:30:00Z',
  },
  {
    id: 'demo-v2',
    owner_id: 'demo-user-00000000-0000-0000-0000-000000000000',
    name: 'Valley Floor East',
    variety: 'Chardonnay',
    area: 6.8,
    area_unit: 'ha',
    latitude: -33.3520,
    longitude: 149.1080,
    polygon_coords: [
      { latitude: -33.3510, longitude: 149.1070 },
      { latitude: -33.3510, longitude: 149.1090 },
      { latitude: -33.3530, longitude: 149.1090 },
      { latitude: -33.3530, longitude: 149.1070 },
    ],
    planting_date: '2016-04-20',
    health_score: 72,
    last_scan: '2026-04-01T14:30:00Z',
    image_url: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=400&h=300&fit=crop',
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2026-04-01T14:30:00Z',
  },
  {
    id: 'demo-v3',
    owner_id: 'demo-user-00000000-0000-0000-0000-000000000000',
    name: 'Ridge Top West',
    variety: 'Shiraz',
    area: 3.1,
    area_unit: 'ha',
    latitude: -33.3460,
    longitude: 149.0950,
    polygon_coords: [
      { latitude: -33.3450, longitude: 149.0940 },
      { latitude: -33.3450, longitude: 149.0960 },
      { latitude: -33.3470, longitude: 149.0960 },
      { latitude: -33.3470, longitude: 149.0940 },
    ],
    planting_date: '2020-05-10',
    health_score: 94,
    last_scan: '2026-04-01T14:30:00Z',
    image_url: 'https://images.unsplash.com/photo-1596142813210-245649b1cf58?w=400&h=300&fit=crop',
    created_at: '2024-03-15T00:00:00Z',
    updated_at: '2026-04-01T14:30:00Z',
  },
  {
    id: 'demo-v4',
    owner_id: 'demo-user-00000000-0000-0000-0000-000000000000',
    name: 'Creek Bend South',
    variety: 'Cabernet Sauvignon',
    area: 5.5,
    area_unit: 'ha',
    latitude: -33.3550,
    longitude: 149.0980,
    polygon_coords: [
      { latitude: -33.3540, longitude: 149.0970 },
      { latitude: -33.3540, longitude: 149.0990 },
      { latitude: -33.3560, longitude: 149.0990 },
      { latitude: -33.3560, longitude: 149.0970 },
    ],
    planting_date: '2019-06-01',
    health_score: 61,
    last_scan: '2026-03-31T10:15:00Z',
    image_url: 'https://images.unsplash.com/photo-1464638681249-e162a7e1b4f5?w=400&h=300&fit=crop',
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2026-03-31T10:15:00Z',
  },
];

function normalizeVineyard(v: DbVineyard): DbVineyard {
  let polygon = v.polygon_coords as unknown;
  if (typeof polygon === 'string') {
    try {
      polygon = JSON.parse(polygon);
    } catch (e) {
      console.log('[Vineyards] Failed to parse polygon_coords', e);
      polygon = null;
    }
  }
  return {
    ...v,
    polygon_coords: Array.isArray(polygon)
      ? (polygon as Array<{ latitude: number; longitude: number }>)
      : null,
  };
}

export const [VineyardProvider, useVineyards] = createContextHook(() => {
  const { user, isDemoMode } = useAuth();
  const queryClient = useQueryClient();
  const [demoVineyards, setDemoVineyards] = useState<DbVineyard[]>(DEMO_VINEYARDS);

  const vineyardsQuery = useQuery({
    queryKey: ['vineyards', user?.id, isDemoMode ? 'demo' : 'live'],
    queryFn: async (): Promise<DbVineyard[]> => {
      if (isDemoMode) {
        console.log('[Vineyards] Returning demo vineyards');
        return demoVineyards;
      }
      if (!user) return [];
      console.log('[Vineyards] Fetching vineyards for user:', user.id);

      const { data: owned, error: ownedError } = await supabase
        .from('vineyards')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (ownedError) {
        console.log('[Vineyards] Error fetching owned:', ownedError.message);
        throw ownedError;
      }

      const { data: shares, error: sharesError } = await supabase
        .from('vineyard_shares')
        .select('vineyard_id')
        .eq('shared_with_id', user.id)
        .eq('status', 'accepted');

      if (sharesError) {
        console.log('[Vineyards] Error fetching shares:', sharesError.message);
        return ((owned ?? []) as DbVineyard[]).map(normalizeVineyard);
      }

      const sharedIds = (shares ?? []).map((s: { vineyard_id: string }) => s.vineyard_id);
      if (sharedIds.length === 0) {
        return ((owned ?? []) as DbVineyard[]).map(normalizeVineyard);
      }

      const { data: shared } = await supabase
        .from('vineyards')
        .select('*')
        .in('id', sharedIds);

      const all = [...(owned ?? []), ...(shared ?? [])];
      const unique = Array.from(new Map(all.map((v) => [v.id, v])).values());
      const normalized = unique.map((v) => normalizeVineyard(v as DbVineyard));
      console.log('[Vineyards] Total vineyards:', normalized.length);
      return normalized;
    },
    enabled: !!user || isDemoMode,
  });

  const addVineyardMutation = useMutation({
    mutationFn: async (input: CreateVineyardInput): Promise<DbVineyard> => {
      if (isDemoMode) {
        const newVineyard: DbVineyard = {
          id: `demo-v${Date.now()}`,
          owner_id: 'demo-user-00000000-0000-0000-0000-000000000000',
          name: input.name,
          variety: input.variety,
          area: input.area,
          area_unit: input.area_unit ?? 'ha',
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          polygon_coords: input.polygon_coords ?? null,
          planting_date: input.planting_date ?? null,
          health_score: Math.floor(Math.random() * 30) + 65,
          last_scan: new Date().toISOString(),
          image_url: input.image_url ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setDemoVineyards(prev => [newVineyard, ...prev]);
        return newVineyard;
      }
      if (!user) throw new Error('Not authenticated');
      console.log('[Vineyards] Adding vineyard:', input.name);
      const insertPayload = {
        owner_id: user.id,
        name: input.name,
        variety: input.variety,
        area: input.area,
        area_unit: input.area_unit ?? 'ha',
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        polygon_coords: input.polygon_coords ?? null,
        planting_date: input.planting_date ?? null,
        image_url: input.image_url ?? null,
      };
      console.log('[Vineyards] Insert payload:', JSON.stringify(insertPayload));
      const { data, error } = await supabase
        .from('vineyards')
        .insert(insertPayload)
        .select()
        .single();
      if (error) {
        console.error('[Vineyards] Insert error:', error.message, error.code, error.details, error.hint);
        throw new Error(error.message);
      }
      console.log('[Vineyards] Insert success:', data?.id);
      return data as DbVineyard;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vineyards'] });
    },
  });

  const updateVineyardMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DbVineyard> & { id: string }): Promise<DbVineyard> => {
      if (isDemoMode) {
        const updated = demoVineyards.map(v => v.id === id ? { ...v, ...updates, updated_at: new Date().toISOString() } : v);
        setDemoVineyards(updated);
        return updated.find(v => v.id === id) as DbVineyard;
      }
      console.log('[Vineyards] Updating vineyard:', id);
      const { data, error } = await supabase
        .from('vineyards')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as DbVineyard;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vineyards'] });
    },
  });

  const deleteVineyardMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isDemoMode) {
        setDemoVineyards(prev => prev.filter(v => v.id !== id));
        return;
      }
      console.log('[Vineyards] Deleting vineyard:', id);
      const { error } = await supabase.from('vineyards').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vineyards'] });
    },
  });

  const shareVineyardMutation = useMutation({
    mutationFn: async ({
      vineyardId,
      email,
      permission,
      role,
    }: {
      vineyardId: string;
      email: string;
      permission: 'view' | 'edit';
      role: ShareRole;
    }) => {
      if (isDemoMode) {
        Alert.alert('Demo Mode', 'Sharing is not available in demo mode. Create an account to share vineyards.');
        throw new Error('Sharing unavailable in demo mode');
      }
      if (!user) throw new Error('Not authenticated');
      console.log('[Vineyards] Sharing vineyard:', vineyardId, 'with:', email);

      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      const { data, error } = await supabase
        .from('vineyard_shares')
        .insert({
          vineyard_id: vineyardId,
          owner_id: user.id,
          shared_with_email: email,
          shared_with_id: existingUser?.id ?? null,
          permission,
          role,
          status: existingUser ? 'pending' : 'pending',
        })
        .select()
        .single();
      if (error) throw error;
      return data as DbVineyardShare;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vineyard_shares'] });
    },
  });

  const sharesQuery = useQuery({
    queryKey: ['vineyard_shares', user?.id, isDemoMode ? 'demo' : 'live'],
    queryFn: async (): Promise<DbVineyardShare[]> => {
      if (isDemoMode) return [];
      if (!user) return [];
      const { data: ownedShares } = await supabase
        .from('vineyard_shares')
        .select('*')
        .eq('owner_id', user.id);

      const { data: receivedShares } = await supabase
        .from('vineyard_shares')
        .select('*')
        .eq('shared_with_id', user.id);

      const all = [...(ownedShares ?? []), ...(receivedShares ?? [])];
      const unique = Array.from(new Map(all.map((s) => [s.id, s])).values());
      return unique as DbVineyardShare[];
    },
    enabled: !!user || isDemoMode,
  });

  const respondToShareMutation = useMutation({
    mutationFn: async ({ shareId, accept }: { shareId: string; accept: boolean }) => {
      console.log('[Vineyards] Responding to share:', shareId, accept ? 'accept' : 'decline');
      const { error } = await supabase
        .from('vineyard_shares')
        .update({ status: accept ? 'accepted' : 'declined' })
        .eq('id', shareId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vineyard_shares'] });
      void queryClient.invalidateQueries({ queryKey: ['vineyards'] });
    },
  });

  const removeShareMutation = useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase.from('vineyard_shares').delete().eq('id', shareId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vineyard_shares'] });
    },
  });

  const addVineyard = useCallback(
    (input: CreateVineyardInput) => addVineyardMutation.mutateAsync(input),
    [addVineyardMutation]
  );

  const updateVineyard = useCallback(
    (id: string, updates: Partial<DbVineyard>) => updateVineyardMutation.mutateAsync({ id, ...updates }),
    [updateVineyardMutation]
  );

  const deleteVineyard = useCallback(
    (id: string) => deleteVineyardMutation.mutateAsync(id),
    [deleteVineyardMutation]
  );

  const shareVineyard = useCallback(
    (vineyardId: string, email: string, permission: 'view' | 'edit', role: ShareRole = 'worker') =>
      shareVineyardMutation.mutateAsync({ vineyardId, email, permission, role }),
    [shareVineyardMutation]
  );

  const updateShareMutation = useMutation({
    mutationFn: async ({ shareId, updates }: { shareId: string; updates: Partial<DbVineyardShare> }) => {
      const { error } = await supabase
        .from('vineyard_shares')
        .update(updates)
        .eq('id', shareId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vineyard_shares'] });
    },
  });

  const updateShare = useCallback(
    (shareId: string, updates: Partial<DbVineyardShare>) =>
      updateShareMutation.mutateAsync({ shareId, updates }),
    [updateShareMutation]
  );

  const respondToShare = useCallback(
    (shareId: string, accept: boolean) => respondToShareMutation.mutateAsync({ shareId, accept }),
    [respondToShareMutation]
  );

  const removeShare = useCallback(
    (shareId: string) => removeShareMutation.mutateAsync(shareId),
    [removeShareMutation]
  );

  const vineyards = useMemo(() => vineyardsQuery.data ?? [], [vineyardsQuery.data]);
  const shares = useMemo(() => sharesQuery.data ?? [], [sharesQuery.data]);

  const pendingShares = useMemo(
    () => shares.filter((s) => s.shared_with_id === user?.id && s.status === 'pending'),
    [shares, user?.id]
  );

  const refetch = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['vineyards'] });
    void queryClient.invalidateQueries({ queryKey: ['vineyard_shares'] });
  }, [queryClient]);

  return useMemo(() => ({
    vineyards,
    shares,
    pendingShares,
    isLoading: vineyardsQuery.isLoading,
    isRefetching: vineyardsQuery.isRefetching,
    addVineyard,
    updateVineyard,
    deleteVineyard,
    shareVineyard,
    updateShare,
    respondToShare,
    removeShare,
    refetch,
    isAdding: addVineyardMutation.isPending,
    isSharing: shareVineyardMutation.isPending,
    addError: addVineyardMutation.error?.message ?? null,
    shareError: shareVineyardMutation.error?.message ?? null,
  }), [
    vineyards, shares, pendingShares,
    vineyardsQuery.isLoading, vineyardsQuery.isRefetching,
    addVineyard, updateVineyard, deleteVineyard,
    shareVineyard, updateShare, respondToShare, removeShare, refetch,
    addVineyardMutation.isPending, shareVineyardMutation.isPending,
    addVineyardMutation.error, shareVineyardMutation.error,
  ]);
});
