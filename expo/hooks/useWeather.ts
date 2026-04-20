import { useQuery } from '@tanstack/react-query';
import { fetchSeasonWeather, WeatherSeason } from '@/lib/weather';
import { useWeatherStation } from '@/providers/WeatherStationProvider';

export function useWeather(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  baseTemp: number = 10
) {
  const { station, apiKey } = useWeatherStation();

  return useQuery<WeatherSeason>({
    queryKey: [
      'weather',
      latitude,
      longitude,
      baseTemp,
      station?.stationId ?? null,
    ],
    queryFn: () => {
      if (latitude == null || longitude == null) {
        throw new Error('Missing coordinates');
      }
      return fetchSeasonWeather(latitude, longitude, baseTemp, {
        stationId: station?.stationId ?? null,
        apiKey,
      });
    },
    enabled: latitude != null && longitude != null,
    staleTime: 1000 * 60 * 60,
  });
}
