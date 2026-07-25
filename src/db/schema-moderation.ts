import {
  check,
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
  moderationSuggestionStatusEnum,
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
    status: moderationSuggestionStatusEnum("status")
      .default("pending")
      .notNull(),
    modelVersion: varchar("model_version", { length: 80 }),
    promptVersion: varchar("prompt_version", { length: 40 }),
    inputFingerprint: varchar("input_fingerprint", { length: 64 }),
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
    check(
      "moderation_suggestions_confidence_range_check",
      sql`${table.confidence} >= 0 and ${table.confidence} <= 100`,
    ),
    check(
      "moderation_suggestions_summary_length_check",
      sql`char_length(${table.summary}) between 1 and 2000`,
    ),
  ],
);
