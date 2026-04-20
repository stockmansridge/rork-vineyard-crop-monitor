import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSentinel2NdviSeries, NdviSample, type IndexKind } from '@/lib/ndvi';
import { PolygonPoint } from '@/lib/planet';
import { useIndexReadings, type IndexType } from '@/providers/IndexReadingsProvider';
import { useAuth } from '@/providers/AuthProvider';

export function useNdviSeries(
  vineyardId: string | null | undefined,
  polygon: PolygonPoint[] | null | undefined,
  monthsBack: number = 6,
  kind: IndexKind = 'NDVI'
) {
  const { isDemoMode } = useAuth();
  const { addReading, getVineyardReadings } = useIndexReadings();

  const polyKey = polygon
    ?.map((p) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`)
    .join('|');

  const query = useQuery<NdviSample[]>({
    queryKey: ['ndvi-series', vineyardId, polyKey, monthsBack, kind],
    queryFn: async () => {
      if (!polygon || polygon.length < 3) return [];
      const samples = await fetchSentinel2NdviSeries(polygon, monthsBack, kind);
      return samples;
    },
    enabled: !!polygon && polygon.length >= 3,
    staleTime: 1000 * 60 * 60 * 12,
    retry: 1,
  });

  const addReadingRef = useRef(addReading);
  addReadingRef.current = addReading;
  const lastPersistedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (isDemoMode) return;
    if (!vineyardId) return;
    if (!query.data || query.data.length === 0) return;
    const key = `${vineyardId}:${kind}:${query.data.map((s) => s.acquiredAt).join(',')}`;
    if (lastPersistedKeyRef.current === key) return;
    lastPersistedKeyRef.current = key;
    void addReadingRef.current(vineyardId, query.data, kind as IndexType);
  }, [query.data, vineyardId, isDemoMode, kind]);

  const stored = useMemo(
    () => (vineyardId ? getVineyardReadings(vineyardId, kind as IndexType) : []),
    [vineyardId, getVineyardReadings, kind]
  );

  const combined = useMemo<NdviSample[]>(() => {
    const map = new Map<string, NdviSample>();
    for (const s of stored) {
      map.set(s.acquired_at, {
        acquiredAt: s.acquired_at,
        value: Number(s.value),
        source: (s.source as 'sentinel-2' | 'planet') ?? 'sentinel-2',
        sceneId: s.scene_id ?? undefined,
        cloudCover: s.cloud_cover ?? undefined,
      });
    }
    for (const s of query.data ?? []) {
      map.set(s.acquiredAt, s);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.acquiredAt < b.acquiredAt ? -1 : 1
    );
  }, [stored, query.data]);

  return {
    samples: combined,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}
