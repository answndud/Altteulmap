CREATE INDEX "places_status_created_at_idx" ON "places" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "price_reports_status_created_at_idx" ON "price_reports" USING btree ("report_status","created_at");
