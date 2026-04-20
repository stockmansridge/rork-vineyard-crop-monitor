import { useCallback, useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import type {
  DbScoutTask,
  ScoutCheckPoint,
  ScoutObservations,
  ScoutOutcome,
  ScoutPhoto,
  ScoutPin,
  ScoutStatus,
  ScoutTriggerKind,
} from '@/lib/scoutTasks';
import type { RecommendationConfidence, RecommendationPriority } from '@/lib/recommendations';

export interface ScoutTaskDraft {
  vineyard_id: string;
  trigger_kind: ScoutTriggerKind;
  trigger_rec_id?: string | null;
  title: string;
  reason?: string | null;
  urgency: RecommendationPriority;
  confidence: RecommendationConfidence;
  check_points?: ScoutCheckPoint[] | null;
}

export interface ScoutTaskUpdate {
  status?: ScoutStatus;
  check_points?: ScoutCheckPoint[] | null;
  inspected_at?: string | null;
  outcome?: ScoutOutcome | null;
  action_taken?: string | null;
  resolution_notes?: string | null;
  photos?: ScoutPhoto[] | null;
  pins?: ScoutPin[] | null;
  observations?: ScoutObservations | null;
}

const DEMO_KEY = 'scout_tasks_demo_v1';

function nowIso(): string {
  return new Date().toISOString();
}

function genId(): string {
  return `scout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const [ScoutTasksProvider, useScoutTasks] = createContextHook(() => {
  const { user, isDemoMode } = useAuth();
  const queryClient = useQueryClient();
  const [demoTasks, setDemoTasks] = useState<DbScoutTask[]>([]);
  const [demoLoaded, setDemoLoaded] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DEMO_KEY);
        if (raw) setDemoTasks(JSON.parse(raw) as DbScoutTask[]);
      } catch (e) {
        console.log('[Scout] demo load error', e);
      } finally {
        setDemoLoaded(true);
      }
    })();
  }, []);

  const persistDemo = useCallback(async (list: DbScoutTask[]) => {
    try {
      await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(list));
    } catch (e) {
      console.log('[Scout] demo persist error', e);
    }
  }, []);

  const tasksQuery = useQuery({
    queryKey: ['scout_tasks', user?.id, isDemoMode ? 'demo' : 'live'],
    queryFn: async (): Promise<DbScoutTask[]> => {
      if (isDemoMode) return demoTasks;
      if (!user) return [];
      const { data, error } = await supabase
        .from('scout_tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.log('[Scout] fetch error', error.message);
        return [];
      }
      return (data ?? []) as DbScoutTask[];
    },
    enabled: (!!user || isDemoMode) && (!isDemoMode || demoLoaded),
    staleTime: 1000 * 60 * 2,
  });

  const createMutation = useMutation({
    mutationFn: async (draft: ScoutTaskDraft): Promise<DbScoutTask> => {
      if (isDemoMode) {
        const task: DbScoutTask = {
          id: genId(),
          vineyard_id: draft.vineyard_id,
          owner_id: 'demo-user-00000000-0000-0000-0000-000000000000',
          trigger_kind: draft.trigger_kind,
          trigger_rec_id: draft.trigger_rec_id ?? null,
          title: draft.title,
          reason: draft.reason ?? null,
          urgency: draft.urgency,
          confidence: draft.confidence,
          status: 'open',
          check_points: draft.check_points ?? null,
          inspected_at: null,
          outcome: null,
          action_taken: null,
          resolution_notes: null,
          photos: null,
          pins: null,
          observations: null,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        const next = [task, ...demoTasks];
        setDemoTasks(next);
        await persistDemo(next);
        return task;
      }
      if (!user) throw new Error('Not authenticated');
      const payload = {
        vineyard_id: draft.vineyard_id,
        owner_id: user.id,
        trigger_kind: draft.trigger_kind,
        trigger_rec_id: draft.trigger_rec_id ?? null,
        title: draft.title,
        reason: draft.reason ?? null,
        urgency: draft.urgency,
        confidence: draft.confidence,
        status: 'open' as ScoutStatus,
        check_points: draft.check_points ?? null,
      };
      const { data, error } = await supabase
        .from('scout_tasks')
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as DbScoutTask;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scout_tasks'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ScoutTaskUpdate }): Promise<DbScoutTask> => {
      if (isDemoMode) {
        const next = demoTasks.map((t) =>
          t.id === id ? { ...t, ...updates, updated_at: nowIso() } : t
        );
        setDemoTasks(next);
        await persistDemo(next);
        return next.find((t) => t.id === id) as DbScoutTask;
      }
      const { data, error } = await supabase
        .from('scout_tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as DbScoutTask;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scout_tasks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isDemoMode) {
        const next = demoTasks.filter((t) => t.id !== id);
        setDemoTasks(next);
        await persistDemo(next);
        return;
      }
      const { error } = await supabase.from('scout_tasks').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['scout_tasks'] });
    },
  });

  const tasks = useMemo(
    () => (isDemoMode ? demoTasks : tasksQuery.data ?? []),
    [tasksQuery.data, demoTasks, isDemoMode]
  );

  const createTask = useCallback(
    (draft: ScoutTaskDraft) => createMutation.mutateAsync(draft),
    [createMutation]
  );
  const updateTask = useCallback(
    (id: string, updates: ScoutTaskUpdate) => updateMutation.mutateAsync({ id, updates }),
    [updateMutation]
  );
  const deleteTask = useCallback((id: string) => deleteMutation.mutateAsync(id), [deleteMutation]);

  const findByRecId = useCallback(
    (recId: string) => tasks.find((t) => t.trigger_rec_id === recId) ?? null,
    [tasks]
  );

  const getByVineyard = useCallback(
    (vineyardId: string) => tasks.filter((t) => t.vineyard_id === vineyardId),
    [tasks]
  );

  const openCount = useMemo(
    () => tasks.filter((t) => t.status === 'open' || t.status === 'in_progress').length,
    [tasks]
  );

  return useMemo(
    () => ({
      tasks,
      openCount,
      isLoading: tasksQuery.isLoading,
      createTask,
      updateTask,
      deleteTask,
      findByRecId,
      getByVineyard,
      isCreating: createMutation.isPending,
      isUpdating: updateMutation.isPending,
    }),
    [
      tasks,
      openCount,
      tasksQuery.isLoading,
      createTask,
      updateTask,
      deleteTask,
      findByRecId,
      getByVineyard,
      createMutation.isPending,
      updateMutation.isPending,
    ]
  );
});
