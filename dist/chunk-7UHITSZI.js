// src/config/errors.ts
var ConfigValidationError = class extends Error {
  constructor(field, message) {
    super(message);
    this.field = field;
    this.name = "ConfigValidationError";
  }
};

export {
  ConfigValidationError
};
