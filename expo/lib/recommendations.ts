import type { WeatherForecast } from '@/lib/weather';
import type { DbVineyard } from '@/providers/VineyardProvider';
import { isStale, type DataTrust } from '@/lib/dataTrust';
import { computeIrrigation, toRecommendation as irrigationToRec } from '@/lib/irrigation';
import { assessSpray, assessFrost, assessDisease } from '@/lib/weatherDecisions';
import {
  getSprayDecisionGrade,
  getFrostDecisionGrade,
  getDiseaseDecisionGrade,
} from '@/lib/decisionGrade';
import type { DbScoutTask, ScoutTriggerKind } from '@/lib/scoutTasks';
import { triggerFromKind } from '@/lib/scoutTasks';
import { summarizeBlockHistory, priorityBoostForTrigger } from '@/lib/blockHistory';

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

export type RecommendationGrade =
  | 'operational'
  | 'advisory'
  | 'inspect'
  | 'monitor'
  | 'info'
  | 'insufficient-data';

export interface RecommendationInput {
  label: string;
  value: string;
  freshness?: string;
  impact?: 'positive' | 'negative' | 'neutral';
}

export interface Recommendation {
  id: string;
  kind: RecommendationKind;
  priority: RecommendationPriority;
  confidence: RecommendationConfidence;
  grade: RecommendationGrade;
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
  logicSummary?: string;
  inputs?: RecommendationInput[];
  freshnessNote?: string;
}

export function gradeLabel(g: RecommendationGrade): string {
  switch (g) {
    case 'operational':
      return 'Operational';
    case 'advisory':
      return 'Advisory';
    case 'inspect':
      return 'Inspect';
    case 'monitor':
      return 'Monitor only';
    case 'info':
      return 'Info';
    case 'insufficient-data':
      return 'Insufficient data';
  }
}

export function gradeDescription(g: RecommendationGrade): string {
  switch (g) {
    case 'operational':
      return 'Supported by fresh, site-specific, configured inputs — suitable for an operational decision.';
    case 'advisory':
      return 'Based on forecast or derived inputs. Use alongside a field check before acting.';
    case 'inspect':
      return 'Signals suggest a field inspection before taking any operational action.';
    case 'monitor':
      return 'Conditions worth watching. No action recommended yet.';
    case 'info':
      return 'Informational — no action required.';
    case 'insufficient-data':
      return 'Not enough fresh or site-specific data for a confident recommendation.';
  }
}

function inferGrade(
  confidence: RecommendationConfidence,
  kind: RecommendationKind,
  priority: RecommendationPriority,
  usedObserved: boolean
): RecommendationGrade {
  if (kind === 'stale-data' || kind === 'setup') return 'insufficient-data';
  if (confidence === 'low') {
    return priority === 'low' ? 'monitor' : 'advisory';
  }
  if (priority === 'low' && (kind === 'spray-ok' || kind === 'disease-risk' || kind === 'inspect')) {
    return 'monitor';
  }
  // Operational grade is never inferred here — it must come from an engine-specific
  // decision-grade gate (see lib/decisionGrade.ts).
  if (confidence === 'high' && usedObserved && (kind === 'drainage')) return 'operational';
  return 'advisory';
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

export function withGrade(rec: Recommendation, usedObserved: boolean = false): Recommendation {
  if (rec.grade) return rec;
  return { ...rec, grade: inferGrade(rec.confidence, rec.kind, rec.priority, usedObserved) };
}

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
  scoutTasks?: DbScoutTask[];
}

const URGENCY_ORDER: RecommendationPriority[] = ['low', 'medium', 'high', 'critical'];
function shiftUrgency(p: RecommendationPriority, delta: number): RecommendationPriority {
  const idx = URGENCY_ORDER.indexOf(p);
  const next = Math.max(0, Math.min(URGENCY_ORDER.length - 1, idx + delta));
  return URGENCY_ORDER[next];
}
const CONF_ORDER: RecommendationConfidence[] = ['low', 'medium', 'high'];
function shiftConfidence(c: RecommendationConfidence, delta: number): RecommendationConfidence {
  const idx = CONF_ORDER.indexOf(c);
  const steps = delta >= 0.2 ? 1 : delta <= -0.2 ? -1 : 0;
  const next = Math.max(0, Math.min(CONF_ORDER.length - 1, idx + steps));
  return CONF_ORDER[next];
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
      grade: 'insufficient-data',
      title: 'Add your first vineyard',
      reason: 'Recommendations become block-specific once a vineyard is added.',
      vineyardId: null,
      vineyardName: null,
      timestamp: now,
      action: { label: 'Add vineyard', route: '/add-field' },
      logicSummary: 'No blocks available — recommendation engine is idle until one is added.',
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
      const frostGate = getFrostDecisionGrade({
        forecast: f,
        current: f.current ?? null,
        vineyard: v,
        isDemo: input.isDemoMode,
        severity:
          frostA.status === 'critical'
            ? 'critical'
            : frostA.status === 'elevated'
            ? 'elevated'
            : frostA.status === 'watch'
            ? 'monitor'
            : 'none',
      });
      if (frostA.status === 'critical' || frostA.status === 'elevated') {
        out.push({
          id: `frost-${v.id}-${frostA.coldestNight?.date ?? 'na'}`,
          kind: 'frost-watch',
          priority: frostA.status === 'critical' ? 'critical' : 'high',
          confidence: frostGate.confidence,
          grade: frostGate.grade,
          title: `${frostA.headline} · ${v.name}`,
          reason: frostA.reasons.map((r) => r.label).join(' · ') || 'Overnight frost risk based on current forecast.',
          vineyardId: v.id,
          vineyardName: v.name,
          timestamp: frostA.coldestNight?.date ?? today?.date ?? now,
          action: { label: 'Open block', route: `/field-detail?id=${v.id}` },
          trustNote: 'Forecast-derived · advisory',
          logicSummary: 'Compares forecast overnight minimum to frost thresholds, adjusted for block frost flag, elevation and humidity.',
          inputs: frostA.reasons.map((r) => ({ label: r.label, value: '', impact: r.impact })),
          freshnessNote: f.fetchedAt ? `Forecast fetched ${f.fetchedAt}` : undefined,
        });
      } else if (frostA.status === 'watch') {
        out.push({
          id: `frost-watch-${v.id}-${frostA.coldestNight?.date ?? 'na'}`,
          kind: 'frost-watch',
          priority: 'medium',
          confidence: frostGate.confidence,
          grade: frostGate.grade === 'insufficient-data' ? 'insufficient-data' : 'monitor',
          title: `Frost watch · ${v.name}`,
          reason: frostA.reasons.map((r) => r.label).join(' · ') || 'Monitor overnight temperatures based on current forecast.',
          vineyardId: v.id,
          vineyardName: v.name,
          timestamp: frostA.coldestNight?.date ?? today?.date ?? now,
          trustNote: 'Forecast-derived · advisory',
          logicSummary: 'Overnight minimum is close to watch threshold. Not yet indicative of damage risk.',
          inputs: frostA.reasons.map((r) => ({ label: r.label, value: '', impact: r.impact })),
        });
      }

      // Heat stress
      if (today && today.tMax >= t.heatTempC) {
        out.push({
          id: `heat-${v.id}-${today.date}`,
          kind: 'heat-watch',
          priority: 'high',
          confidence: 'medium',
          grade: 'advisory',
          title: `Elevated heat exposure · ${v.name}`,
          reason: `Forecast high ${today.tMax.toFixed(1)}°C. Based on current forecast — consider pre-irrigation and avoid midday canopy work.`,
          vineyardId: v.id,
          vineyardName: v.name,
          timestamp: today.date,
          action: { label: 'Open block', route: `/field-detail?id=${v.id}` },
          trustNote: 'Open-Meteo forecast · advisory',
          logicSummary: 'Compares forecast daily maximum to the heat threshold set in preferences.',
          inputs: [
            { label: 'Forecast max', value: `${today.tMax.toFixed(1)}°C`, impact: 'negative' },
            { label: 'Heat threshold', value: `${t.heatTempC}°C` },
          ],
        });
      }

      // Spray suitability
      if (today) {
        const sprayA = assessSpray(f, { isDemo: input.isDemoMode });
        const sprayGate = getSprayDecisionGrade({
          forecast: f,
          current: f.current ?? null,
          isDemo: input.isDemoMode,
          severity:
            sprayA.status === 'not-suitable'
              ? 'elevated'
              : sprayA.status === 'caution'
              ? 'inspect'
              : sprayA.status === 'suitable'
              ? 'monitor'
              : 'none',
        });
        if (sprayA.status === 'not-suitable') {
          out.push({
            id: `avoid-spray-${v.id}-${today.date}`,
            kind: 'avoid-spray',
            priority: 'high',
            confidence: sprayGate.confidence,
            grade: sprayGate.grade,
            logicSummary: 'Spray window scored against wind, rain likelihood and temperature thresholds.',
            inputs: sprayA.reasons.map((r) => ({ label: r.label, value: '', impact: r.impact })),
            title: `Not suitable for spraying · ${v.name}`,
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
            confidence: sprayGate.confidence,
            grade: sprayGate.grade === 'operational' ? 'advisory' : sprayGate.grade,
            logicSummary: 'Marginal conditions on at least one spray parameter — treat as cautionary.',
            inputs: sprayA.reasons.map((r) => ({ label: r.label, value: '', impact: r.impact })),
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
            confidence: sprayGate.confidence,
            grade: sprayGate.grade === 'insufficient-data' ? 'insufficient-data' : 'monitor',
            logicSummary: 'All spray parameters currently within suitable ranges. Check field conditions before starting.',
            inputs: sprayA.reasons.map((r) => ({ label: r.label, value: '', impact: r.impact })),
            title: `Spray window looks suitable · ${v.name}`,
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
      const diseaseGate = getDiseaseDecisionGrade({
        forecast: f,
        current: f.current ?? null,
        vineyard: v,
        isDemo: input.isDemoMode,
        severity:
          diseaseA.status === 'inspect'
            ? 'inspect'
            : diseaseA.status === 'elevated'
            ? 'elevated'
            : diseaseA.status === 'monitor'
            ? 'monitor'
            : 'none',
      });
      if (diseaseA.status === 'inspect' || diseaseA.status === 'elevated') {
        out.push({
          id: `disease-${v.id}`,
          kind: 'disease-risk',
          priority: diseaseA.status === 'inspect' ? 'high' : 'medium',
          confidence: diseaseGate.confidence,
          grade: diseaseGate.grade,
          title: diseaseA.status === 'inspect' ? `Recommended inspection for disease · ${v.name}` : `Elevated disease-supportive conditions · ${v.name}`,
          reason: diseaseA.reasons.map((r) => r.label).join(' · ') || 'Conditions support canopy disease pressure.',
          vineyardId: v.id,
          vineyardName: v.name,
          timestamp: now,
          action: { label: 'Open block', route: `/field-detail?id=${v.id}` },
          trustNote: 'Generic disease-supportive proxy · advisory',
          logicSummary: 'Heuristic score from wet days, mild temperatures, humidity and block disease flag. Not a pathogen-specific model.',
          inputs: diseaseA.reasons.map((r) => ({ label: r.label, value: '', impact: r.impact })),
        });
      } else if (diseaseA.status === 'monitor' && next3.length > 0) {
        out.push({
          id: `disease-monitor-${v.id}`,
          kind: 'disease-risk',
          priority: 'low',
          confidence: diseaseGate.confidence,
          grade: diseaseGate.grade === 'insufficient-data' ? 'insufficient-data' : 'monitor',
          title: `Monitor disease conditions · ${v.name}`,
          reason: diseaseA.reasons.map((r) => r.label).join(' · ') || 'Keep an eye on canopy conditions this week.',
          vineyardId: v.id,
          vineyardName: v.name,
          timestamp: now,
          trustNote: 'Generic disease-supportive proxy · advisory',
          logicSummary: 'Conditions are marginal. Not yet at inspection threshold.',
          inputs: diseaseA.reasons.map((r) => ({ label: r.label, value: '', impact: r.impact })),
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
          grade: 'advisory',
          title: `Recommended drainage check · ${v.name}`,
          reason: `${heavy.precipitation.toFixed(0)}mm expected ${heavy.date}. Block is flagged for waterlogging — recommended inspection ahead of the rain event.`,
          vineyardId: v.id,
          vineyardName: v.name,
          timestamp: heavy.date,
          logicSummary: 'Forecast daily rainfall above the drainage threshold combined with block waterlogging flag.',
          inputs: [
            { label: 'Forecast rainfall', value: `${heavy.precipitation.toFixed(0)}mm on ${heavy.date}`, impact: 'negative' },
            { label: 'Waterlogging flag', value: 'Enabled for this block', impact: 'negative' },
          ],
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
          grade: 'insufficient-data',
          title: `Probe data is stale · ${p.name}`,
          reason: `No recent reading from ${p.name}. Confidence reduced due to stale probe data — field conditions may have changed.`,
          vineyardId: v.id,
          vineyardName: v.name,
          timestamp: p.last_reading,
          action: { label: 'Open probe', route: `/probe-detail?id=${p.id}` },
          logicSummary: 'Probe last reported outside the expected freshness window.',
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
            grade: 'operational',
            title: `Soil trending wet · ${v.name}`,
            reason: `${p.name} at ${p.moisture.toFixed(0)}% (above ${t.highMoisturePct}%). Recommended inspection of drainage and holding irrigation.`,
            vineyardId: v.id,
            vineyardName: v.name,
            timestamp: p.last_reading,
            trustNote: 'Observed · soil probe',
            logicSummary: 'Fresh probe reading exceeds the high-moisture threshold.',
            inputs: [
              { label: 'Probe moisture', value: `${p.moisture.toFixed(0)}%`, impact: 'negative' },
              { label: 'High-moisture threshold', value: `${t.highMoisturePct}%` },
            ],
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
        grade: 'advisory',
        title: `Recommended inspection · ${v.name}`,
        reason: 'No fresh probe data and last satellite scan is stale. Confidence reduced due to stale inputs — ground-truth the block.',
        vineyardId: v.id,
        vineyardName: v.name,
        timestamp: now,
        action: { label: 'Open block', route: `/field-detail?id=${v.id}` },
        logicSummary: 'Both remote inputs (probe and satellite) are outside the freshness window.',
      });
    }

    if (v.low_vigor_history && vineyardProbes.length === 0) {
      out.push({
        id: `lowvigor-${v.id}`,
        kind: 'inspect',
        priority: 'low',
        confidence: 'low',
        grade: 'monitor',
        title: `Monitor ${v.name} for low-vigor signals`,
        reason: 'Block has low-vigor history. Consider adding a soil probe for targeted decisions.',
        vineyardId: v.id,
        vineyardName: v.name,
        timestamp: now,
        logicSummary: 'Historical flag only — no current signal. Kept as a long-term watch item.',
      });
    }
  }

  // In demo mode, reduce confidence of forecast-derived items
  if (input.isDemoMode) {
    return sortRecommendations(
      out.map((r) =>
        r.kind === 'irrigate' || r.kind === 'drainage'
          ? r
          : {
              ...r,
              confidence: 'low',
              grade: 'advisory',
              trustNote: 'Demo data — advisory only',
            }
      )
    );
  }

  const tasksByVineyard = new Map<string, DbScoutTask[]>();
  for (const task of input.scoutTasks ?? []) {
    const list = tasksByVineyard.get(task.vineyard_id) ?? [];
    list.push(task);
    tasksByVineyard.set(task.vineyard_id, list);
  }

  const adjusted = out.map((rec) => {
    if (!rec.vineyardId) return rec;
    const vineyardTasks = tasksByVineyard.get(rec.vineyardId);
    if (!vineyardTasks || vineyardTasks.length < 2) return rec;
    const summary = summarizeBlockHistory(vineyardTasks);
    const trigger: ScoutTriggerKind = triggerFromKind(rec.kind);
    const boost = priorityBoostForTrigger(summary, trigger);
    if (!boost.note && !boost.followUpNote) return rec;
    const combinedNote = [boost.note, boost.followUpNote].filter(Boolean).join(' · ');
    return {
      ...rec,
      priority: shiftUrgency(rec.priority, boost.urgencyBoost),
      confidence: shiftConfidence(rec.confidence, boost.confidenceBoost),
      trustNote: combinedNote || rec.trustNote,
      reason: combinedNote ? `${rec.reason} · ${combinedNote}` : rec.reason,
    };
  });

  return sortRecommendations(adjusted);
}

export function summarizeVerifiedTrust(trust: DataTrust | null | undefined): boolean {
  if (!trust) return false;
  return trust.isDecisionGrade;
}
