import { and, asc, eq, sql } from "drizzle-orm";

import { places, priceItems } from "@/db/schema";
import type {
  AdminPriceItem,
  ModerationSuggestion,
} from "@/shared/admin-contracts";
import { getWorkerDb } from "@/worker/db";

type WorkerDb = ReturnType<typeof getWorkerDb>;
type WorkerDbTransaction = Parameters<Parameters<WorkerDb["transaction"]>[0]>[0];
type WorkerDbExecutor = WorkerDb | WorkerDbTransaction;
type VerificationStatus = "verified" | "unverified";

type ModerationSuggestionRecord = ModerationSuggestion;
type AdminPriceItemRecord = AdminPriceItem;

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
});
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function formatDate(value: Date | string | null) {
  if (!value) {
    return "";
  }

  const normalized = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(normalized.getTime())) {
    return "";
  }

  return dateFormatter.format(normalized);
}

export function toAdminActionUserId(adminUserId?: string | null) {
  if (!adminUserId || !UUID_PATTERN.test(adminUserId)) {
    return null;
  }

  return adminUserId;
}

export function toModerationSuggestionRecord(row: {
  suggestedAction: "approve" | "review" | "reject";
  confidence: number;
  summary: string;
  checks: string[];
  flags: string[];
}): ModerationSuggestionRecord {
  return {
    suggestedAction: row.suggestedAction,
    confidence: row.confidence,
    summary: row.summary,
    checks: row.checks,
    flags: row.flags,
  };
}

export function toAdminPriceItemRecord(item: {
  id: string;
  label: string;
  amount: number;
  unitLabel: string | null;
  verificationStatus: VerificationStatus;
  verifiedReportCount: number;
  latestReportedAt: Date | null;
  isRepresentative: boolean;
  isActive: boolean;
}): AdminPriceItemRecord {
  return {
    id: item.id,
    label: item.label,
    amount: item.amount,
    unitLabel: item.unitLabel ?? undefined,
    verificationStatus: item.verificationStatus,
    verifiedReportCount: item.verifiedReportCount,
    reportedAt: formatDate(item.latestReportedAt),
    isRepresentative: item.isRepresentative,
    isActive: item.isActive,
  };
}

function selectRepresentativePriceItem(
  items: Array<{
    id: string;
    label: string;
    amount: number;
    latestReportedAt: Date | null;
    verificationStatus: VerificationStatus;
    isRepresentative: boolean;
  }>,
) {
  return (
    items.find(
      (item) => item.isRepresentative && item.verificationStatus === "verified",
    ) ??
    items.find((item) => item.verificationStatus === "verified") ??
    items.find((item) => item.isRepresentative) ??
    items[0] ??
    null
  );
}

export async function refreshWorkerPlacePricingSummary(
  db: WorkerDbExecutor,
  placeId: string,
  changedAt: Date,
) {
  const currentPriceItems = await db
    .select({
      id: priceItems.id,
      label: priceItems.label,
      amount: priceItems.amount,
      latestReportedAt: priceItems.latestReportedAt,
      verificationStatus: priceItems.verificationStatus,
      isRepresentative: priceItems.isRepresentative,
    })
    .from(priceItems)
    .where(and(eq(priceItems.placeId, placeId), eq(priceItems.isActive, true)))
    .orderBy(asc(priceItems.amount), asc(priceItems.label));

  if (currentPriceItems.length === 0) {
    await db
      .update(places)
      .set({
        representativePriceAmount: null,
        representativePriceLabel: null,
        verifiedPriceItemCount: 0,
        lastPriceUpdatedAt: changedAt,
        updatedAt: changedAt,
      })
      .where(eq(places.id, placeId));
    return;
  }

  const representativeItem = selectRepresentativePriceItem(currentPriceItems);

  if (!representativeItem) {
    return;
  }

  const verifiedPriceItemCount = currentPriceItems.filter(
    (item) => item.verificationStatus === "verified",
  ).length;

  await db
    .update(priceItems)
    .set({
      isRepresentative: false,
      updatedAt: changedAt,
    })
    .where(eq(priceItems.placeId, placeId));
  await db
    .update(priceItems)
    .set({
      isRepresentative: true,
      updatedAt: changedAt,
    })
    .where(eq(priceItems.id, representativeItem.id));
  await db
    .update(places)
    .set({
      representativePriceAmount: representativeItem.amount,
      representativePriceLabel: representativeItem.label,
      verifiedPriceItemCount,
      lastPriceUpdatedAt: changedAt,
      updatedAt: changedAt,
    })
    .where(eq(places.id, placeId));
}

export async function lockWorkerPriceReportModerationGroup(
  db: WorkerDbExecutor,
  input: { placeId: string; normalizedLabel: string },
) {
  await db.execute(sql`
    select pg_advisory_xact_lock(
      hashtextextended(${`${input.placeId}:${input.normalizedLabel}`}, 0)
    )
  `);
}
