import type { Hono } from "hono";

import { listWorkerSocialAuthProviders } from "@/worker/auth-repository";
import {
  AUTH_CALLBACK_COOKIE_NAME,
  AUTH_CSRF_COOKIE_NAME,
  AUTH_SESSION_COOKIE_NAME,
  getSessionFromRequest,
} from "@/worker/auth/session";
import { appendCookie } from "@/worker/http/cookies";
import { getOrigin, normalizeCallbackUrl } from "@/worker/http/urls";
import { registerAuthCredentialsRoutes } from "@/worker/routes/auth-credentials";
import { registerAuthOAuthRoutes } from "@/worker/routes/auth-oauth";
import type {
  AuthBindings,
  AuthRouteDependencies,
} from "@/worker/routes/auth-support";

export function registerAuthRoutes(
  app: Hono<{ Bindings: AuthBindings; Variables: { requestId: string } }>,
  dependencies: AuthRouteDependencies<AuthBindings>,
) {
  app.get("/api/auth/csrf", (c) => {
    const csrfToken = crypto.randomUUID();
    const response = c.json(
      {
        csrfToken,
      },
      200,
      dependencies.noStoreHeaders,
    );

    appendCookie(response, c.req.raw, {
      name: AUTH_CSRF_COOKIE_NAME,
      value: `${csrfToken}|vite-mock`,
    });
    appendCookie(response, c.req.raw, {
      name: AUTH_CALLBACK_COOKIE_NAME,
      value: getOrigin(c.req.raw, c.env.NEXTAUTH_URL ?? c.env.SITE_URL),
    });

    return response;
  });

  app.get("/api/auth/session", (c) => {
    const session = getSessionFromRequest(c.req.raw, c.env);

    if (!session) {
      return c.json({}, 200, dependencies.noStoreHeaders);
    }

    return c.json(session, 200, dependencies.noStoreHeaders);
  });

  app.post("/api/auth/signout", async (c) => {
    const contentType = c.req.header("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await c.req.json().catch(() => ({}))
      : Object.fromEntries((await c.req.formData()).entries());
    const origin = getOrigin(c.req.raw, c.env.NEXTAUTH_URL ?? c.env.SITE_URL);
    const shouldReturnJson =
      body.json === "true" ||
      c.req.header("accept")?.includes("application/json") === true;
    const callbackUrl = normalizeCallbackUrl(
      typeof body.callbackUrl === "string" ? body.callbackUrl : "/",
      origin,
    );
    const response = shouldReturnJson
      ? c.json({ url: callbackUrl }, 200, dependencies.noStoreHeaders)
      : c.redirect(new URL(callbackUrl, origin).toString());

    appendCookie(response, c.req.raw, {
      name: AUTH_SESSION_COOKIE_NAME,
      value: "",
      maxAge: 0,
    });
    appendCookie(response, c.req.raw, {
      name: AUTH_CALLBACK_COOKIE_NAME,
      value: callbackUrl,
    });

    return response;
  });

  app.get("/api/auth/providers", (c) => {
    const origin = getOrigin(c.req.raw, c.env.NEXTAUTH_URL ?? c.env.SITE_URL);
    const providers: Record<string, unknown> = {
      credentials: {
        id: "credentials",
        name: "Credentials",
        type: "credentials",
        signinUrl: `${origin}/api/auth/signin/credentials`,
        callbackUrl: `${origin}/api/auth/callback/credentials`,
      },
    };

    for (const provider of listWorkerSocialAuthProviders(c.env)) {
      if (!provider.enabled) {
        continue;
      }

      providers[provider.id] = {
        id: provider.id,
        name: provider.label,
        type: "oauth",
        signinUrl: `${origin}/api/auth/signin/${provider.id}`,
        callbackUrl: `${origin}/api/auth/callback/${provider.id}`,
      };
    }

    return c.json(providers, 200, dependencies.noStoreHeaders);
  });

  registerAuthOAuthRoutes(app, dependencies);
  registerAuthCredentialsRoutes(app, dependencies);
}
