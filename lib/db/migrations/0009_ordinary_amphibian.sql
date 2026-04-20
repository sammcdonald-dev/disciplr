ALTER TABLE "bible_verses" ALTER COLUMN "embedding" SET DATA TYPE vector(3072);--> statement-breakpoint
ALTER TABLE "Chat" ALTER COLUMN "userId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "Document" ALTER COLUMN "userId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "Suggestion" ALTER COLUMN "userId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "free_chat_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
