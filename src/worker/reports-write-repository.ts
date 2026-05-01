import { eq } from "drizzle-orm";

import { contentReports, places } from "@/db/schema";
import type { ReportSubmissionInput } from "@/features/reports/schema";
import { getWorkerDb, type WorkerDatabaseBindings } from "@/worker/db";
import type { WorkerPublicWriteActor } from "@/worker/public-write-actor";

export async function createDatabaseReportSubmission(
  env: WorkerDatabaseBindings,
  input: ReportSubmissionInput,
  actor: WorkerPublicWriteActor,
) {
  const db = getWorkerDb(env);
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
      reporterUserId: actor.user?.id ?? null,
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
    source: "database" as const,
    preview: {
      id: createdReport.id,
      placeId: placeRow.slug,
      placeName: placeRow.name,
      reasonType: input.reasonType,
      detail: input.detail,
    },
  };
}
