// src/lib/metrics-utils.ts
function computePercentiles(sorted) {
  if (sorted.length === 0) return { p50: 0, p95: 0, p99: 0 };
  const p = (rank) => sorted[Math.min(Math.floor(rank), sorted.length - 1)];
  return {
    p50: p(sorted.length * 0.5),
    p95: p(sorted.length * 0.95),
    p99: p(sorted.length * 0.99)
  };
}
function percentileCeil(sorted, fraction) {
  if (sorted.length === 0) return 0;
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index];
}
function percentChange(current, baseline) {
  if (baseline === 0) return 0;
  if (!Number.isFinite(baseline)) return 0;
  return (current - baseline) / Math.abs(baseline) * 100;
}
function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
function heapUsageRatio(heapUsed, heapTotal) {
  if (heapTotal <= 0) return 0;
  return heapUsed / heapTotal;
}
function heapUsagePercent(heapUsed, heapTotal) {
  return heapUsageRatio(heapUsed, heapTotal) * 100;
}
function safeSum(values, fallback = 0) {
  let acc = 0;
  let any = false;
  for (const v of values) {
    if (Number.isFinite(v)) {
      acc += v;
      any = true;
    }
  }
  return any ? acc : fallback;
}
function safeMean(values, fallback = 0) {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (Number.isFinite(v)) {
      sum += v;
      count += 1;
    }
  }
  return count > 0 ? sum / count : fallback;
}
function safeMax(values, fallback = 0) {
  let acc = null;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (acc === null || v > acc || v === 0 && acc === 0 && Object.is(v, 0)) {
      acc = v;
    }
  }
  return acc === null ? fallback : acc;
}
function safeMin(values, fallback = 0) {
  let acc = null;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (acc === null || v < acc || v === 0 && acc === 0 && Object.is(v, -0)) {
      acc = v;
    }
  }
  return acc === null ? fallback : acc;
}
function bytesToMb(bytes) {
  return bytes / (1024 * 1024);
}

export {
  computePercentiles,
  percentileCeil,
  percentChange,
  roundTo,
  heapUsageRatio,
  heapUsagePercent,
  safeSum,
  safeMean,
  safeMax,
  safeMin,
  bytesToMb
};
