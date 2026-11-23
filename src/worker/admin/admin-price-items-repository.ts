import { and, eq, ne } from "drizzle-orm";

import { adminActions, places, priceItems } from "@/db/schema";
import { normalizePriceLabel } from "@/features/places/normalization";
import type { AdminPriceItemUpdateInput } from "@/features/places/write-schema";
import {
  refreshWorkerPlacePricingSummary,
  toAdminActionUserId,
  toAdminPriceItemRecord,
} from "@/worker/admin/admin-price-helpers";
import { DomainError } from "@/worker/http/api-error";
import { getWorkerDb, type WorkerDatabaseBindings } from "@/worker/db";
import { VERIFICATION_REPORTER_THRESHOLD } from "@/worker/services/price-report-rules";

type DataSource = "database";
type AdminUser = {
  id: string;
};

export async function updateWorkerPriceItem(
  env: WorkerDatabaseBindings,
  itemId: string,
  input: AdminPriceItemUpdateInput,
  adminUser: AdminUser,
) {
  const db = getWorkerDb(env);

  return await db.transaction(async (tx) => {
    const [existingItem] = await tx
      .select({
        id: priceItems.id,
        placeId: places.id,
        placeSlug: places.slug,
        label: priceItems.label,
        amount: priceItems.amount,
        verifiedReportCount: priceItems.verifiedReportCount,
      })
      .from(priceItems)
      .innerJoin(places, eq(priceItems.placeId, places.id))
      .where(and(eq(priceItems.id, itemId), eq(places.status, "active")))
      .limit(1);

    if (!existingItem) {
      throw new DomainError("NOT_FOUND", "가격 항목을 찾지 못했습니다.");
    }

    const normalizedLabel = normalizePriceLabel(input.label);
    const [duplicateItem] = await tx
      .select({ id: priceItems.id })
      .from(priceItems)
      .where(
        and(
          eq(priceItems.placeId, existingItem.placeId),
          eq(priceItems.normalizedLabel, normalizedLabel),
          ne(priceItems.id, existingItem.id),
        ),
      )
      .limit(1);

    if (duplicateItem) {
      throw new DomainError("CONFLICT", "같은 이름의 가격 항목이 이미 있습니다.");
    }

    const changedAt = new Date();
    const nextIsRepresentative = input.isActive ? input.isRepresentative : false;
    const nextVerifiedReportCount =
      input.verificationStatus === "verified"
        ? Math.max(
            existingItem.verifiedReportCount,
            VERIFICATION_REPORTER_THRESHOLD,
          )
        : 0;

    if (nextIsRepresentative) {
      await tx
        .update(priceItems)
        .set({
          isRepresentative: false,
          updatedAt: changedAt,
        })
        .where(eq(priceItems.placeId, existingItem.placeId));
    }

    const [updatedItem] = await tx
      .update(priceItems)
      .set({
        label: input.label,
        normalizedLabel,
        amount: input.amount,
        unitLabel: input.unitLabel || null,
        isActive: input.isActive,
        isRepresentative: nextIsRepresentative,
        verificationStatus: input.verificationStatus,
        verifiedReportCount: nextVerifiedReportCount,
        latestReportedAt: changedAt,
        updatedAt: changedAt,
      })
      .where(eq(priceItems.id, itemId))
      .returning({
        id: priceItems.id,
        label: priceItems.label,
        amount: priceItems.amount,
        unitLabel: priceItems.unitLabel,
        verificationStatus: priceItems.verificationStatus,
        verifiedReportCount: priceItems.verifiedReportCount,
        latestReportedAt: priceItems.latestReportedAt,
        isRepresentative: priceItems.isRepresentative,
        isActive: priceItems.isActive,
      });

    await refreshWorkerPlacePricingSummary(tx, existingItem.placeId, changedAt);
    await tx.insert(adminActions).values({
      adminUserId: toAdminActionUserId(adminUser.id),
      actionType: "update_price_item",
      targetType: "price_item",
      targetId: updatedItem.id,
      metadataJson: {
        placeId: existingItem.placeSlug,
        previousLabel: existingItem.label,
        previousAmount: existingItem.amount,
        nextLabel: updatedItem.label,
        nextAmount: updatedItem.amount,
        isActive: updatedItem.isActive,
        isRepresentative: updatedItem.isRepresentative,
        verificationStatus: updatedItem.verificationStatus,
      },
    });

    return {
      ok: true,
      message: updatedItem.isActive
        ? "가격 항목을 업데이트했습니다."
        : "가격 항목을 숨겼습니다.",
      source: "database" as DataSource,
      item: toAdminPriceItemRecord(updatedItem),
      placeId: existingItem.placeSlug,
    };
  });
}
