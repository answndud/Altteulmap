ALTER TABLE "visit_activity" ADD COLUMN "entry_ref" varchar(24);--> statement-breakpoint
ALTER TABLE "visit_activity" ADD COLUMN "entry_source" varchar(32);--> statement-breakpoint
CREATE INDEX "visit_activity_date_ref_idx" ON "visit_activity" USING btree ("visit_date","entry_ref");--> statement-breakpoint
CREATE INDEX "visit_activity_date_source_idx" ON "visit_activity" USING btree ("visit_date","entry_source");