import {
  and,
  asc,
  desc,
  eq,
  inArray,
} from "drizzle-orm";

import {
  comments,
  placeReactions,
  places,
  priceItems,
  priceReports,
  users,
} from "@/db/schema";
import type { PlaceReactionType } from "@/features/places/types";
import {
  getWorkerDb,
  type WorkerDatabaseBindings,
} from "@/worker/db";
import {
  formatDate,
  toAuthorLabel,
  toPlaceRecord,
} from "@/worker/places/places-read-mappers";
import type {
  WorkerPlaceDetailResult,
  WorkerPlaceViewer,
} from "@/worker/places/places-read-types";

const placeDetailSelectFields = {
  internalId: places.id,
  slug: places.slug,
  name: places.name,
  businessName: places.businessName,
  description: places.description,
  note: places.note,
  roadAddress: places.roadAddress,
  district: places.district,
  latitude: places.latitude,
  longitude: places.longitude,
  primaryCategorySlug: places.primaryCategorySlug,
  representativePriceAmount: places.representativePriceAmount,
  representativePriceLabel: places.representativePriceLabel,
  likeCount: places.likeCount,
  dislikeCount: places.dislikeCount,
  verifiedPriceItemCount: places.verifiedPriceItemCount,
  lastPriceUpdatedAt: places.lastPriceUpdatedAt,
};

type ActivePlaceIdSubquery = ReturnType<typeof activePlaceIdBySlug>;

/** slug로 장소 id를 찾는 서브쿼리. 자식 쿼리가 장소 조회를 기다리지 않고 한 번에 나가게 한다. */
function activePlaceIdBySlug(env: WorkerDatabaseBindings, slug: string) {
  return getWorkerDb(env)
    .select({ id: places.id })
    .from(places)
    .where(and(eq(places.slug, slug), eq(places.status, "active")));
}

async function loadViewerReactionMap(
  env: WorkerDatabaseBindings,
  placeIdSubquery: ActivePlaceIdSubquery,
  viewer: WorkerPlaceViewer,
) {
  if (!viewer?.userId && !viewer?.visitorId) {
    return new Map<string, PlaceReactionType>();
  }

  const db = getWorkerDb(env);
  const rows = await db
    .select({
      placeId: placeReactions.placeId,
      reactionType: placeReactions.reactionType,
    })
    .from(placeReactions)
    .where(
      and(
        inArray(placeReactions.placeId, placeIdSubquery),
        viewer.userId
          ? eq(placeReactions.userId, viewer.userId)
          : eq(placeReactions.visitorId, viewer.visitorId ?? ""),
      ),
    );

  return new Map(rows.map((row) => [row.placeId, row.reactionType]));
}

export async function getDatabasePlaceDetail(
  env: WorkerDatabaseBindings,
  slug: string,
  viewer: WorkerPlaceViewer,
): Promise<WorkerPlaceDetailResult> {
  const db = getWorkerDb(env);
  const placeIdSubquery = activePlaceIdBySlug(env, slug);

  // 장소 본문과 자식 쿼리(가격·이력·코멘트·반응)를 한 번에 보낸다. DB가 멀어 왕복 1회가 비용의 대부분이라
  // 장소를 먼저 읽고 그 id로 자식을 읽던 순차 구조(왕복 2회)를 서브쿼리로 합쳤다.
  const [[row], priceItemRows, historyRows, commentRows, viewerReactionMap] =
    await Promise.all([
      db
        .select(placeDetailSelectFields)
        .from(places)
        .where(and(eq(places.slug, slug), eq(places.status, "active")))
        .limit(1),
      db
        .select({
          id: priceItems.id,
          label: priceItems.label,
          amount: priceItems.amount,
          unitLabel: priceItems.unitLabel,
          verificationStatus: priceItems.verificationStatus,
          latestReportedAt: priceItems.latestReportedAt,
        })
        .from(priceItems)
        .where(
          and(inArray(priceItems.placeId, placeIdSubquery), eq(priceItems.isActive, true)),
        )
        .orderBy(
          desc(priceItems.isRepresentative),
          asc(priceItems.amount),
          asc(priceItems.label),
        ),
      db
        .select({
          id: priceReports.id,
          label: priceReports.label,
          amount: priceReports.amount,
          verificationStatus: priceReports.snapshotVerificationStatus,
          recordedAt: priceReports.createdAt,
        })
        .from(priceReports)
        .where(
          and(
            inArray(priceReports.placeId, placeIdSubquery),
            eq(priceReports.reportStatus, "accepted"),
          ),
        )
        .orderBy(desc(priceReports.createdAt)),
      db
        .select({
          id: comments.id,
          userId: comments.userId,
          visitorId: comments.visitorId,
          body: comments.body,
          createdAt: comments.createdAt,
          nickname: users.nickname,
          email: users.email,
        })
        .from(comments)
        .leftJoin(users, eq(comments.userId, users.id))
        .where(
          and(
            inArray(comments.placeId, placeIdSubquery),
            eq(comments.status, "visible"),
          ),
        )
        .orderBy(desc(comments.createdAt)),
      loadViewerReactionMap(env, placeIdSubquery, viewer),
    ]);

  if (!row) {
    return {
      item: null,
      source: "database",
    };
  }

  return {
    item: toPlaceRecord(row, {
      priceItems: priceItemRows.map((priceItem) => ({
        id: priceItem.id,
        label: priceItem.label,
        amount: priceItem.amount,
        unitLabel: priceItem.unitLabel ?? undefined,
        verificationStatus: priceItem.verificationStatus,
        reportedAt: formatDate(priceItem.latestReportedAt),
      })),
      history: historyRows.map((history) => ({
        id: history.id,
        label: history.label,
        amount: history.amount,
        verificationStatus: history.verificationStatus,
        recordedAt: formatDate(history.recordedAt),
      })),
      comments: commentRows.map((comment) => ({
        id: comment.id,
        authorLabel: toAuthorLabel(comment.nickname, comment.email, "익명"),
        body: comment.body,
        createdAt: formatDate(comment.createdAt),
        canDelete:
          viewer?.role === "admin" ||
          (Boolean(comment.userId) && viewer?.userId === comment.userId) ||
          (Boolean(comment.visitorId) && viewer?.visitorId === comment.visitorId),
      })),
      reactionSummary: {
        likeCount: row.likeCount,
        dislikeCount: row.dislikeCount,
        viewerReaction: viewerReactionMap.get(row.internalId) ?? null,
      },
    }),
    source: "database",
  };
}
