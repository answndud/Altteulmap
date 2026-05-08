import { and, eq, sql } from "drizzle-orm";

import {
  categories,
  comments,
  placeCategories,
  placeReactions,
  places,
  priceItems,
  priceReports,
} from "@/db/schema";
import {
  normalizePriceLabel,
  slugifyPlaceName,
} from "@/features/places/normalization";
import type { PlaceReactionType } from "@/features/places/types";
import type {
  PlaceCommentInput,
  PlacePriceReportInput,
} from "@/features/places/write-schema";
import type { PlaceSubmissionInput } from "@/features/submission/schema";
import { getWorkerDb, type WorkerDatabaseBindings } from "@/worker/db";
import type { WorkerPublicWriteActor } from "@/worker/public-write-actor";

type DataSource = "database";
type WorkerDb = ReturnType<typeof getWorkerDb>;
type WorkerDbTransaction = Parameters<Parameters<WorkerDb["transaction"]>[0]>[0];
type WorkerDbExecutor = WorkerDb | WorkerDbTransaction;

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
});

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

function toAuthorLabel(
  name: string | null | undefined,
  email: string | null | undefined,
  fallback: string,
) {
  if (name) {
    return name;
  }

  if (email) {
    return email.split("@")[0];
  }

  return fallback;
}

function getReactionActorKey(actor: WorkerPublicWriteActor) {
  if (actor.user?.id) {
    return `user:${actor.user.id}`;
  }

  if (actor.visitorId) {
    return `visitor:${actor.visitorId}`;
  }

  return null;
}

function getPlaceReactionMessage(reaction: PlaceReactionType | null) {
  if (reaction === "like") {
    return "좋아요를 남겼습니다.";
  }

  if (reaction === "dislike") {
    return "싫어요를 남겼습니다.";
  }

  return "반응을 취소했습니다.";
}

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

async function getActivePlaceIdentityBySlug(
  db: WorkerDbExecutor,
  slug: string,
) {
  const [placeRow] = await db
    .select({
      id: places.id,
      slug: places.slug,
      name: places.name,
      district: places.district,
    })
    .from(places)
    .where(and(eq(places.slug, slug), eq(places.status, "active")))
    .limit(1);

  return placeRow ?? null;
}

async function refreshPlaceReactionSummary(
  db: WorkerDbExecutor,
  placeId: string,
) {
  const rows = await db
    .select({
      reactionType: placeReactions.reactionType,
      count: sql<number>`count(*)::int`,
    })
    .from(placeReactions)
    .where(eq(placeReactions.placeId, placeId))
    .groupBy(placeReactions.reactionType);
  const summary = {
    likeCount: 0,
    dislikeCount: 0,
  };

  for (const row of rows) {
    const count = Number(row.count) || 0;

    if (row.reactionType === "like") {
      summary.likeCount = count;
    } else {
      summary.dislikeCount = count;
    }
  }

  await db
    .update(places)
    .set({
      likeCount: summary.likeCount,
      dislikeCount: summary.dislikeCount,
      updatedAt: new Date(),
    })
    .where(eq(places.id, placeId));

  return summary;
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
      label: input.label,
      normalizedLabel,
      amount: input.amount,
      currency: "KRW",
      unitLabel: input.unitLabel || null,
      comment: input.comment || null,
      reportStatus: "pending_review",
      snapshotVerificationStatus: "unverified",
    })
    .returning({
      id: priceReports.id,
    });

  return {
    ok: true,
    message: "가격 제보가 접수되었습니다. 운영 검토 후 상세 화면에 반영됩니다.",
    source: "database" as DataSource,
    mock: false,
    item: {
      id: createdReport.id,
      placeId: placeRow.slug,
      placeName: placeRow.name,
      label: input.label,
      amount: input.amount,
      unitLabel: input.unitLabel || undefined,
      comment: input.comment || undefined,
    },
  };
}

export async function createDatabasePlaceComment(
  env: WorkerDatabaseBindings,
  slug: string,
  input: PlaceCommentInput,
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

  const [createdComment] = await db
    .insert(comments)
    .values({
      placeId: placeRow.id,
      userId: actor.user?.id ?? null,
      visitorId: actor.visitorId,
      body: input.body,
      status: "visible",
    })
    .returning({
      id: comments.id,
      createdAt: comments.createdAt,
    });

  return {
    ok: true,
    message: "코멘트를 등록했습니다.",
    source: "database" as DataSource,
    mock: false,
    item: {
      id: createdComment.id,
      authorLabel: actor.user
        ? toAuthorLabel(actor.user.name, actor.user.email, "나")
        : "익명",
      body: input.body,
      createdAt: formatDate(createdComment.createdAt),
      canDelete: true,
    },
  };
}

export async function deleteDatabasePlaceComment(
  env: WorkerDatabaseBindings,
  slug: string,
  commentId: string,
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
      deletedCommentId: null,
    };
  }

  const [existingComment] = await db
    .select({
      id: comments.id,
      userId: comments.userId,
      visitorId: comments.visitorId,
      status: comments.status,
    })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.placeId, placeRow.id)))
    .limit(1);

  if (!existingComment || existingComment.status !== "visible") {
    return {
      ok: false,
      message: "코멘트를 찾지 못했습니다.",
      source: "database" as DataSource,
      mock: false,
      deletedCommentId: null,
    };
  }

  const canDeleteAsOwner =
    (Boolean(existingComment.userId) &&
      existingComment.userId === actor.user?.id) ||
    (Boolean(existingComment.visitorId) &&
      existingComment.visitorId === actor.visitorId);

  if (actor.user?.role !== "admin" && !canDeleteAsOwner) {
    return {
      ok: false,
      message: "삭제 권한이 없습니다.",
      source: "database" as DataSource,
      mock: false,
      deletedCommentId: null,
    };
  }

  await db
    .update(comments)
    .set({
      status: "hidden",
      updatedAt: new Date(),
    })
    .where(eq(comments.id, existingComment.id));

  return {
    ok: true,
    message: "코멘트를 삭제했습니다.",
    source: "database" as DataSource,
    mock: false,
    deletedCommentId: existingComment.id,
  };
}

export async function setDatabasePlaceReaction(
  env: WorkerDatabaseBindings,
  placeSlug: string,
  reaction: PlaceReactionType | null,
  actor: WorkerPublicWriteActor,
) {
  const actorKey = getReactionActorKey(actor);

  if (!actorKey) {
    return {
      ok: false,
      source: "database" as DataSource,
      reaction: null,
      likeCount: 0,
      dislikeCount: 0,
      message: "반응 대상을 확인하지 못했습니다.",
      placeId: placeSlug,
    };
  }

  const db = getWorkerDb(env);
  const place = await getActivePlaceIdentityBySlug(db, placeSlug);

  if (!place) {
    return {
      ok: false,
      source: "database" as DataSource,
      reaction: null,
      likeCount: 0,
      dislikeCount: 0,
      message: "장소를 찾지 못했습니다.",
      placeId: placeSlug,
    };
  }

  if (reaction) {
    await db
      .insert(placeReactions)
      .values({
        userId: actor.user?.id ?? null,
        visitorId: actor.visitorId,
        placeId: place.id,
        reactionType: reaction,
      })
      .onConflictDoUpdate({
        target: actor.user?.id
          ? [placeReactions.userId, placeReactions.placeId]
          : [placeReactions.visitorId, placeReactions.placeId],
        set: {
          reactionType: reaction,
          updatedAt: new Date(),
        },
      });
  } else {
    await db
      .delete(placeReactions)
      .where(
        and(
          eq(placeReactions.placeId, place.id),
          actor.user?.id
            ? eq(placeReactions.userId, actor.user.id)
            : eq(placeReactions.visitorId, actor.visitorId ?? ""),
        ),
      );
  }

  const summary = await refreshPlaceReactionSummary(db, place.id);

  return {
    ok: true,
    source: "database" as DataSource,
    reaction,
    likeCount: summary.likeCount,
    dislikeCount: summary.dislikeCount,
    message: getPlaceReactionMessage(reaction),
    placeId: placeSlug,
  };
}
