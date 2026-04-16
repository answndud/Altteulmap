import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDb, isDatabaseEnabled, markDatabaseUnavailable } from "@/db/client";
import { bookmarks, places } from "@/db/schema";
import { mockPlaces } from "@/features/places/catalog-data";

type DataSource = "mock" | "database";

export type BookmarkActor = {
  id: string;
  email: string;
  name: string | null;
};

type BookmarkRecord = {
  placeId: string;
  createdAt: string;
};

export type BookmarkedPlaceRecord = {
  id: string;
  name: string;
  district: string;
  categorySlug: string;
  representativePriceAmount: number;
  representativePriceLabel: string;
  createdAt: string;
};

export type BookmarkListResult = {
  items: BookmarkRecord[];
  source: DataSource;
  userLabel: string;
  authenticated: boolean;
};

export type BookmarkToggleResult = {
  ok: boolean;
  source: DataSource;
  bookmarked: boolean;
  message: string;
  placeId: string;
  requiresAuth?: boolean;
};

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
});

function formatDate(value: Date) {
  return dateFormatter.format(value);
}

function getUserLabel(actor: BookmarkActor | null) {
  if (!actor) {
    return "게스트";
  }

  return actor.name || actor.email;
}

function getMockBookmarks(actor: BookmarkActor | null): BookmarkListResult {
  return {
    items:
      actor?.email === "demo@altteulmap.local"
        ? [
            {
              placeId: "school-gimbap",
              createdAt: "2026-03-31",
            },
          ]
        : [],
    source: "mock",
    userLabel: getUserLabel(actor),
    authenticated: actor !== null,
  };
}

function getMockBookmarkedPlaces(
  actor: BookmarkActor | null,
): BookmarkedPlaceRecord[] {
  const bookmarks = getMockBookmarks(actor).items;

  return bookmarks
    .map((bookmark) => {
      const place = mockPlaces.find((item) => item.id === bookmark.placeId);

      if (!place) {
        return null;
      }

      return {
        id: place.id,
        name: place.name,
        district: place.district,
        categorySlug: place.categorySlug,
        representativePriceAmount: place.representativePriceAmount,
        representativePriceLabel: place.representativePriceLabel,
        createdAt: bookmark.createdAt,
      } satisfies BookmarkedPlaceRecord;
    })
    .filter((item): item is BookmarkedPlaceRecord => item !== null);
}

async function listDatabaseBookmarks(
  actor: BookmarkActor | null,
): Promise<BookmarkListResult> {
  if (!actor) {
    return {
      items: [],
      source: "database",
      userLabel: "게스트",
      authenticated: false,
    };
  }

  const db = getDb();
  const rows = await db
    .select({
      placeId: places.slug,
      createdAt: bookmarks.createdAt,
    })
    .from(bookmarks)
    .innerJoin(places, eq(bookmarks.placeId, places.id))
    .where(eq(bookmarks.userId, actor.id))
    .orderBy(desc(bookmarks.createdAt));

  return {
    items: rows.map((row) => ({
      placeId: row.placeId,
      createdAt: formatDate(row.createdAt),
    })),
    source: "database",
    userLabel: getUserLabel(actor),
    authenticated: true,
  };
}

async function listDatabaseBookmarkedPlaces(
  actor: BookmarkActor | null,
): Promise<BookmarkedPlaceRecord[]> {
  if (!actor) {
    return [];
  }

  const db = getDb();
  const rows = await db
    .select({
      id: places.slug,
      name: places.name,
      district: places.district,
      categorySlug: places.primaryCategorySlug,
      representativePriceAmount: places.representativePriceAmount,
      representativePriceLabel: places.representativePriceLabel,
      createdAt: bookmarks.createdAt,
    })
    .from(bookmarks)
    .innerJoin(places, eq(bookmarks.placeId, places.id))
    .where(and(eq(bookmarks.userId, actor.id), eq(places.status, "active")))
    .orderBy(desc(bookmarks.createdAt));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    district: row.district,
    categorySlug: row.categorySlug ?? "other-service",
    representativePriceAmount: row.representativePriceAmount ?? 0,
    representativePriceLabel: row.representativePriceLabel ?? "대표 가격 준비 중",
    createdAt: formatDate(row.createdAt),
  }));
}

async function setDatabaseBookmark(
  placeSlug: string,
  bookmarked: boolean,
  actor: BookmarkActor | null,
): Promise<BookmarkToggleResult> {
  if (!actor) {
    return {
      ok: false,
      source: "database",
      bookmarked: false,
      message: "북마크 저장은 로그인 후 사용할 수 있습니다.",
      placeId: placeSlug,
      requiresAuth: true,
    };
  }

  const db = getDb();
  const place = await db
    .select({
      id: places.id,
    })
    .from(places)
    .where(eq(places.slug, placeSlug))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!place) {
    return {
      ok: false,
      source: "database",
      bookmarked: false,
      message: "장소를 찾지 못했습니다.",
      placeId: placeSlug,
    };
  }

  const existing = await db
    .select({
      placeId: bookmarks.placeId,
    })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, actor.id), eq(bookmarks.placeId, place.id)))
    .limit(1);

  if (bookmarked) {
    if (existing.length === 0) {
      await db.insert(bookmarks).values({
        userId: actor.id,
        placeId: place.id,
      });
    }

    return {
      ok: true,
      source: "database",
      bookmarked: true,
      message: "북마크에 저장했습니다.",
      placeId: placeSlug,
    };
  }

  if (existing.length > 0) {
    await db
      .delete(bookmarks)
      .where(and(eq(bookmarks.userId, actor.id), eq(bookmarks.placeId, place.id)));
  }

  return {
    ok: true,
    source: "database",
    bookmarked: false,
    message: "북마크를 해제했습니다.",
    placeId: placeSlug,
  };
}

export async function listBookmarks(actor: BookmarkActor | null) {
  if (!isDatabaseEnabled()) {
    return getMockBookmarks(actor);
  }

  try {
    return await listDatabaseBookmarks(actor);
  } catch (error) {
    markDatabaseUnavailable(error);
    console.error("Failed to load bookmarks. Falling back to mock data.", error);
    return getMockBookmarks(actor);
  }
}

export async function setBookmark(
  placeSlug: string,
  bookmarked: boolean,
  actor: BookmarkActor | null,
) {
  if (!actor) {
    return {
      ok: false,
      source: isDatabaseEnabled() ? ("database" as const) : ("mock" as const),
      bookmarked: false,
      message: "북마크 저장은 로그인 후 사용할 수 있습니다.",
      placeId: placeSlug,
      requiresAuth: true,
    };
  }

  if (!isDatabaseEnabled()) {
    return {
      ok: true,
      source: "mock" as const,
      bookmarked,
      message: bookmarked
        ? "북마크에 저장했습니다."
        : "북마크를 해제했습니다.",
      placeId: placeSlug,
    };
  }

  try {
    return await setDatabaseBookmark(placeSlug, bookmarked, actor);
  } catch (error) {
    markDatabaseUnavailable(error);
    console.error("Failed to update bookmark.", error);

    return {
      ok: false,
      source: "database" as const,
      bookmarked: false,
      message: "북마크 업데이트에 실패했습니다.",
      placeId: placeSlug,
    };
  }
}

export async function listBookmarkedPlaces(actor: BookmarkActor | null) {
  if (!isDatabaseEnabled()) {
    return getMockBookmarkedPlaces(actor);
  }

  try {
    return await listDatabaseBookmarkedPlaces(actor);
  } catch (error) {
    markDatabaseUnavailable(error);
    console.error(
      "Failed to load bookmarked places. Falling back to mock data.",
      error,
    );
    return getMockBookmarkedPlaces(actor);
  }
}
