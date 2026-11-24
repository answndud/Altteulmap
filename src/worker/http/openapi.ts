import type { Env, Hono } from "hono";
import { z } from "zod";

import { credentialsSignupSchema } from "@/features/auth/schema";
import { bookmarkToggleSchema } from "@/features/bookmarks/schema";
import { placeReactionSchema } from "@/features/places/reaction-schema";
import {
  adminPriceItemUpdateSchema,
  placeCommentSchema,
  placePriceReportSchema,
  priceReportModerationSchema,
} from "@/features/places/write-schema";
import {
  reportModerationSchema,
  reportSubmissionSchema,
} from "@/features/reports/schema";
import {
  placeModerationSchema,
  placeSubmissionSchema,
} from "@/features/submission/schema";
import { visitPayloadSchema } from "@/worker/routes/telemetry";

type ApiAccess = "public" | "user" | "admin";

type ApiOperationDoc = {
  summary: string;
  tag: string;
  access: ApiAccess;
  /** 요청 본문 스키마. zod에서 JSON Schema로 변환한다. */
  body?: z.ZodType;
  /** 본문 스키마로 표현하기 어려운 제약(공개 쓰기 방어 등). */
  notes?: string;
};

const PUBLIC_WRITE_NOTE =
  "공개 쓰기: 본문 256KiB 상한, Turnstile 토큰, visitor/IP rate limit(429)이 적용된다.";

const credentialsLoginSchema = z.object({
  email: z.string(),
  password: z.string(),
  csrfToken: z.string(),
  json: z.string().optional(),
});

/**
 * 라우트 메타데이터. 키는 `METHOD /hono/path`이고, 등록된 라우트(app.routes)는 자동으로 문서에 들어간다.
 * 여기에 없는 라우트는 문서에 `x-undocumented`로 표시되고 tests/unit/openapi.test.ts가 실패한다.
 */
export const apiOperationDocs: Record<string, ApiOperationDoc> = {
  "GET /api/health": { summary: "상태 확인(`?deep=1`이면 DB·정적 자산까지 확인)", tag: "운영", access: "public" },
  "GET /api/config/public": { summary: "클라이언트가 쓰는 공개 설정(지도 키, Turnstile 사이트 키)", tag: "운영", access: "public" },
  "GET /api/openapi.json": { summary: "이 문서(OpenAPI 3.1 JSON)", tag: "운영", access: "public" },
  "GET /api/docs": { summary: "이 문서(HTML 표)", tag: "운영", access: "public" },
  "POST /api/telemetry/visit": {
    summary: "방문 집계(익명, 경로·공유 유입 출처)",
    tag: "운영",
    access: "public",
    body: visitPayloadSchema,
    notes: "집계용이라 실패해도 화면 동작에 영향이 없다.",
  },
  "GET /api/categories": { summary: "업종 목록", tag: "장소", access: "public" },
  "GET /api/places/map": {
    summary: "지도 viewport 장소·마커 조회(넓은 범위는 SQL 격자 클러스터)",
    tag: "장소",
    access: "public",
    notes: "쿼리: minLat·maxLat·minLng·maxLng·zoom·category·query·scope. 익명 viewport 응답은 엣지에서 60초 신선 + 180초 stale-while-revalidate 캐시된다(`X-Altteulmap-Map-Cache`). `Server-Timing: db`로 DB 구간을 알 수 있다.",
  },
  "GET /api/places/:id": {
    summary: "장소 상세(가격·이력·댓글·내 반응을 쿼리 1개로 조회)",
    tag: "장소",
    access: "public",
    notes: "쿠키 없는 익명 응답은 엣지에서 20초 캐시된다(`X-Altteulmap-Detail-Cache`).",
  },
  "POST /api/places": {
    summary: "장소 등록 제안(운영자 승인 전에는 공개되지 않음)",
    tag: "장소",
    access: "public",
    body: placeSubmissionSchema,
    notes: PUBLIC_WRITE_NOTE,
  },
  "POST /api/places/:id/comments": {
    summary: "댓글 작성",
    tag: "장소",
    access: "public",
    body: placeCommentSchema,
    notes: PUBLIC_WRITE_NOTE,
  },
  "DELETE /api/places/:id/comments/:commentId": {
    summary: "댓글 삭제(작성자 또는 운영자)",
    tag: "장소",
    access: "user",
    notes: "회원은 본인 댓글, 익명은 같은 visitor의 댓글만 삭제할 수 있다.",
  },
  "POST /api/places/:id/prices": {
    summary: "가격 제보(pending_review로 저장, 멱등 키로 중복 방지)",
    tag: "장소",
    access: "public",
    body: placePriceReportSchema,
    notes: PUBLIC_WRITE_NOTE,
  },
  "PUT /api/places/:id/reaction": {
    summary: "좋아요·싫어요 반응 설정",
    tag: "장소",
    access: "public",
    body: placeReactionSchema,
  },
  "POST /api/reports": {
    summary: "콘텐츠 신고",
    tag: "신고",
    access: "public",
    body: reportSubmissionSchema,
    notes: PUBLIC_WRITE_NOTE,
  },
  "GET /api/bookmarks": { summary: "내 북마크 목록", tag: "북마크", access: "user" },
  "PUT /api/bookmarks/:id": {
    summary: "북마크 설정·해제",
    tag: "북마크",
    access: "user",
    body: bookmarkToggleSchema,
  },
  "GET /api/auth/csrf": { summary: "CSRF 토큰 발급", tag: "인증", access: "public" },
  "GET /api/auth/providers": { summary: "사용 가능한 로그인 방식", tag: "인증", access: "public" },
  "GET /api/auth/session": { summary: "현재 세션(없으면 빈 객체)", tag: "인증", access: "public" },
  "POST /api/auth/signup": {
    summary: "이메일 가입(성공하면 바로 로그인)",
    tag: "인증",
    access: "public",
    body: credentialsSignupSchema,
    notes: "IP·이메일 단위 rate limit이 적용된다(429).",
  },
  "POST /api/auth/callback/credentials": {
    summary: "이메일·비밀번호 로그인",
    tag: "인증",
    access: "public",
    body: credentialsLoginSchema,
    notes: "JSON 또는 form 본문. CSRF 토큰과 IP·계정 rate limit이 적용된다. 성공하면 `altteulmap.session` 쿠키(HttpOnly, 7일)를 발급한다.",
  },
  "POST /api/auth/signout": { summary: "로그아웃(서버 세션 폐기)", tag: "인증", access: "user" },
  "GET /api/auth/signin/:provider": { summary: "Kakao·Naver 로그인 시작(제공자로 리다이렉트)", tag: "인증", access: "public" },
  "GET /api/auth/callback/:provider": { summary: "Kakao·Naver 로그인 callback(잘못된 요청은 /login?error로 리다이렉트)", tag: "인증", access: "public" },
  "GET /api/admin/stats": { summary: "운영 대시보드 지표", tag: "관리자", access: "admin" },
  "GET /api/admin/places": { summary: "승인 대기 장소 목록(offset 페이지네이션)", tag: "관리자", access: "admin" },
  "GET /api/admin/places/:id": { summary: "승인 대기 장소 상세", tag: "관리자", access: "admin" },
  "PATCH /api/admin/places/:id": {
    summary: "장소 승인·반려",
    tag: "관리자",
    access: "admin",
    body: placeModerationSchema,
  },
  "GET /api/admin/prices": { summary: "가격 제보 검수 큐", tag: "관리자", access: "admin" },
  "GET /api/admin/prices/places/:id": { summary: "장소별 가격 제보", tag: "관리자", access: "admin" },
  "PATCH /api/admin/prices/:id": {
    summary: "가격 제보 승인·반려(advisory lock + 조건부 UPDATE로 직렬화)",
    tag: "관리자",
    access: "admin",
    body: priceReportModerationSchema,
    notes: "이미 처리된 제보는 404/409 계열 오류를 돌려준다.",
  },
  "PATCH /api/admin/price-items/:id": {
    summary: "가격 항목 수정",
    tag: "관리자",
    access: "admin",
    body: adminPriceItemUpdateSchema,
  },
  "GET /api/admin/reports": { summary: "신고 큐", tag: "관리자", access: "admin" },
  "PATCH /api/admin/reports/:id": {
    summary: "신고 처리",
    tag: "관리자",
    access: "admin",
    body: reportModerationSchema,
  },
};

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

type RegisteredRoute = { method: string; path: string };

/** Hono의 `:id` 경로 표기를 OpenAPI의 `{id}`로 바꾼다. */
export function toOpenApiPath(honoPath: string) {
  return honoPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function getPathParameters(honoPath: string) {
  return [...honoPath.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => ({
    name: match[1],
    in: "path" as const,
    required: true,
    schema: { type: "string" },
  }));
}

/** `/api` 아래의 실제 라우트만 골라 중복 없이 정렬한다(미들웨어·와일드카드 제외). */
export function listApiRoutes(routes: readonly RegisteredRoute[]) {
  const seen = new Set<string>();

  return routes
    .filter(
      (route) =>
        route.path.startsWith("/api/") &&
        !route.path.includes("*") &&
        (HTTP_METHODS as readonly string[]).includes(route.method.toUpperCase()),
    )
    .map((route) => ({ method: route.method.toUpperCase(), path: route.path }))
    .filter((route) => {
      const key = `${route.method} ${route.path}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

const errorEnvelopeSchema = {
  type: "object",
  required: ["ok", "message", "error", "requestId"],
  properties: {
    ok: { const: false },
    message: { type: "string" },
    error: {
      type: "object",
      required: ["code"],
      properties: { code: { type: "string" }, details: {} },
    },
    requestId: { type: "string" },
  },
};

function toJsonSchema(schema: z.ZodType) {
  // 입력 형태(preprocess·transform 이전)를 문서화하고, 표현할 수 없는 부분은 빈 스키마로 둔다.
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, {
    io: "input",
    unrepresentable: "any",
  }) as Record<string, unknown>;

  return rest;
}

export function buildOpenApiDocument(routes: readonly RegisteredRoute[]) {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of listApiRoutes(routes)) {
    const doc = apiOperationDocs[`${route.method} ${route.path}`];
    const method = route.method.toLowerCase();
    const parameters = getPathParameters(route.path);
    const operation: Record<string, unknown> = {
      summary: doc?.summary ?? `${route.method} ${route.path}`,
      tags: [doc?.tag ?? "미분류"],
      ...(parameters.length > 0 ? { parameters } : {}),
      ...(doc?.notes ? { description: doc.notes } : {}),
      ...(doc?.body
        ? {
            requestBody: {
              required: true,
              content: { "application/json": { schema: toJsonSchema(doc.body) } },
            },
          }
        : {}),
      responses: {
        "200": { description: "성공" },
        default: {
          description: "실패: 모든 실패 응답은 같은 에러 envelope을 쓴다.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } },
          },
        },
      },
      "x-access": doc?.access ?? "unknown",
      ...(doc ? {} : { "x-undocumented": true }),
    };

    if (doc && doc.access !== "public") {
      operation.security = [{ sessionCookie: [] }];
    }

    paths[toOpenApiPath(route.path)] = {
      ...(paths[toOpenApiPath(route.path)] ?? {}),
      [method]: operation,
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "알뜰맵 API",
      version: "1.0.0",
      description:
        "Cloudflare Worker(Hono) API. 라우트는 서버에 등록된 것을 그대로 읽어 만들고, 요청 본문 스키마는 서버가 검증에 쓰는 zod 스키마에서 생성한다.",
    },
    paths,
    components: {
      schemas: { ErrorEnvelope: errorEnvelopeSchema },
      securitySchemes: {
        sessionCookie: { type: "apiKey", in: "cookie", name: "altteulmap.session" },
      },
    },
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (char) =>
    char === "&" ? "&amp;" : char === "<" ? "&lt;" : char === ">" ? "&gt;" : "&quot;",
  );
}

const ACCESS_LABEL: Record<string, string> = {
  public: "공개",
  user: "로그인",
  admin: "운영자",
  unknown: "-",
};

/** 외부 스크립트·CDN 없이 서버가 그리는 HTML 표(CSP default-src 'self'를 그대로 유지한다). */
function renderApiDocsHtml(document: ReturnType<typeof buildOpenApiDocument>) {
  const rows = Object.entries(document.paths).flatMap(([path, operations]) =>
    Object.entries(operations).map(([method, operation]) => {
      const op = operation as {
        summary: string;
        tags: string[];
        description?: string;
        requestBody?: { content: { "application/json": { schema: { properties?: Record<string, unknown>; required?: string[] } } } };
        "x-access": string;
      };
      const schema = op.requestBody?.content["application/json"].schema;
      const fields = schema?.properties
        ? Object.keys(schema.properties)
            .map((name) => (schema.required?.includes(name) ? `${name}*` : name))
            .join(", ")
        : "";

      return `<tr><td>${escapeHtml(op.tags[0] ?? "")}</td><td class="m">${method.toUpperCase()}</td><td class="p">${escapeHtml(path)}</td><td>${ACCESS_LABEL[op["x-access"]] ?? "-"}</td><td>${escapeHtml(op.summary)}${
        fields ? `<div class="f">본문: ${escapeHtml(fields)}</div>` : ""
      }${op.description ? `<div class="n">${escapeHtml(op.description)}</div>` : ""}</td></tr>`;
    }),
  );

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>알뜰맵 API</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px auto;max-width:1100px;padding:0 16px;color:#1b2430;line-height:1.5}
h1{font-size:24px;margin:0 0 4px}p{margin:4px 0 16px;color:#4a5a6e}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid #d6dde6;padding:8px;text-align:left;vertical-align:top}
th{background:#eef2f7}.m{font-weight:700;white-space:nowrap}.p{font-family:ui-monospace,monospace;word-break:break-all}
.f{color:#1d4ed8;margin-top:4px;font-size:12px}.n{color:#4a5a6e;margin-top:4px;font-size:12px}
</style></head><body>
<h1>알뜰맵 API</h1>
<p>${rows.length}개 엔드포인트. 기계가 읽는 문서는 <a href="/api/openapi.json">/api/openapi.json</a>(OpenAPI 3.1)이다. 모든 실패 응답은 <code>{ ok:false, message, error:{ code, details? }, requestId }</code>다.</p>
<table><thead><tr><th>분류</th><th>메서드</th><th>경로</th><th>접근</th><th>설명</th></tr></thead><tbody>
${rows.join("\n")}
</tbody></table></body></html>`;
}

export function registerApiDocsRoutes<E extends Env>(app: Hono<E>) {
  app.get("/api/openapi.json", (c) =>
    c.body(JSON.stringify(buildOpenApiDocument(app.routes)), 200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    }),
  );
  app.get("/api/docs", (c) =>
    c.body(renderApiDocsHtml(buildOpenApiDocument(app.routes)), 200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    }),
  );
}
