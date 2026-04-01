ALTER TABLE "place_reactions" DROP CONSTRAINT "place_reactions_pk";--> statement-breakpoint
ALTER TABLE "place_reactions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "place_reactions" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "place_reactions" ADD COLUMN "visitor_id" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "place_reactions_user_place_unique" ON "place_reactions" USING btree ("user_id","place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "place_reactions_visitor_place_unique" ON "place_reactions" USING btree ("visitor_id","place_id");--> statement-breakpoint
CREATE INDEX "place_reactions_visitor_updated_at_idx" ON "place_reactions" USING btree ("visitor_id","updated_at");