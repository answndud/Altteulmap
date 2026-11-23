import type { Hono } from "hono";

import { reportModerationSchema } from "@/features/reports/schema";
import { DomainError } from "@/worker/http/api-error";
import {
  requireAdminSession,
  type AdminBindings,
  type AdminRouteDependencies,
  type AdminVariables,
} from "@/worker/routes/admin-support";
import { getAdminService } from "@/worker/services/admin-service";

export function registerAdminReportRoutes(
  app: Hono<{
    Bindings: AdminBindings;
    Variables: AdminVariables;
  }>,
  dependencies: AdminRouteDependencies,
) {
  app.get("/api/admin/reports", async (c) => {
    await requireAdminSession(c.req.raw, c.env);

    const result = await getAdminService(c.env).listReports();

    return c.json(
      {
        items: result.items,
        count: result.items.length,
        source: result.source,
        mock: result.source === "mock",
      },
      200,
      dependencies.noStoreHeaders,
    );
  });

  app.patch("/api/admin/reports/:id", async (c) => {
    const admin = await requireAdminSession(c.req.raw, c.env);
    const parsed = reportModerationSchema.safeParse(
      await c.req.json().catch(() => null),
    );

    if (!parsed.success) {
      throw new DomainError(
        "VALIDATION_FAILED",
        "신고 상태 검증에 실패했습니다.",
        parsed.error.flatten(),
      );
    }

    const result = await getAdminService(c.env).updateReport(
      c.req.param("id"),
      parsed.data,
      admin,
    );

    return c.json(result, 200, dependencies.noStoreHeaders);
  });
}
