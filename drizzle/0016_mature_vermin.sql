CREATE TYPE "public"."moderation_suggestion_status" AS ENUM('pending', 'applied', 'superseded');--> statement-breakpoint
ALTER TABLE "moderation_suggestions" ADD COLUMN "status" "moderation_suggestion_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "moderation_suggestions" ADD COLUMN "model_version" varchar(80);--> statement-breakpoint
ALTER TABLE "moderation_suggestions" ADD COLUMN "prompt_version" varchar(40);--> statement-breakpoint
ALTER TABLE "moderation_suggestions" ADD COLUMN "input_fingerprint" varchar(64);--> statement-breakpoint
ALTER TABLE "moderation_suggestions" ADD CONSTRAINT "moderation_suggestions_confidence_range_check" CHECK ("moderation_suggestions"."confidence" >= 0 and "moderation_suggestions"."confidence" <= 100);--> statement-breakpoint
ALTER TABLE "moderation_suggestions" ADD CONSTRAINT "moderation_suggestions_summary_length_check" CHECK (char_length("moderation_suggestions"."summary") between 1 and 2000);