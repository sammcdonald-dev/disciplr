CREATE TABLE "bible_verses" (
	"id" serial PRIMARY KEY NOT NULL,
	"book" varchar(50) NOT NULL,
	"chapter" integer NOT NULL,
	"verse" integer NOT NULL,
	"text" text NOT NULL,
	"embedding" vector(768),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "Chat" DROP CONSTRAINT "Chat_userId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Document" DROP CONSTRAINT "Document_userId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Suggestion" DROP CONSTRAINT "Suggestion_userId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Chat" ALTER COLUMN "userId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "Document" ALTER COLUMN "userId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "Suggestion" ALTER COLUMN "userId" DROP NOT NULL;