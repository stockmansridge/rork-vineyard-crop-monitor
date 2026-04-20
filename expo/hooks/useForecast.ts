import { useQuery } from '@tanstack/react-query';
import { fetchForecast, WeatherForecast } from '@/lib/weather';

export function useForecast(
  latitude: number | null | undefined,
  longitude: number | null | undefined
) {
  return useQuery<WeatherForecast>({
    queryKey: ['weather-forecast', latitude, longitude],
    queryFn: () => {
      if (latitude == null || longitude == null) {
        throw new Error('Missing coordinates');
      }
      return fetchForecast(latitude, longitude);
    },
    enabled: latitude != null && longitude != null,
    staleTime: 1000 * 60 * 30,
  });
}
