import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "./schema-auth";
import {
  contentReportStatusEnum,
  contentReportTargetTypeEnum,
  moderationSuggestionActionEnum,
  moderationSuggestionSubjectTypeEnum,
} from "./schema-enums";
import { withTimestamps } from "./schema-helpers";

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
