import type { Hono } from "hono";

import {
  type PublicWriteBindings,
  type PublicWriteRouteDependencies,
  type PublicWriteVariables,
} from "@/worker/routes/public-write-support";
import { registerPublicWriteCommentRoutes } from "@/worker/routes/public-write-comments";
import { registerPublicWritePriceReportRoutes } from "@/worker/routes/public-write-price-reports";
import { registerPublicWriteReactionRoutes } from "@/worker/routes/public-write-reactions";
import { registerPublicWriteReportRoutes } from "@/worker/routes/public-write-reports";
import { registerPublicWriteSubmissionRoutes } from "@/worker/routes/public-write-submissions";

export function registerPublicWriteRoutes(
  app: Hono<{
    Bindings: PublicWriteBindings;
    Variables: PublicWriteVariables;
  }>,
  dependencies: PublicWriteRouteDependencies,
) {
  registerPublicWritePriceReportRoutes(app, dependencies);

  registerPublicWriteCommentRoutes(app, dependencies);

  registerPublicWriteReactionRoutes(app, dependencies);

  registerPublicWriteSubmissionRoutes(app, dependencies);

  registerPublicWriteReportRoutes(app, dependencies);
}
