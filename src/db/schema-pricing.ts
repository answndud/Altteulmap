import {
  boolean,
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
