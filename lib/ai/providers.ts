// lib/ai/providers.ts
import { customProvider, wrapLanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';
import { isTestEnvironment } from '../constants';
import { createFallbackLanguageModel } from './fallback-language-model';

export type LanguageModelId =
  | 'chat-model'
  | 'chat-model-reasoning'
  | 'title-model'
  | 'artifact-model';

export const myProvider = (() => {
  if (isTestEnvironment) {
    // Simple fallback mock provider
    return customProvider({
      languageModels: {},
    });
  }

  const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });
  // Production mode with Gemini (multi-key fallback on rate limit)
  const rawKeys = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '';
  const apiKeys = rawKeys
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const keys = apiKeys.length > 0 ? apiKeys : [rawKeys].filter(Boolean);
  if (keys.length === 0) {
    throw new Error(
      'GOOGLE_GENERATIVE_AI_API_KEY must be set (comma-separated for multiple keys)',
    );
  }

  const googleProviders = keys.map((apiKey) =>
    createGoogleGenerativeAI({ apiKey }),
  );
  const geminiModels = googleProviders.map((p) => p.chat('gemini-2.5-flash'));
  const fallbackModel = createFallbackLanguageModel(geminiModels);

  const base = customProvider({
    languageModels: {
      'chat-model': wrapLanguageModel({
        model: fallbackModel,
        middleware: [],
      }),
      'chat-model-reasoning': wrapLanguageModel({
        model: fallbackModel,
        middleware: [],
      }),
      'title-model': wrapLanguageModel({
        model: fallbackModel,
        middleware: [],
      }),
      'artifact-model': wrapLanguageModel({
        model: fallbackModel,
        middleware: [],
      }),
    },
  });

  return {
    ...base,
    languageModel: (id: LanguageModelId) => base.languageModel(id),
  };
})();
