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
import { getGoogleApiKeys } from './api-keys';

export type LanguageModelId =
  | 'chat-model'
  | 'chat-model-reasoning'
  | 'title-model'
  | 'artifact-model';

export const myProvider = (() => {
  if (isTestEnvironment) {
    const base = customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    });

    return {
      ...base,
      languageModel: (id: LanguageModelId) => base.languageModel(id),
    };
  }

  const keys = getGoogleApiKeys();
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
