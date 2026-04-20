import type { WeatherForecast } from '@/lib/weather';
import type { DbVineyard } from '@/providers/VineyardProvider';
import { isStale, type DataTrust } from '@/lib/dataTrust';
import { computeIrrigation, toRecommendation as irrigationToRec } from '@/lib/irrigation';

export type RecommendationKind =
  | 'inspect'
  | 'avoid-spray'
  | 'spray-ok'
  | 'frost-watch'
  | 'heat-watch'
  | 'irrigate'
  | 'hold-irrigation'
  | 'disease-risk'
  | 'drainage'
  | 'stale-data'
  | 'setup';

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

export type RecommendationConfidence = 'high' | 'medium' | 'low';

export interface Recommendation {
  id: string;
  kind: RecommendationKind;
  priority: RecommendationPriority;
  confidence: RecommendationConfidence;
  title: string;
  reason: string;
  vineyardId: string | null;
  vineyardName: string | null;
  timestamp: string;
  action?: {
    label: string;
    route?: string;
  };
  trustNote?: string;
}

export interface ProbeSnapshot {
  id: string;
  name: string;
  vineyard_id: string | null;
  moisture: number | null;
  temperature: number | null;
  ph: number | null;
  last_reading: string;
  is_online: boolean;
  battery_level: number | null;
}

export interface RecommendationThresholds {
  frostTempC: number;
  heatTempC: number;
  windSprayMaxKmh: number;
  rainHoldMm: number;
  lowMoisturePct: number;
  highMoisturePct: number;
}

export const DEFAULT_REC_THRESHOLDS: RecommendationThresholds = {
  frostTempC: 2,
  heatTempC: 33,
  windSprayMaxKmh: 20,
  rainHoldMm: 3,
  lowMoisturePct: 20,
  highMoisturePct: 45,
};

const priorityOrder: Record<RecommendationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function sortRecommendations(list: Recommendation[]): Recommendation[] {
  return [...list].sort((a, b) => {
    const p = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (p !== 0) return p;
    return a.timestamp < b.timestamp ? 1 : -1;
  });
}

export interface ComputeRecommendationsInput {
  vineyards: DbVineyard[];
  forecasts: Record<string, WeatherForecast>;
  probes: ProbeSnapshot[];
  thresholds?: RecommendationThresholds;
  isDemoMode: boolean;
}

export function computeRecommendations(
  input: ComputeRecommendationsInput
): Recommendation[] {
  const t = input.thresholds ?? DEFAULT_REC_THRESHOLDS;
  const out: Recommendation[] = [];
  const now = new Date().toISOString();

  if (input.vineyards.length === 0) {
    out.push({
      id: 'setup-add-vineyard',
      kind: 'setup',
      priority: 'medium',
      confidence: 'high',
      title: 'Add your first vineyard',
      reason: 'Recommendations become block-specific once a vineyard is added.',
      vineyardId: null,
      vineyardName: null,
      timestamp: now,
      action: { label: 'Add vineyard', route: '/add-field' },
    });
    return out;
  }

  for (const v of input.vineyards) {
    const f = input.forecasts[v.id];
    const vineyardProbes = input.probes.filter((p) => p.vineyard_id === v.id);

    // Forecast-driven recommendations
    if (f) {
      const today = f.days[0];
      const tomorrow = f.days[1];
      const next3 = f.days.slice(0, 3);

      // Frost overnight
      if (today && today.tMin <= t.frostTempC) {
        out.push({
          id: `frost-${v.id}-${today.date}`,
          kind: 'frost-watch',
          priority: 'critical',
          confidence: 'high',
          title: `Frost watch tonight · ${v.name}`,
          reason: `Forecast low ${today.tMin.toFixed(1)}°C. Prepare frost protection before dusk.`,
          vineyardId: v.id,
          vineyardName: v.name,
          timestamp: today.date,
          action: { label: 'Open block', route: `/field-detail?id=${v.id}` },
          trustNote: 'Open-Meteo forecast · advisory',
        });
      } else if (tomorrow && tomorrow.tMin <= t.frostTempC + 1) {
        out.push({
          id: `frost-soon-${v.id}-${tomorrow.date}`,
          kind: 'frost-watch',
          priority: 'high',
          confidence: 'medium',
          title: `Frost risk approaching · ${v.name}`,
          reason: `Forecast low ${tomorrow.tMin.toFixed(1)}°C on ${tomorrow.date}.`,
          vineyardId: v.id,
          vineyardName: v.name,
          timestamp: tomorrow.date,
          trustNote: 'Open-Meteo forecast · advisory',
        });
      }

      // Heat stress
      if (today && today.tMax >= t.heatTempC) {
        out.push({
          id: `heat-${v.id}-${today.date}`,
          kind: 'heat-watch',
          priority: 'high',
          confidence: 'medium',
          title: `Heat stress risk · ${v.name}`,
          reason: `Forecast high ${today.tMax.toFixed(1)}°C. Consider pre-irrigation and avoid midday canopy work.`,
          vineyardId: v.id,
          vineyardName: v.name,
          timestamp: today.date,
          action: { label: 'Open block', route: `/field-detail?id=${v.id}` },
          trustNote: 'Open-Meteo forecast · advisory',
        });
      }

      // Spray window (today)
      if (today) {
        const windy = today.windSpeedMax >= t.windSprayMaxKmh;
        const rainSoon = today.precipitation >= t.rainHoldMm || today.precipProbability >= 60;
        if (windy || rainSoon) {
          const reasons: string[] = [];
          if (windy) reasons.push(`winds ${today.windSpeedMax.toFixed(0)} km/h`);
          if (rainSoon) reasons.push(`${today.precipitation.toFixed(0)}mm rain likely (${today.precipProbability}%)`);
          out.push({
            id: `avoid-spray-${v.id}-${today.date}`,
            kind: 'avoid-spray',
            priority: 'high',
            confidence: 'medium',
            title: `Avoid spraying today · ${v.name}`,
            reason: `Poor spray conditions: ${reasons.join(' · ')}.`,
            vineyardId: v.id,
            vineyardName: v.name,
            timestamp: today.date,
            trustNote: 'Open-Meteo forecast · advisory',
          });
        } else if (today.windSpeedMax < 12 && today.precipProbability < 20) {
          out.push({
            id: `spray-ok-${v.id}-${today.date}`,
            kind: 'spray-ok',
            priority: 'low',
            confidence: 'medium',
            title: `Good spray window · ${v.name}`,
            reason: `Low wind (${today.windSpeedMax.toFixed(0)} km/h) and dry conditions today.`,
            vineyardId: v.id,
            vineyardName: v.name,
            timestamp: today.date,
            trustNote: 'Open-Meteo forecast · advisory',
          });
        }
      }

      // Irrigation water balance (forecast-only; block-level detail uses season data)
      const freshestProbe = vineyardProbes
        .filter((p) => p.moisture != null && !isStale('probe', p.last_reading))
        .sort((a, b) => (a.last_reading < b.last_reading ? 1 : -1))[0];
      const irr = computeIrrigation({
        vineyard: v,
        season: null,
        forecast: f,
        probeMoisturePct: freshestProbe?.moisture ?? null,
        probeObservedAt: freshestProbe?.last_reading ?? null,
        isDemoMode: input.isDemoMode,
      });
      const irrRec = irrigationToRec(irr);
      if (irrRec) out.push(irrRec);

      // Powdery mildew risk
      const wet = next3.filter((d) => d.precipitation >= 2 || d.precipProbability >= 60).length;
      const warm = next3.filter((d) => d.tMax >= 20 && d.tMax <= 30).length;
      if (wet >= 2 && warm >= 2 && v.disease_prone !== false) {
        out.push({
          id: `pm-${v.id}`,
          kind: 'disease-risk',
          priority: v.disease_prone ? 'high' : 'medium',
          confidence: 'medium',
          title: `Powdery mildew pressure · ${v.name}`,
          reason: `Warm, wet 3-day window forecast.${v.disease_prone ? ' This block is flagged disease-prone.' : ''}`,
          vineyardId: v.id,
          vineyardName: v.name,
          timestamp: now,
          action: { label: 'Open block', route: `/field-detail?id=${v.id}` },
          trustNote: 'Forecast-derived pressure index · advisory',
        });
      }

      // Heavy rain + waterlogging
      const heavy = next3.find((d) => d.precipitation >= 25);
      if (heavy && v.waterlogging_risk) {
        out.push({
          id: `drain-${v.id}-${heavy.date}`,
          kind: 'drainage',
          priority: 'high',
          confidence: 'medium',
          title: `Check drainage · ${v.name}`,
          reason: `${heavy.precipitation.toFixed(0)}mm expected ${heavy.date}. Block is flagged for waterlogging.`,
          vineyardId: v.id,
          vineyardName: v.name,
          timestamp: heavy.date,
        });
      }
    }

    // Probe-driven recommendations (wet/drainage + stale)
    let freshMoistureSeen = false;
    for (const p of vineyardProbes) {
      const stale = isStale('probe', p.last_reading);
      if (stale) {
        out.push({
          id: `stale-${p.id}`,
          kind: 'stale-data',
          priority: 'low',
          confidence: 'low',
          title: `Probe data stale · ${p.name}`,
          reason: `No recent reading from ${p.name}. Field conditions may have changed.`,
          vineyardId: v.id,
          vineyardName: v.name,
          timestamp: p.last_reading,
          action: { label: 'Open probe', route: `/probe-detail?id=${p.id}` },
        });
        continue;
      }
      if (p.moisture != null) {
        freshMoistureSeen = true;
        if (p.moisture > t.highMoisturePct) {
          out.push({
            id: `wet-${p.id}`,
            kind: 'drainage',
            priority: 'medium',
            confidence: 'high',
            title: `Wet soil · ${v.name}`,
            reason: `${p.name} at ${p.moisture.toFixed(0)}% (above ${t.highMoisturePct}%). Check drainage and hold irrigation.`,
            vineyardId: v.id,
            vineyardName: v.name,
            timestamp: p.last_reading,
            trustNote: 'Observed · soil probe',
          });
        }
      }
    }

    // Scout recommendation when canopy signals lag
    const lastScanStale = isStale('satellite', v.last_scan);
    if (lastScanStale && vineyardProbes.length === 0 && !freshMoistureSeen) {
      out.push({
        id: `scout-${v.id}`,
        kind: 'inspect',
        priority: 'medium',
        confidence: 'low',
        title: `Scout ${v.name} in person`,
        reason: 'No fresh probe data and last satellite scan is stale. Ground-truth the block.',
        vineyardId: v.id,
        vineyardName: v.name,
        timestamp: now,
        action: { label: 'Open block', route: `/field-detail?id=${v.id}` },
      });
    }

    if (v.low_vigor_history && vineyardProbes.length === 0) {
      out.push({
        id: `lowvigor-${v.id}`,
        kind: 'inspect',
        priority: 'low',
        confidence: 'low',
        title: `Watch ${v.name} for low-vigor signals`,
        reason: 'Block has low-vigor history. Consider adding a soil probe for targeted decisions.',
        vineyardId: v.id,
        vineyardName: v.name,
        timestamp: now,
      });
    }
  }

  // In demo mode, reduce confidence of forecast-derived items
  if (input.isDemoMode) {
    return sortRecommendations(
      out.map((r) =>
        r.kind === 'irrigate' || r.kind === 'drainage'
          ? r
          : { ...r, confidence: 'low', trustNote: 'Demo data — not decision grade' }
      )
    );
  }

  return sortRecommendations(out);
}

export function summarizeVerifiedTrust(trust: DataTrust | null | undefined): boolean {
  if (!trust) return false;
  return trust.isDecisionGrade;
}
