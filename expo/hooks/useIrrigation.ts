import { useMemo } from 'react';
import { useWeather } from '@/hooks/useWeather';
import { useForecast } from '@/hooks/useForecast';
import { computeIrrigation, type IrrigationRecommendation } from '@/lib/irrigation';
import type { DbVineyard } from '@/providers/VineyardProvider';
import { useAlerts } from '@/providers/AlertsProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useProbeReadings } from '@/providers/ProbeReadingsProvider';
import type { ProbeReadingPoint } from '@/lib/irrigationCalibration';

export function useIrrigation(vineyard: DbVineyard | null | undefined): {
  recommendation: IrrigationRecommendation | null;
  isLoading: boolean;
} {
  const season = useWeather(vineyard?.latitude, vineyard?.longitude);
  const forecast = useForecast(vineyard?.latitude, vineyard?.longitude);
  const { probes } = useAlerts();
  const { readings } = useProbeReadings();
  const { isDemoMode } = useAuth();

  const recommendation = useMemo<IrrigationRecommendation | null>(() => {
    if (!vineyard) return null;
    const vineyardProbes = probes.filter((p) => p.vineyard_id === vineyard.id);
    const freshest = vineyardProbes
      .filter((p) => p.moisture != null)
      .sort((a, b) => (a.last_reading < b.last_reading ? 1 : -1))[0];

    const probeIds = new Set(vineyardProbes.map((p) => p.id));
    const history: ProbeReadingPoint[] = readings
      .filter((r) => probeIds.has(r.probe_id) && r.moisture != null)
      .map((r) => ({
        observedAt: r.recorded_at,
        moisturePct: r.moisture as number,
      }));

    return computeIrrigation({
      vineyard,
      season: season.data ?? null,
      forecast: forecast.data ?? null,
      probeMoisturePct: freshest?.moisture ?? null,
      probeObservedAt: freshest?.last_reading ?? null,
      probeHistory: history,
      isDemoMode,
    });
  }, [vineyard, season.data, forecast.data, probes, readings, isDemoMode]);

  return {
    recommendation,
    isLoading: season.isLoading || forecast.isLoading,
  };
}
