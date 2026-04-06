type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  policyName?: RateLimitPolicyName;
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
};

export const RATE_LIMIT_POLICIES = {
  placeSubmission: {
    scope: "place_submission",
    limit: 4,
    windowMs: 30 * 60 * 1000,
  },
  placeCommentSubmission: {
    scope: "place_comment_submission",
    limit: 8,
    windowMs: 10 * 60 * 1000,
  },
  placePriceSubmission: {
    scope: "place_price_submission",
    limit: 8,
    windowMs: 10 * 60 * 1000,
  },
  contentReportSubmission: {
    scope: "content_report_submission",
    limit: 6,
    windowMs: 30 * 60 * 1000,
  },
  placeReaction: {
    scope: "place_reaction",
    limit: 40,
    windowMs: 5 * 60 * 1000,
  },
  authSignup: {
    scope: "auth_signup",
    limit: 3,
    windowMs: 30 * 60 * 1000,
  },
} as const;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;

export type RateLimitResult = {
  ok: boolean;
  policyName?: RateLimitPolicyName;
  scope: string;
  limit: number;
  remaining: number;
  resetAt: number;
  windowMs: number;
  retryAfterMs: number;
};

const globalStore = globalThis as typeof globalThis & {
  __altteulmapRateLimits?: Map<string, RateLimitEntry>;
};

function getRateLimitStore() {
  if (!globalStore.__altteulmapRateLimits) {
    globalStore.__altteulmapRateLimits = new Map<string, RateLimitEntry>();
  }

  return globalStore.__altteulmapRateLimits;
}

function cleanupExpiredEntries(store: Map<string, RateLimitEntry>, now: number) {
  for (const [key, value] of store.entries()) {
    if (value.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function consumeRateLimit({
  policyName,
  scope,
  key,
  limit,
  windowMs,
}: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const store = getRateLimitStore();

  if (store.size > 200) {
    cleanupExpiredEntries(store, now);
  }

  const bucketKey = `${scope}:${key}`;
  const current = store.get(bucketKey);

  if (!current || current.resetAt <= now) {
    store.set(bucketKey, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      ok: true,
      policyName,
      scope,
      limit,
      remaining: limit - 1,
      resetAt: now + windowMs,
      windowMs,
      retryAfterMs: 0,
    };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      policyName,
      scope,
      limit,
      remaining: 0,
      resetAt: current.resetAt,
      windowMs,
      retryAfterMs: Math.max(current.resetAt - now, 0),
    };
  }

  current.count += 1;
  store.set(bucketKey, current);

  return {
    ok: true,
    policyName,
    scope,
    limit,
    remaining: Math.max(limit - current.count, 0),
    resetAt: current.resetAt,
    windowMs,
    retryAfterMs: 0,
  };
}

export function consumeRateLimitPolicy(
  policyName: RateLimitPolicyName,
  key: string,
) {
  const policy = RATE_LIMIT_POLICIES[policyName];

  return consumeRateLimit({
    policyName,
    ...policy,
    key,
  });
}

export function applyRateLimitHeaders(
  response: Response,
  rateLimit: RateLimitResult,
) {
  response.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
  response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
  response.headers.set(
    "X-RateLimit-Window",
    String(Math.ceil(rateLimit.windowMs / 1000)),
  );
  response.headers.set("X-RateLimit-Policy", rateLimit.scope);
  response.headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil(rateLimit.resetAt / 1000)),
  );

  if (!rateLimit.ok && rateLimit.retryAfterMs > 0) {
    response.headers.set(
      "Retry-After",
      String(Math.ceil(rateLimit.retryAfterMs / 1000)),
    );
  }

  return response;
}
