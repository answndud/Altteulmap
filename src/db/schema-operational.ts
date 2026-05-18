import {
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./schema-auth";

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
