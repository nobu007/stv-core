// src/utils/sanitize.ts
var UNSAFE_PATTERN = /[/\\]/g;
var DOTDOT_PATTERN = /\.\./g;
var NULL_BYTE_PATTERN = /\0/g;
var CONTROL_CHAR_PATTERN = /[\x00-\x1f\x7f]/g;
var RTL_OVERRIDE_PATTERN = /[\u202e\u202d\u202c\u200f\u200e\ufeff]/g;
var MAX_FILENAME_LENGTH = 255;
function sanitizeFilename(input) {
  let name = input.replace(NULL_BYTE_PATTERN, "").replace(RTL_OVERRIDE_PATTERN, "").replace(UNSAFE_PATTERN, "_").replace(DOTDOT_PATTERN, "").replace(CONTROL_CHAR_PATTERN, "").replace(/^\.+/, "").trim().slice(0, MAX_FILENAME_LENGTH);
  if (name.length === 0) {
    name = "unnamed";
  }
  return name;
}
export {
  sanitizeFilename
};
