import { and, eq } from "drizzle-orm";

import { comments } from "@/db/schema";
import type { PlaceCommentInput } from "@/features/places/write-schema";
import { getWorkerDb, type WorkerDatabaseBindings } from "@/worker/db";
import type { WorkerPublicWriteActor } from "@/worker/public-write-actor";
import {
  type DataSource,
  getActivePlaceIdentityBySlug,
} from "@/worker/places-write-support";

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
