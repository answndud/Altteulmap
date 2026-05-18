import type { Hono } from "hono";

import { reportModerationSchema } from "@/features/reports/schema";
import {
  listWorkerMockReports,
  listWorkerReports,
  updateWorkerReportStatus,
} from "@/worker/admin-repository";
import {
  isWorkerDatabaseEnabled,
  isWorkerMockDataEnabled,
} from "@/worker/db";
import {
  requireAdminSession,
  type AdminBindings,
  type AdminRouteDependencies,
  type AdminVariables,
} from "@/worker/routes/admin-support";

export function registerAdminReportRoutes(
  app: Hono<{
    Bindings: AdminBindings;
    Variables: AdminVariables;
  }>,
  dependencies: AdminRouteDependencies,
) {
  app.get("/api/admin/reports", async (c) => {
    const admin = requireAdminSession(c.req.raw, c.env, dependencies.noStoreHeaders);

    if (admin.response) {
      return admin.response;
    }

    if (!isWorkerDatabaseEnabled(c.env)) {
      if (!isWorkerMockDataEnabled(c.env)) {
        return dependencies.databaseUnavailableResponse("신고 목록을 불러오지 못했습니다.");
      }

      const result = listWorkerMockReports();

      return c.json(
        {
          items: result.items,
          count: result.items.length,
          source: result.source,
          mock: true,
        },
        200,
        dependencies.noStoreHeaders,
      );
    }

    try {
      const result = await dependencies.runWorkerDatabaseRoute(c.env, () =>
        listWorkerReports(c.env),
      );

      return c.json(
        {
          items: result.items,
          count: result.items.length,
          source: result.source,
          mock: false,
        },
        200,
        dependencies.noStoreHeaders,
      );
    } catch (error) {
      console.error("Failed to load worker admin reports.", error);

      return c.json(
        {
          ok: false,
          message: "신고 목록을 불러오지 못했습니다.",
        },
        500,
        dependencies.noStoreHeaders,
      );
    }
  });

  app.patch("/api/admin/reports/:id", async (c) => {
    const admin = requireAdminSession(c.req.raw, c.env, dependencies.noStoreHeaders);

    if (admin.response) {
      return admin.response;
    }

    const body = await c.req.json().catch(() => null);
    const parsed = reportModerationSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          message: "신고 상태 검증에 실패했습니다.",
          error: parsed.error.flatten(),
        },
        400,
        dependencies.noStoreHeaders,
      );
    }

    if (!isWorkerDatabaseEnabled(c.env)) {
      if (!isWorkerMockDataEnabled(c.env)) {
        return dependencies.databaseUnavailableResponse("신고 상태를 업데이트하지 못했습니다.");
      }

      return c.json(
        {
          ok: true,
          message: "목업 모드에서는 신고 상태가 실제 저장되지 않습니다.",
          source: "mock",
          item: null,
        },
        200,
        dependencies.noStoreHeaders,
      );
    }

    try {
      const result = await dependencies.runWorkerDatabaseRoute(c.env, () =>
        updateWorkerReportStatus(c.env, c.req.param("id"), parsed.data, admin.user),
      );

      return c.json(result, result.ok ? 200 : 404, dependencies.noStoreHeaders);
    } catch (error) {
      console.error("Failed to update worker report status.", error);

      return c.json(
        {
          ok: false,
          message: "신고 상태 업데이트에 실패했습니다.",
          source: "database",
          item: null,
        },
        500,
        dependencies.noStoreHeaders,
      );
    }
  });
}
