import {
  and,
  asc,
  desc,
  eq,
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
  assertWorkerDatabaseReadEnabled,
  getWorkerDb,
  isWorkerDatabaseEnabled,
  isWorkerMockDataEnabled,
  markWorkerDatabaseUnavailable,
  WorkerDatabaseUnavailableError,
  type WorkerDatabaseBindings,
  withWorkerDatabaseReadTimeout,
} from "@/worker/db";
import {
  formatDate,
  toAuthorLabel,
  toPlaceRecord,
} from "@/worker/places-read-mappers";
import { listDatabaseMapPlaces } from "@/worker/places-read-map-repository";
import {
  getMockPlaceDetail,
  listMockMapPlaces,
} from "@/worker/places-read-mock";
import type {
  PlaceQuery,
  WorkerPlaceDetailResult,
  WorkerPlaceViewer,
} from "@/worker/places-read-types";
export type { WorkerPlaceViewer } from "@/worker/places-read-types";

const mapPlaceSelectFields = {
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

export async function listWorkerMapPlaces(
  env: WorkerDatabaseBindings,
  query: PlaceQuery = {},
) {
  if (!isWorkerDatabaseEnabled(env)) {
    if (isWorkerMockDataEnabled(env)) {
      return listMockMapPlaces(query);
    }

    assertWorkerDatabaseReadEnabled(env, "listWorkerMapPlaces");
  }

  try {
    return await withWorkerDatabaseReadTimeout(env, "listWorkerMapPlaces", () =>
      listDatabaseMapPlaces(env, query),
    );
  } catch (error) {
    markWorkerDatabaseUnavailable();
    console.error(
      "Failed to load worker map places from database.",
      error,
    );
    throw new WorkerDatabaseUnavailableError(
      "지도 장소 목록을 운영 DB에서 불러오지 못했습니다.",
    );
  }
}

async function loadViewerReactionMap(
  env: WorkerDatabaseBindings,
  placeId: string,
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
        eq(placeReactions.placeId, placeId),
        viewer.userId
          ? eq(placeReactions.userId, viewer.userId)
          : eq(placeReactions.visitorId, viewer.visitorId ?? ""),
      ),
    );

  return new Map(rows.map((row) => [row.placeId, row.reactionType]));
}

async function getDatabasePlaceDetail(
  env: WorkerDatabaseBindings,
  slug: string,
  viewer: WorkerPlaceViewer,
): Promise<WorkerPlaceDetailResult> {
  const db = getWorkerDb(env);
  const [row] = await db
    .select(mapPlaceSelectFields)
    .from(places)
    .where(and(eq(places.slug, slug), eq(places.status, "active")))
    .limit(1);

  if (!row) {
    return {
      item: null,
      source: "database",
    };
  }

  const [priceItemRows, historyRows, commentRows, viewerReactionMap] =
    await Promise.all([
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
          and(eq(priceItems.placeId, row.internalId), eq(priceItems.isActive, true)),
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
            eq(priceReports.placeId, row.internalId),
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
        .where(and(eq(comments.placeId, row.internalId), eq(comments.status, "visible")))
        .orderBy(desc(comments.createdAt)),
      loadViewerReactionMap(env, row.internalId, viewer),
    ]);

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

export async function getWorkerPlaceDetail(
  env: WorkerDatabaseBindings,
  slug: string,
  viewer: WorkerPlaceViewer,
) {
  if (!isWorkerDatabaseEnabled(env)) {
    if (isWorkerMockDataEnabled(env)) {
      return getMockPlaceDetail(slug, viewer);
    }

    assertWorkerDatabaseReadEnabled(env, "getWorkerPlaceDetail");
  }

  try {
    return await withWorkerDatabaseReadTimeout(env, "getWorkerPlaceDetail", () =>
      getDatabasePlaceDetail(env, slug, viewer),
    );
  } catch (error) {
    markWorkerDatabaseUnavailable();
    console.error(
      "Failed to load worker place detail from database.",
      error,
    );
    throw new WorkerDatabaseUnavailableError(
      "장소 상세 정보를 운영 DB에서 불러오지 못했습니다.",
    );
  }
}
