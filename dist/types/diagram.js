// ========================================
// Type Guards
// ========================================
/**
 * Canonical, single-source list of every `DiagramType`.
 *
 * Exported so consumers iterate the canonical set instead of re-literalizing
 * the union (which silently drifts when a type is added — e.g. a scoring loop
 * re-literalizing this list would skip a newly-added type because the
 * accompanying `as DiagramType[]` cast defeats the type-checker). Typed as
 * `readonly DiagramType[]` so mapped values infer `DiagramType` directly.
 */
export const DIAGRAM_TYPES = ['flow', 'flowchart', 'tree', 'timeline', 'matrix', 'cycle', 'comparison', 'network', 'conceptmap', 'mindmap', 'general'];
export function isDiagramType(value) {
    return typeof value === 'string' && DIAGRAM_TYPES.includes(value);
}
/**
 * Canonical Japanese display title per diagram type — the single source.
 *
 * Previously the same "type → title" map was independently frozen in
 * video-generator (`generateSceneTitle`) and DiagramScene (`DIAGRAM_TITLES`),
 * and the two had ALREADY drifted: `flowchart` was 「プロセスフロー」 in the
 * generated scene title but 「フローチャート」 in the rendered video frame,
 * and `general` was 「ダイアグラム」 vs 「一般」. The DiagramPreview badge
 * labels (ツリー構造/マトリクス/…) are a different surface (UI shorthand, not
 * the video title) and stay local to that component.
 */
export const DIAGRAM_TYPE_TITLES = {
    flow: 'プロセスフロー',
    flowchart: 'フローチャート',
    tree: '階層構造',
    timeline: 'タイムライン',
    matrix: '比較表',
    cycle: '循環プロセス',
    comparison: '比較',
    network: 'ネットワーク',
    conceptmap: 'コンセプトマップ',
    mindmap: 'マインドマップ',
    general: '一般',
};
export function isNodeDatum(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const obj = value;
    return typeof obj.id === 'string' && typeof obj.label === 'string';
}
export function isEdgeDatum(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const obj = value;
    return typeof obj.from === 'string' && typeof obj.to === 'string';
}
