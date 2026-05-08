type PublicConfigEnv = {
  NAVER_MAP_CLIENT_ID?: string;
  NEXT_PUBLIC_NAVER_MAP_CLIENT_ID?: string;
  NEXT_PUBLIC_NAVER_MAP_KEY_ID?: string;
  NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
};

const BUILD_TIME_PUBLIC_NAVER_MAP_KEY_ID =
  process.env.NEXT_PUBLIC_NAVER_MAP_KEY_ID ||
  process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ||
  "";

export function getPublicNaverMapKeyId(env: PublicConfigEnv) {
  return (
    env.NEXT_PUBLIC_NAVER_MAP_KEY_ID ||
    env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ||
    env.NAVER_MAP_CLIENT_ID ||
    BUILD_TIME_PUBLIC_NAVER_MAP_KEY_ID ||
    ""
  );
}

export function getPublicTurnstileSiteKey(env: PublicConfigEnv) {
  return env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
}
