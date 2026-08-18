// src/utils/regex-escape.ts
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export {
  escapeRegex
};
