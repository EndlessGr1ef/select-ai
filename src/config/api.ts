// Context tokens limits (for selection explanation)
export const CONTEXT_MAX_TOKENS = {
  default: 5000,
  min: 200,
  max: 50000,
} as const;

// Translation concurrency limits
export const TRANSLATION_CONCURRENCY = {
  default: 10,
  min: 1,
  max: 20,
} as const;

// Request timeout in milliseconds
export const REQUEST_TIMEOUT = 30000; // 30 seconds

// Helper function to clamp context max tokens
export function clampContextMaxTokens(value: number): number {
  if (!Number.isFinite(value)) return CONTEXT_MAX_TOKENS.default;
  return Math.max(CONTEXT_MAX_TOKENS.min, Math.min(CONTEXT_MAX_TOKENS.max, value));
}

// Helper function to clamp translation concurrency
export function clampTranslationConcurrency(value: number): number {
  if (!Number.isFinite(value)) return TRANSLATION_CONCURRENCY.default;
  return Math.max(TRANSLATION_CONCURRENCY.min, Math.min(TRANSLATION_CONCURRENCY.max, value));
}
