import { useMemo } from 'react';
import type { DbVineyard } from '@/providers/VineyardProvider';
import { useBlockSeasons } from '@/providers/BlockSeasonsProvider';
import { useIndexReadings } from '@/providers/IndexReadingsProvider';
import { computeBlockReadiness, type BlockReadinessSnapshot } from '@/lib/blockReadiness';

export function useBlockReadiness(
  vineyard: DbVineyard | null | undefined
): BlockReadinessSnapshot | null {
  const { getVineyardSeasons } = useBlockSeasons();
  const { readings } = useIndexReadings();

  return useMemo(() => {
    if (!vineyard) return null;
    const seasons = getVineyardSeasons(vineyard.id).sort((a, b) => b.season - a.season);
    return computeBlockReadiness({
      vineyard,
      seasons,
      indexReadings: readings,
    });
  }, [vineyard, getVineyardSeasons, readings]);
}
