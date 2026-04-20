export type DataSourceType =
  | 'observed'
  | 'derived'
  | 'estimated'
  | 'simulated'
  | 'manual';

export type DataQualityFlag = 'high' | 'medium' | 'low' | 'stale' | 'demo';

export type DataScopeType = 'estate' | 'vineyard' | 'block' | 'probe' | 'zone';

export type DataKind =
  | 'weather-current'
  | 'weather-forecast'
  | 'weather-history'
  | 'satellite'
  | 'probe'
  | 'irrigation'
  | 'disease'
  | 'manual';

export interface DataTrust {
  sourceType: DataSourceType;
  sourceName: string;
  observedAt: string | null;
  ingestedAt: string;
  qualityFlag: DataQualityFlag;
  scopeType: DataScopeType;
  methodVersion: string;
  isDecisionGrade: boolean;
  note?: string;
}

export interface WithTrust<T> {
  data: T;
  trust: DataTrust;
}

const FRESHNESS_RULES: Record<DataKind, number> = {
  'weather-current': 2 * 60 * 60 * 1000,
  'weather-forecast': 6 * 60 * 60 * 1000,
  'weather-history': 24 * 60 * 60 * 1000,
  satellite: 14 * 24 * 60 * 60 * 1000,
  probe: 12 * 60 * 60 * 1000,
  irrigation: 24 * 60 * 60 * 1000,
  disease: 6 * 60 * 60 * 1000,
  manual: 30 * 24 * 60 * 60 * 1000,
};

function freshnessWindow(kind: DataKind): number {
  return FRESHNESS_RULES[kind] ?? 24 * 60 * 60 * 1000;
}

export function isStale(kind: DataKind, observedAt: string | null | undefined): boolean {
  if (!observedAt) return true;
  const ts = new Date(observedAt).getTime();
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts > freshnessWindow(kind);
}

export interface EvaluateTrustInput {
  sourceType: DataSourceType;
  sourceName: string;
  observedAt: string | null;
  scopeType: DataScopeType;
  methodVersion: string;
  kind: DataKind;
  ingestedAt?: string;
  isDemo?: boolean;
  baseQuality?: DataQualityFlag;
  note?: string;
}

export function evaluateTrust(input: EvaluateTrustInput): DataTrust {
  const ingestedAt = input.ingestedAt ?? new Date().toISOString();
  let qualityFlag: DataQualityFlag = input.baseQuality ?? 'high';

  if (input.isDemo) {
    qualityFlag = 'demo';
  } else if (input.sourceType === 'simulated') {
    qualityFlag = 'low';
  } else if (input.sourceType === 'estimated') {
    qualityFlag = 'medium';
  }

  if (qualityFlag !== 'demo' && isStale(input.kind, input.observedAt)) {
    qualityFlag = 'stale';
  }

  const isDecisionGrade =
    !input.isDemo &&
    (input.sourceType === 'observed' ||
      input.sourceType === 'derived' ||
      input.sourceType === 'manual') &&
    (qualityFlag === 'high' || qualityFlag === 'medium');

  return {
    sourceType: input.sourceType,
    sourceName: input.sourceName,
    observedAt: input.observedAt,
    ingestedAt,
    qualityFlag,
    scopeType: input.scopeType,
    methodVersion: input.methodVersion,
    isDecisionGrade,
    note: input.note,
  };
}

export function qualityLabel(q: DataQualityFlag): string {
  switch (q) {
    case 'high':
      return 'Decision-grade';
    case 'medium':
      return 'Advisory';
    case 'low':
      return 'Low confidence';
    case 'stale':
      return 'Stale';
    case 'demo':
      return 'Demo data';
  }
}

export function sourceTypeLabel(t: DataSourceType): string {
  switch (t) {
    case 'observed':
      return 'Observed';
    case 'derived':
      return 'Derived';
    case 'estimated':
      return 'Estimated';
    case 'simulated':
      return 'Simulated';
    case 'manual':
      return 'Manual entry';
  }
}

export function freshnessLabel(observedAt: string | null | undefined): string {
  if (!observedAt) return 'No timestamp';
  const ts = new Date(observedAt).getTime();
  if (!Number.isFinite(ts)) return 'Unknown';
  const diff = Date.now() - ts;
  if (diff < 0) return 'Forecast';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function demoTrust(
  sourceName: string,
  scopeType: DataScopeType = 'vineyard'
): DataTrust {
  return evaluateTrust({
    sourceType: 'simulated',
    sourceName,
    observedAt: new Date().toISOString(),
    scopeType,
    methodVersion: 'demo-1',
    kind: 'manual',
    isDemo: true,
  });
}

export function trustConfidenceWeight(trust: DataTrust | null | undefined): number {
  if (!trust) return 0;
  switch (trust.qualityFlag) {
    case 'high':
      return 1;
    case 'medium':
      return 0.7;
    case 'low':
      return 0.4;
    case 'stale':
      return 0.3;
    case 'demo':
      return 0;
  }
}
