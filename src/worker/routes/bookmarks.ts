import type { Hono } from "hono";

import { bookmarkToggleSchema } from "@/features/bookmarks/schema";
import { getPlaceById } from "@/features/places/queries";
import {
  getSessionFromRequest,
  type LocalSession,
} from "@/worker/auth/session";
import {
  isWorkerDatabaseEnabled,
  isWorkerMockDataEnabled,
  withWorkerDatabaseConnection,
  type WorkerDatabaseBindings,
} from "@/worker/db";
import {
  listDatabaseBookmarks,
  setDatabaseBookmark,
} from "@/worker/bookmarks-repository";

type BookmarkBindings = WorkerDatabaseBindings & {
  ASSETS: {
    fetch(request: Request): Promise<Response> | Response;
  };
  AUTH_SECRET?: string;
};

type BookmarkRouteDependencies = {
  databaseUnavailableResponse(message: string): Response;
  formatDate(date: Date): string;
  noStoreHeaders: Record<string, string>;
};

const mockBookmarkStore = new Map<string, Set<string>>();

function getUserBookmarkSet(session: LocalSession) {
  const existing = mockBookmarkStore.get(session.user.id);

  if (existing) {
    return existing;
  }

  const initialBookmarks =
    session.user.email === "demo@altteulmap.local"
      ? new Set(["school-gimbap"])
      : new Set<string>();

  mockBookmarkStore.set(session.user.id, initialBookmarks);
  return initialBookmarks;
}

export function registerBookmarkRoutes(
  app: Hono<{ Bindings: BookmarkBindings; Variables: { requestId: string } }>,
  dependencies: BookmarkRouteDependencies,
) {
  app.get("/api/bookmarks", async (c) => {
    const session = getSessionFromRequest(c.req.raw, c.env);

    if (!session) {
      return c.json(
        {
          ok: false,
          message: "로그인이 필요합니다.",
        },
        401,
        dependencies.noStoreHeaders,
      );
    }

    if (isWorkerDatabaseEnabled(c.env)) {
      try {
        const items = await withWorkerDatabaseConnection(c.env, () =>
          listDatabaseBookmarks(c.env, session.user.id),
        );

        return c.json(
          {
            items: items.map((item) => ({
              placeId: item.placeId,
              createdAt: dependencies.formatDate(item.createdAt),
            })),
            count: items.length,
            source: "database",
            userLabel: session.user.name || session.user.email,
            mock: false,
          },
          200,
          dependencies.noStoreHeaders,
        );
      } catch (error) {
        console.error("Failed to load database bookmarks.", error);
        return dependencies.databaseUnavailableResponse("저장한 장소를 불러오지 못했습니다.");
      }
    }

    if (!isWorkerMockDataEnabled(c.env)) {
      return dependencies.databaseUnavailableResponse("저장한 장소를 불러오지 못했습니다.");
    }

    const bookmarkSet = getUserBookmarkSet(session);
    const items = [...bookmarkSet].map((placeId) => ({
      placeId,
      createdAt: dependencies.formatDate(new Date()),
    }));

    return c.json(
      {
        items,
        count: items.length,
        source: "mock",
        userLabel: session.user.name || session.user.email,
        mock: true,
      },
      200,
      dependencies.noStoreHeaders,
    );
  });

  app.put("/api/bookmarks/:id", async (c) => {
    const session = getSessionFromRequest(c.req.raw, c.env);

    if (!session) {
      return c.json(
        {
          ok: false,
          message: "로그인이 필요합니다.",
          requiresAuth: true,
        },
        401,
        dependencies.noStoreHeaders,
      );
    }

    const body = await c.req.json().catch(() => null);
    const parsed = bookmarkToggleSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          message: "저장할 장소 정보를 확인해 주세요.",
          error: parsed.error.flatten(),
        },
        400,
        dependencies.noStoreHeaders,
      );
    }

    const placeId = c.req.param("id");

    if (isWorkerDatabaseEnabled(c.env)) {
      try {
        const result = await withWorkerDatabaseConnection(c.env, () =>
          setDatabaseBookmark(
            c.env,
            session.user.id,
            placeId,
            parsed.data.bookmarked,
          ),
        );

        if (!result) {
          return c.json(
            {
              ok: false,
              source: "database",
              bookmarked: false,
              message: "장소를 찾지 못했습니다.",
              placeId,
            },
            404,
            dependencies.noStoreHeaders,
          );
        }

        return c.json(
          {
            ok: true,
            source: "database",
            bookmarked: result.bookmarked,
            message: result.bookmarked
              ? "장소를 저장했습니다."
              : "저장을 해제했습니다.",
            placeId: result.placeId,
          },
          200,
          dependencies.noStoreHeaders,
        );
      } catch (error) {
        console.error("Failed to update database bookmark.", error);
        return dependencies.databaseUnavailableResponse("장소 저장에 실패했습니다.");
      }
    }

    if (!isWorkerMockDataEnabled(c.env)) {
        return dependencies.databaseUnavailableResponse("장소 저장에 실패했습니다.");
    }

    const place = getPlaceById(placeId);

    if (!place) {
      return c.json(
        {
          ok: false,
          source: "mock",
          bookmarked: false,
          message: "장소를 찾지 못했습니다.",
          placeId,
        },
        404,
        dependencies.noStoreHeaders,
      );
    }

    const bookmarkSet = getUserBookmarkSet(session);

    if (parsed.data.bookmarked) {
      bookmarkSet.add(placeId);
    } else {
      bookmarkSet.delete(placeId);
    }

    return c.json(
      {
        ok: true,
        source: "mock",
        bookmarked: parsed.data.bookmarked,
        message: parsed.data.bookmarked
          ? "장소를 저장했습니다."
          : "저장을 해제했습니다.",
        placeId,
      },
      200,
      dependencies.noStoreHeaders,
    );
  });
}
