import "dotenv/config";

import { eq } from "drizzle-orm";

import { categoryGroups } from "../features/categories/catalog";
import { mockPlaces } from "../features/places/mock-data";
import { normalizePriceLabel } from "../features/places/normalization";
import { mockReports } from "../features/reports/mock-data";

process.env.USE_MOCK_DATA = "false";

function toDate(value: string) {
  return new Date(`${value}T12:00:00+09:00`);
}

async function main() {
  const { getDb } = await import("./client");
  const {
    adminActions,
    authAccounts,
    authSessions,
    authVerificationTokens,
    bookmarks,
    categories,
    comments,
    contentReports,
    placeCategories,
    places,
    priceItems,
    priceReports,
    users,
  } = await import("./schema");

  const db = getDb();

  await db.transaction(async (tx) => {
    await tx.delete(adminActions);
    await tx.delete(contentReports);
    await tx.delete(bookmarks);
    await tx.delete(comments);
    await tx.delete(priceReports);
    await tx.delete(priceItems);
    await tx.delete(placeCategories);
    await tx.delete(places);
    await tx.delete(authAccounts);
    await tx.delete(authSessions);
    await tx.delete(authVerificationTokens);
    await tx.delete(categories);
    await tx.delete(users);

    const adminUserId = crypto.randomUUID();
    const demoUserId = crypto.randomUUID();

    await tx.insert(users).values([
      {
        id: adminUserId,
        email: "admin@altteulmap.local",
        nickname: "운영자",
        role: "admin",
      },
      {
        id: demoUserId,
        email: "demo@altteulmap.local",
        nickname: "근처 주민",
        role: "user",
      },
    ]);

    const categoryRows = categoryGroups.flatMap((group, groupIndex) => {
      const parentId = crypto.randomUUID();

      return [
        {
          id: parentId,
          parentId: null,
          slug: group.slug,
          name: group.name,
          sortOrder: groupIndex,
          isActive: true,
        },
        ...group.children.map((category, childIndex) => ({
          id: crypto.randomUUID(),
          parentId,
          slug: category.slug,
          name: category.name,
          sortOrder: childIndex,
          isActive: true,
        })),
      ];
    });

    await tx.insert(categories).values(categoryRows);

    const categoryIdBySlug = new Map(
      categoryRows.map((category) => [category.slug, category.id]),
    );
    const placeInternalIdBySlug = new Map<string, string>();

    for (const place of mockPlaces) {
      const placeId = crypto.randomUUID();
      placeInternalIdBySlug.set(place.id, placeId);

      await tx.insert(places).values({
        id: placeId,
        slug: place.id,
        name: place.name,
        businessName: place.businessName ?? null,
        description: place.description,
        note: place.note,
        roadAddress: place.address,
        district: place.district,
        latitude: place.latitude,
        longitude: place.longitude,
        status: "active",
        representativePriceAmount: place.representativePriceAmount,
        representativePriceLabel: place.representativePriceLabel,
        verifiedPriceItemCount: place.priceItems.filter(
          (item) => item.verificationStatus === "verified",
        ).length,
        lastPriceUpdatedAt: toDate(place.lastPriceUpdatedAt),
        createdByUserId: demoUserId,
      });

      const categoryId = categoryIdBySlug.get(place.categorySlug);

      if (categoryId) {
        await tx.insert(placeCategories).values({
          placeId,
          categoryId,
          isPrimary: true,
        });
      }

      const priceItemRows = await tx
        .insert(priceItems)
        .values(
          place.priceItems.map((item) => ({
            placeId,
            label: item.label,
            normalizedLabel: normalizePriceLabel(item.label),
            amount: item.amount,
            currency: "KRW" as const,
            unitLabel: item.unitLabel ?? null,
            isRepresentative: item.label === place.representativePriceLabel,
            verificationStatus: item.verificationStatus,
            verifiedReportCount: item.verificationStatus === "verified" ? 2 : 0,
            latestReportedAt: toDate(item.reportedAt),
            createdByUserId: demoUserId,
          })),
        )
        .returning({
          id: priceItems.id,
          normalizedLabel: priceItems.normalizedLabel,
        });

      const priceItemIdByNormalizedLabel = new Map(
        priceItemRows.map((item) => [item.normalizedLabel, item.id]),
      );

      await tx.insert(priceReports).values([
        ...place.history.map((entry) => ({
          placeId,
          priceItemId:
            priceItemIdByNormalizedLabel.get(normalizePriceLabel(entry.label)) ??
            null,
          reporterUserId: demoUserId,
          label: entry.label,
          normalizedLabel: normalizePriceLabel(entry.label),
          amount: entry.amount,
          currency: "KRW",
          unitLabel: null,
          comment: "이력 시드 데이터",
          reportStatus: "accepted" as const,
          snapshotVerificationStatus: entry.verificationStatus,
          createdAt: toDate(entry.recordedAt),
        })),
        ...place.priceItems.map((item) => ({
          placeId,
          priceItemId:
            priceItemIdByNormalizedLabel.get(normalizePriceLabel(item.label)) ??
            null,
          reporterUserId: demoUserId,
          label: item.label,
          normalizedLabel: normalizePriceLabel(item.label),
          amount: item.amount,
          currency: "KRW",
          unitLabel: item.unitLabel ?? null,
          comment: "최신 가격 시드 데이터",
          reportStatus: "accepted" as const,
          snapshotVerificationStatus: item.verificationStatus,
          createdAt: toDate(item.reportedAt),
        })),
      ]);

      if (place.comments.length > 0) {
        await tx.insert(comments).values(
          place.comments.map((comment) => ({
            placeId,
            userId: demoUserId,
            body: comment.body,
            status: "visible" as const,
            createdAt: toDate(comment.createdAt),
            updatedAt: toDate(comment.createdAt),
          })),
        );
      }
    }

    for (const report of mockReports) {
      const targetId = placeInternalIdBySlug.get(report.placeId);

      if (!targetId) {
        continue;
      }

      await tx.insert(contentReports).values({
        reporterUserId: demoUserId,
        targetType: "place",
        targetId,
        reasonType: report.reasonType,
        detail: report.detail,
        status: report.status,
        createdAt: toDate(report.createdAt),
      });
    }

    const [schoolGimbapPlace] = await tx
      .select({
        id: places.id,
      })
      .from(places)
      .where(eq(places.slug, "school-gimbap"))
      .limit(1);

    if (schoolGimbapPlace) {
      await tx.insert(bookmarks).values({
        userId: demoUserId,
        placeId: schoolGimbapPlace.id,
      });
    }
  });

  console.log("Seed complete.");
}

main().catch((error) => {
  console.error("Seed failed.", error);
  process.exit(1);
});
