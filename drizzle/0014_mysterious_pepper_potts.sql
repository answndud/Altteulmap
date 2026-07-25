ALTER TABLE "places" ADD CONSTRAINT "places_latitude_range_check" CHECK ("places"."latitude" is null or ("places"."latitude" >= -90 and "places"."latitude" <= 90));--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_longitude_range_check" CHECK ("places"."longitude" is null or ("places"."longitude" >= -180 and "places"."longitude" <= 180));--> statement-breakpoint
ALTER TABLE "price_items" ADD CONSTRAINT "price_items_amount_positive_check" CHECK ("price_items"."amount" > 0);--> statement-breakpoint
ALTER TABLE "price_items" ADD CONSTRAINT "price_items_verified_count_nonnegative_check" CHECK ("price_items"."verified_report_count" >= 0);--> statement-breakpoint
ALTER TABLE "price_reports" ADD CONSTRAINT "price_reports_amount_positive_check" CHECK ("price_reports"."amount" > 0);
