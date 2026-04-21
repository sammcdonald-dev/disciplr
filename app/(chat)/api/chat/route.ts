import {
  convertToModelMessages,
  createUIMessageStream,
  embed,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { auth, type UserType } from "@/app/(auth)/auth";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { sql } from "drizzle-orm";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getUserPromptCount,
  saveChat,
  saveMessages,
} from "@/lib/db/queries";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { createDocument } from "@/lib/ai/tools/create-document";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { isProductionEnvironment } from "@/lib/constants";
import { myProvider } from "@/lib/ai/providers";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { postRequestBodySchema, type PostRequestBody } from "./schema";
import { geolocation } from "@vercel/functions";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import { after } from "next/server";
import { ChatSDKError } from "@/lib/errors";
import { DEFAULT_BIBLE_CHAT_PERSONA_ID, personas } from "@/lib/ai/personas";
import type { ChatMessage } from "@/lib/types";
import type { ChatModel } from "@/lib/ai/models";
import type { VisibilityType } from "@/components/visibility-selector";
import type { LanguageModelId } from "@/lib/ai/providers";
import { cookies } from "next/headers";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { db } from "@/lib/db";
import { getRandomGoogleApiKey } from "@/lib/ai/api-keys";

async function getSelectedPersonaId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get("disciplr")?.value;
}

async function retrieveBibleContext(userMessage: string): Promise<string> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.warn(
      "GOOGLE_GENERATIVE_AI_API_KEY is not set; skipping embedding.",
    );
    return "";
  }

  try {
    const google = createGoogleGenerativeAI({
      apiKey: getRandomGoogleApiKey(),
    });

    const { embedding } = await embed({
      model: google.textEmbeddingModel("gemini-embedding-001"),
      value: userMessage,
    });

    if (!embedding || embedding.length === 0) {
      console.warn("Could not embed user message");
      return "";
    }

    const vectorLiteral = `[${embedding.join(",")}]`;
    const verses = await db.execute(sql`
      SELECT book, chapter, verse, text,
             (embedding <-> ${vectorLiteral}::vector) AS distance
      FROM bible_verses
      WHERE embedding IS NOT NULL
      ORDER BY distance ASC
      LIMIT 5
    `);

    if (!verses || verses.length === 0) {
      return "";
    }

    const DISTANCE_THRESHOLD = 1.2;
    const relevant = (verses as any[]).filter(
      (row) => parseFloat(row.distance) < DISTANCE_THRESHOLD,
    );

    if (relevant.length === 0) {
      return "";
    }

    const context = relevant
      .map(
        (row: any, i: number) =>
          `[${i + 1}] ${row.book} ${row.chapter}:${row.verse}\n"${row.text}"`,
      )
      .join("\n\n");

    return `Relevant Bible Passages:\n${context}`;
  } catch (err) {
    console.warn("RAG context retrieval failed, continuing without it:", err);
    return "";
  }
}

// TransformStream to enforce guardrails
function guardrailFilterStream(): TransformStream {
  const blockedTerms = [
    "violence",
    "hate",
    "self-harm",
    "suicide",
    "explicit",
    "racist",
    "bully",
    "harass",
  ];

  return new TransformStream({
    transform(chunk, controller) {
      const text = (chunk?.content ?? "").toLowerCase();

      const isBlocked = blockedTerms.some((term) => text.includes(term));

      if (isBlocked) {
        controller.enqueue({
          ...chunk,
          content: "⚠️ Response blocked due to unsafe content.",
        });
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
      if (error.message.includes("REDIS_URL")) {
        console.log(
          " > Resumable streams are disabled due to missing REDIS_URL",
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
    return new ChatSDKError("bad_request:api").toResponse();
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
      selectedChatModel: ChatModel["id"];
      selectedVisibilityType: VisibilityType;
      selectedPersonaId?: string;
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userType: UserType = session.user.type;
    const isGuest = userType === "guest";

    if (isGuest) {
      // For guest users, check total prompt count (limit: 8)
      const promptCount = await getUserPromptCount({ id: session.user.id });
      if (promptCount >= 8) {
        return new ChatSDKError("rate_limit:auth").toResponse();
      }
    }

    // For unpaid logged in users check after 12 messages for payment subscription
    // For regular users, check daily message limit
    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }
    // TODO: ----- RAG step: enrich with Bible context -----
    const firstPart = message.parts[0];
    const bibleContext =
      firstPart.type === "text"
        ? await retrieveBibleContext(
            (firstPart as { type: "text"; text: string }).text,
          )
        : "";

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
        return new ChatSDKError("forbidden:chat").toResponse();
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
          role: "user",
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
      : "";

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
            selectedChatModel === "chat-model-reasoning"
              ? []
              : [
                  "getWeather",
                  "createDocument",
                  "updateDocument",
                  "requestSuggestions",
                ],
          experimental_transform: smoothStream({ chunking: "word" }),
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
            functionId: "stream-text",
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
        return "Oops, an error occurred!";
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
    console.error("Chat API error:", error);

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Handle other errors
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (!chat) {
    return new ChatSDKError("not_found:chat").toResponse();
  }

  if (chat.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
