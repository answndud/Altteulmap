import { getSessionFromRequest } from "@/worker/auth/session";

type AssetFetcher = {
  fetch(request: Request): Promise<Response> | Response;
};

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
  databaseUnavailableResponse(message: string): Response;
  noStoreHeaders: Record<string, string>;
  runWorkerDatabaseRoute<T>(env: AdminBindings, load: () => Promise<T>): Promise<T>;
};

export function requireAdminSession(
  request: Request,
  env: AdminBindings,
  noStoreHeaders: Record<string, string>,
) {
  const session = getSessionFromRequest(request, env);

  if (!session) {
    return {
      response: Response.json(
        {
          ok: false,
          message: "로그인이 필요합니다.",
        },
        { status: 401, headers: noStoreHeaders },
      ),
    };
  }

  if (session.user.role !== "admin") {
    return {
      response: Response.json(
        {
          ok: false,
          message: "운영자 권한이 필요합니다.",
        },
        { status: 403, headers: noStoreHeaders },
      ),
    };
  }

  return {
    user: session.user,
  };
}
