/**
 * Core-owned configuration error type.
 *
 * The config layer must stay free of pipeline dependencies, so it throws its
 * own error class instead of borrowing `PipelineConfigError` (which lives in
 * the product repo's pipeline layer).
 */
export class ConfigValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}
