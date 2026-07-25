import { pgEnum } from "drizzle-orm/pg-core";

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
export const moderationSuggestionStatusEnum = pgEnum(
  "moderation_suggestion_status",
  ["pending", "applied", "superseded"],
);
