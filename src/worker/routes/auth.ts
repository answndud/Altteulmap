import type { Hono } from "hono";

import { credentialsSignupSchema } from "@/features/auth/schema";
import {
  createWorkerCredentialsUser,
  listWorkerSocialAuthProviders,
  syncWorkerOAuthUser,
  verifyWorkerCredentials,
} from "@/worker/auth-repository";
import {
  AUTH_CALLBACK_COOKIE_NAME,
  AUTH_CSRF_COOKIE_NAME,
  AUTH_OAUTH_STATE_COOKIE_NAME,
  AUTH_OAUTH_STATE_MAX_AGE,
  AUTH_SESSION_COOKIE_NAME,
  AUTH_SESSION_MAX_AGE,
  createSession,
  decodeSignedPayload,
  encodeSession,
  encodeSignedPayload,
  getSessionFromRequest,
} from "@/worker/auth/session";
import { appendCookie, getCookieValue } from "@/worker/http/cookies";
import { getOrigin, normalizeCallbackUrl } from "@/worker/http/urls";

const OAUTH_PROVIDERS = ["kakao", "naver"] as const;

type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number];
type OAuthState = {
  callbackUrl: string;
  expires: number;
  nonce: string;
  provider: OAuthProviderId;
};
type OAuthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
};
type OAuthProfile = {
  email: string | null;
  id: string | null;
  name: string | null;
};

type AssetFetcher = {
  fetch(request: Request): Promise<Response> | Response;
};

type AuthBindings = {
  ASSETS: AssetFetcher;
  AUTH_ADMIN_PASSWORD?: string;
  AUTH_DEMO_PASSWORD?: string;
  AUTH_SECRET?: string;
  AUTH_KAKAO_CLIENT_ID?: string;
  AUTH_KAKAO_CLIENT_SECRET?: string;
  AUTH_NAVER_CLIENT_ID?: string;
  AUTH_NAVER_CLIENT_SECRET?: string;
  DATABASE_URL?: string;
  HYPERDRIVE?: {
    connectionString?: string;
  };
  NEXTAUTH_URL?: string;
  SITE_URL?: string;
  USE_MOCK_DATA?: string;
};

type AuthRouteDependencies<TBindings extends AuthBindings> = {
  noStoreHeaders: Record<string, string>;
  runWorkerDatabaseRoute<T>(env: TBindings, load: () => Promise<T>): Promise<T>;
};

function isOAuthProviderId(value: string): value is OAuthProviderId {
  return OAUTH_PROVIDERS.includes(value as OAuthProviderId);
}

function createOAuthState(
  provider: OAuthProviderId,
  callbackUrl: string,
  env: AuthBindings,
) {
  return encodeSignedPayload(
    {
      callbackUrl,
      expires: Date.now() + AUTH_OAUTH_STATE_MAX_AGE * 1000,
      nonce: crypto.randomUUID(),
      provider,
    } satisfies OAuthState,
    env,
  );
}

function decodeOAuthState(
  rawState: string | null,
  env: AuthBindings,
): OAuthState | null {
  const state = decodeSignedPayload<OAuthState>(rawState, env);

  if (
    !state ||
    !isOAuthProviderId(state.provider) ||
    !state.nonce ||
    Date.now() >= state.expires
  ) {
    return null;
  }

  return {
    ...state,
    callbackUrl: normalizeCallbackUrl(state.callbackUrl),
  };
}

function getEnabledOAuthProvider(
  env: AuthBindings,
  providerId: string,
) {
  if (!isOAuthProviderId(providerId)) {
    return null;
  }

  const availability = listWorkerSocialAuthProviders(env).find(
    (provider) => provider.id === providerId,
  );

  if (!availability?.enabled) {
    return null;
  }

  return providerId;
}

function getOAuthProviderConfig(
  env: AuthBindings,
  provider: OAuthProviderId,
  origin: string,
) {
  if (provider === "kakao") {
    return {
      authorizationUrl: "https://kauth.kakao.com/oauth/authorize",
      clientId: env.AUTH_KAKAO_CLIENT_ID ?? "",
      clientSecret: env.AUTH_KAKAO_CLIENT_SECRET ?? "",
      redirectUri: `${origin}/api/auth/callback/kakao`,
      tokenUrl: "https://kauth.kakao.com/oauth/token",
      userInfoUrl: "https://kapi.kakao.com/v2/user/me",
    };
  }

  return {
    authorizationUrl: "https://nid.naver.com/oauth2.0/authorize",
    clientId: env.AUTH_NAVER_CLIENT_ID ?? "",
    clientSecret: env.AUTH_NAVER_CLIENT_SECRET ?? "",
    redirectUri: `${origin}/api/auth/callback/naver`,
    tokenUrl: "https://nid.naver.com/oauth2.0/token",
    userInfoUrl: "https://openapi.naver.com/v1/nid/me",
  };
}

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

async function exchangeOAuthToken(
  provider: OAuthProviderId,
  code: string,
  env: AuthBindings,
  origin: string,
) {
  const config = getOAuthProviderConfig(env, provider, origin);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`OAuth token exchange failed for ${provider}.`);
  }

  return (await response.json()) as OAuthTokenResponse;
}

async function fetchOAuthProfile(
  provider: OAuthProviderId,
  accessToken: string,
  env: AuthBindings,
  origin: string,
): Promise<OAuthProfile> {
  const config = getOAuthProviderConfig(env, provider, origin);
  const response = await fetch(config.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`OAuth profile fetch failed for ${provider}.`);
  }

  const profile = (await response.json()) as Record<string, unknown>;

  if (provider === "kakao") {
    const kakaoAccount = profile.kakao_account as
      | Record<string, unknown>
      | undefined;
    const properties = profile.properties as Record<string, unknown> | undefined;

    return {
      email:
        typeof kakaoAccount?.email === "string" ? kakaoAccount.email : null,
      id: typeof profile.id === "number" || typeof profile.id === "string"
        ? String(profile.id)
        : null,
      name:
        typeof properties?.nickname === "string"
          ? properties.nickname
          : typeof kakaoAccount?.profile === "object" &&
              kakaoAccount.profile &&
              typeof (kakaoAccount.profile as { nickname?: unknown }).nickname ===
                "string"
            ? (kakaoAccount.profile as { nickname: string }).nickname
            : null,
    };
  }

  const responseProfile = profile.response as Record<string, unknown> | undefined;

  return {
    email:
      typeof responseProfile?.email === "string" ? responseProfile.email : null,
    id: typeof responseProfile?.id === "string" ? responseProfile.id : null,
    name: typeof responseProfile?.name === "string" ? responseProfile.name : null,
  };
}

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
