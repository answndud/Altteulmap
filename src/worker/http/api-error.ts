/**
 * API 에러 계약. 모든 4xx/5xx JSON 응답은 아래 envelope 하나를 따른다.
 *
 *   { ok: false, message, error: { code, message, details? }, requestId }
 *
 * - `message`는 기존 클라이언트 호환을 위한 사용자용 문구다.
 * - `error.code`는 기계가 분기하는 안정적인 식별자다(아래 API_ERROR_CODES).
 * - 도메인 코드는 `DomainError`를 던져 만들고, 기존 라우트가 만든 `{ ok: false, ... }`
 *   응답은 `normalizeErrorBody`가 경계(미들웨어)에서 같은 envelope로 맞춘다.
 */
export const API_ERROR_CODES = {
  BAD_REQUEST: { status: 400, description: "요청 형식이 올바르지 않음" },
  VALIDATION_FAILED: { status: 400, description: "입력값 검증 실패(details에 필드별 오류)" },
  UNAUTHENTICATED: { status: 401, description: "로그인이 필요함" },
  INVALID_BOUNDS: { status: 400, description: "지도 영역 파라미터가 올바르지 않음" },
  QUERY_TOO_LONG: { status: 400, description: "검색어가 상한을 넘음" },
  FORBIDDEN: { status: 403, description: "권한 없음" },
  CROSS_SITE_REQUEST: { status: 403, description: "허용되지 않은 출처의 변경 요청" },
  NOT_FOUND: { status: 404, description: "대상을 찾지 못함" },
  CONFLICT: { status: 409, description: "이미 존재하는 값과 충돌" },
  REQUEST_BODY_TOO_LARGE: { status: 413, description: "요청 본문이 상한을 넘음" },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, description: "JSON 외 본문" },
  RATE_LIMITED: { status: 429, description: "요청 한도 초과(Retry-After 참고)" },
  INTERNAL_ERROR: { status: 500, description: "처리되지 않은 서버 오류" },
  SERVICE_UNAVAILABLE: { status: 503, description: "외부 설정·서비스를 사용할 수 없음" },
  DATABASE_UNAVAILABLE: { status: 503, description: "데이터베이스를 사용할 수 없음" },
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_CODES;

/** 서비스·repository가 던지는 의도된 실패. 라우트(onError)가 envelope로 변환한다. */
export class DomainError extends Error {
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }

  get status() {
    return API_ERROR_CODES[this.code].status;
  }
}

const STATUS_FALLBACK_CODES: Record<number, ApiErrorCode> = {
  400: "BAD_REQUEST",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "REQUEST_BODY_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  429: "RATE_LIMITED",
  503: "SERVICE_UNAVAILABLE",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isZodFlatten(value: unknown) {
  return isRecord(value) && ("fieldErrors" in value || "formErrors" in value);
}

type ErrorEnvelope = ReturnType<typeof buildErrorBody>;

export function buildErrorBody({
  code,
  message,
  details,
  requestId,
  extra,
}: {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
  requestId?: string;
  extra?: Record<string, unknown>;
}) {
  return {
    ...extra,
    ok: false as const,
    message,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
    ...(requestId ? { requestId } : {}),
  };
}

/**
 * `{ ok: false, ... }` 본문을 표준 envelope로 맞춘다. 이미 `error.code`가 있으면 유지하고,
 * zod flatten 결과는 `error.details`로 옮기며, 코드는 HTTP status에서 유도한다.
 * `retryAfterMs`·`item` 같은 부가 필드는 호환을 위해 그대로 둔다.
 * 표준 envelope가 아니면(예: `{ url }`) null을 반환해 건드리지 않는다.
 */
export function normalizeErrorBody(
  body: unknown,
  status: number,
  requestId?: string,
): ErrorEnvelope | null {
  if (!isRecord(body) || body.ok !== false) {
    return null;
  }

  const { error, message, ...rest } = body;
  const text =
    typeof message === "string" && message
      ? message
      : isRecord(error) && typeof error.message === "string"
        ? error.message
        : "요청을 처리하지 못했습니다.";

  if (isRecord(error) && typeof error.code === "string") {
    return {
      ...body,
      message: text,
      ...(requestId && !body.requestId ? { requestId } : {}),
    } as ErrorEnvelope;
  }

  const code: ApiErrorCode = isZodFlatten(error)
    ? "VALIDATION_FAILED"
    : (STATUS_FALLBACK_CODES[status] ??
      (status >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST"));
  const { ok: _ok, ...extra } = rest;

  return buildErrorBody({
    code,
    message: text,
    details: isZodFlatten(error) ? error : undefined,
    requestId,
    extra,
  });
}
