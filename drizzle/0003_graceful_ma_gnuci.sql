CREATE TYPE "public"."place_reaction_type" AS ENUM('like', 'dislike');--> statement-breakpoint
CREATE TABLE "place_reactions" (
	"user_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"reaction_type" "place_reaction_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_reactions_pk" PRIMARY KEY("user_id","place_id")
);
--> statement-breakpoint
ALTER TABLE "place_reactions" ADD CONSTRAINT "place_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_reactions" ADD CONSTRAINT "place_reactions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "place_reactions_place_type_idx" ON "place_reactions" USING btree ("place_id","reaction_type");--> statement-breakpoint
CREATE INDEX "place_reactions_user_updated_at_idx" ON "place_reactions" USING btree ("user_id","updated_at");