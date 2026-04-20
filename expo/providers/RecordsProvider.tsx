import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';

export type TaskType =
  | 'pruning'
  | 'spraying'
  | 'harvesting'
  | 'irrigation'
  | 'fertilizing'
  | 'canopy'
  | 'scouting'
  | 'other';

export type TaskStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface DbTask {
  id: string;
  vineyard_id: string;
  owner_id: string;
  task_type: TaskType;
  title: string;
  notes: string | null;
  status: TaskStatus;
  scheduled_for: string | null;
  completed_at: string | null;
  duration_hours: number | null;
  labor_hours: number | null;
  cost: number | null;
  created_at: string;
  updated_at: string;
}

export type PhenologyStage =
  | 'dormant'
  | 'budbreak'
  | 'leaf_out'
  | 'flowering'
  | 'fruit_set'
  | 'veraison'
  | 'ripening'
  | 'harvest'
  | 'post_harvest'
  | 'leaf_fall';

export interface DbPhenology {
  id: string;
  vineyard_id: string;
  owner_id: string;
  stage: PhenologyStage;
  observed_on: string;
  percent_complete: number | null;
  gdd_at_event: number | null;
  notes: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface DbSpray {
  id: string;
  vineyard_id: string;
  owner_id: string;
  applied_on: string;
  product_name: string;
  active_ingredient: string | null;
  target: string | null;
  rate: number | null;
  rate_unit: string | null;
  total_volume: number | null;
  volume_unit: string | null;
  water_volume: number | null;
  phi_days: number | null;
  rei_hours: number | null;
  weather_conditions: string | null;
  wind_speed: number | null;
  temperature: number | null;
  applicator: string | null;
  equipment: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbHarvest {
  id: string;
  vineyard_id: string;
  owner_id: string;
  harvested_on: string;
  yield_kg: number | null;
  yield_tons: number | null;
  yield_per_ha: number | null;
  brix: number | null;
  ph: number | null;
  ta: number | null;
  ya_n: number | null;
  berry_weight_g: number | null;
  cluster_count: number | null;
  destination: string | null;
  picker_count: number | null;
  labor_hours: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type NewTask = Omit<DbTask, 'id' | 'owner_id' | 'created_at' | 'updated_at'>;
export type NewPhenology = Omit<DbPhenology, 'id' | 'owner_id' | 'created_at'>;
export type NewSpray = Omit<DbSpray, 'id' | 'owner_id' | 'created_at' | 'updated_at'>;
export type NewHarvest = Omit<DbHarvest, 'id' | 'owner_id' | 'created_at' | 'updated_at'>;

export const [RecordsProvider, useRecords] = createContextHook(() => {
  const { user, isDemoMode } = useAuth();
  const queryClient = useQueryClient();
  const enabled = !!user && !isDemoMode;

  const tasksQuery = useQuery({
    queryKey: ['tasks', user?.id],
    queryFn: async (): Promise<DbTask[]> => {
      if (!enabled) return [];
      const { data, error } = await supabase
        .from('vineyard_tasks')
        .select('*')
        .order('scheduled_for', { ascending: false, nullsFirst: false });
      if (error) {
        console.log('[Records] tasks error', error.message);
        return [];
      }
      return (data ?? []) as DbTask[];
    },
    enabled,
    staleTime: 1000 * 60 * 2,
  });

  const phenologyQuery = useQuery({
    queryKey: ['phenology', user?.id],
    queryFn: async (): Promise<DbPhenology[]> => {
      if (!enabled) return [];
      const { data, error } = await supabase
        .from('phenology_events')
        .select('*')
        .order('observed_on', { ascending: false });
      if (error) {
        console.log('[Records] phenology error', error.message);
        return [];
      }
      return (data ?? []) as DbPhenology[];
    },
    enabled,
    staleTime: 1000 * 60 * 2,
  });

  const spraysQuery = useQuery({
    queryKey: ['sprays', user?.id],
    queryFn: async (): Promise<DbSpray[]> => {
      if (!enabled) return [];
      const { data, error } = await supabase
        .from('spray_records')
        .select('*')
        .order('applied_on', { ascending: false });
      if (error) {
        console.log('[Records] sprays error', error.message);
        return [];
      }
      return (data ?? []) as DbSpray[];
    },
    enabled,
    staleTime: 1000 * 60 * 2,
  });

  const harvestsQuery = useQuery({
    queryKey: ['harvests', user?.id],
    queryFn: async (): Promise<DbHarvest[]> => {
      if (!enabled) return [];
      const { data, error } = await supabase
        .from('harvest_records')
        .select('*')
        .order('harvested_on', { ascending: false });
      if (error) {
        console.log('[Records] harvests error', error.message);
        return [];
      }
      return (data ?? []) as DbHarvest[];
    },
    enabled,
    staleTime: 1000 * 60 * 2,
  });

  const addTaskMutation = useMutation({
    mutationFn: async (input: NewTask): Promise<DbTask> => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('vineyard_tasks')
        .insert({ ...input, owner_id: user.id, created_by: user.id, updated_by: user.id })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as DbTask;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DbTask> & { id: string }): Promise<DbTask> => {
      const { data, error } = await supabase
        .from('vineyard_tasks')
        .update({ ...updates, updated_by: user?.id ?? null })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as DbTask;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vineyard_tasks').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const addPhenologyMutation = useMutation({
    mutationFn: async (input: NewPhenology): Promise<DbPhenology> => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('phenology_events')
        .insert({ ...input, owner_id: user.id, created_by: user.id })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as DbPhenology;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['phenology'] });
    },
  });

  const deletePhenologyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('phenology_events').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['phenology'] });
    },
  });

  const addSprayMutation = useMutation({
    mutationFn: async (input: NewSpray): Promise<DbSpray> => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('spray_records')
        .insert({ ...input, owner_id: user.id, created_by: user.id, updated_by: user.id })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as DbSpray;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sprays'] });
    },
  });

  const deleteSprayMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('spray_records').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sprays'] });
    },
  });

  const addHarvestMutation = useMutation({
    mutationFn: async (input: NewHarvest): Promise<DbHarvest> => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('harvest_records')
        .insert({ ...input, owner_id: user.id, created_by: user.id, updated_by: user.id })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as DbHarvest;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['harvests'] });
    },
  });

  const deleteHarvestMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('harvest_records').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['harvests'] });
    },
  });

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const phenology = useMemo(() => phenologyQuery.data ?? [], [phenologyQuery.data]);
  const sprays = useMemo(() => spraysQuery.data ?? [], [spraysQuery.data]);
  const harvests = useMemo(() => harvestsQuery.data ?? [], [harvestsQuery.data]);

  const getVineyardTasks = useCallback(
    (vineyardId: string) => tasks.filter((t) => t.vineyard_id === vineyardId),
    [tasks]
  );
  const getVineyardPhenology = useCallback(
    (vineyardId: string) => phenology.filter((p) => p.vineyard_id === vineyardId),
    [phenology]
  );
  const getVineyardSprays = useCallback(
    (vineyardId: string) => sprays.filter((s) => s.vineyard_id === vineyardId),
    [sprays]
  );
  const getVineyardHarvests = useCallback(
    (vineyardId: string) => harvests.filter((h) => h.vineyard_id === vineyardId),
    [harvests]
  );

  const addTask = useCallback((input: NewTask) => addTaskMutation.mutateAsync(input), [addTaskMutation]);
  const updateTask = useCallback(
    (id: string, updates: Partial<DbTask>) => updateTaskMutation.mutateAsync({ id, ...updates }),
    [updateTaskMutation]
  );
  const deleteTask = useCallback((id: string) => deleteTaskMutation.mutateAsync(id), [deleteTaskMutation]);

  const addPhenology = useCallback(
    (input: NewPhenology) => addPhenologyMutation.mutateAsync(input),
    [addPhenologyMutation]
  );
  const deletePhenology = useCallback(
    (id: string) => deletePhenologyMutation.mutateAsync(id),
    [deletePhenologyMutation]
  );

  const addSpray = useCallback((input: NewSpray) => addSprayMutation.mutateAsync(input), [addSprayMutation]);
  const deleteSpray = useCallback((id: string) => deleteSprayMutation.mutateAsync(id), [deleteSprayMutation]);

  const addHarvest = useCallback(
    (input: NewHarvest) => addHarvestMutation.mutateAsync(input),
    [addHarvestMutation]
  );
  const deleteHarvest = useCallback(
    (id: string) => deleteHarvestMutation.mutateAsync(id),
    [deleteHarvestMutation]
  );

  return useMemo(
    () => ({
      tasks,
      phenology,
      sprays,
      harvests,
      isLoading:
        tasksQuery.isLoading ||
        phenologyQuery.isLoading ||
        spraysQuery.isLoading ||
        harvestsQuery.isLoading,
      getVineyardTasks,
      getVineyardPhenology,
      getVineyardSprays,
      getVineyardHarvests,
      addTask,
      updateTask,
      deleteTask,
      addPhenology,
      deletePhenology,
      addSpray,
      deleteSpray,
      addHarvest,
      deleteHarvest,
      isAddingTask: addTaskMutation.isPending,
      isAddingPhenology: addPhenologyMutation.isPending,
      isAddingSpray: addSprayMutation.isPending,
      isAddingHarvest: addHarvestMutation.isPending,
    }),
    [
      tasks,
      phenology,
      sprays,
      harvests,
      tasksQuery.isLoading,
      phenologyQuery.isLoading,
      spraysQuery.isLoading,
      harvestsQuery.isLoading,
      getVineyardTasks,
      getVineyardPhenology,
      getVineyardSprays,
      getVineyardHarvests,
      addTask,
      updateTask,
      deleteTask,
      addPhenology,
      deletePhenology,
      addSpray,
      deleteSpray,
      addHarvest,
      deleteHarvest,
      addTaskMutation.isPending,
      addPhenologyMutation.isPending,
      addSprayMutation.isPending,
      addHarvestMutation.isPending,
    ]
  );
});
