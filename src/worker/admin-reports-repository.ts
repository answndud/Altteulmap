import { and, desc, eq, inArray } from "drizzle-orm";

import {
  adminActions,
  contentReports,
  moderationSuggestions,
  places,
} from "@/db/schema";
import { mockReports, type MockReportRecord } from "@/features/reports/mock-data";
import type { ReportModerationInput } from "@/features/reports/schema";
import type { ModerationSuggestion } from "@/shared/admin-contracts";
import { getWorkerDb, type WorkerDatabaseBindings } from "@/worker/db";
import { parseModerationSuggestion } from "@/worker/admin/moderation-suggestion-validation";

type DataSource = "database";
type AdminUser = {
  id: string;
};

type ModerationSuggestionRecord = ModerationSuggestion;

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
});
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatDate(value: Date | string | null) {
  if (!value) {
    return "";
  }

  const normalized = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(normalized.getTime())) {
    return "";
  }

  return dateFormatter.format(normalized);
}

function toAdminActionUserId(adminUserId?: string | null) {
  if (!adminUserId || !UUID_PATTERN.test(adminUserId)) {
    return null;
  }

  return adminUserId;
}

function toModerationSuggestionRecord(row: {
  suggestedAction: string;
  confidence: number;
  summary: string;
  checks: unknown;
  flags: unknown;
}): ModerationSuggestionRecord {
  return (
    parseModerationSuggestion({
      suggestedAction: row.suggestedAction,
      confidence: row.confidence,
      summary: row.summary,
      checks: row.checks,
      flags: row.flags,
    }) ?? {
      suggestedAction: "review",
      confidence: 0,
      summary: "검수 제안을 표시할 수 없습니다.",
      checks: [],
      flags: ["malformed_suggestion"],
    }
  );
}

export async function listWorkerReports(env: WorkerDatabaseBindings) {
  const db = getWorkerDb(env);
  const rows = await db
    .select({
      id: contentReports.id,
      placeId: places.slug,
      placeName: places.name,
      reasonType: contentReports.reasonType,
      detail: contentReports.detail,
      status: contentReports.status,
      createdAt: contentReports.createdAt,
    })
    .from(contentReports)
    .leftJoin(places, eq(contentReports.targetId, places.id))
    .where(eq(contentReports.targetType, "place"))
    .orderBy(desc(contentReports.createdAt));
  const suggestionRows =
    rows.length > 0
      ? await db
          .select({
            subjectKey: moderationSuggestions.subjectKey,
            suggestedAction: moderationSuggestions.suggestedAction,
            confidence: moderationSuggestions.confidence,
            summary: moderationSuggestions.summary,
            checks: moderationSuggestions.checks,
            flags: moderationSuggestions.flags,
          })
          .from(moderationSuggestions)
          .where(
            and(
              eq(moderationSuggestions.subjectType, "content_report"),
              eq(moderationSuggestions.status, "pending"),
              inArray(
                moderationSuggestions.subjectKey,
                rows.map((row) => row.id),
              ),
            ),
          )
      : [];
  const suggestionsBySubject = new Map(
    suggestionRows.map((row) => [
      row.subjectKey,
      toModerationSuggestionRecord(row),
    ]),
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      placeId: row.placeId ?? "unknown-place",
      placeName: row.placeName ?? "알 수 없는 장소",
      reasonType: row.reasonType as MockReportRecord["reasonType"],
      detail: row.detail ?? "",
      status: row.status,
      createdAt: formatDate(row.createdAt),
      moderationSuggestion: suggestionsBySubject.get(row.id),
    })),
    source: "database" as DataSource,
  };
}

export function listWorkerMockReports() {
  return {
    items: mockReports,
    source: "mock" as const,
  };
}

export async function updateWorkerReportStatus(
  env: WorkerDatabaseBindings,
  id: string,
  input: ReportModerationInput,
  adminUser: AdminUser,
) {
  const db = getWorkerDb(env);

  return await db.transaction(async (tx) => {
    const now = new Date();
    const [updatedReport] = await tx
      .update(contentReports)
      .set({
        status: input.status,
        resolvedAt:
          input.status === "resolved" || input.status === "dismissed"
            ? now
            : null,
      })
      .where(
        and(
          eq(contentReports.id, id),
          inArray(contentReports.status, ["open", "reviewing"]),
        ),
      )
      .returning({
        id: contentReports.id,
        targetId: contentReports.targetId,
        reasonType: contentReports.reasonType,
        detail: contentReports.detail,
        status: contentReports.status,
        createdAt: contentReports.createdAt,
      });

    if (!updatedReport) {
      return {
        ok: false,
        message: "신고가 없거나 이미 최종 처리되었습니다.",
        source: "database" as DataSource,
        item: null,
      };
    }

    const [placeRow] = await tx
      .select({
        slug: places.slug,
        name: places.name,
      })
      .from(places)
      .where(eq(places.id, updatedReport.targetId))
      .limit(1);

    await tx.insert(adminActions).values({
      adminUserId: toAdminActionUserId(adminUser.id),
      actionType: "update_content_report_status",
      targetType: "content_report",
      targetId: updatedReport.id,
      metadataJson: {
        status: input.status,
      },
    });

    return {
      ok: true,
      message: "신고 상태를 업데이트했습니다.",
      source: "database" as DataSource,
      item: {
        id: updatedReport.id,
        placeId: placeRow?.slug ?? "unknown-place",
        placeName: placeRow?.name ?? "알 수 없는 장소",
        reasonType: updatedReport.reasonType as MockReportRecord["reasonType"],
        detail: updatedReport.detail ?? "",
        status: updatedReport.status,
        createdAt: formatDate(updatedReport.createdAt),
      },
    };
  });
}
