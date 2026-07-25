ALTER TABLE "price_reports" ADD COLUMN "reporter_visitor_id" varchar(64);--> statement-breakpoint
ALTER TABLE "price_reports" ADD COLUMN "submission_key" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "price_reports_submission_key_unique" ON "price_reports" USING btree ("submission_key");