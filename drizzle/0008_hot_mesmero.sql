CREATE TABLE "visit_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_key" varchar(96) NOT NULL,
	"user_id" uuid,
	"visitor_id" varchar(64),
	"route_group" varchar(24) NOT NULL,
	"route_path" varchar(160) NOT NULL,
	"visit_date" date NOT NULL,
	"bucket_started_at" timestamp with time zone NOT NULL,
	"hit_count" integer DEFAULT 1 NOT NULL,
	"first_visited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_visited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visit_activity" ADD CONSTRAINT "visit_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "visit_activity_actor_group_bucket_unique" ON "visit_activity" USING btree ("actor_key","route_group","bucket_started_at");--> statement-breakpoint
CREATE INDEX "visit_activity_date_group_idx" ON "visit_activity" USING btree ("visit_date","route_group");--> statement-breakpoint
CREATE INDEX "visit_activity_date_actor_idx" ON "visit_activity" USING btree ("visit_date","actor_key");--> statement-breakpoint
CREATE INDEX "visit_activity_user_date_idx" ON "visit_activity" USING btree ("user_id","visit_date");--> statement-breakpoint
CREATE INDEX "visit_activity_visitor_date_idx" ON "visit_activity" USING btree ("visitor_id","visit_date");