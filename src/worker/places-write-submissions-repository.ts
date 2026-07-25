import { eq } from "drizzle-orm";

import {
  categories,
  placeCategories,
  places,
  priceItems,
  priceReports,
} from "@/db/schema";
import {
  normalizePriceLabel,
  slugifyPlaceName,
} from "@/features/places/normalization";
import type { PlaceSubmissionInput } from "@/features/submission/schema";
import { getWorkerDb, type WorkerDatabaseBindings } from "@/worker/db";
import type { WorkerPublicWriteActor } from "@/worker/public-write-actor";
import { getPriceReportSubmissionKey } from "@/worker/price-report-identity";
import {
  type DataSource,
  type WorkerDbExecutor,
} from "@/worker/places-write-support";

async function createUniquePlaceSlug(
  db: WorkerDbExecutor,
  baseSlug: string,
) {
  const rootSlug = baseSlug || `place-${Date.now()}`;
  let candidate = rootSlug;
  let suffix = 2;

  while (true) {
    const existing = await db
      .select({ id: places.id })
      .from(places)
      .where(eq(places.slug, candidate))
      .limit(1);

    if (existing.length === 0) {
      return candidate;
    }

    candidate = `${rootSlug}-${suffix}`;
    suffix += 1;
  }
}

export async function createDatabasePlaceSubmission(
  env: WorkerDatabaseBindings,
  input: PlaceSubmissionInput,
  actor: WorkerPublicWriteActor,
) {
  const db = getWorkerDb(env);

  return await db.transaction(async (tx) => {
    const [categoryRow] = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, input.categorySlug))
      .limit(1);

    if (!categoryRow) {
      throw new Error("Selected category does not exist.");
    }

    let representativeIndex = 0;

    input.priceItems.forEach((item, index) => {
      if (item.amount < input.priceItems[representativeIndex].amount) {
        representativeIndex = index;
      }
    });

    const slug = await createUniquePlaceSlug(tx, slugifyPlaceName(input.name));
    const now = new Date();
    const [createdPlace] = await tx
      .insert(places)
      .values({
        slug,
        name: input.name,
        businessName: input.businessName || null,
        description: null,
        note: input.note || null,
        roadAddress: input.roadAddress,
        district: input.district,
        latitude: null,
        longitude: null,
        status: "pending_review",
        primaryCategorySlug: input.categorySlug,
        representativePriceAmount: input.priceItems[representativeIndex].amount,
        representativePriceLabel: input.priceItems[representativeIndex].label,
        likeCount: 0,
        dislikeCount: 0,
        verifiedPriceItemCount: 0,
        lastPriceUpdatedAt: now,
        createdByUserId: actor.user?.id ?? null,
      })
      .returning({
        id: places.id,
        slug: places.slug,
      });

    await tx.insert(placeCategories).values({
      placeId: createdPlace.id,
      categoryId: categoryRow.id,
      isPrimary: true,
    });

    const insertedPriceItems = await tx
      .insert(priceItems)
      .values(
        input.priceItems.map((item, index) => ({
          placeId: createdPlace.id,
          label: item.label,
          normalizedLabel: normalizePriceLabel(item.label),
          amount: item.amount,
          currency: "KRW" as const,
          unitLabel: item.unitLabel || null,
          isActive: true,
          isRepresentative: index === representativeIndex,
          verificationStatus: "unverified" as const,
          verifiedReportCount: 0,
          latestReportedAt: now,
          createdByUserId: actor.user?.id ?? null,
        })),
      )
      .returning({
        id: priceItems.id,
        normalizedLabel: priceItems.normalizedLabel,
      });
    const priceItemIdByLabel = new Map(
      insertedPriceItems.map((item) => [item.normalizedLabel, item.id]),
    );

    await tx.insert(priceReports).values(
      input.priceItems.map((item) => ({
        placeId: createdPlace.id,
        priceItemId:
          priceItemIdByLabel.get(normalizePriceLabel(item.label)) ?? null,
        label: item.label,
        normalizedLabel: normalizePriceLabel(item.label),
        amount: item.amount,
        currency: "KRW" as const,
        unitLabel: item.unitLabel || null,
        comment: "신규 제보 등록",
        reportStatus: "pending_review" as const,
          snapshotVerificationStatus: "unverified" as const,
          reporterUserId: actor.user?.id ?? null,
          reporterVisitorId: actor.visitorId,
          submissionKey: getPriceReportSubmissionKey(
            createdPlace.id,
            actor,
            normalizePriceLabel(item.label),
            item.amount,
            item.unitLabel || null,
          ),
        createdAt: now,
      })),
    );

    return {
      ok: true,
      message: "장소 등록 요청이 접수되었습니다. 검토 후 공개 목록에 반영됩니다.",
      mock: false,
      source: "database" as DataSource,
      preview: {
        id: createdPlace.slug,
        name: input.name,
        categorySlug: input.categorySlug,
        roadAddress: input.roadAddress,
        district: input.district,
        priceItems: input.priceItems.map((item) => ({
          label: item.label,
          amount: item.amount,
          unitLabel: item.unitLabel || undefined,
        })),
      },
    };
  });
}
