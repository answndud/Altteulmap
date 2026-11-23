import type { Hono } from "hono";

import {
  adminPriceItemUpdateSchema,
  priceReportModerationSchema,
} from "@/features/places/write-schema";
import { DomainError } from "@/worker/http/api-error";
import {
  getAdminQueuePagination,
  requireAdminSession,
  type AdminBindings,
  type AdminRouteDependencies,
  type AdminVariables,
} from "@/worker/routes/admin-support";
import { getAdminService } from "@/worker/services/admin-service";

export function registerAdminPriceRoutes(
  app: Hono<{
    Bindings: AdminBindings;
    Variables: AdminVariables;
  }>,
  dependencies: AdminRouteDependencies,
) {
  app.get("/api/admin/prices", async (c) => {
    await requireAdminSession(c.req.raw, c.env);

    const result = await getAdminService(c.env).listPriceReports(
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

  app.patch("/api/admin/prices/:id", async (c) => {
    const admin = await requireAdminSession(c.req.raw, c.env);
    const parsed = priceReportModerationSchema.safeParse(
      await c.req.json().catch(() => null),
    );

    if (!parsed.success) {
      throw new DomainError(
        "VALIDATION_FAILED",
        "가격 정보 검토 입력값을 확인해 주세요.",
        parsed.error.flatten(),
      );
    }

    const result = await getAdminService(c.env).moderatePriceReport(
      c.req.param("id"),
      parsed.data,
      admin,
    );

    return c.json(result, 200, dependencies.noStoreHeaders);
  });

  app.get("/api/admin/prices/places/:id", async (c) => {
    await requireAdminSession(c.req.raw, c.env);

    const result = await getAdminService(c.env).getPlacePriceDetail(
      c.req.param("id"),
    );

    return c.json(
      result,
      result.item ? 200 : 404,
      dependencies.noStoreHeaders,
    );
  });

  app.patch("/api/admin/price-items/:id", async (c) => {
    const admin = await requireAdminSession(c.req.raw, c.env);
    const parsed = adminPriceItemUpdateSchema.safeParse(
      await c.req.json().catch(() => null),
    );

    if (!parsed.success) {
      throw new DomainError(
        "VALIDATION_FAILED",
        "가격 항목 수정 입력값 검증에 실패했습니다.",
        parsed.error.flatten(),
      );
    }

    const result = await getAdminService(c.env).updatePriceItem(
      c.req.param("id"),
      parsed.data,
      admin,
    );

    return c.json(result, 200, dependencies.noStoreHeaders);
  });
}
