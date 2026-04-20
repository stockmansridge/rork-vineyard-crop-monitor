import { useQuery } from '@tanstack/react-query';
import { searchLatestScene, PolygonPoint, PlanetScene } from '@/lib/planet';

export function usePlanetScene(polygon: PolygonPoint[] | null | undefined) {
  const enabled = !!polygon && polygon.length >= 3 && !!process.env.EXPO_PUBLIC_PLANET_API_KEY;
  const key = polygon
    ?.map((p) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`)
    .join('|');

  return useQuery<PlanetScene | null>({
    queryKey: ['planet-scene', key],
    queryFn: async () => {
      if (!polygon) return null;
      return searchLatestScene(polygon, { maxCloudCover: 0.3 });
    },
    enabled,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
}
