CREATE TABLE "public_write_rate_limits" (
	"scope" varchar(80) NOT NULL,
	"actor_key" varchar(160) NOT NULL,
	"bucket_started_at" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_write_rate_limits_pk" PRIMARY KEY("scope","actor_key","bucket_started_at")
);
--> statement-breakpoint
CREATE INDEX "public_write_rate_limits_expires_at_idx" ON "public_write_rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "public_write_rate_limits_actor_updated_idx" ON "public_write_rate_limits" USING btree ("actor_key","updated_at");