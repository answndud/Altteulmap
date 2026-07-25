ALTER TABLE "places" ADD COLUMN "source_provider" varchar(40) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "source_external_id" varchar(160);--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "source_import_batch" varchar(80);--> statement-breakpoint
ALTER TABLE "price_items" ADD COLUMN "source_provider" varchar(40) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "price_items" ADD COLUMN "source_external_id" varchar(160);--> statement-breakpoint
ALTER TABLE "price_items" ADD COLUMN "source_import_batch" varchar(80);--> statement-breakpoint
ALTER TABLE "price_reports" ADD COLUMN "source_provider" varchar(40) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "price_reports" ADD COLUMN "source_external_id" varchar(160);--> statement-breakpoint
ALTER TABLE "price_reports" ADD COLUMN "source_import_batch" varchar(80);--> statement-breakpoint
CREATE UNIQUE INDEX "places_source_external_unique" ON "places" USING btree ("source_provider","source_external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "price_items_source_external_unique" ON "price_items" USING btree ("source_provider","source_external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "price_reports_source_external_unique" ON "price_reports" USING btree ("source_provider","source_external_id");