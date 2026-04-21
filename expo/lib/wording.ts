/**
 * Shared wording helpers.
 *
 * Purpose: keep severity, confidence, freshness and engine-framing language
 * consistent everywhere in the app so that UI copy cannot drift away from the
 * grading framework. Every surface that shows a recommendation, alert, or
 * engine output should use these helpers rather than hand-writing labels.
 *
 * Rules encoded here (see also decisionGrade.ts, blockReadiness.ts):
 *   - Severity words are shared across engines: none / watch / monitor /
 *     elevated / inspect / critical. No engine invents its own.
 *   - Confidence words are shared: high / medium / low. Always paired with
 *     the word "confidence" so users understand it is not certainty.
 *   - We never use language that implies a definitive go/no-go for spray,
 *     frost, disease or satellite — those engines are at most advisory.
 *   - Alert titles always frame forecast-based warnings as "watch" or
 *     "conditions", never as a verdict. Specific pathogens are never named
 *     in generic disease wording.
 */

import type { RecommendationConfidence, RecommendationGrade } from '@/lib/recommendations';

export type Severity = 'none' | 'watch' | 'monitor' | 'elevated' | 'inspect' | 'critical';

export function severityLabel(s: Severity): string {
  switch (s) {
    case 'none':
      return 'Clear';
    case 'watch':
      return 'Watch';
    case 'monitor':
      return 'Monitor';
    case 'elevated':
      return 'Elevated';
    case 'inspect':
      return 'Recommended inspection';
    case 'critical':
      return 'Critical';
  }
}

/**
 * One-line phrasing that can appear after the severity word in headlines or
 * alert titles. Tuned to sound conservative — these should never read as a
 * verdict.
 */
export function severityPhrase(s: Severity): string {
  switch (s) {
    case 'none':
      return 'No concern based on current inputs';
    case 'watch':
      return 'Worth watching — not yet at action threshold';
    case 'monitor':
      return 'Monitor — no action yet';
    case 'elevated':
      return 'Elevated — verify before acting';
    case 'inspect':
      return 'Recommended inspection';
    case 'critical':
      return 'Critical conditions forecast';
  }
}

export function confidenceLabel(c: RecommendationConfidence): string {
  // Always paired with "confidence" so users never read "High" alone as
  // implying authority.
  switch (c) {
    case 'high':
      return 'High confidence';
    case 'medium':
      return 'Medium confidence';
    case 'low':
      return 'Low confidence';
  }
}

export function confidenceSentence(c: RecommendationConfidence): string {
  switch (c) {
    case 'high':
      return 'High confidence — fresh, block-specific inputs support this recommendation.';
    case 'medium':
      return 'Medium confidence — some inputs are stale, missing or default-based.';
    case 'low':
      return 'Low confidence — treat as advisory and verify in the field before acting.';
  }
}

/**
 * Framing words that describe the recommendation grade from the user's point
 * of view. Used instead of re-typing sentences in every card/screen.
 */
export function gradeFrame(g: RecommendationGrade): string {
  switch (g) {
    case 'operational':
      return 'Suitable for a management decision';
    case 'advisory':
      return 'Advisory only — verify before acting';
    case 'inspect':
      return 'Inspection recommended — confirm in field';
    case 'monitor':
      return 'Monitor only — no action yet';
    case 'info':
      return 'Informational';
    case 'insufficient-data':
      return 'Not decision-grade — input gaps';
  }
}

/**
 * Alert titles. These must match the engine vocabulary so a user never sees a
 * "Warning" title attached to what the engine graded as "watch/monitor", or a
 * pathogen-specific title attached to the generic disease-supportive proxy.
 */
export const ALERT_TITLES = {
  frostWatch: 'Frost watch',
  frostElevated: 'Elevated frost risk',
  frostCritical: 'Critical frost risk forecast',
  heatWatch: 'Heat stress watch',
  heatElevated: 'Elevated heat exposure',
  rainHeavy: 'Heavy rain expected',
  diseaseMonitor: 'Disease-supportive conditions — monitor',
  diseaseElevated: 'Elevated disease-supportive conditions',
  diseaseInspect: 'Recommended inspection — disease-supportive conditions',
  probeStale: 'Probe data is stale',
  probeOffline: 'Probe offline',
  moistureLow: 'Soil moisture below threshold',
  moistureHigh: 'Soil moisture above threshold',
  phOut: 'Soil pH out of range',
  batteryLow: 'Probe battery low',
} as const;

/**
 * Standard trust-note suffixes. Everything forecast-driven must make clear it
 * is forecast-derived and advisory unless the grading framework has lifted it
 * to operational.
 */
export const TRUST_NOTES = {
  forecastAdvisory: 'Forecast-derived · advisory',
  sprayForecastOnly:
    'Forecast-derived weather suitability · advisory timing window · verify local block conditions before spraying',
  diseaseGenericProxy: 'Generic disease-supportive proxy · advisory · not a pathogen-specific model',
  probeObserved: 'Observed · soil probe',
  demoAdvisory: 'Demo data — advisory only',
} as const;

/**
 * Short reminder sentences to clarify what readiness / grade / advisory mean.
 * Keeps wording identical across screens.
 */
export const CLARIFIERS = {
  readinessIsInputs:
    'Readiness reflects how many block inputs are configured — it is not a measure of model certainty or authority.',
  diseaseAlwaysAdvisory:
    'Disease engine remains advisory even when readiness is high — always ground-truth in the field.',
  frostAlwaysAdvisory:
    'Frost outputs stay advisory — forecasts carry overnight uncertainty.',
  sprayForecastOnly:
    'Spray weather suitability is forecast-only — no local field verification of wind, canopy wetness or block conditions.',
  satelliteSceneQuality:
    'Satellite signals depend on scene quality — limited scenes are capped at inspection-only.',
  groundTruth:
    'Ground-truth in the field before acting on operational items.',
} as const;
