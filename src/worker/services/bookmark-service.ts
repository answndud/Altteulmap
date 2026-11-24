import { getPlaceById } from "@/features/places/queries";
import {
  withExistingOrNewWorkerDatabaseConnection,
  type WorkerDatabaseBindings,
} from "@/worker/db";
import { DomainError } from "@/worker/http/api-error";
import {
  listDatabaseBookmarks,
  setDatabaseBookmark,
} from "@/worker/places/bookmarks-repository";
import { selectBackend } from "@/worker/services/backend";

type BookmarkUser = { id: string; email: string };

type BookmarkList = {
  items: Array<{ placeId: string; createdAt: Date }>;
  source: "database" | "mock";
  mock: boolean;
};

type BookmarkSetResult = {
  source: "database" | "mock";
  bookmarked: boolean;
  placeId: string;
};

type BookmarkService = {
  list(user: BookmarkUser): Promise<BookmarkList>;
  set(
    user: BookmarkUser,
    placeId: string,
    bookmarked: boolean,
  ): Promise<BookmarkSetResult>;
};

const mockBookmarkStore = new Map<string, Set<string>>();

function getMockBookmarks(user: BookmarkUser) {
  const existing = mockBookmarkStore.get(user.id);

  if (existing) {
    return existing;
  }

  const initial =
    user.email === "demo@altteulmap.local"
      ? new Set(["school-gimbap"])
      : new Set<string>();

  mockBookmarkStore.set(user.id, initial);

  return initial;
}

/** DB 장애는 503으로, 의도된 도메인 실패(404 등)는 그대로 전달한다. */
async function withDatabase<T>(
  env: WorkerDatabaseBindings,
  label: string,
  load: () => Promise<T>,
) {
  try {
    return await withExistingOrNewWorkerDatabaseConnection(env, load);
  } catch (error) {
    if (error instanceof DomainError) {
      throw error;
    }

    console.error(`Failed to ${label}.`, error);
    throw new DomainError("DATABASE_UNAVAILABLE", `${label} 처리에 실패했습니다.`);
  }
}

export function getBookmarkService(env: WorkerDatabaseBindings) {
  return selectBackend<BookmarkService>(
    env,
    {
      database: () => ({
        async list(user) {
          const items = await withDatabase(env, "저장한 장소 조회", () =>
            listDatabaseBookmarks(env, user.id),
          );

          return { items, source: "database", mock: false };
        },
        async set(user, placeId, bookmarked) {
          const result = await withDatabase(env, "장소 저장", () =>
            setDatabaseBookmark(env, user.id, placeId, bookmarked),
          );

          if (!result) {
            throw new DomainError("NOT_FOUND", "장소를 찾지 못했습니다.");
          }

          return {
            source: "database",
            bookmarked: result.bookmarked,
            placeId: result.placeId,
          };
        },
      }),
      mock: () => ({
        async list(user) {
          return {
            items: [...getMockBookmarks(user)].map((placeId) => ({
              placeId,
              createdAt: new Date(),
            })),
            source: "mock",
            mock: true,
          };
        },
        async set(user, placeId, bookmarked) {
          if (!getPlaceById(placeId)) {
            throw new DomainError("NOT_FOUND", "장소를 찾지 못했습니다.");
          }

          const bookmarks = getMockBookmarks(user);

          if (bookmarked) {
            bookmarks.add(placeId);
          } else {
            bookmarks.delete(placeId);
          }

          return { source: "mock", bookmarked, placeId };
        },
      }),
    },
    "저장한 장소를 불러오지 못했습니다.",
  );
}
