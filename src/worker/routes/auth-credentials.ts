import type { Hono } from "hono";

import { credentialsSignupSchema } from "@/features/auth/schema";
import {
  createWorkerCredentialsUser,
  verifyWorkerCredentials,
} from "@/worker/auth-repository";
import {
  AUTH_CALLBACK_COOKIE_NAME,
  isValidCsrfToken,
  AUTH_SESSION_COOKIE_NAME,
  AUTH_SESSION_MAX_AGE,
  createSession,
  encodeSession,
} from "@/worker/auth/session";
import { appendCookie } from "@/worker/http/cookies";
import { getOrigin, normalizeCallbackUrl } from "@/worker/http/urls";
import type {
  AuthBindings,
  AuthRouteDependencies,
} from "@/worker/routes/auth-support";
import {
  applyAuthRateLimitHeaders,
  consumeAuthRateLimit,
} from "@/worker/routes/auth-support";

export function registerAuthCredentialsRoutes(
  app: Hono<{ Bindings: AuthBindings; Variables: { requestId: string } }>,
  dependencies: AuthRouteDependencies<AuthBindings>,
) {
  app.post("/api/auth/callback/credentials", async (c) => {
    const contentType = c.req.header("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await c.req.json().catch(() => ({}))
      : Object.fromEntries((await c.req.formData()).entries());
    const origin = getOrigin(c.req.raw, c.env.NEXTAUTH_URL ?? c.env.SITE_URL);
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const shouldReturnJson =
      body.json === "true" ||
      c.req.header("accept")?.includes("application/json") === true;
    if (!isValidCsrfToken(c.req.raw, typeof body.csrfToken === "string" ? body.csrfToken : null)) {
      const errorUrl = `${origin}/api/auth/error?error=CSRFCheck&provider=credentials`;

      if (!shouldReturnJson) {
        return c.redirect(errorUrl);
      }

      return c.json({ url: errorUrl }, 403, dependencies.noStoreHeaders);
    }
    const rateLimit = await consumeAuthRateLimit(
      c.env,
      "authLogin",
      c.req.raw,
      email.trim().toLowerCase(),
      dependencies.runWorkerDatabaseRoute,
    );
    if (!rateLimit.ok) {
      return applyAuthRateLimitHeaders(
        c.json(
          { ok: false, message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요." },
          429,
          dependencies.noStoreHeaders,
        ),
        rateLimit,
      );
    }
    const callbackUrl = normalizeCallbackUrl(
      typeof body.callbackUrl === "string" ? body.callbackUrl : "/",
      origin,
    );
    const user = await dependencies.runWorkerDatabaseRoute(c.env, () =>
      verifyWorkerCredentials(c.env, email, password),
    );

    if (!user) {
      const errorUrl = `${origin}/api/auth/error?error=CredentialsSignin&provider=credentials`;

      if (!shouldReturnJson) {
        return c.redirect(errorUrl);
      }

      return c.json({ url: errorUrl }, 401, dependencies.noStoreHeaders);
    }

    const session = createSession(user);
    const redirectUrl = new URL(callbackUrl, origin).toString();
    const response = shouldReturnJson
      ? c.json({ url: callbackUrl }, 200, dependencies.noStoreHeaders)
      : c.redirect(redirectUrl);

    appendCookie(response, c.req.raw, {
      name: AUTH_SESSION_COOKIE_NAME,
      value: encodeSession(session, c.env),
      maxAge: AUTH_SESSION_MAX_AGE,
    });
    appendCookie(response, c.req.raw, {
      name: AUTH_CALLBACK_COOKIE_NAME,
      value: callbackUrl,
    });

    return response;
  });

  app.post("/api/auth/signup", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = credentialsSignupSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          message: "회원가입 입력값 검증에 실패했습니다.",
          item: null,
          error: parsed.error.flatten(),
        },
        400,
        dependencies.noStoreHeaders,
      );
    }

    const rateLimit = await consumeAuthRateLimit(
      c.env,
      "authSignup",
      c.req.raw,
      parsed.data.email.trim().toLowerCase(),
      dependencies.runWorkerDatabaseRoute,
    );
    if (!rateLimit.ok) {
      return applyAuthRateLimitHeaders(
        c.json(
          { ok: false, message: "회원가입 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
          429,
          dependencies.noStoreHeaders,
        ),
        rateLimit,
      );
    }

    const result = await dependencies.runWorkerDatabaseRoute(c.env, () =>
      createWorkerCredentialsUser(c.env, parsed.data),
    );
    const status = result.ok
      ? 201
      : result.message.includes("이미 가입된 이메일")
        ? 409
        : result.message.includes("데이터 연결")
          ? 503
          : 500;

    return c.json(result, status, dependencies.noStoreHeaders);
  });
}
