import type { Hono } from "hono";

import { registerAuthCredentialsRoutes } from "@/worker/routes/auth-credentials";
import { registerAuthOAuthRoutes } from "@/worker/routes/auth-oauth";
import { registerAuthSessionRoutes } from "@/worker/routes/auth-session";
import type {
  AuthBindings,
  AuthRouteDependencies,
} from "@/worker/routes/auth-support";

export function registerAuthRoutes(
  app: Hono<{ Bindings: AuthBindings; Variables: { requestId: string } }>,
  dependencies: AuthRouteDependencies<AuthBindings>,
) {
  registerAuthSessionRoutes(app, dependencies);
  registerAuthOAuthRoutes(app, dependencies);
  registerAuthCredentialsRoutes(app, dependencies);
}
