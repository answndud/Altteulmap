import { and, eq } from "drizzle-orm";

import { priceItems, priceReports } from "@/db/schema";
import { normalizePriceLabel } from "@/features/places/normalization";
import type { PlacePriceReportInput } from "@/features/places/write-schema";
import { getWorkerDb, type WorkerDatabaseBindings } from "@/worker/db";
import type { WorkerPublicWriteActor } from "@/worker/public-write-actor";
import { getPriceReportSubmissionKey } from "@/worker/price-report-identity";
import {
  type DataSource,
  getActivePlaceIdentityBySlug,
} from "@/worker/places-write-support";

export async function createDatabasePlacePriceReport(
  env: WorkerDatabaseBindings,
  slug: string,
  input: PlacePriceReportInput,
  actor: WorkerPublicWriteActor,
) {
  const db = getWorkerDb(env);
  const placeRow = await getActivePlaceIdentityBySlug(db, slug);

  if (!placeRow) {
    return {
      ok: false,
      message: "장소를 찾지 못했습니다.",
      source: "database" as DataSource,
      mock: false,
      item: null,
    };
  }

  const normalizedLabel = normalizePriceLabel(input.label);
  const submissionKey = getPriceReportSubmissionKey(
    placeRow.id,
    actor,
    normalizedLabel,
    input.amount,
    input.unitLabel || null,
  );
  const [matchedPriceItem] = await db
    .select({
      id: priceItems.id,
    })
    .from(priceItems)
    .where(
      and(
        eq(priceItems.placeId, placeRow.id),
        eq(priceItems.normalizedLabel, normalizedLabel),
      ),
    )
    .limit(1);
  const [createdReport] = await db
    .insert(priceReports)
    .values({
      placeId: placeRow.id,
      priceItemId: matchedPriceItem?.id ?? null,
      reporterUserId: actor.user?.id ?? null,
      reporterVisitorId: actor.visitorId,
      submissionKey,
      label: input.label,
      normalizedLabel,
      amount: input.amount,
      currency: "KRW",
      unitLabel: input.unitLabel || null,
      comment: input.comment || null,
      reportStatus: "pending_review",
      snapshotVerificationStatus: "unverified",
    })
    .onConflictDoNothing({ target: priceReports.submissionKey })
    .returning({
      id: priceReports.id,
    });

  const report =
    createdReport ??
    (await db
      .select({ id: priceReports.id })
      .from(priceReports)
      .where(eq(priceReports.submissionKey, submissionKey))
      .limit(1))[0];

  if (!report) {
    throw new Error("가격 제보를 저장하지 못했습니다.");
  }

  return {
    ok: true,
    message: "가격 제보가 접수되었습니다. 운영 검토 후 상세 화면에 반영됩니다.",
    source: "database" as DataSource,
    mock: false,
    item: {
      id: report.id,
      placeId: placeRow.slug,
      placeName: placeRow.name,
      label: input.label,
      amount: input.amount,
      unitLabel: input.unitLabel || undefined,
      comment: input.comment || undefined,
    },
  };
}
