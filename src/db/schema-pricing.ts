import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./schema-auth";
import {
  priceReportStatusEnum,
  verificationStatusEnum,
} from "./schema-enums";
import { withTimestamps } from "./schema-helpers";
import { places } from "./schema-place-core";

export const priceItems = pgTable(
  "price_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    sourceProvider: varchar("source_provider", { length: 40 })
      .default("user")
      .notNull(),
    sourceExternalId: varchar("source_external_id", { length: 160 }),
    sourceImportBatch: varchar("source_import_batch", { length: 80 }),
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
    uniqueIndex("price_items_source_external_unique").on(
      table.sourceProvider,
      table.sourceExternalId,
    ),
    index("price_items_place_active_idx").on(table.placeId, table.isActive),
    index("price_items_place_representative_idx").on(
      table.placeId,
      table.isRepresentative,
    ),
    check("price_items_amount_positive_check", sql`${table.amount} > 0`),
    check(
      "price_items_verified_count_nonnegative_check",
      sql`${table.verifiedReportCount} >= 0`,
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
    sourceProvider: varchar("source_provider", { length: 40 })
      .default("user")
      .notNull(),
    sourceExternalId: varchar("source_external_id", { length: 160 }),
    sourceImportBatch: varchar("source_import_batch", { length: 80 }),
    priceItemId: uuid("price_item_id").references(() => priceItems.id, {
      onDelete: "set null",
    }),
    reporterUserId: uuid("reporter_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reporterVisitorId: varchar("reporter_visitor_id", { length: 64 }),
    submissionKey: varchar("submission_key", { length: 64 }),
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
    index("price_reports_status_created_at_idx").on(
      table.reportStatus,
      table.createdAt,
    ),
    uniqueIndex("price_reports_submission_key_unique").on(table.submissionKey),
    uniqueIndex("price_reports_source_external_unique").on(
      table.sourceProvider,
      table.sourceExternalId,
    ),
    check("price_reports_amount_positive_check", sql`${table.amount} > 0`),
  ],
);
