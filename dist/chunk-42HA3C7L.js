// src/config/validate.ts
function validateConfig(config) {
  const errors = [];
  if (!config.googleApiKey) {
    errors.push({ field: "googleApiKey", message: "GOOGLE_API_KEY is required" });
  }
  if (!config.supabaseUrl) {
    errors.push({ field: "supabaseUrl", message: "SUPABASE_URL is required" });
  }
  if (!config.supabaseAnonKey) {
    errors.push({ field: "supabaseAnonKey", message: "SUPABASE_ANON_KEY is required" });
  }
  if (config.supabaseUrl) {
    const urlError = validateUrl(config.supabaseUrl, "supabaseUrl");
    if (urlError) {
      errors.push(urlError);
    }
  }
  if (config.complexityThreshold !== void 0) {
    const rangeError = validateNumberRange(
      config.complexityThreshold,
      0,
      1,
      "complexityThreshold"
    );
    if (rangeError) {
      errors.push(rangeError);
    }
  }
  if (config.similarityThreshold !== void 0) {
    const rangeError = validateNumberRange(
      config.similarityThreshold,
      0,
      1,
      "similarityThreshold"
    );
    if (rangeError) {
      errors.push(rangeError);
    }
  }
  if (config.port !== void 0) {
    const portError = validateNumberRange(config.port, 1024, 65535, "port");
    if (portError) {
      errors.push(portError);
    }
  }
  if (config.cacheSize !== void 0) {
    const cacheError = validateNumberRange(config.cacheSize, 1, 1e4, "cacheSize");
    if (cacheError) {
      errors.push(cacheError);
    }
  }
  if (config.cacheTtlMinutes !== void 0) {
    const ttlError = validateNumberRange(config.cacheTtlMinutes, 1, 10080, "cacheTtlMinutes");
    if (ttlError) {
      errors.push(ttlError);
    }
  }
  if (config.nodeEnv !== void 0) {
    const validEnvs = ["development", "production", "test"];
    if (!validEnvs.includes(config.nodeEnv)) {
      errors.push({
        field: "nodeEnv",
        message: "NODE_ENV must be one of: development, production, test"
      });
    }
  }
  return errors;
}
function validateUrl(url, fieldName) {
  try {
    new URL(url);
    return null;
  } catch {
    return { field: fieldName, message: `${fieldName} is not a valid URL` };
  }
}
function validateNumberRange(value, min, max, fieldName) {
  if (value < min || value > max) {
    return {
      field: fieldName,
      message: `${fieldName} must be between ${min} and ${max}`
    };
  }
  return null;
}

export {
  validateConfig,
  validateUrl,
  validateNumberRange
};
