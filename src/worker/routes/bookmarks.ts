import type { Hono } from "hono";

import { bookmarkToggleSchema } from "@/features/bookmarks/schema";
import { getSessionFromRequest } from "@/worker/auth/session";
import { type WorkerDatabaseBindings } from "@/worker/db";
import { DomainError } from "@/worker/http/api-error";
import { getBookmarkService } from "@/worker/services/bookmark-service";

type BookmarkBindings = WorkerDatabaseBindings & {
  ASSETS: {
    fetch(request: Request): Promise<Response> | Response;
  };
  AUTH_SECRET?: string;
};

type BookmarkRouteDependencies = {
  formatDate(date: Date): string;
  noStoreHeaders: Record<string, string>;
};

async function requireUser(request: Request, env: BookmarkBindings) {
  const session = await getSessionFromRequest(request, env);

  if (!session) {
    throw new DomainError("UNAUTHENTICATED", "로그인이 필요합니다.");
  }

  return session.user;
}

export function registerBookmarkRoutes(
  app: Hono<{ Bindings: BookmarkBindings; Variables: { requestId: string } }>,
  dependencies: BookmarkRouteDependencies,
) {
  app.get("/api/bookmarks", async (c) => {
    const user = await requireUser(c.req.raw, c.env);
    const result = await getBookmarkService(c.env).list(user);

    return c.json(
      {
        items: result.items.map((item) => ({
          placeId: item.placeId,
          createdAt: dependencies.formatDate(item.createdAt),
        })),
        count: result.items.length,
        source: result.source,
        userLabel: user.name || user.email,
        mock: result.mock,
      },
      200,
      dependencies.noStoreHeaders,
    );
  });

  app.put("/api/bookmarks/:id", async (c) => {
    const user = await requireUser(c.req.raw, c.env);
    const parsed = bookmarkToggleSchema.safeParse(
      await c.req.json().catch(() => null),
    );

    if (!parsed.success) {
      throw new DomainError(
        "VALIDATION_FAILED",
        "저장할 장소 정보를 확인해 주세요.",
        parsed.error.flatten(),
      );
    }

    const result = await getBookmarkService(c.env).set(
      user,
      c.req.param("id"),
      parsed.data.bookmarked,
    );

    return c.json(
      {
        ok: true,
        source: result.source,
        bookmarked: result.bookmarked,
        message: result.bookmarked
          ? "장소를 저장했습니다."
          : "저장을 해제했습니다.",
        placeId: result.placeId,
      },
      200,
      dependencies.noStoreHeaders,
    );
  });
}
