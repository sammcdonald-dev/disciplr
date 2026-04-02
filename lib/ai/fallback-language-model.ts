import { APICallError } from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';

/**
 * Returns true if the error should trigger fallback to the next API key
 * (e.g. rate limit 429 or server retryable 5xx).
 */
function isRetryableForFallback(error: unknown): boolean {
  if (!APICallError.isInstance(error)) return false;
  if (error.statusCode === 429) return true;
  if (error.isRetryable === true) return true;
  return false;
}

/**
 * Creates a LanguageModelV2 that tries each model in order and falls back to the
 * next on rate-limit or retryable errors (e.g. 429). Use when multiple API keys
 * (e.g. from different Google projects) are available.
 */
export function createFallbackLanguageModel(
  models: LanguageModelV2[],
  options?: { providerId?: string; modelId?: string },
): LanguageModelV2 {
  if (models.length === 0) {
    throw new Error('createFallbackLanguageModel requires at least one model');
  }

  const first = models[0];
  const providerId = options?.providerId ?? 'google-generative-ai-fallback';
  const modelId = options?.modelId ?? first.modelId;

  return {
    specificationVersion: 'v2',
    provider: providerId,
    modelId,
    supportedUrls: first.supportedUrls,

    async doGenerate(options) {
      let lastError: unknown;
      for (const model of models) {
        try {
          return await Promise.resolve(model.doGenerate(options));
        } catch (error) {
          lastError = error;
          if (!isRetryableForFallback(error)) throw error;
          // Continue to next model (optional: log fallback)
        }
      }
      throw lastError;
    },

    async doStream(options) {
      let lastError: unknown;
      for (const model of models) {
        try {
          return await Promise.resolve(model.doStream(options));
        } catch (error) {
          lastError = error;
          if (!isRetryableForFallback(error)) throw error;
        }
      }
      throw lastError;
    },
  };
}
