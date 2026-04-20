# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
docker-compose up    # Start the app (Postgres + Redis + Next.js, runs migrations on startup)
docker-compose up -d # Start in background

npm run lint         # ESLint + Biome lint
npm run lint:fix     # Auto-fix lint issues
npm run format       # Format with Biome
npm run test         # Run Playwright E2E tests

# Database (run inside container or with local DB connection)
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Apply migrations
npm run db:studio    # Open Drizzle Studio GUI
npm run db:push      # Push schema directly (dev only)
npm run db:embed     # Generate pgvector embeddings for Bible verses
```

## Architecture

**disciplr** is a faith-focused AI chatbot (Next.js 15 App Router) where users converse with Biblical personas powered by Google Gemini, with Bible verse RAG, Stripe billing, and document/artifact generation.

### Layers

**Routing:** Two route groups — `app/(auth)` (login/register) and `app/(chat)` (main app, API routes, billing page). Landing page lives in `app/landing`.

**AI pipeline** (`lib/ai/`):
- `personas.ts` defines 5 personas (disciplr, moses, david, paul, mary-magdalene) with system prompts
- `models.ts` wraps Gemini with a fallback multi-key rotation provider (`FallbackLanguageModel`)
- `index.ts` selects the active model and conditionally attaches tools (tools are disabled for reasoning models)
- Per-message RAG: user messages are embedded with Gemini's text-embedding model, top-5 Bible verses fetched via pgvector L2 distance, injected into the system prompt

**Database** (`lib/db/`):
- Drizzle ORM over PostgreSQL + pgvector extension
- Schema: `users`, `chats` (with `personaId`), `messages_v2` (current), `messages` (deprecated v1), `documents`, `suggestions`, `votes`, `bibleVerses`
- Queries in `lib/db/queries.ts`; migrations in `lib/db/migrations/`

**Billing** (`lib/billing/`):
- Stripe checkout + customer portal via `/api/billing/*` routes
- Guest users get 8 free chats tracked server-side; paid users have subscription or lifetime access
- `OWNER_BYPASS_KEY` env var + cookie skips billing checks (testing/admin)
- Webhook at `/api/billing/webhook` updates subscription state

**Chat API** (`app/(chat)/api/chat/route.ts`):
1. Validates auth + billing entitlements
2. Saves user message to DB
3. Embeds message → pgvector similarity search → prepends relevant verses to system prompt
4. Streams Gemini response via Vercel AI SDK SSE
5. On finish: saves assistant message, updates chat metadata

**Frontend state:** SWR for history/chat data, `useChat` from `@ai-sdk/react` for streaming, persona selection stored in a cookie.

### Persona-scoped chat history
Each `Chat` row stores a `personaId`. The `/api/history` route accepts a `persona_id` query param, and SWR caches are keyed per-persona so switching personas shows only that persona's chats. See `PERSONA_CHAT_HISTORY_IMPLEMENTATION.md` for the full design.

### Error handling
`lib/errors.ts` exports `ChatSDKError` with typed codes in `ErrorType:Surface` format. Set `visibility: 'response'` for client-visible errors, `'log'` for internal-only.

## Environment variables

Copy `.env.example` to `.env.local`. Required vars:

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | NextAuth secret (`openssl rand -base64 32`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini key(s) — comma-separate multiple for rotation |
| `POSTGRES_URL` / `DATABASE_URL` | PostgreSQL connection string |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_APP_URL` | Public URL for Stripe redirects |
| `REDIS_URL` | Optional — enables resumable streams |
| `OWNER_BYPASS_KEY` | Optional — set cookie `owner-key` to this value to bypass billing |

Docker Compose (`docker-compose.yml`) spins up Postgres 15 with pgvector + Redis + the app.
