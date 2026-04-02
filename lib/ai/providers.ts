// lib/ai/providers.ts
import { customProvider, wrapLanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { isTestEnvironment } from '../constants';
<<<<<<< HEAD
=======
import { createFallbackLanguageModel } from './fallback-language-model';
>>>>>>> 0535d4f1f6314d7b96c35e828bf1b1cf4ee7b3af

// Define the allowed model IDs
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

<<<<<<< HEAD
  const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });
=======
  // ✅ Production mode with Gemini (multi-key fallback on rate limit)
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
>>>>>>> 0535d4f1f6314d7b96c35e828bf1b1cf4ee7b3af

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
