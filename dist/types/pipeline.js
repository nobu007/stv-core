/**
 * Pipeline Type Definitions
 * Based on docs/design/speech-to-visuals/interfaces.ts
 */
const PROCESSING_STATUSES = [
    'idle',
    'uploading',
    'transcribing',
    'analyzing',
    'generating',
    'complete',
    'error',
];
export function isProcessingStatus(value) {
    return typeof value === 'string' && PROCESSING_STATUSES.includes(value);
}
