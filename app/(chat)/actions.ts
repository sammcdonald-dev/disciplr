"use server";
import { generateText, type UIMessage } from "ai";
import { cookies } from "next/headers";
import { deleteMessagesByChatIdAfterTimestamp, getMessageById, updateChatVisiblityById, } from "@/lib/db/queries";
import type { VisibilityType } from "@/components/visibility-selector";
import { myProvider } from "@/lib/ai/providers";
import type { Persona } from "@/lib/ai/personas";

// Blocked terms list - add more as needed
const BLOCKED_TERMS = [
  // Profanity and harassment
  "fuck", "shit", "bitch", "asshole", "dick", "cunt",
  "nigger", "nigga", "chink", "spic", "gook", "kike",
  // Hate speech
  "nazi", "hitler", "kkk", "white power",
  // Violence threats
  "kill", "murder", "bomb", "shoot", "attack",
  // Add more based on community standards
];

// Check if message contains blocked terms
function containsBlockedTerms(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return BLOCKED_TERMS.some(term => lowerMessage.includes(term));
}

// Get chat count from cookies/session
export async function getChatCount(): Promise<number> {
  const cookieStore = await cookies();
  const countStr = cookieStore.get("chat-count")?.value || "0";
  return parseInt(countStr, 10);
}

// Increment chat count
export async function incrementChatCount(): Promise<void> {
  const cookieStore = await cookies();
  const currentCount = await getChatCount();
  cookieStore.set("chat-count", (currentCount + 1).toString());
}

// Reset chat count (after successful payment)
export async function resetChatCount(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("chat-count", "0");
}

// Check if user is owner (bypass payment)
export async function isOwner(): Promise<boolean> {
  const cookieStore = await cookies();
  const ownerKey = cookieStore.get("owner-key")?.value;
  const expectedKey = process.env.OWNER_BYPASS_KEY;
  return ownerKey === expectedKey && !!expectedKey;
}

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function saveChatPersonaAsCookie(persona: Persona["id"]) {
  const cookieStore = await cookies();
  cookieStore.set("disciplr", persona);
}

export async function generateTitleFromUserMessage({ message, }: { message: UIMessage; }) {
  try {
    // Check for blocked terms before processing
    if (containsBlockedTerms(message.content)) {
      throw new Error("Message contains inappropriate content");
    }
    
    const { text: title } = await generateText({
      model: myProvider.languageModel("title-model"),
      system: `\n - you will generate a short title based on the first message a user begins a conversation with\n - ensure it is not more than 80 characters long\n - the title should be a summary of the user's message\n - do not use quotes or colons`,
      prompt: JSON.stringify(message),
    });
    return title;
  } catch (error) {
    // Handle quota errors gracefully
    if (error instanceof Error && error.message.includes("quota")) {
      console.warn("Quota exceeded for title generation, using fallback title");
      return "New Chat";
    }
    // Handle blocked terms error
    if (error instanceof Error && error.message.includes("inappropriate content")) {
      throw error; // Re-throw to be handled by calling function
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

export async function updateChatVisibility({ chatId, visibility, }: { chatId: string; visibility: VisibilityType; }) {
  await updateChatVisiblityById({ chatId, visibility });
}