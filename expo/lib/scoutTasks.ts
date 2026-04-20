import type { Recommendation, RecommendationKind, RecommendationPriority, RecommendationConfidence } from '@/lib/recommendations';

export type ScoutTriggerKind =
  | 'falling-vigor'
  | 'moisture-pattern'
  | 'irrigation'
  | 'disease'
  | 'frost'
  | 'heat'
  | 'drainage'
  | 'manual'
  | 'other';

export type ScoutStatus = 'open' | 'in_progress' | 'resolved' | 'ignored' | 'monitoring';
export type ScoutOutcome = 'confirmed' | 'false_alarm' | 'partial' | 'not_checked';
export type FollowUpResult = 'resolved' | 'unresolved' | 'recurring' | 'improved' | 'worsened';
export type ActionEffectiveness = 'effective' | 'partial' | 'ineffective' | 'unknown';

export interface ScoutPhoto {
  uri: string;
  caption?: string;
  takenAt: string;
}

export interface ScoutPin {
  id: string;
  latitude: number;
  longitude: number;
  note?: string;
}

export interface ScoutObservations {
  canopyCondition?: 'healthy' | 'mild_stress' | 'moderate_stress' | 'severe_stress' | null;
  moistureStress?: boolean;
  diseaseSymptoms?: string[];
  irrigationFault?: string[];
  drainageIssue?: boolean;
  rowNotes?: string;
  generalNotes?: string;
}

export interface ScoutCheckPoint {
  id: string;
  label: string;
  hint?: string;
  done?: boolean;
}

export interface DbScoutTask {
  id: string;
  vineyard_id: string;
  owner_id: string;
  trigger_kind: ScoutTriggerKind;
  trigger_rec_id: string | null;
  title: string;
  reason: string | null;
  urgency: RecommendationPriority;
  confidence: RecommendationConfidence;
  status: ScoutStatus;
  check_points: ScoutCheckPoint[] | null;
  inspected_at: string | null;
  outcome: ScoutOutcome | null;
  action_taken: string | null;
  action_at: string | null;
  performed_by: string | null;
  resolution_notes: string | null;
  photos: ScoutPhoto[] | null;
  pins: ScoutPin[] | null;
  observations: ScoutObservations | null;
  follow_up_at: string | null;
  follow_up_result: FollowUpResult | null;
  follow_up_notes: string | null;
  effectiveness: ActionEffectiveness | null;
  created_by: string | null;
  updated_by: string | null;
  source_inputs: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export function triggerFromKind(kind: RecommendationKind): ScoutTriggerKind {
  switch (kind) {
    case 'inspect':
      return 'falling-vigor';
    case 'irrigate':
    case 'hold-irrigation':
      return 'irrigation';
    case 'disease-risk':
      return 'disease';
    case 'frost-watch':
      return 'frost';
    case 'heat-watch':
      return 'heat';
    case 'drainage':
      return 'drainage';
    default:
      return 'other';
  }
}

export function checkPointsFor(trigger: ScoutTriggerKind): ScoutCheckPoint[] {
  const base: ScoutCheckPoint[] = [];
  switch (trigger) {
    case 'falling-vigor':
      return [
        { id: 'canopy', label: 'Canopy density and leaf colour' },
        { id: 'shoots', label: 'Shoot vigor and internode length' },
        { id: 'west-edge', label: 'Check western edge and exposed rows' },
        { id: 'comparison', label: 'Compare against a healthy reference row' },
      ];
    case 'moisture-pattern':
      return [
        { id: 'probe', label: 'Inspect probe site and cable' },
        { id: 'emitters', label: 'Walk the line — check emitter flow' },
        { id: 'soil', label: 'Dig 20–30cm, feel soil moisture' },
      ];
    case 'irrigation':
      return [
        { id: 'emitters', label: 'Check for blocked or leaking emitters' },
        { id: 'pressure', label: 'Confirm line pressure and valve status' },
        { id: 'coverage', label: 'Sample soil wetness across zone' },
      ];
    case 'disease':
      return [
        { id: 'underside', label: 'Inspect leaf undersides in interior canopy' },
        { id: 'bunches', label: 'Check bunch tightness and berry splits' },
        { id: 'microclimate', label: 'Note wet, shaded microclimate zones' },
      ];
    case 'frost':
      return [
        { id: 'low-spots', label: 'Scout low-lying and cold-air pooling zones' },
        { id: 'shoot-damage', label: 'Look for blackened shoots / wilted tips' },
        { id: 'recovery', label: 'Flag rows needing replacement shoots' },
      ];
    case 'heat':
      return [
        { id: 'sunburn', label: 'Check exposed bunches for sunburn' },
        { id: 'wilting', label: 'Look for midday canopy wilting' },
        { id: 'water', label: 'Verify irrigation ran successfully' },
      ];
    case 'drainage':
      return [
        { id: 'pooling', label: 'Identify water pooling or runoff channels' },
        { id: 'headlands', label: 'Inspect headlands and row ends' },
        { id: 'erosion', label: 'Note soil erosion or mud' },
      ];
    default:
      return base.length
        ? base
        : [
            { id: 'general', label: 'Walk block and note any anomalies' },
            { id: 'photos', label: 'Capture 2–3 photos with pins' },
          ];
  }
}

export function scoutTitleFor(rec: Recommendation): string {
  const where = rec.vineyardName ?? 'Block';
  switch (rec.kind) {
    case 'inspect':
      return `Scout ${where} for vigor decline`;
    case 'irrigate':
      return `Verify irrigation on ${where}`;
    case 'hold-irrigation':
      return `Confirm soil status on ${where}`;
    case 'disease-risk':
      return `Inspect ${where} for disease pressure`;
    case 'frost-watch':
      return `Check ${where} for frost damage`;
    case 'heat-watch':
      return `Check ${where} for heat stress`;
    case 'drainage':
      return `Check drainage on ${where}`;
    default:
      return `Scout ${where}`;
  }
}

export function urgencyWeight(u: RecommendationPriority): number {
  switch (u) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'medium':
      return 2;
    case 'low':
      return 3;
  }
}

export function recommendationToDraft(rec: Recommendation): {
  vineyard_id: string;
  trigger_kind: ScoutTriggerKind;
  trigger_rec_id: string;
  title: string;
  reason: string;
  urgency: RecommendationPriority;
  confidence: RecommendationConfidence;
  check_points: ScoutCheckPoint[];
} | null {
  if (!rec.vineyardId) return null;
  const trigger = triggerFromKind(rec.kind);
  return {
    vineyard_id: rec.vineyardId,
    trigger_kind: trigger,
    trigger_rec_id: rec.id,
    title: scoutTitleFor(rec),
    reason: rec.reason,
    urgency: rec.priority,
    confidence: rec.confidence,
    check_points: checkPointsFor(trigger),
  };
}

export function triggerLabel(t: ScoutTriggerKind): string {
  switch (t) {
    case 'falling-vigor':
      return 'Falling vigor';
    case 'moisture-pattern':
      return 'Moisture pattern';
    case 'irrigation':
      return 'Irrigation concern';
    case 'disease':
      return 'Disease risk';
    case 'frost':
      return 'Frost risk';
    case 'heat':
      return 'Heat stress';
    case 'drainage':
      return 'Drainage';
    case 'manual':
      return 'Manual scout';
    case 'other':
      return 'Other';
  }
}

export function outcomeLabel(o: ScoutOutcome): string {
  switch (o) {
    case 'confirmed':
      return 'Issue confirmed';
    case 'false_alarm':
      return 'False alarm';
    case 'partial':
      return 'Partially confirmed';
    case 'not_checked':
      return 'Not checked';
  }
}

export function statusLabel(s: ScoutStatus): string {
  switch (s) {
    case 'open':
      return 'Open';
    case 'in_progress':
      return 'In progress';
    case 'resolved':
      return 'Resolved';
    case 'ignored':
      return 'Ignored';
    case 'monitoring':
      return 'Monitoring';
  }
}

export function followUpResultLabel(r: FollowUpResult): string {
  switch (r) {
    case 'resolved':
      return 'Resolved';
    case 'unresolved':
      return 'Still active';
    case 'recurring':
      return 'Recurring issue';
    case 'improved':
      return 'Improved';
    case 'worsened':
      return 'Worsened';
  }
}

export function effectivenessLabel(e: ActionEffectiveness): string {
  switch (e) {
    case 'effective':
      return 'Effective';
    case 'partial':
      return 'Partially effective';
    case 'ineffective':
      return 'Ineffective';
    case 'unknown':
      return 'Unknown';
  }
}
