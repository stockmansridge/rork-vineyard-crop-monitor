import type { NdviSample } from '@/lib/ndvi';
import { getSatelliteDecisionGrade, type DecisionGradeResult } from '@/lib/decisionGrade';

export type IndexKey = 'NDVI' | 'NDRE' | 'MOISTURE';

export type SceneQuality = 'good' | 'fair' | 'poor' | 'stale' | 'none';

export interface SceneQualityAssessment {
  quality: SceneQuality;
  reasons: string[];
  ageDays: number | null;
  cloudCover: number | null;
  decisionGrade: boolean;
}

export interface Delta {
  value: number;
  percent: number;
  direction: 'up' | 'down' | 'flat';
  significant: boolean;
}

export interface PeerBlockSnapshot {
  vineyardId: string;
  vineyardName: string;
  latest: number | null;
  acquiredAt: string | null;
}

export interface IndexAnalysis {
  indexKey: IndexKey;
  latest: NdviSample | null;
  previous: NdviSample | null;
  baselineMedian: number | null;
  peerMedian: number | null;
  sceneDelta: Delta | null;
  baselineDelta: Delta | null;
  peerDelta: Delta | null;
  trendDirection: 'rising' | 'declining' | 'stable' | 'unknown';
  sceneQuality: SceneQualityAssessment;
  anomalyScore: number;
  isDecisionGrade: boolean;
  confidence: 'high' | 'medium' | 'low';
  headline: string;
  narrative: string;
  suggestedAction: string | null;
  gradeResult: DecisionGradeResult;
}

const SIGNIFICANT_CHANGE: Record<IndexKey, number> = {
  NDVI: 0.05,
  NDRE: 0.04,
  MOISTURE: 0.04,
};

const STALE_DAYS: Record<IndexKey, number> = {
  NDVI: 14,
  NDRE: 14,
  MOISTURE: 14,
};

function daysBetween(a: string, b: string = new Date().toISOString()): number {
  const d = (new Date(b).getTime() - new Date(a).getTime()) / (24 * 60 * 60 * 1000);
  return Number.isFinite(d) ? d : 0;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function computeDelta(current: number, reference: number, threshold: number): Delta {
  const value = current - reference;
  const percent = reference !== 0 ? (value / Math.abs(reference)) * 100 : 0;
  const direction: Delta['direction'] =
    value > threshold * 0.2 ? 'up' : value < -threshold * 0.2 ? 'down' : 'flat';
  return {
    value,
    percent,
    direction,
    significant: Math.abs(value) >= threshold,
  };
}

export function assessSceneQuality(
  sample: NdviSample | null,
  indexKey: IndexKey
): SceneQualityAssessment {
  if (!sample) {
    return {
      quality: 'none',
      reasons: ['No scenes available'],
      ageDays: null,
      cloudCover: null,
      decisionGrade: false,
    };
  }
  const reasons: string[] = [];
  const ageDays = sample.acquiredAt ? daysBetween(sample.acquiredAt) : null;
  const cloud = sample.cloudCover ?? null;
  const staleLimit = STALE_DAYS[indexKey];

  let quality: SceneQuality = 'good';

  if (sample.sourceType === 'simulated') {
    quality = 'poor';
    reasons.push('Fallback estimate — no real reflectance');
  }
  if (cloud != null && cloud > 40) {
    quality = quality === 'good' ? 'poor' : quality;
    reasons.push(`Heavy cloud cover (${Math.round(cloud)}%)`);
  } else if (cloud != null && cloud > 15) {
    quality = quality === 'good' ? 'fair' : quality;
    reasons.push(`Partial cloud (${Math.round(cloud)}%)`);
  }
  if (ageDays != null && ageDays > staleLimit) {
    quality = 'stale';
    reasons.push(`Scene is ${Math.round(ageDays)} days old`);
  } else if (ageDays != null && ageDays > staleLimit * 0.6) {
    if (quality === 'good') quality = 'fair';
    reasons.push('Imagery is aging');
  }

  if (reasons.length === 0) reasons.push('Cloud-free and recent');

  return {
    quality,
    reasons,
    ageDays,
    cloudCover: cloud,
    decisionGrade: quality === 'good' || quality === 'fair',
  };
}

function trendDirection(samples: NdviSample[], threshold: number): IndexAnalysis['trendDirection'] {
  if (samples.length < 3) return 'unknown';
  const recent = samples.slice(-4);
  const first = recent[0].value;
  const last = recent[recent.length - 1].value;
  const diff = last - first;
  if (Math.abs(diff) < threshold) return 'stable';
  return diff > 0 ? 'rising' : 'declining';
}

function narrativePieces(
  indexKey: IndexKey,
  latest: number,
  scene: Delta | null,
  baseline: Delta | null,
  peer: Delta | null,
  quality: SceneQualityAssessment,
  blockName: string
): { headline: string; narrative: string; action: string | null } {
  const indexLabel = indexKey;
  const conservative = quality.quality === 'poor' || quality.quality === 'stale';

  // Build narrative
  const parts: string[] = [];

  if (scene) {
    if (scene.significant && scene.direction === 'down') {
      parts.push(
        `${indexLabel} dropped ${Math.abs(scene.value).toFixed(2)} since the previous scene.`
      );
    } else if (scene.significant && scene.direction === 'up') {
      parts.push(
        `${indexLabel} rose ${Math.abs(scene.value).toFixed(2)} since the previous scene.`
      );
    } else {
      parts.push(`${indexLabel} held steady versus the previous scene.`);
    }
  }

  if (baseline && baseline.significant) {
    if (baseline.direction === 'down') {
      parts.push(
        `Running ${Math.abs(baseline.percent).toFixed(0)}% below this block's recent baseline.`
      );
    } else {
      parts.push(
        `Running ${Math.abs(baseline.percent).toFixed(0)}% above this block's recent baseline.`
      );
    }
  } else if (baseline) {
    parts.push(`Tracking in line with this block's recent baseline.`);
  }

  if (peer && peer.significant) {
    if (peer.direction === 'down') {
      parts.push(
        `Underperforming nearby blocks by ${Math.abs(peer.value).toFixed(2)}.`
      );
    } else {
      parts.push(
        `Outperforming nearby blocks by ${Math.abs(peer.value).toFixed(2)}.`
      );
    }
  }

  if (conservative) {
    parts.push(
      quality.quality === 'stale'
        ? 'Scene is past its useful window — treat as advisory only.'
        : 'Scene quality is limited — signal strength reduced.'
    );
  }

  // Headline
  let headline = `${blockName}: ${indexLabel} ${latest.toFixed(2)}`;
  if (scene?.significant && scene.direction === 'down') {
    headline = `${blockName} showing canopy decline`;
  } else if (baseline?.significant && baseline.direction === 'down') {
    headline = `${blockName} below its own baseline`;
  } else if (peer?.significant && peer.direction === 'down') {
    headline = `${blockName} lagging nearby blocks`;
  } else if (scene?.significant && scene.direction === 'up') {
    headline = `${blockName} canopy recovering`;
  } else {
    headline = `${blockName} stable`;
  }

  // Action
  let action: string | null = null;
  const declineSignal =
    (scene?.significant && scene.direction === 'down') ||
    (baseline?.significant && baseline.direction === 'down') ||
    (peer?.significant && peer.direction === 'down');

  if (conservative) {
    action = declineSignal
      ? `Scene quality is limited — treat as advisory. If possible, ground-truth ${blockName} before acting.`
      : null;
  } else if (declineSignal) {
    if (indexKey === 'NDVI' || indexKey === 'NDRE') {
      action = `Scout ${blockName} for moisture stress, emitter issues, canopy thinning, or disease pressure.`;
    } else if (indexKey === 'MOISTURE') {
      action = `Check ${blockName} soil moisture and irrigation delivery; consider a field inspection.`;
    }
  }

  return {
    headline,
    narrative: parts.join(' ') || `${indexLabel} at ${latest.toFixed(2)}.`,
    action,
  };
}

export interface AnalyzeInput {
  indexKey: IndexKey;
  samples: NdviSample[];
  blockName: string;
  peers?: PeerBlockSnapshot[];
  isDemo?: boolean;
}

export function analyzeIndexSeries(input: AnalyzeInput): IndexAnalysis {
  const { indexKey, samples, blockName, peers = [] } = input;
  const threshold = SIGNIFICANT_CHANGE[indexKey];

  const latest = samples.length > 0 ? samples[samples.length - 1] : null;
  const previous = samples.length > 1 ? samples[samples.length - 2] : null;
  const quality = assessSceneQuality(latest, indexKey);

  // Block baseline: median of prior scenes excluding latest
  const priorValues = samples.slice(0, -1).map((s) => s.value);
  const baselineMedian = median(priorValues);

  // Peer median: latest values from other blocks
  const peerValues = peers
    .map((p) => p.latest)
    .filter((v): v is number => typeof v === 'number');
  const peerMedian = median(peerValues);

  const sceneDelta =
    latest && previous ? computeDelta(latest.value, previous.value, threshold) : null;
  const baselineDelta =
    latest && baselineMedian != null
      ? computeDelta(latest.value, baselineMedian, threshold)
      : null;
  const peerDelta =
    latest && peerMedian != null ? computeDelta(latest.value, peerMedian, threshold) : null;

  const trend = trendDirection(samples, threshold * 0.5);

  // Anomaly score: weighted magnitude of negative signals (0..1)
  let anomaly = 0;
  if (sceneDelta && sceneDelta.direction === 'down') {
    anomaly += Math.min(1, Math.abs(sceneDelta.value) / (threshold * 4)) * 0.4;
  }
  if (baselineDelta && baselineDelta.direction === 'down') {
    anomaly += Math.min(1, Math.abs(baselineDelta.value) / (threshold * 4)) * 0.35;
  }
  if (peerDelta && peerDelta.direction === 'down') {
    anomaly += Math.min(1, Math.abs(peerDelta.value) / (threshold * 4)) * 0.25;
  }
  anomaly = Math.max(0, Math.min(1, anomaly));

  // Dampen anomaly score when scene quality is poor/stale/simulated so bad imagery
  // never drives strong 'needs scouting' signals.
  if (quality.quality === 'poor') anomaly *= 0.5;
  if (quality.quality === 'stale') anomaly *= 0.35;
  if (quality.quality === 'none') anomaly = 0;

  const declineSignal =
    (sceneDelta?.significant && sceneDelta.direction === 'down') ||
    (baselineDelta?.significant && baselineDelta.direction === 'down') ||
    (peerDelta?.significant && peerDelta.direction === 'down') ||
    false;

  const gradeResult = getSatelliteDecisionGrade({
    latest,
    sceneQuality: quality.quality,
    sampleCount: samples.length,
    hasBaseline: baselineMedian != null,
    hasPeers: peerMedian != null,
    isDemo: input.isDemo,
    declineSignal: !!declineSignal,
  });

  const confidence: IndexAnalysis['confidence'] = gradeResult.confidence;

  const { headline, narrative, action } = latest
    ? narrativePieces(
        indexKey,
        latest.value,
        sceneDelta,
        baselineDelta,
        peerDelta,
        quality,
        blockName
      )
    : {
        headline: `${blockName}: no imagery`,
        narrative: 'No cloud-free scenes available for analysis yet.',
        action: null,
      };

  return {
    indexKey,
    latest,
    previous,
    baselineMedian,
    peerMedian,
    sceneDelta,
    baselineDelta,
    peerDelta,
    trendDirection: trend,
    sceneQuality: quality,
    anomalyScore: anomaly,
    isDecisionGrade:
      quality.decisionGrade &&
      latest?.sourceType !== 'simulated' &&
      gradeResult.blockers.length === 0,
    confidence,
    headline,
    narrative,
    suggestedAction: action,
    gradeResult,
  };
}

export function confidenceColor(c: IndexAnalysis['confidence']): string {
  if (c === 'high') return '#22C55E';
  if (c === 'medium') return '#F59E0B';
  return '#EF4444';
}
