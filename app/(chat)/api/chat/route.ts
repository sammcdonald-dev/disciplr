import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import { sql } from 'drizzle-orm';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getUserPromptCount,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import { DEFAULT_BIBLE_CHAT_PERSONA_ID, personas } from '@/lib/ai/personas';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';
import type { LanguageModelId } from '@/lib/ai/providers';
import { cookies } from 'next/headers';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/db';
import { GoogleGenAI } from '@google/genai';

// Get selected persona from cookie
async function getSelectedPersonaId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get('bible-chat')?.value;
}

async function retrieveBibleContext(userMessage: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.warn(
      'GOOGLE_GENERATIVE_AI_API_KEY is not set; skipping embedding.',
    );
    return '';
  }

  const newGenAI = new GoogleGenAI({
    apiKey: apiKey,
  });

  //const genAI = new GoogleGenerativeAI(apiKey);

  // 1. Embed the user message
  const result = await newGenAI.models.embedContent({
    model: 'gemini-embedding-001',
    contents: userMessage,
  });

  const embedding = result.embeddings?.[0];

  if (!embedding) {
    throw new Error('Embedding generation failed');
  }

  const userEmbedding = result.embeddings?.[0].values ?? [];
  if (!userEmbedding) {
    console.warn('Could not embed user message');
    return '';
  }

  // 2. Query for top-5 most similar verses using vector distance
  const vectorLiteral = `[${userEmbedding.join(',')}]`;
  const verses = await db.execute(sql`
  SELECT book, chapter, verse, text,
         (embedding <-> ${vectorLiteral}::vector) AS distance
  FROM bible_verses
  WHERE embedding IS NOT NULL
  ORDER BY distance ASC
  LIMIT 5
`);

  // 3. Format and return as context string
  if (!verses || verses.length === 0) {
    return 'No relevant Bible passages found.';
  }

  const context = verses
    .map(
      (row: any, i: number) =>
        `[${i + 1}] ${row.book} ${row.chapter}:${row.verse}\n"${row.text}"`,
    )
    .join('\n\n');

  return `Relevant Bible Passages:\n${context}`;
}

// TransformStream to enforce guardrails
function guardrailFilterStream(): TransformStream {
  return new TransformStream({
    transform(chunk, controller) {
      const text = chunk?.content ?? '';

      // Block unsafe or inappropriate content
      const lowerText = text.toLowerCase();

      // Basic guardrails for now - can expand how we do this later
      if (
        lowerText.includes('violence') ||
        lowerText.includes('hate') ||
        lowerText.includes('sex') ||
        lowerText.includes('drugs') ||
        lowerText.includes('self-harm') ||
        lowerText.includes('suicide') ||
        lowerText.includes('abuse') ||
        lowerText.includes('explicit') ||
        lowerText.includes('racist') ||
        lowerText.includes('bully') ||
        lowerText.includes('harass')
      ) {
        const text = chunk?.content ?? '';

        // Example guardrail: block off-topic or unsafe outputs
        if (text.toLowerCase().includes('violence')) {
          controller.enqueue({
            ...chunk,
            content: '⚠️ Response blocked due to unsafe content.',
          });
        }
      } else {
        controller.enqueue(chunk);
      }
    },
  });
}

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
      selectedPersonaId,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
      selectedPersonaId?: string;
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;
    const isGuest = userType === 'guest';

    if (isGuest) {
      // For guest users, check total prompt count (limit: 8)
      const promptCount = await getUserPromptCount({ id: session.user.id });
      if (promptCount >= 8) {
        return new ChatSDKError('rate_limit:auth').toResponse();
      }
    }

    // For regular users, check daily message limit
    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }
    // TODO: ----- RAG step: enrich with Bible context -----
    const firstPart = message.parts[0];
    const bibleContext =
      firstPart.type === 'text'
        ? await retrieveBibleContext(
            (firstPart as { type: 'text'; text: string }).text,
          )
        : '';

    // Get selected persona from request body or fallback to cookie
    const personaId = selectedPersonaId || (await getSelectedPersonaId());

    const selectedPersona = personaId
      ? personas.find((p) => p.id === personaId)
      : personas.find((p) => p.id === DEFAULT_BIBLE_CHAT_PERSONA_ID);

    const finalPersonaId = selectedPersona?.id || DEFAULT_BIBLE_CHAT_PERSONA_ID;

    // looks for chat by id - if not found,
    // creates new chat with title generated from first user message
    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
        personaId: finalPersonaId,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    // Store user message
    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    const personaPrompt = selectedPersona
      ? `${selectedPersona.name} — ${selectedPersona.description}\n${selectedPersona.prompt}`
      : '';

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel as LanguageModelId),
          system: systemPrompt({
            extraContext: `${bibleContext}\n${personaPrompt}`,
          }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        dataStream.merge(
          result
            .toUIMessageStream({ sendReasoning: true })
            .pipeThrough(guardrailFilterStream()),
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    console.error('Chat API error:', error);

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Handle other errors
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
