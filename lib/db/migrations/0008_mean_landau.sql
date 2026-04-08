ALTER TABLE "User" ADD COLUMN "stripe_customer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "subscription_status" varchar(64);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "current_period_end" timestamp;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "has_lifetime_access" boolean DEFAULT false;