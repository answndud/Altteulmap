DROP TABLE "auth_verification_tokens" CASCADE;--> statement-breakpoint
ALTER TABLE "auth_accounts" DROP COLUMN "id_token";--> statement-breakpoint
ALTER TABLE "auth_accounts" DROP COLUMN "session_state";