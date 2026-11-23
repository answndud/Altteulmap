import type { Hono } from "hono";

import { registerAdminPlaceRoutes } from "@/worker/routes/admin-places";
import { registerAdminPriceRoutes } from "@/worker/routes/admin-prices";
import { registerAdminReportRoutes } from "@/worker/routes/admin-reports";
import { getAdminService } from "@/worker/services/admin-service";
import {
  requireAdminSession,
  type AdminBindings,
  type AdminRouteDependencies,
  type AdminVariables,
} from "@/worker/routes/admin-support";

export function registerAdminRoutes(
  app: Hono<{
    Bindings: AdminBindings;
    Variables: AdminVariables;
  }>,
  dependencies: AdminRouteDependencies,
) {
  app.get("/api/admin/stats", async (c) => {
    await requireAdminSession(c.req.raw, c.env);

    return c.json(await getAdminService(c.env).getStats(), 200, dependencies.noStoreHeaders);
  });

  registerAdminPlaceRoutes(app, dependencies);

  registerAdminPriceRoutes(app, dependencies);

  registerAdminReportRoutes(app, dependencies);
}
