// src/utils/prometheus-label-escape.ts
var MAX_PROMETHEUS_LABEL_LENGTH = 200;
function sanitizePrometheusLabel(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/[\x00-\x09\x0b-\x1f\x7f]/g, "").slice(0, MAX_PROMETHEUS_LABEL_LENGTH);
}
export {
  MAX_PROMETHEUS_LABEL_LENGTH,
  sanitizePrometheusLabel
};
