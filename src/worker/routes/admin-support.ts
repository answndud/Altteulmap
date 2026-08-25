import { getWorkerAuthUserById } from "@/worker/auth-repository";
import { getSessionFromRequest } from "@/worker/auth/session";
import { isWorkerDatabaseEnabled } from "@/worker/db";

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

export function getAdminQueuePagination(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "50");

  return {
    page: Number.isFinite(page) ? page : 1,
    limit: Number.isFinite(limit) ? limit : 50,
  };
}

export async function requireAdminSession(
  request: Request,
  env: AdminBindings,
  noStoreHeaders: Record<string, string>,
  dependencies: Pick<AdminRouteDependencies, "databaseUnavailableResponse" | "runWorkerDatabaseRoute">,
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

  if (isWorkerDatabaseEnabled(env)) {
    try {
      const currentUser = await dependencies.runWorkerDatabaseRoute(env, () =>
        getWorkerAuthUserById(env, session.user.id),
      );

      if (!currentUser || currentUser.role !== "admin") {
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
        user: {
          ...session.user,
          email: currentUser.email,
          name: currentUser.nickname ?? currentUser.email.split("@")[0] ?? currentUser.email,
          role: currentUser.role,
        },
      };
    } catch {
      return {
        response: dependencies.databaseUnavailableResponse(
          "권한을 확인하지 못했습니다.",
        ),
      };
    }
  }

  return {
    user: session.user,
  };
}
