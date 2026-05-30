import type { Hono } from "hono";

import { syncWorkerOAuthUser } from "@/worker/auth-repository";
import {
  AUTH_CALLBACK_COOKIE_NAME,
  AUTH_OAUTH_STATE_COOKIE_NAME,
  AUTH_OAUTH_STATE_MAX_AGE,
  AUTH_SESSION_COOKIE_NAME,
  AUTH_SESSION_MAX_AGE,
  createSession,
  encodeSession,
} from "@/worker/auth/session";
import { appendCookie, getCookieValue } from "@/worker/http/cookies";
import { getOrigin, normalizeCallbackUrl } from "@/worker/http/urls";
import {
  createOAuthState,
  decodeOAuthState,
  exchangeOAuthToken,
  fetchOAuthProfile,
  getEnabledOAuthProvider,
  getOAuthProviderConfig,
} from "@/worker/routes/auth-oauth-support";
import type {
  AuthBindings,
  AuthRouteDependencies,
} from "@/worker/routes/auth-support";

function redirectToLoginError(
  request: Request,
  env: AuthBindings,
  error: string,
  callbackUrl = "/",
) {
  const redirectUrl = new URL(
    "/login",
    getOrigin(request, env.NEXTAUTH_URL ?? env.SITE_URL),
  );

  redirectUrl.searchParams.set("callbackUrl", normalizeCallbackUrl(callbackUrl));
  redirectUrl.searchParams.set("error", error);

  return Response.redirect(redirectUrl.toString(), 302);
}

export function registerAuthOAuthRoutes(
  app: Hono<{ Bindings: AuthBindings; Variables: { requestId: string } }>,
  dependencies: AuthRouteDependencies<AuthBindings>,
) {
  app.get("/api/auth/signin/:provider", (c) => {
    const provider = c.req.param("provider");
    const callbackUrl = normalizeCallbackUrl(c.req.query("callbackUrl"));
    const enabledProvider = getEnabledOAuthProvider(c.env, provider);

    if (!enabledProvider) {
      return redirectToLoginError(c.req.raw, c.env, provider, callbackUrl);
    }

    const origin = getOrigin(c.req.raw, c.env.NEXTAUTH_URL ?? c.env.SITE_URL);
    const config = getOAuthProviderConfig(c.env, enabledProvider, origin);
    const state = createOAuthState(enabledProvider, callbackUrl, c.env);
    const authorizationUrl = new URL(config.authorizationUrl);

    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", config.clientId);
    authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
    authorizationUrl.searchParams.set("state", state);

    if (enabledProvider === "kakao") {
      authorizationUrl.searchParams.set("scope", "profile_nickname account_email");
    }

    const response = c.redirect(authorizationUrl.toString());

    appendCookie(response, c.req.raw, {
      name: AUTH_OAUTH_STATE_COOKIE_NAME,
      value: state,
      maxAge: AUTH_OAUTH_STATE_MAX_AGE,
    });
    appendCookie(response, c.req.raw, {
      name: AUTH_CALLBACK_COOKIE_NAME,
      value: callbackUrl,
    });

    return response;
  });

  app.get("/api/auth/callback/:provider", async (c) => {
    const provider = c.req.param("provider");
    const enabledProvider = getEnabledOAuthProvider(c.env, provider);

    if (!enabledProvider) {
      return redirectToLoginError(c.req.raw, c.env, "OAuthSignin");
    }

    const error = c.req.query("error");

    if (error) {
      return redirectToLoginError(c.req.raw, c.env, "OAuthCallback");
    }

    const code = c.req.query("code");
    const state = c.req.query("state");
    const cookieState = getCookieValue(
      c.req.header("cookie") ?? null,
      AUTH_OAUTH_STATE_COOKIE_NAME,
    );
    const decodedState = decodeOAuthState(state ?? null, c.env);
    const decodedCookieState = decodeOAuthState(cookieState, c.env);

    if (
      !code ||
      !decodedState ||
      !decodedCookieState ||
      state !== cookieState ||
      decodedState.provider !== enabledProvider
    ) {
      return redirectToLoginError(c.req.raw, c.env, "OAuthCallback");
    }

    try {
      const origin = getOrigin(c.req.raw, c.env.NEXTAUTH_URL ?? c.env.SITE_URL);
      const token = await exchangeOAuthToken(enabledProvider, code, c.env, origin);

      if (!token.access_token) {
        return redirectToLoginError(
          c.req.raw,
          c.env,
          "OAuthCallback",
          decodedState.callbackUrl,
        );
      }

      const profile = await fetchOAuthProfile(
        enabledProvider,
        token.access_token,
        c.env,
        origin,
      );

      if (!profile.email || !profile.id) {
        return redirectToLoginError(
          c.req.raw,
          c.env,
          "OAuthEmailRequired",
          decodedState.callbackUrl,
        );
      }

      const profileEmail = profile.email;
      const profileId = profile.id;
      const syncedUser = await dependencies.runWorkerDatabaseRoute(c.env, () =>
        syncWorkerOAuthUser(c.env, {
          provider: enabledProvider,
          providerAccountId: profileId,
          type: "oauth",
          email: profileEmail,
          name: profile.name,
          accessToken: token.access_token ?? null,
          refreshToken: token.refresh_token ?? null,
          expiresAt: token.expires_in
            ? Math.floor(Date.now() / 1000) + token.expires_in
            : null,
          tokenType: token.token_type ?? null,
          scope: token.scope ?? null,
          idToken: token.id_token ?? null,
          sessionState: null,
        }),
      );

      if (!syncedUser) {
        return redirectToLoginError(
          c.req.raw,
          c.env,
          "OAuthAccountSyncFailed",
          decodedState.callbackUrl,
        );
      }

      const session = createSession(syncedUser);
      const response = c.redirect(decodedState.callbackUrl);

      appendCookie(response, c.req.raw, {
        name: AUTH_SESSION_COOKIE_NAME,
        value: encodeSession(session, c.env),
        maxAge: AUTH_SESSION_MAX_AGE,
      });
      appendCookie(response, c.req.raw, {
        name: AUTH_OAUTH_STATE_COOKIE_NAME,
        value: "",
        maxAge: 0,
      });
      appendCookie(response, c.req.raw, {
        name: AUTH_CALLBACK_COOKIE_NAME,
        value: decodedState.callbackUrl,
      });

      return response;
    } catch (callbackError) {
      console.error(`Failed to complete ${enabledProvider} OAuth callback.`, callbackError);
      return redirectToLoginError(
        c.req.raw,
        c.env,
        "OAuthCallback",
        decodedState.callbackUrl,
      );
    }
  });
}
