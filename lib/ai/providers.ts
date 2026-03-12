// lib/ai/providers.ts
import { customProvider, wrapLanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { isTestEnvironment } from '../constants';

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

  const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });

  const base = customProvider({
    languageModels: {
      'chat-model': wrapLanguageModel({
        model: google.chat('gemini-2.5-flash'),
        middleware: [],
      }),
      'chat-model-reasoning': wrapLanguageModel({
        model: google.chat('gemini-2.5-flash'),
        middleware: [],
      }),
      'title-model': wrapLanguageModel({
        model: google.chat('gemini-2.5-flash'),
        middleware: [],
      }),
      'artifact-model': wrapLanguageModel({
        model: google.chat('gemini-2.5-flash'),
        middleware: [],
      }),
    },
  });

  return {
    ...base,
    languageModel: (id: LanguageModelId) => base.languageModel(id),
  };
})();
