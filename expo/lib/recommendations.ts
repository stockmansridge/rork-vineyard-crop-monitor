import type { WeatherForecast } from '@/lib/weather';
import type { DbVineyard } from '@/providers/VineyardProvider';
import { isStale, type DataTrust } from '@/lib/dataTrust';
import { computeIrrigation, toRecommendation as irrigationToRec } from '@/lib/irrigation';
import { assessSpray, assessFrost, assessDisease } from '@/lib/weatherDecisions';

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

      // Frost (block-aware)
      const frostA = assessFrost(f, v, {
        frostTempC: t.frostTempC,
        isDemo: input.isDemoMode,
        currentHumidity: f.current?.humidity ?? null,
      });
      if (frostA.status === 'critical' || frostA.status === 'elevated') {
        out.push({
          id: `frost-${v.id}-${frostA.coldestNight?.date ?? 'na'}`,
          kind: 'frost-watch',
          priority: frostA.status === 'critical' ? 'critical' : 'high',
          confidence: frostA.confidence,
          title: `${frostA.headline} · ${v.name}`,
          reason: frostA.reasons.map((r) => r.label).join(' · ') || 'Overnight frost risk.',
          vineyardId: v.id,
          vineyardName: v.name,
          timestamp: frostA.coldestNight?.date ?? today?.date ?? now,
          action: { label: 'Open block', route: `/field-detail?id=${v.id}` },
          trustNote: 'Forecast-derived · advisory',
        });
      } else if (frostA.status === 'watch') {
        out.push({
          id: `frost-watch-${v.id}-${frostA.coldestNight?.date ?? 'na'}`,
          kind: 'frost-watch',
          priority: 'medium',
          confidence: frostA.confidence,
          title: `Frost watch · ${v.name}`,
          reason: frostA.reasons.map((r) => r.label).join(' · '),
          vineyardId: v.id,
          vineyardName: v.name,
          timestamp: frostA.coldestNight?.date ?? today?.date ?? now,
          trustNote: 'Forecast-derived · advisory',
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

      // Spray suitability
      if (today) {
        const sprayA = assessSpray(f, { isDemo: input.isDemoMode });
        if (sprayA.status === 'not-suitable') {
          out.push({
            id: `avoid-spray-${v.id}-${today.date}`,
            kind: 'avoid-spray',
            priority: 'high',
            confidence: sprayA.confidence,
            title: `Avoid spraying today · ${v.name}`,
            reason:
              sprayA.reasons
                .filter((r) => r.impact === 'negative')
                .map((r) => r.label)
                .join(' · ') +
              (sprayA.nextWindow ? ` · Next window ${sprayA.nextWindow.label}` : ''),
            vineyardId: v.id,
            vineyardName: v.name,
            timestamp: today.date,
            trustNote: 'Forecast-derived · advisory',
          });
        } else if (sprayA.status === 'caution') {
          out.push({
            id: `spray-caution-${v.id}-${today.date}`,
            kind: 'avoid-spray',
            priority: 'medium',
            confidence: sprayA.confidence,
            title: `Spray with caution · ${v.name}`,
            reason: sprayA.reasons.map((r) => r.label).join(' · '),
            vineyardId: v.id,
            vineyardName: v.name,
            timestamp: today.date,
            trustNote: 'Forecast-derived · advisory',
          });
        } else if (sprayA.status === 'suitable') {
          out.push({
            id: `spray-ok-${v.id}-${today.date}`,
            kind: 'spray-ok',
            priority: 'low',
            confidence: sprayA.confidence,
            title: `Good spray window · ${v.name}`,
            reason: sprayA.reasons
              .filter((r) => r.impact === 'positive')
              .map((r) => r.label)
              .join(' · '),
            vineyardId: v.id,
            vineyardName: v.name,
            timestamp: today.date,
            trustNote: 'Forecast-derived · advisory',
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

      // Disease-supportive conditions
      const diseaseA = assessDisease(f, v, f.current ?? null, { isDemo: input.isDemoMode });
      if (diseaseA.status === 'inspect' || diseaseA.status === 'elevated') {
        out.push({
          id: `disease-${v.id}`,
          kind: 'disease-risk',
          priority: diseaseA.status === 'inspect' ? 'high' : 'medium',
          confidence: diseaseA.confidence,
          title: `${diseaseA.headline} · ${v.name}`,
          reason: diseaseA.reasons.map((r) => r.label).join(' · '),
          vineyardId: v.id,
          vineyardName: v.name,
          timestamp: now,
          action: { label: 'Open block', route: `/field-detail?id=${v.id}` },
          trustNote: 'Generic disease-supportive proxy · advisory',
        });
      } else if (diseaseA.status === 'monitor' && next3.length > 0) {
        out.push({
          id: `disease-monitor-${v.id}`,
          kind: 'disease-risk',
          priority: 'low',
          confidence: diseaseA.confidence,
          title: `Monitor disease conditions · ${v.name}`,
          reason: diseaseA.reasons.map((r) => r.label).join(' · '),
          vineyardId: v.id,
          vineyardName: v.name,
          timestamp: now,
          trustNote: 'Generic disease-supportive proxy · advisory',
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
