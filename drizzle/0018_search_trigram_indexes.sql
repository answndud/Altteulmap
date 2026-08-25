CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS places_active_name_trgm_idx ON places USING gin (name gin_trgm_ops) WHERE status = 'active';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS places_active_business_name_trgm_idx ON places USING gin (business_name gin_trgm_ops) WHERE status = 'active';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS places_active_road_address_trgm_idx ON places USING gin (road_address gin_trgm_ops) WHERE status = 'active';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS places_active_district_trgm_idx ON places USING gin (district gin_trgm_ops) WHERE status = 'active';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS places_active_price_label_trgm_idx ON places USING gin (representative_price_label gin_trgm_ops) WHERE status = 'active';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS places_active_description_trgm_idx ON places USING gin (description gin_trgm_ops) WHERE status = 'active';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS places_active_note_trgm_idx ON places USING gin (note gin_trgm_ops) WHERE status = 'active';
