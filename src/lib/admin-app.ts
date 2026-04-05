import "server-only";

import { serverEnv } from "@/lib/env";
import { getSiteOrigin } from "@/lib/site";

function normalizeBaseUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  return value.endsWith("/") ? value : `${value}/`;
}

export function getAdminAppBaseUrl() {
  const baseUrl = normalizeBaseUrl(serverEnv.ADMIN_APP_URL);

  if (!baseUrl) {
    return null;
  }

  try {
    const siteOrigin = serverEnv.NEXTAUTH_URL ?? getSiteOrigin();
    const siteUrl = new URL(siteOrigin);
    const isLocalSite =
      siteUrl.hostname === "localhost" ||
      siteUrl.hostname === "127.0.0.1" ||
      siteUrl.hostname === "::1";

    if (isLocalSite) {
      return null;
    }
  } catch {
    return null;
  }

  return baseUrl;
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
    { status: 200 },
  );
}
