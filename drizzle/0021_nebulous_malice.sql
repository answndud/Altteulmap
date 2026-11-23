-- 0018이 수기 SQL로 만든 trigram 인덱스를 schema에 선언해 drizzle snapshot과 맞춘다.
-- 이미 적용된 DB에서는 IF NOT EXISTS로 건너뛰고, 새 DB에서는 0018 이후 여기서 한 번만 만들어진다.
CREATE INDEX IF NOT EXISTS "bookmarks_place_id_idx" ON "bookmarks" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "places_active_name_trgm_idx" ON "places" USING gin ("name" gin_trgm_ops) WHERE "places"."status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "places_active_business_name_trgm_idx" ON "places" USING gin ("business_name" gin_trgm_ops) WHERE "places"."status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "places_active_road_address_trgm_idx" ON "places" USING gin ("road_address" gin_trgm_ops) WHERE "places"."status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "places_active_district_trgm_idx" ON "places" USING gin ("district" gin_trgm_ops) WHERE "places"."status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "places_active_price_label_trgm_idx" ON "places" USING gin ("representative_price_label" gin_trgm_ops) WHERE "places"."status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "places_active_description_trgm_idx" ON "places" USING gin ("description" gin_trgm_ops) WHERE "places"."status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "places_active_note_trgm_idx" ON "places" USING gin ("note" gin_trgm_ops) WHERE "places"."status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_reports_reporter_user_idx" ON "price_reports" USING btree ("reporter_user_id");