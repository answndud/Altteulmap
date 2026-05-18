import type { Hono } from "hono";

import { registerAdminPlaceRoutes } from "@/worker/routes/admin-places";
import { registerAdminPriceRoutes } from "@/worker/routes/admin-prices";
import { registerAdminReportRoutes } from "@/worker/routes/admin-reports";
import {
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
  registerAdminPlaceRoutes(app, dependencies);

  registerAdminPriceRoutes(app, dependencies);

  registerAdminReportRoutes(app, dependencies);
}
