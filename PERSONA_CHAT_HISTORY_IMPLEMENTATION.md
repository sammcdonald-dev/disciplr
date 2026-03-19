# Persona-Based Chat History Implementation

This document explains all the changes made to implement persona-based chat history filtering, where each persona has its own separate chat history.

## Overview

The goal was to relate chat history to the selected persona model, so that when a different persona is selected, the user sees a different set of chat histories for each persona. This allows users to have separate conversations with different Biblical personas (Moses, David, Paul, Mary Magdalene, etc.).

---

## 1. Database Schema Changes

### File: `lib/db/schema.ts`

**What Changed:**
- Added `personaId` field to the `chat` table schema

```typescript
export const chat = pgTable('Chat', {
  // ... existing fields
  personaId: varchar('personaId', { length: 64 })
    .notNull()
    .default('bible-chat'),
});
```

**Why:**
- Each chat needs to be associated with a specific persona
- The default value `'bible-chat'` ensures existing chats are assigned to the default persona
- `NOT NULL` constraint ensures all chats have a persona assigned
- Length of 64 characters is sufficient for persona IDs (e.g., 'bible-chat', 'moses', 'david')

---

## 2. Database Migration

### File: `lib/db/migrations/0007_add_persona_id_to_chat.sql`

**What Changed:**
- Created a new migration file to add the `personaId` column to the existing `Chat` table

```sql
ALTER TABLE "Chat" ADD COLUMN "personaId" varchar(64) DEFAULT 'bible-chat' NOT NULL;
```

**Why:**
- Adds the new column to the database
- Sets default value for existing rows to `'bible-chat'`
- Ensures the column cannot be null

### File: `lib/db/migrations/meta/_journal.json`

**What Changed:**
- Added migration entry to the journal

**Why:**
- Drizzle needs to track all migrations
- This tells Drizzle that migration 0007 exists and has been applied

---

## 3. Database Query Functions

### File: `lib/db/queries.ts`

#### A. Updated `saveChat` function

**What Changed:**
- Added `personaId` parameter to the function signature
- Modified the database insert to include `personaId`

```typescript
export async function saveChat({
  id,
  userId,
  title,
  visibility,
  personaId, // NEW
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
  personaId: string; // NEW
}) {
  return await db.insert(chat).values({
    id,
    createdAt: new Date(),
    userId,
    title,
    visibility,
    personaId, // NEW
  });
}
```

**Why:**
- When creating a new chat, we need to save which persona it belongs to
- This allows us to filter chats by persona later

#### B. Updated `getChatsByUserId` function

**What Changed:**
- Added optional `personaId` parameter
- Modified the query to filter by `personaId` when provided
- Updated pagination logic to also filter by `personaId` when checking for the selected chat

```typescript
export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
  personaId, // NEW - optional
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
  personaId?: string; // NEW
}) {
  const query = (whereCondition?: SQL<any>) => {
    const conditions: SQL<any>[] = [eq(chat.userId, id)];
    
    if (personaId) {
      conditions.push(eq(chat.personaId, personaId)); // NEW - filter by persona
    }
    
    // ... rest of query logic
  };
  
  // Also updated pagination logic to filter by personaId
  // when checking if the selected chat exists
}
```

**Why:**
- Allows fetching chats filtered by a specific persona
- When `personaId` is provided, only chats for that persona are returned
- When `personaId` is not provided, all chats for the user are returned (backward compatibility)
- Pagination must also respect the persona filter to ensure correct pagination

---

## 4. API Route Changes

### File: `app/(chat)/api/chat/route.ts`

#### A. Chat Creation

**What Changed:**
- Modified chat creation to save the `personaId` when creating a new chat
- Gets persona from request body or cookie as fallback

```typescript
// Get selected persona from request body or fallback to cookie
const personaId = selectedPersonaId || (await getSelectedPersonaId());
const selectedPersona = personaId
  ? personas.find((p) => p.id === personaId)
  : personas.find((p) => p.id === DEFAULT_BIBLE_CHAT_PERSONA_ID);
const finalPersonaId = selectedPersona?.id || DEFAULT_BIBLE_CHAT_PERSONA_ID;

// Save chat with personaId
await saveChat({
  id,
  userId: session.user.id,
  title,
  visibility: selectedVisibilityType,
  personaId: finalPersonaId, // NEW
});
```

**Why:**
- When a user creates a new chat, we need to associate it with the currently selected persona
- This ensures the chat appears in the correct persona's history
- Falls back to cookie if not provided in request body

### File: `app/(chat)/api/history/route.ts`

**What Changed:**
- Added `persona_id` query parameter extraction
- Pass `personaId` to the `getChatsByUserId` function

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Number.parseInt(searchParams.get('limit') || '10');
  const startingAfter = searchParams.get('starting_after');
  const endingBefore = searchParams.get('ending_before');
  const personaId = searchParams.get('persona_id') || undefined; // NEW

  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chats = await getChatsByUserId({
    id: session.user.id,
    limit,
    startingAfter,
    endingBefore,
    personaId, // NEW - pass to query function
  });

  return Response.json(chats);
}
```

**Why:**
- The API needs to accept a `persona_id` parameter from the frontend
- This allows the frontend to request chats for a specific persona
- When not provided, returns all chats (for backward compatibility)

---

## 5. Frontend Component Changes

### File: `components/app-sidebar.tsx`

**What Changed:**
- Pass `selectedPersonaId` prop to `SidebarHistory` component

```typescript
export function AppSidebar({
  user,
  session,
  selectedPersonaId, // Already receiving this prop
}: { user: User | undefined; session: Session; selectedPersonaId: string }) {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarHistory 
          user={user} 
          selectedPersonaId={selectedPersonaId} // NEW - pass personaId
        />
        {/* ... */}
      </SidebarContent>
    </Sidebar>
  );
}
```

**Why:**
- The sidebar needs to know which persona is selected
- This prop flows from the layout (which reads it from cookies) down to the history component

### File: `components/sidebar-history.tsx`

**What Changed:**
This is the most complex change. Here's what was modified:

#### A. Component Props

```typescript
export function SidebarHistory({
  user,
  selectedPersonaId, // NEW - added this prop
}: {
  user: User | undefined;
  selectedPersonaId: string; // NEW
}) {
  // ...
}
```

#### B. SWR Infinite Key Function

**What Changed:**
- Completely rewrote the key function to include `selectedPersonaId` in the API URL
- This ensures SWR treats different personas as separate queries

```typescript
const getKey = (pageIndex: number, previousPageData: ChatHistory | null) => {
  // Return null if we've reached the end
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }
  
  // Build the key with personaId included in the URL
  const personaParam = selectedPersonaId 
    ? `&persona_id=${encodeURIComponent(selectedPersonaId)}` 
    : '';
  
  if (pageIndex === 0) {
    return `/api/history?limit=${PAGE_SIZE}${personaParam}`;
  }

  const firstChatFromPage = previousPageData?.chats.at(-1);
  if (!firstChatFromPage) return null;

  return `/api/history?ending_before=${firstChatFromPage.id}&limit=${PAGE_SIZE}${personaParam}`;
};
```

**Why:**
- SWR uses the key function to cache data
- By including `personaId` in the key, SWR treats each persona as a separate query
- When `selectedPersonaId` changes, SWR automatically detects the key change and fetches new data
- `encodeURIComponent` ensures special characters in persona IDs are properly URL-encoded

#### C. SWR Infinite Configuration

```typescript
const {
  data: paginatedChatHistories,
  setSize,
  isValidating,
  isLoading,
  mutate,
} = useSWRInfinite<ChatHistory>(getKey, fetcher, {
  revalidateFirstPage: true, // NEW - ensures first page is revalidated
});
```

**Why:**
- Removed `fallbackData: []` to avoid showing empty state prematurely
- `revalidateFirstPage: true` ensures data is fresh when the component mounts
- When `selectedPersonaId` changes, the key changes, causing SWR to automatically fetch new data

#### D. Loading State Logic

**What Changed:**
- Improved loading state detection

```typescript
// Show loading state if we're loading and don't have data yet
if (isLoading || (!paginatedChatHistories && isValidating)) {
  return <LoadingSkeleton />;
}
```

**Why:**
- Shows loading skeleton when fetching data
- Also shows when validating (refreshing) data if we don't have cached data yet

#### E. Empty State Logic

**What Changed:**
- Fixed empty state detection to only show after data has loaded

```typescript
// Only check for empty history if we've finished loading and received a response
const hasLoadedData = paginatedChatHistories && paginatedChatHistories.length > 0;
const hasEmptyChatHistory =
  !isLoading &&
  !isValidating &&
  hasLoadedData &&
  paginatedChatHistories.every((page) => page.chats.length === 0);

// Show empty state if we've loaded but have no chats
if (
  !isLoading &&
  !isValidating &&
  (hasEmptyChatHistory ||
    (paginatedChatHistories &&
      paginatedChatHistories.length > 0 &&
      paginatedChatHistories[0]?.chats.length === 0))
) {
  return <EmptyStateMessage />;
}
```

**Why:**
- Previous logic showed empty state too early (when data was still loading)
- Now only shows empty state after confirming data has loaded and is actually empty
- Prevents flickering between loading and empty states

#### F. Render Logic

**What Changed:**
- Added check to ensure we have data before trying to render chats

```typescript
{paginatedChatHistories && paginatedChatHistories.length > 0 && (() => {
  const chatsFromHistory = paginatedChatHistories.flatMap(
    (paginatedChatHistory) => paginatedChatHistory.chats,
  );
  const groupedChats = groupChatsByDate(chatsFromHistory);
  // ... render grouped chats
})()}
```

**Why:**
- Prevents errors when trying to render undefined data
- Only renders chats when we have at least one page of data

---

## 6. Chat Detail Page Changes

### File: `app/(chat)/chat/[id]/page.tsx`

**What Changed:**
- Modified to use `personaId` from the database chat record instead of just the cookie

```typescript
const chat = await getChatById({ id });
// Use personaId from the chat (database) if available, otherwise fallback to cookie
const personaId = chat.personaId || cookieStore.get('bible-chat')?.value || DEFAULT_BIBLE_CHAT_PERSONA_ID;

return (
  <Chat
    id={chat.id}
    initialMessages={uiMessages}
    initialChatModel={chatModelFromCookie.value}
    initialPersonaId={personaId} // Use personaId from database
    // ...
  />
);
```

**Why:**
- When opening an existing chat, we should use the persona it was created with
- This ensures the chat continues with the same persona it was started with
- Falls back to cookie if database doesn't have personaId (for backward compatibility)

---

## 7. Cache Invalidation Changes

### File: `components/chat.tsx`

**What Changed:**
- Updated cache invalidation to invalidate all history caches (all personas)

```typescript
onFinish: () => {
  // Invalidate all chat history caches (all personas)
  mutate(
    (key) => typeof key === 'string' && key.startsWith('/api/history'),
  );
},
```

**Why:**
- When a new chat is created or updated, we need to refresh the history
- Since we don't know which persona's cache to invalidate, we invalidate all
- This ensures the history updates correctly for the active persona

### File: `hooks/use-chat-visibility.ts`

**What Changed:**
- Similar cache invalidation update

```typescript
const setVisibilityType = (updatedVisibilityType: VisibilityType) => {
  setLocalVisibility(updatedVisibilityType);
  // Invalidate all chat history caches (all personas)
  mutate(
    (key) => typeof key === 'string' && key.startsWith('/api/history'),
  );
  // ...
};
```

**Why:**
- When chat visibility changes, we need to refresh the history
- Invalidating all persona caches ensures the change is reflected everywhere

---

## 8. Removed Unused Code

### Files: Various

**What Changed:**
- Removed unused imports (`useEffect`, `unstable_serialize`, `getChatHistoryPaginationKey` from some files)
- Cleaned up unused function exports

**Why:**
- Keeps code clean and reduces bundle size
- Removes potential confusion about which function to use

---

## How It All Works Together

### Flow 1: Creating a New Chat

1. User selects a persona (e.g., "Moses")
2. User creates a new chat
3. `app/(chat)/api/chat/route.ts` receives the request with `selectedPersonaId`
4. `saveChat` is called with the `personaId`
5. Chat is saved to database with `personaId = 'moses'`
6. Chat appears in Moses' chat history

### Flow 2: Viewing Chat History

1. User selects a persona (e.g., "David")
2. `AppSidebar` receives `selectedPersonaId = 'david'`
3. `SidebarHistory` receives `selectedPersonaId = 'david'`
4. SWR Infinite key function generates: `/api/history?limit=20&persona_id=david`
5. API route receives request with `persona_id = 'david'`
6. `getChatsByUserId` filters chats where `personaId = 'david'`
7. Only David's chats are returned and displayed

### Flow 3: Switching Personas

1. User switches from "Moses" to "Paul"
2. `selectedPersonaId` prop changes from `'moses'` to `'paul'`
3. SWR Infinite detects key change (URL includes different `persona_id`)
4. SWR automatically fetches new data for Paul's chats
5. History updates to show only Paul's chats
6. Old Moses chats remain cached but not displayed

### Flow 4: Opening an Existing Chat

1. User clicks on a chat from the history
2. `app/(chat)/chat/[id]/page.tsx` loads the chat from database
3. Chat record includes `personaId = 'moses'` (the persona it was created with)
4. Chat component uses `personaId = 'moses'` for the conversation
5. Chat continues with the same persona it was started with

---

## Key Design Decisions

### 1. Why Store `personaId` in Database?

**Decision:** Store `personaId` in the chat record
**Reason:** 
- Chats should maintain their persona even if user switches personas
- Allows filtering by persona in database queries (efficient)
- Enables analytics on which personas are used most

### 2. Why Include `personaId` in SWR Key?

**Decision:** Include `personaId` in the API URL (SWR key)
**Reason:**
- SWR automatically handles caching and refetching when keys change
- Different personas are treated as separate queries
- No manual cache invalidation needed when switching personas
- Each persona's history is cached separately

### 3. Why Default to `'bible-chat'`?

**Decision:** Default `personaId` to `'bible-chat'`
**Reason:**
- Backward compatibility with existing chats
- Migration sets all existing chats to default persona
- Users don't lose their existing chats

### 4. Why Filter in Database vs Frontend?

**Decision:** Filter chats by `personaId` in database query
**Reason:**
- More efficient (only fetch what's needed)
- Better performance (less data transferred)
- Supports pagination correctly
- Scalable as chat history grows

### 5. Why Optional `personaId` Parameter?

**Decision:** Make `personaId` optional in `getChatsByUserId`
**Reason:**
- Backward compatibility
- Allows fetching all chats when needed
- Flexible API that can be used in different contexts

---

## Testing Considerations

### What to Test:

1. **Creating chats with different personas:**
   - Create chat with persona A
   - Create chat with persona B
   - Verify each appears in correct persona's history

2. **Switching personas:**
   - Select persona A, see their chats
   - Switch to persona B, see their chats (different set)
   - Switch back to persona A, see original chats (cached)

3. **Opening existing chats:**
   - Open chat created with persona A
   - Verify it uses persona A (not current selection)
   - Continue conversation with correct persona

4. **Empty states:**
   - Select persona with no chats
   - Verify empty state message appears
   - Verify no loading skeleton flicker

5. **Pagination:**
   - Create many chats for one persona
   - Verify pagination works correctly
   - Verify only that persona's chats are paginated

---

## Migration Notes

### Running the Migration:

```bash
npm run db:migrate
# Or inside Docker:
docker exec bible-chat-app npm run db:migrate
```

### What Happens:

1. Migration adds `personaId` column to `Chat` table
2. All existing chats get `personaId = 'bible-chat'` (default)
3. New chats will have the personaId from when they were created
4. No data loss, all existing chats remain accessible

### Rollback (if needed):

If you need to rollback, you would:
1. Remove the `personaId` column from schema
2. Create a new migration to drop the column
3. Update all code to not use `personaId`
4. Run the rollback migration

---

## Future Enhancements

Potential improvements that could be made:

1. **Persona-specific UI:**
   - Different styling for different personas
   - Persona avatars in chat list
   - Persona indicators

2. **Cross-persona features:**
   - Search across all personas
   - Merge conversations
   - Export all chats

3. **Analytics:**
   - Track which personas are used most
   - Average conversation length per persona
   - User preferences

4. **Performance:**
   - Index on `personaId` column for faster queries
   - Cache warming for frequently used personas
   - Lazy loading of persona histories

---

## Summary

This implementation successfully separates chat histories by persona, allowing users to have distinct conversations with different Biblical personas. The key changes were:

1. **Database:** Added `personaId` column to track which persona each chat belongs to
2. **Backend:** Modified queries and API routes to filter by persona
3. **Frontend:** Updated components to pass and use `personaId` for filtering
4. **Caching:** Leveraged SWR's key-based caching to handle multiple persona histories

The solution is scalable, efficient, and maintains backward compatibility with existing chats.

