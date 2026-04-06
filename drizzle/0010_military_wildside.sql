CREATE TYPE "public"."moderation_suggestion_action" AS ENUM('approve', 'review', 'reject');--> statement-breakpoint
CREATE TYPE "public"."moderation_suggestion_subject_type" AS ENUM('place_submission', 'price_report', 'content_report');--> statement-breakpoint
CREATE TABLE "moderation_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "moderation_suggestion_subject_type" NOT NULL,
	"subject_key" varchar(160) NOT NULL,
	"provider" varchar(40) DEFAULT 'local_rule_agent' NOT NULL,
	"suggested_action" "moderation_suggestion_action" NOT NULL,
	"confidence" integer NOT NULL,
	"summary" text NOT NULL,
	"checks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_suggestions_subject_unique" ON "moderation_suggestions" USING btree ("subject_type","subject_key");--> statement-breakpoint
CREATE INDEX "moderation_suggestions_subject_updated_idx" ON "moderation_suggestions" USING btree ("subject_type","updated_at");