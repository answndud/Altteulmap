import {
  type AnyPgColumn,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const withTimestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const placeStatusEnum = pgEnum("place_status", [
  "active",
  "hidden",
  "closed",
  "pending_review",
]);
export const verificationStatusEnum = pgEnum("verification_status", [
  "unverified",
  "verified",
]);
export const priceReportStatusEnum = pgEnum("price_report_status", [
  "accepted",
  "rejected",
  "pending_review",
]);
export const commentStatusEnum = pgEnum("comment_status", [
  "visible",
  "hidden",
]);
export const placeReactionTypeEnum = pgEnum("place_reaction_type", [
  "like",
  "dislike",
]);
export const contentReportTargetTypeEnum = pgEnum(
  "content_report_target_type",
  ["place", "price_item", "comment"],
);
export const contentReportStatusEnum = pgEnum("content_report_status", [
  "open",
  "reviewing",
  "resolved",
  "dismissed",
]);
export const moderationSuggestionSubjectTypeEnum = pgEnum(
  "moderation_suggestion_subject_type",
  ["place_submission", "price_report", "content_report"],
);
export const moderationSuggestionActionEnum = pgEnum(
  "moderation_suggestion_action",
  ["approve", "review", "reject"],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    nickname: varchar("nickname", { length: 60 }),
    role: userRoleEnum("role").default("user").notNull(),
    ...withTimestamps(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    index("users_role_idx").on(table.role),
  ],
);

export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).notNull(),
    providerAccountId: varchar("provider_account_id", {
      length: 255,
    }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    passwordHash: text("password_hash"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    expiresAt: integer("expires_at"),
    tokenType: varchar("token_type", { length: 50 }),
    scope: text("scope"),
    idToken: text("id_token"),
    sessionState: text("session_state"),
    ...withTimestamps(),
  },
  (table) => [
    uniqueIndex("auth_accounts_provider_account_unique").on(
      table.provider,
      table.providerAccountId,
    ),
    index("auth_accounts_user_id_idx").on(table.userId),
  ],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    sessionToken: varchar("session_token", { length: 255 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (table) => [index("auth_sessions_user_id_idx").on(table.userId)],
);

export const authVerificationTokens = pgTable(
  "auth_verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.identifier, table.token],
      name: "auth_verification_tokens_pk",
    }),
  ],
);

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

export const contentReports = pgTable(
  "content_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reporterUserId: uuid("reporter_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    targetType: contentReportTargetTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reasonType: varchar("reason_type", { length: 50 }).notNull(),
    detail: text("detail"),
    status: contentReportStatusEnum("status").default("open").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("content_reports_status_created_at_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);

export const adminActions = pgTable(
  "admin_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminUserId: uuid("admin_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actionType: varchar("action_type", { length: 50 }).notNull(),
    targetType: varchar("target_type", { length: 40 }).notNull(),
    targetId: uuid("target_id"),
    metadataJson: jsonb("metadata_json")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("admin_actions_admin_created_at_idx").on(
      table.adminUserId,
      table.createdAt,
    ),
  ],
);

export const visitActivities = pgTable(
  "visit_activity",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorKey: varchar("actor_key", { length: 96 }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    visitorId: varchar("visitor_id", { length: 64 }),
    routeGroup: varchar("route_group", { length: 24 }).notNull(),
    routePath: varchar("route_path", { length: 160 }).notNull(),
    entryRef: varchar("entry_ref", { length: 24 }),
    entrySource: varchar("entry_source", { length: 32 }),
    visitDate: date("visit_date").notNull(),
    bucketStartedAt: timestamp("bucket_started_at", {
      withTimezone: true,
    }).notNull(),
    hitCount: integer("hit_count").default(1).notNull(),
    firstVisitedAt: timestamp("first_visited_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    lastVisitedAt: timestamp("last_visited_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("visit_activity_actor_group_bucket_unique").on(
      table.actorKey,
      table.routeGroup,
      table.bucketStartedAt,
    ),
    index("visit_activity_date_group_idx").on(table.visitDate, table.routeGroup),
    index("visit_activity_date_ref_idx").on(table.visitDate, table.entryRef),
    index("visit_activity_date_source_idx").on(
      table.visitDate,
      table.entrySource,
    ),
    index("visit_activity_date_actor_idx").on(table.visitDate, table.actorKey),
    index("visit_activity_user_date_idx").on(table.userId, table.visitDate),
    index("visit_activity_visitor_date_idx").on(
      table.visitorId,
      table.visitDate,
    ),
  ],
);

export const publicWriteRateLimits = pgTable(
  "public_write_rate_limits",
  {
    scope: varchar("scope", { length: 80 }).notNull(),
    actorKey: varchar("actor_key", { length: 160 }).notNull(),
    bucketStartedAt: timestamp("bucket_started_at", {
      withTimezone: true,
    }).notNull(),
    count: integer("count").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.scope, table.actorKey, table.bucketStartedAt],
      name: "public_write_rate_limits_pk",
    }),
    index("public_write_rate_limits_expires_at_idx").on(table.expiresAt),
    index("public_write_rate_limits_actor_updated_idx").on(
      table.actorKey,
      table.updatedAt,
    ),
  ],
);

export const moderationSuggestions = pgTable(
  "moderation_suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectType: moderationSuggestionSubjectTypeEnum("subject_type").notNull(),
    subjectKey: varchar("subject_key", { length: 160 }).notNull(),
    provider: varchar("provider", { length: 40 })
      .default("local_rule_agent")
      .notNull(),
    suggestedAction: moderationSuggestionActionEnum("suggested_action").notNull(),
    confidence: integer("confidence").notNull(),
    summary: text("summary").notNull(),
    checks: jsonb("checks")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    flags: jsonb("flags")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    ...withTimestamps(),
  },
  (table) => [
    uniqueIndex("moderation_suggestions_subject_unique").on(
      table.subjectType,
      table.subjectKey,
    ),
    index("moderation_suggestions_subject_updated_idx").on(
      table.subjectType,
      table.updatedAt,
    ),
  ],
);
