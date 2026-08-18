// src/types/diagram.ts
var DIAGRAM_TYPES = ["flow", "flowchart", "tree", "timeline", "matrix", "cycle", "comparison", "network", "conceptmap", "mindmap", "general"];
function isDiagramType(value) {
  return typeof value === "string" && DIAGRAM_TYPES.includes(value);
}
var DIAGRAM_TYPE_TITLES = {
  flow: "\u30D7\u30ED\u30BB\u30B9\u30D5\u30ED\u30FC",
  flowchart: "\u30D5\u30ED\u30FC\u30C1\u30E3\u30FC\u30C8",
  tree: "\u968E\u5C64\u69CB\u9020",
  timeline: "\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3",
  matrix: "\u6BD4\u8F03\u8868",
  cycle: "\u5FAA\u74B0\u30D7\u30ED\u30BB\u30B9",
  comparison: "\u6BD4\u8F03",
  network: "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF",
  conceptmap: "\u30B3\u30F3\u30BB\u30D7\u30C8\u30DE\u30C3\u30D7",
  mindmap: "\u30DE\u30A4\u30F3\u30C9\u30DE\u30C3\u30D7",
  general: "\u4E00\u822C"
};
function isNodeDatum(value) {
  if (typeof value !== "object" || value === null) return false;
  const obj = value;
  return typeof obj.id === "string" && typeof obj.label === "string";
}
function isEdgeDatum(value) {
  if (typeof value !== "object" || value === null) return false;
  const obj = value;
  return typeof obj.from === "string" && typeof obj.to === "string";
}

export {
  DIAGRAM_TYPES,
  isDiagramType,
  DIAGRAM_TYPE_TITLES,
  isNodeDatum,
  isEdgeDatum
};
