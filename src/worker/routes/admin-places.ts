import type { Hono } from "hono";

import { placeModerationSchema } from "@/features/submission/schema";
import { DomainError } from "@/worker/http/api-error";
import {
  getAdminQueuePagination,
  requireAdminSession,
  type AdminBindings,
  type AdminRouteDependencies,
  type AdminVariables,
} from "@/worker/routes/admin-support";
import { getAdminService } from "@/worker/services/admin-service";

export function registerAdminPlaceRoutes(
  app: Hono<{
    Bindings: AdminBindings;
    Variables: AdminVariables;
  }>,
  dependencies: AdminRouteDependencies,
) {
  app.get("/api/admin/places", async (c) => {
    await requireAdminSession(c.req.raw, c.env);

    const result = await getAdminService(c.env).listPlaces(
      getAdminQueuePagination(c.req.raw),
    );

    return c.json(
      {
        items: result.items,
        count: result.count,
        page: result.page,
        limit: result.limit,
        returnedCount: result.items.length,
        truncated: result.items.length < result.count,
        source: result.source,
        mock: result.source === "mock",
      },
      200,
      dependencies.noStoreHeaders,
    );
  });

  app.get("/api/admin/places/:id", async (c) => {
    await requireAdminSession(c.req.raw, c.env);

    const result = await getAdminService(c.env).findPlace(c.req.param("id"));

    return c.json(
      {
        item: result.item,
        source: result.source,
        mock: result.source === "mock",
      },
      result.item ? 200 : 404,
      dependencies.noStoreHeaders,
    );
  });

  app.patch("/api/admin/places/:id", async (c) => {
    const admin = await requireAdminSession(c.req.raw, c.env);
    const parsed = placeModerationSchema.safeParse(
      await c.req.json().catch(() => null),
    );

    if (!parsed.success) {
      throw new DomainError(
        "VALIDATION_FAILED",
        "장소 검토 입력값 검증에 실패했습니다.",
        parsed.error.flatten(),
      );
    }

    const result = await getAdminService(c.env).moderatePlace(
      c.req.param("id"),
      parsed.data,
      admin,
    );

    return c.json(result, 200, dependencies.noStoreHeaders);
  });
}
