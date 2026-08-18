/**
 * LLM Service Type Definitions
 * Based on docs/design/speech-to-visuals/interfaces.ts
 */
const LLM_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'];
export function isLLMModel(value) {
    return typeof value === 'string' && LLM_MODELS.includes(value);
}
