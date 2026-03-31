ALTER TABLE "places" ALTER COLUMN "latitude" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ALTER COLUMN "longitude" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "slug" varchar(160) NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "district" varchar(80) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "places_slug_unique" ON "places" USING btree ("slug");