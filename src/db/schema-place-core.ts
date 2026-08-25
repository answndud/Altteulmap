import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./schema-auth";
import { placeStatusEnum } from "./schema-enums";
import { withTimestamps } from "./schema-helpers";

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => [
    uniqueIndex("categories_slug_unique").on(table.slug),
    index("categories_parent_id_idx").on(table.parentId),
  ],
);

export const places = pgTable(
  "places",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 160 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    businessName: varchar("business_name", { length: 120 }),
    description: text("description"),
    note: text("note"),
    roadAddress: text("road_address").notNull(),
    lotAddress: text("lot_address"),
    district: varchar("district", { length: 80 }).notNull(),
    sourceProvider: varchar("source_provider", { length: 40 })
      .default("user")
      .notNull(),
    sourceExternalId: varchar("source_external_id", { length: 160 }),
    sourceImportBatch: varchar("source_import_batch", { length: 80 }),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    status: placeStatusEnum("status").default("active").notNull(),
    primaryCategorySlug: varchar("primary_category_slug", { length: 80 }),
    representativePriceAmount: integer("representative_price_amount"),
    representativePriceLabel: varchar("representative_price_label", {
      length: 120,
    }),
    likeCount: integer("like_count").default(0).notNull(),
    dislikeCount: integer("dislike_count").default(0).notNull(),
    verifiedPriceItemCount: integer("verified_price_item_count")
      .default(0)
      .notNull(),
    lastPriceUpdatedAt: timestamp("last_price_updated_at", {
      withTimezone: true,
    }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...withTimestamps(),
  },
  (table) => [
    uniqueIndex("places_slug_unique").on(table.slug),
    uniqueIndex("places_source_external_unique").on(
      table.sourceProvider,
      table.sourceExternalId,
    ),
    index("places_status_updated_at_idx").on(table.status, table.updatedAt),
    index("places_status_created_at_idx").on(table.status, table.createdAt),
    index("places_status_primary_category_idx").on(
      table.status,
      table.primaryCategorySlug,
    ),
    index("places_status_lat_lng_idx").on(
      table.status,
      table.latitude,
      table.longitude,
    ),
    index("places_status_category_lat_lng_idx").on(
      table.status,
      table.primaryCategorySlug,
      table.latitude,
      table.longitude,
    ),
    index("places_representative_price_idx").on(
      table.representativePriceAmount,
    ),
    index("places_creator_idx").on(table.createdByUserId),
    check(
      "places_latitude_range_check",
      sql`${table.latitude} is null or (${table.latitude} >= -90 and ${table.latitude} <= 90)`,
    ),
    check(
      "places_longitude_range_check",
      sql`${table.longitude} is null or (${table.longitude} >= -180 and ${table.longitude} <= 180)`,
    ),
  ],
);

export const placeCategories = pgTable(
  "place_categories",
  {
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").default(false).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.placeId, table.categoryId],
      name: "place_categories_pk",
    }),
    index("place_categories_category_place_idx").on(
      table.categoryId,
      table.placeId,
    ),
  ],
);
