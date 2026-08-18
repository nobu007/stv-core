// src/lib/quality-display-tiers.ts
var QUALITY_TIER_BARS = {
  excellent: 90,
  good: 70,
  fair: 50
};
function getQualityTier(score) {
  if (score >= QUALITY_TIER_BARS.excellent) return "excellent";
  if (score >= QUALITY_TIER_BARS.good) return "good";
  if (score >= QUALITY_TIER_BARS.fair) return "fair";
  return "poor";
}
var TIER_COLOR_CLASSES = {
  excellent: "text-green-600 dark:text-green-400",
  good: "text-blue-600 dark:text-blue-400",
  fair: "text-yellow-600 dark:text-yellow-400",
  poor: "text-red-600 dark:text-red-400"
};
function getQualityColorClass(score) {
  return TIER_COLOR_CLASSES[getQualityTier(score)];
}
var TIER_BADGE_VARIANTS = {
  excellent: "default",
  good: "secondary",
  fair: "outline",
  poor: "destructive"
};
function getQualityBadgeVariant(score) {
  return TIER_BADGE_VARIANTS[getQualityTier(score)];
}
var TIER_LABELS = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  // The historic label ternary had only three outcomes (`>= 90 ? 'Excellent'
  // : >= 70 ? 'Good' : 'Fair'`) — scores below the fair bar also read 'Fair'.
  // Kept as-is: zero-delta migration, not a UX redesign.
  poor: "Fair"
};
function getQualityTierLabel(score) {
  return TIER_LABELS[getQualityTier(score)];
}
export {
  QUALITY_TIER_BARS,
  getQualityBadgeVariant,
  getQualityColorClass,
  getQualityTier,
  getQualityTierLabel
};
