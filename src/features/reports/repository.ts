import "server-only";

import { desc, eq } from "drizzle-orm";

import { getDb, isDatabaseEnabled } from "@/db/client";
import { adminActions, contentReports, places } from "@/db/schema";
import { mockReports, type MockReportRecord } from "@/features/reports/mock-data";
import type {
  ReportModerationInput,
  ReportSubmissionInput,
} from "@/features/reports/schema";

type DataSource = "mock" | "database";

export type ReportListResult = {
  items: MockReportRecord[];
  source: DataSource;
};

export type ReportSubmissionResult = {
  ok: boolean;
  message: string;
  mock: boolean;
  source: DataSource;
  preview: {
    id: string;
    placeId: string;
    placeName: string;
    reasonType: ReportSubmissionInput["reasonType"];
    detail: string;
  };
};

export type ReportModerationResult = {
  ok: boolean;
  message: string;
  source: DataSource;
  item: MockReportRecord | null;
};

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
});

function formatDate(value: Date) {
  return dateFormatter.format(value);
}

function toMockPreview(input: ReportSubmissionInput) {
  return {
    id: `report-${Date.now()}`,
    placeId: input.placeId,
    placeName: input.placeName,
    reasonType: input.reasonType,
    detail: input.detail,
  };
}

async function listDatabaseReports(): Promise<ReportListResult> {
  const db = getDb();
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

  return {
    items: rows.map((row) => ({
      id: row.id,
      placeId: row.placeId ?? "unknown-place",
      placeName: row.placeName ?? "알 수 없는 장소",
      reasonType: row.reasonType as MockReportRecord["reasonType"],
      detail: row.detail ?? "",
      status: row.status,
      createdAt: formatDate(row.createdAt),
    })),
    source: "database",
  };
}

async function createDatabaseReportSubmission(
  input: ReportSubmissionInput,
  reporterUserId?: string | null,
): Promise<ReportSubmissionResult> {
  const db = getDb();
  const [placeRow] = await db
    .select({
      id: places.id,
      slug: places.slug,
      name: places.name,
    })
    .from(places)
    .where(eq(places.slug, input.placeId))
    .limit(1);

  if (!placeRow) {
    throw new Error("Selected place does not exist.");
  }

  const [createdReport] = await db
    .insert(contentReports)
    .values({
      reporterUserId: reporterUserId ?? null,
      targetType: "place",
      targetId: placeRow.id,
      reasonType: input.reasonType,
      detail: input.detail,
      status: "open",
    })
    .returning({
      id: contentReports.id,
    });

  return {
    ok: true,
    message: "신고가 접수되었습니다. 운영 검토 큐에서 바로 확인할 수 있습니다.",
    mock: false,
    source: "database",
    preview: {
      id: createdReport.id,
      placeId: placeRow.slug,
      placeName: placeRow.name,
      reasonType: input.reasonType,
      detail: input.detail,
    },
  };
}

async function updateDatabaseReportStatus(
  id: string,
  input: ReportModerationInput,
  adminUserId?: string | null,
): Promise<ReportModerationResult> {
  const db = getDb();
  const now = new Date();
  const [updatedReport] = await db
    .update(contentReports)
    .set({
      status: input.status,
      resolvedAt:
        input.status === "resolved" || input.status === "dismissed"
          ? now
          : null,
    })
    .where(eq(contentReports.id, id))
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
      message: "신고를 찾지 못했습니다.",
      source: "database",
      item: null,
    };
  }

  const [placeRow] = await db
    .select({
      slug: places.slug,
      name: places.name,
    })
    .from(places)
    .where(eq(places.id, updatedReport.targetId))
    .limit(1);

  await db.insert(adminActions).values({
    adminUserId: adminUserId ?? null,
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
    source: "database",
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
}

export async function listReports() {
  if (!isDatabaseEnabled()) {
    return {
      items: mockReports,
      source: "mock" as const,
    };
  }

  try {
    return await listDatabaseReports();
  } catch (error) {
    console.error("Failed to load reports from database. Falling back to mock data.", error);

    return {
      items: mockReports,
      source: "mock" as const,
    };
  }
}

export async function createReportSubmission(
  input: ReportSubmissionInput,
  reporterUserId?: string | null,
) {
  if (!isDatabaseEnabled()) {
    return {
      ok: true,
      message: "신고가 접수되었습니다. 확인 후 반영하겠습니다.",
      mock: true,
      source: "mock" as const,
      preview: toMockPreview(input),
    };
  }

  try {
    return await createDatabaseReportSubmission(input, reporterUserId);
  } catch (error) {
    console.error("Failed to persist report submission. Falling back to mock preview.", error);

    return {
      ok: true,
      message: "신고가 접수되었습니다. 확인 후 반영하겠습니다.",
      mock: true,
      source: "mock" as const,
      preview: toMockPreview(input),
    };
  }
}

export async function updateReportStatus(
  id: string,
  input: ReportModerationInput,
  adminUserId?: string | null,
) {
  if (!isDatabaseEnabled()) {
    return {
      ok: true,
      message: "목업 모드에서는 신고 상태가 실제 저장되지 않습니다.",
      source: "mock" as const,
      item: null,
    };
  }

  try {
    return await updateDatabaseReportStatus(id, input, adminUserId);
  } catch (error) {
    console.error("Failed to update report status.", error);

    return {
      ok: false,
      message: "신고 상태 업데이트에 실패했습니다.",
      source: "database" as const,
      item: null,
    };
  }
}
