import { and, eq } from "drizzle-orm";

import { bookmarks, places } from "@/db/schema";
import { getWorkerDb, type WorkerDatabaseBindings } from "@/worker/db";

export async function listDatabaseBookmarks(
  env: WorkerDatabaseBindings,
  userId: string,
) {
  const db = getWorkerDb(env);

  return db
    .select({
      placeId: places.slug,
      createdAt: bookmarks.createdAt,
    })
    .from(bookmarks)
    .innerJoin(places, eq(bookmarks.placeId, places.id))
    .where(eq(bookmarks.userId, userId))
    .orderBy(bookmarks.createdAt);
}

export async function setDatabaseBookmark(
  env: WorkerDatabaseBindings,
  userId: string,
  placeSlug: string,
  bookmarkedValue: boolean,
) {
  const db = getWorkerDb(env);

  const [place] = await db
    .select({ id: places.id, slug: places.slug })
    .from(places)
    .where(and(eq(places.slug, placeSlug), eq(places.status, "active")))
    .limit(1);

  if (!place) {
    return null;
  }

  if (bookmarkedValue) {
    await db
      .insert(bookmarks)
      .values({ userId, placeId: place.id })
      .onConflictDoNothing();
  } else {
    await db
      .delete(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.placeId, place.id)));
  }

  return { placeId: place.slug, bookmarked: bookmarkedValue };
}
