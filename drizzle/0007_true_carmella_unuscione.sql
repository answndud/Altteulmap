ALTER TABLE "places" ADD COLUMN "primary_category_slug" varchar(80);--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "like_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "dislike_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "places" AS "p"
SET "primary_category_slug" = "derived"."category_slug"
FROM (
  SELECT
    "pc"."place_id",
    "c"."slug" AS "category_slug",
    row_number() OVER (
      PARTITION BY "pc"."place_id"
      ORDER BY "pc"."is_primary" DESC, "c"."sort_order" ASC, "c"."slug" ASC
    ) AS "row_number"
  FROM "place_categories" AS "pc"
  INNER JOIN "categories" AS "c" ON "c"."id" = "pc"."category_id"
) AS "derived"
WHERE "p"."id" = "derived"."place_id"
  AND "derived"."row_number" = 1;--> statement-breakpoint
UPDATE "places" AS "p"
SET
  "like_count" = "derived"."like_count",
  "dislike_count" = "derived"."dislike_count"
FROM (
  SELECT
    "place_id",
    count(*) FILTER (WHERE "reaction_type" = 'like')::integer AS "like_count",
    count(*) FILTER (WHERE "reaction_type" = 'dislike')::integer AS "dislike_count"
  FROM "place_reactions"
  GROUP BY "place_id"
) AS "derived"
WHERE "p"."id" = "derived"."place_id";--> statement-breakpoint
CREATE INDEX "places_status_primary_category_idx" ON "places" USING btree ("status","primary_category_slug");
