import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./schema-auth";
import { commentStatusEnum, placeReactionTypeEnum } from "./schema-enums";
import { withTimestamps } from "./schema-helpers";
import { places } from "./schema-place-core";

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
