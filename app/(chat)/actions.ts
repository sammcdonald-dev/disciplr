'use server';

import { generateText, type UIMessage } from 'ai';
import { cookies } from 'next/headers';
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
} from '@/lib/db/queries';
import type { VisibilityType } from '@/components/visibility-selector';
import { myProvider } from '@/lib/ai/providers';
import type { Persona } from '@/lib/ai/personas';
import { containsBlockedTerms } from '@/lib/utils';

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set('chat-model', model);
}

export async function saveChatPersonaAsCookie(persona: Persona['id']) {
  const cookieStore = await cookies();
  cookieStore.set('disciplr', persona);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  try {
    // Check for blocked terms before processing
    if (containsBlockedTerms(message.content)) {
      throw new Error('Message contains inappropriate content');
    }

    const { text: title } = await generateText({
      model: myProvider.languageModel('title-model'),
      system: `\n
      - you will generate a short title based on the first message a user begins a conversation with
      - ensure it is not more than 80 characters long
      - the title should be a summary of the user's message
      - do not use quotes or colons`,
      prompt: JSON.stringify(message),
    });
    return title;
  } catch (error) {
    // Handle quota errors gracefully
    if (error instanceof Error && error.message.includes('quota')) {
      console.warn('Quota exceeded for title generation, using fallback title');
      return 'New Chat'; // Fallback title when quota is exceeded
    }
    // Re-throw other errors
    throw error;
  }
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });
  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisiblityById({ chatId, visibility });
}
