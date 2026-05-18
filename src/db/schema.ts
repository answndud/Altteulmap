import {
  type AnyPgColumn,
  boolean,
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
import { withTimestamps } from "./schema-helpers";
export {
  adminActions,
  contentReports,
  moderationSuggestions,
} from "./schema-moderation";
export {
  publicWriteRateLimits,
  visitActivities,
} from "./schema-operational";
import {
  commentStatusEnum,
  placeReactionTypeEnum,
  placeStatusEnum,
  priceReportStatusEnum,
  verificationStatusEnum,
} from "./schema-enums";

export {
  authAccounts,
  authSessions,
  authVerificationTokens,
  users,
} from "./schema-auth";
export {
  commentStatusEnum,
  contentReportStatusEnum,
  contentReportTargetTypeEnum,
  moderationSuggestionActionEnum,
  moderationSuggestionSubjectTypeEnum,
  placeReactionTypeEnum,
  placeStatusEnum,
  priceReportStatusEnum,
  userRoleEnum,
  verificationStatusEnum,
} from "./schema-enums";

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
    index("places_status_updated_at_idx").on(table.status, table.updatedAt),
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

export const priceItems = pgTable(
  "price_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 120 }).notNull(),
    normalizedLabel: varchar("normalized_label", { length: 120 }).notNull(),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).default("KRW").notNull(),
    unitLabel: varchar("unit_label", { length: 50 }),
    isActive: boolean("is_active").default(true).notNull(),
    isRepresentative: boolean("is_representative").default(false).notNull(),
    verificationStatus: verificationStatusEnum("verification_status")
      .default("unverified")
      .notNull(),
    verifiedReportCount: integer("verified_report_count").default(0).notNull(),
    latestReportedAt: timestamp("latest_reported_at", {
      withTimezone: true,
    }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...withTimestamps(),
  },
  (table) => [
    uniqueIndex("price_items_place_label_unique").on(
      table.placeId,
      table.normalizedLabel,
    ),
    index("price_items_place_active_idx").on(table.placeId, table.isActive),
    index("price_items_place_representative_idx").on(
      table.placeId,
      table.isRepresentative,
    ),
  ],
);

export const priceReports = pgTable(
  "price_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    priceItemId: uuid("price_item_id").references(() => priceItems.id, {
      onDelete: "set null",
    }),
    reporterUserId: uuid("reporter_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    label: varchar("label", { length: 120 }).notNull(),
    normalizedLabel: varchar("normalized_label", { length: 120 }).notNull(),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).default("KRW").notNull(),
    unitLabel: varchar("unit_label", { length: 50 }),
    comment: text("comment"),
    reportStatus: priceReportStatusEnum("report_status")
      .default("accepted")
      .notNull(),
    snapshotVerificationStatus: verificationStatusEnum(
      "snapshot_verification_status",
    )
      .default("unverified")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("price_reports_place_label_amount_idx").on(
      table.placeId,
      table.normalizedLabel,
      table.amount,
    ),
    index("price_reports_created_at_idx").on(table.createdAt),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    visitorId: varchar("visitor_id", { length: 64 }),
    body: text("body").notNull(),
    status: commentStatusEnum("status").default("visible").notNull(),
    ...withTimestamps(),
  },
  (table) => [
    index("comments_place_status_idx").on(table.placeId, table.status),
  ],
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.placeId],
      name: "bookmarks_pk",
    }),
  ],
);

export const placeReactions = pgTable(
  "place_reactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    visitorId: varchar("visitor_id", { length: 64 }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    reactionType: placeReactionTypeEnum("reaction_type").notNull(),
    ...withTimestamps(),
  },
  (table) => [
    uniqueIndex("place_reactions_user_place_unique").on(
      table.userId,
      table.placeId,
    ),
    uniqueIndex("place_reactions_visitor_place_unique").on(
      table.visitorId,
      table.placeId,
    ),
    index("place_reactions_place_type_idx").on(
      table.placeId,
      table.reactionType,
    ),
    index("place_reactions_user_updated_at_idx").on(
      table.userId,
      table.updatedAt,
    ),
    index("place_reactions_visitor_updated_at_idx").on(
      table.visitorId,
      table.updatedAt,
    ),
  ],
);
