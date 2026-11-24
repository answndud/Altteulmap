export type EdgeCacheFreshness = "fresh" | "stale" | "expired";

/**
 * stale-while-revalidate 판정. 저장 시각이 없으면(예전 형식·상세 캐시) 신선한 것으로 본다.
 * - fresh: 저장 후 freshSeconds 이내. 그대로 돌려준다.
 * - stale: freshSeconds 초과, freshSeconds + staleSeconds 이내. 먼저 돌려주고 백그라운드에서 갱신한다.
 * - expired: 그보다 오래됨. 캐시가 없는 것처럼 새로 만든다.
 */
export function getEdgeCacheFreshness(
  cachedAtMs: number | null,
  nowMs: number,
  freshSeconds: number,
  staleSeconds: number,
): EdgeCacheFreshness {
  if (cachedAtMs === null || !Number.isFinite(cachedAtMs)) {
    return "fresh";
  }

  const ageSeconds = Math.max(0, (nowMs - cachedAtMs) / 1000);

  if (ageSeconds <= freshSeconds) {
    return "fresh";
  }

  return ageSeconds <= freshSeconds + staleSeconds ? "stale" : "expired";
}
