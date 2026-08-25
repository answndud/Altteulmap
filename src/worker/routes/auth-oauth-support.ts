import { listWorkerSocialAuthProviders } from "@/worker/auth-repository";
import { z } from "zod";
import {
  AUTH_OAUTH_STATE_MAX_AGE,
  decodeSignedPayload,
  encodeSignedPayload,
} from "@/worker/auth/session";
import { normalizeCallbackUrl } from "@/worker/http/urls";
import { fetchWithTimeout } from "@/worker/http/fetch";
import type { AuthBindings } from "@/worker/routes/auth-support";

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
  emailVerified: boolean;
  id: string | null;
  name: string | null;
};

const oauthTokenResponseSchema = z
  .object({
    access_token: z.string().optional(),
    refresh_token: z.string().optional(),
    expires_in: z.number().finite().nonnegative().optional(),
    token_type: z.string().optional(),
    scope: z.string().optional(),
    id_token: z.string().optional(),
  })
  .passthrough();

function isOAuthProviderId(value: string): value is OAuthProviderId {
  return OAUTH_PROVIDERS.includes(value as OAuthProviderId);
}

export function createOAuthState(
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

export function decodeOAuthState(
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

export function getEnabledOAuthProvider(
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

export function getOAuthProviderConfig(
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

export async function exchangeOAuthToken(
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

  const response = await fetchWithTimeout(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  }, 8_000);

  if (!response.ok) {
    throw new Error(`OAuth token exchange failed for ${provider}.`);
  }

  const parsed = oauthTokenResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    throw new Error(`OAuth token response was malformed for ${provider}.`);
  }

  return parsed.data satisfies OAuthTokenResponse;
}

export async function fetchOAuthProfile(
  provider: OAuthProviderId,
  accessToken: string,
  env: AuthBindings,
  origin: string,
): Promise<OAuthProfile> {
  const config = getOAuthProviderConfig(env, provider, origin);
  const response = await fetchWithTimeout(config.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }, 8_000);

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
      emailVerified:
        kakaoAccount?.is_email_valid === true &&
        kakaoAccount?.is_email_verified === true,
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
    emailVerified: true,
    id: typeof responseProfile?.id === "string" ? responseProfile.id : null,
    name: typeof responseProfile?.name === "string" ? responseProfile.name : null,
  };
}
