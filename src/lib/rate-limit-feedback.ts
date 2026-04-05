"use client";

type RateLimitFeedbackOptions = {
  response: Response;
  message?: string | null;
  retryAfterMs?: number | null;
  defaultMessage?: string;
};

const RETRY_SUFFIX_PATTERN =
  /\s*(잠시 후 다시 시도해주세요|다시 시도해주세요)\.?$/;

function parsePositiveInteger(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function getRetryAfterSecondsFromHeaders(response: Response) {
  const retryAfterSeconds = parsePositiveInteger(
    response.headers.get("Retry-After"),
  );

  if (retryAfterSeconds) {
    return retryAfterSeconds;
  }

  const rateLimitReset = parsePositiveInteger(
    response.headers.get("X-RateLimit-Reset"),
  );

  if (!rateLimitReset) {
    return null;
  }

  return Math.max(rateLimitReset - Math.ceil(Date.now() / 1000), 1);
}

function getRetryAfterSeconds(
  response: Response,
  retryAfterMs?: number | null,
) {
  const fromHeaders = getRetryAfterSecondsFromHeaders(response);

  if (fromHeaders) {
    return fromHeaders;
  }

  if (retryAfterMs && retryAfterMs > 0) {
    return Math.max(Math.ceil(retryAfterMs / 1000), 1);
  }

  return null;
}

function formatRetryAfter(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
  }

  if (minutes > 0) {
    return remainingSeconds > 0
      ? `${minutes}분 ${remainingSeconds}초`
      : `${minutes}분`;
  }

  return `${seconds}초`;
}

function normalizeBaseMessage(message?: string | null, defaultMessage?: string) {
  const normalized =
    message?.trim() || defaultMessage?.trim() || "요청이 너무 빠릅니다.";

  return normalized.replace(RETRY_SUFFIX_PATTERN, "").trim();
}

export function getRateLimitFeedbackMessage({
  response,
  message,
  retryAfterMs,
  defaultMessage,
}: RateLimitFeedbackOptions) {
  if (response.status !== 429) {
    return message ?? defaultMessage ?? "";
  }

  const retryAfterSeconds = getRetryAfterSeconds(response, retryAfterMs);
  const baseMessage = normalizeBaseMessage(message, defaultMessage);

  if (!retryAfterSeconds) {
    return `${baseMessage} 잠시 후 다시 시도해주세요.`;
  }

  return `${baseMessage} 약 ${formatRetryAfter(retryAfterSeconds)} 후 다시 시도해주세요.`;
}
