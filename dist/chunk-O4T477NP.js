// src/types/llm.ts
var LLM_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro"];
function isLLMModel(value) {
  return typeof value === "string" && LLM_MODELS.includes(value);
}

export {
  isLLMModel
};
