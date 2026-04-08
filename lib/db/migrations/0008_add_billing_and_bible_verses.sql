CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripe_customer_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subscription_status" varchar(64);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "current_period_end" timestamp;
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "has_lifetime_access" boolean DEFAULT false;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bible_verses" (
	"id" serial PRIMARY KEY NOT NULL,
	"book" varchar(50) NOT NULL,
	"chapter" integer NOT NULL,
	"verse" integer NOT NULL,
	"text" text NOT NULL,
	"embedding" vector(3072),
	"created_at" timestamp DEFAULT now()
);
