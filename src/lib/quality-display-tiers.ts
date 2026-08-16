/**
 * Quality-score display tiers (0–100 scale) — the single source for how the
 * UI dashboards classify and color a quality score.
 *
 * Round 27 single-source extraction: the 90/70/50 bars lived as consumer-side
 * literals in FOUR shapes — byte-identical `getQualityColor` twins in
 * FrameworkDashboard.tsx and PerformanceMetricsVisualization.tsx, that same
 * file's `getQualityBadge`, and its inline `displayScore >= 90 ? 'Excellent'
 * : …` label ternary. A drifted bar at one site makes the two dashboards
 * color the SAME score differently (silent UI divergence; the drift class
 * this campaign freezes). The tier FUNCTIONS here are behavior-identical to
 * the historic consumer literals (zero numeric delta, verified by the oracle
 * in tests/guards/quality-display-tiers-single-source.test.ts).
 *
 * Scope note: these are DISPLAY tiers only. Pipeline-side graders
 * (pipeline-health-score's scoreToGrade, quality-monitor's determineStatus,
 * continuous-learner's compliance levels) run on intentionally different
 * tuned bars with different label sets — they are separate concepts and are
 * NOT delegated here.
 */

/** The three display tier bars, in descending strictness. */
export const QUALITY_TIER_BARS = {
  excellent: 90,
  good: 70,
  fair: 50,
} as const;

export type QualityTier = keyof typeof QUALITY_TIER_BARS | 'poor';

/** Classify a 0–100 score into its display tier. */
export function getQualityTier(score: number): QualityTier {
  if (score >= QUALITY_TIER_BARS.excellent) return 'excellent';
  if (score >= QUALITY_TIER_BARS.good) return 'good';
  if (score >= QUALITY_TIER_BARS.fair) return 'fair';
  return 'poor';
}

const TIER_COLOR_CLASSES: Record<QualityTier, string> = {
  excellent: 'text-green-600 dark:text-green-400',
  good: 'text-blue-600 dark:text-blue-400',
  fair: 'text-yellow-600 dark:text-yellow-400',
  poor: 'text-red-600 dark:text-red-400',
};

/** Tailwind color class for a quality score (historic getQualityColor). */
export function getQualityColorClass(score: number): string {
  return TIER_COLOR_CLASSES[getQualityTier(score)];
}

export type QualityBadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

const TIER_BADGE_VARIANTS: Record<QualityTier, QualityBadgeVariant> = {
  excellent: 'default',
  good: 'secondary',
  fair: 'outline',
  poor: 'destructive',
};

/** Badge variant for a quality score (historic getQualityBadge). */
export function getQualityBadgeVariant(score: number): QualityBadgeVariant {
  return TIER_BADGE_VARIANTS[getQualityTier(score)];
}

const TIER_LABELS: Record<QualityTier, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  // The historic label ternary had only three outcomes (`>= 90 ? 'Excellent'
  // : >= 70 ? 'Good' : 'Fair'`) — scores below the fair bar also read 'Fair'.
  // Kept as-is: zero-delta migration, not a UX redesign.
  poor: 'Fair',
};

/** Short label for a quality score (historic inline ternary). */
export function getQualityTierLabel(score: number): string {
  return TIER_LABELS[getQualityTier(score)];
}
