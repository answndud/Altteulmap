import "server-only";

import { serverEnv } from "@/lib/env";

function normalizeBaseUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  return value.endsWith("/") ? value : `${value}/`;
}

export function getAdminAppBaseUrl() {
  return normalizeBaseUrl(serverEnv.ADMIN_APP_URL);
}

export function hasExternalAdminApp() {
  return Boolean(getAdminAppBaseUrl());
}

export function getAdminAppHref(pathname = "/admin") {
  const baseUrl = getAdminAppBaseUrl();

  if (!baseUrl) {
    return pathname;
  }

  return new URL(pathname.replace(/^\//, ""), baseUrl).toString();
}

export function createExternalAdminApiResponse(pathname: string) {
  const adminUrl = hasExternalAdminApp() ? getAdminAppHref(pathname) : null;

  return Response.json(
    {
      ok: false,
      message: adminUrl
        ? "관리자 기능은 별도 관리자 앱으로 이동했습니다."
        : "관리자 앱 주소가 아직 설정되지 않았습니다.",
      adminUrl,
    },
    { status: 503 },
  );
}
