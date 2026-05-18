import { and, eq, sql } from "drizzle-orm";

import { placeReactions, places } from "@/db/schema";
import type { PlaceReactionType } from "@/features/places/types";
import { getWorkerDb, type WorkerDatabaseBindings } from "@/worker/db";
import type { WorkerPublicWriteActor } from "@/worker/public-write-actor";
import {
  type DataSource,
  getActivePlaceIdentityBySlug,
  type WorkerDbExecutor,
} from "@/worker/places-write-support";

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
