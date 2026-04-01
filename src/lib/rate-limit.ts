type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  ok: boolean;
  remaining: number;
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
      remaining: limit - 1,
      retryAfterMs: 0,
    };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(current.resetAt - now, 0),
    };
  }

  current.count += 1;
  store.set(bucketKey, current);

  return {
    ok: true,
    remaining: Math.max(limit - current.count, 0),
    retryAfterMs: 0,
  };
}
