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
export declare const QUALITY_TIER_BARS: {
    readonly excellent: 90;
    readonly good: 70;
    readonly fair: 50;
};
export type QualityTier = keyof typeof QUALITY_TIER_BARS | 'poor';
/** Classify a 0–100 score into its display tier. */
export declare function getQualityTier(score: number): QualityTier;
/** Tailwind color class for a quality score (historic getQualityColor). */
export declare function getQualityColorClass(score: number): string;
export type QualityBadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';
/** Badge variant for a quality score (historic getQualityBadge). */
export declare function getQualityBadgeVariant(score: number): QualityBadgeVariant;
/** Short label for a quality score (historic inline ternary). */
export declare function getQualityTierLabel(score: number): string;
