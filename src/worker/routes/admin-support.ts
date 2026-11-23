import type { AssetFetcher } from "@/worker/http/bindings";
import { getSessionFromRequest } from "@/worker/auth/session";
import { DomainError } from "@/worker/http/api-error";

export type AdminBindings = {
  ASSETS: AssetFetcher;
  AUTH_SECRET?: string;
  DATABASE_URL?: string;
  HYPERDRIVE?: {
    connectionString?: string;
  };
  USE_MOCK_DATA?: string;
};

export type AdminVariables = {
  requestId: string;
};

export type AdminRouteDependencies = {
  noStoreHeaders: Record<string, string>;
};

const ADMIN_QUEUE_MAX_PAGE_NUMBER = 1_000;

export function getAdminQueuePagination(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "50");

  return {
    page: Number.isFinite(page)
      ? Math.min(ADMIN_QUEUE_MAX_PAGE_NUMBER, Math.max(1, Math.floor(page)))
      : 1,
    limit: Number.isFinite(limit) ? limit : 50,
  };
}

/**
 * 관리자 API 진입 검사. 세션은 요청마다 DB의 users에서 role을 읽으므로(auth/session.ts)
 * 강등은 즉시 반영된다. 실패는 DomainError로 던져 표준 에러 envelope가 된다.
 */
export async function requireAdminSession(request: Request, env: AdminBindings) {
  const session = await getSessionFromRequest(request, env);

  if (!session) {
    throw new DomainError("UNAUTHENTICATED", "로그인이 필요합니다.");
  }

  if (session.user.role !== "admin") {
    throw new DomainError("FORBIDDEN", "운영자 권한이 필요합니다.");
  }

  return session.user;
}
