import type { AdminSession } from "@/client/routes/admin/types";

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = (await response.json().catch(() => null)) as T & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(data?.message || "요청을 처리하지 못했습니다.");
  }

  return data;
}

export async function loadAdminSession() {
  const session = await fetchJson<AdminSession>("/api/auth/session", {
    cache: "no-store",
  });

  return session.user ?? null;
}
