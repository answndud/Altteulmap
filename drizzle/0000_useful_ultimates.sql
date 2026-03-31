CREATE TYPE "public"."comment_status" AS ENUM('visible', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."content_report_status" AS ENUM('open', 'reviewing', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."content_report_target_type" AS ENUM('place', 'price_item', 'comment');--> statement-breakpoint
CREATE TYPE "public"."place_status" AS ENUM('active', 'hidden', 'closed', 'pending_review');--> statement-breakpoint
CREATE TYPE "public"."price_report_status" AS ENUM('accepted', 'rejected', 'pending_review');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('unverified', 'verified');--> statement-breakpoint
CREATE TABLE "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid,
	"action_type" varchar(50) NOT NULL,
	"target_type" varchar(40) NOT NULL,
	"target_id" uuid,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expires_at" integer,
	"token_type" varchar(50),
	"scope" text,
	"id_token" text,
	"session_state" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_verification_tokens" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "auth_verification_tokens_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"user_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_pk" PRIMARY KEY("user_id","place_id")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"slug" varchar(80) NOT NULL,
	"name" varchar(80) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"status" "comment_status" DEFAULT 'visible' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_user_id" uuid,
	"target_type" "content_report_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"reason_type" varchar(50) NOT NULL,
	"detail" text,
	"status" "content_report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "place_categories" (
	"place_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "place_categories_pk" PRIMARY KEY("place_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"business_name" varchar(120),
	"description" text,
	"road_address" text NOT NULL,
	"lot_address" text,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"status" "place_status" DEFAULT 'active' NOT NULL,
	"representative_price_amount" integer,
	"representative_price_label" varchar(120),
	"verified_price_item_count" integer DEFAULT 0 NOT NULL,
	"last_price_updated_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"label" varchar(120) NOT NULL,
	"normalized_label" varchar(120) NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'KRW' NOT NULL,
	"unit_label" varchar(50),
	"is_representative" boolean DEFAULT false NOT NULL,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"verified_report_count" integer DEFAULT 0 NOT NULL,
	"latest_reported_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"price_item_id" uuid,
	"reporter_user_id" uuid,
	"label" varchar(120) NOT NULL,
	"normalized_label" varchar(120) NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'KRW' NOT NULL,
	"unit_label" varchar(50),
	"comment" text,
	"report_status" "price_report_status" DEFAULT 'accepted' NOT NULL,
	"snapshot_verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"nickname" varchar(60),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_categories" ADD CONSTRAINT "place_categories_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_categories" ADD CONSTRAINT "place_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_items" ADD CONSTRAINT "price_items_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_items" ADD CONSTRAINT "price_items_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_reports" ADD CONSTRAINT "price_reports_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_reports" ADD CONSTRAINT "price_reports_price_item_id_price_items_id_fk" FOREIGN KEY ("price_item_id") REFERENCES "public"."price_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_reports" ADD CONSTRAINT "price_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_actions_admin_created_at_idx" ON "admin_actions" USING btree ("admin_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_accounts_provider_account_unique" ON "auth_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_unique" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "comments_place_status_idx" ON "comments" USING btree ("place_id","status");--> statement-breakpoint
CREATE INDEX "content_reports_status_created_at_idx" ON "content_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "place_categories_category_place_idx" ON "place_categories" USING btree ("category_id","place_id");--> statement-breakpoint
CREATE INDEX "places_status_updated_at_idx" ON "places" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "places_representative_price_idx" ON "places" USING btree ("representative_price_amount");--> statement-breakpoint
CREATE INDEX "places_creator_idx" ON "places" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "price_items_place_label_unique" ON "price_items" USING btree ("place_id","normalized_label");--> statement-breakpoint
CREATE INDEX "price_items_place_representative_idx" ON "price_items" USING btree ("place_id","is_representative");--> statement-breakpoint
CREATE INDEX "price_reports_place_label_amount_idx" ON "price_reports" USING btree ("place_id","normalized_label","amount");--> statement-breakpoint
CREATE INDEX "price_reports_created_at_idx" ON "price_reports" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");