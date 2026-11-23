const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

type CrossSiteRejection = {
  status: 403 | 415;
  code: "CROSS_SITE_REQUEST" | "UNSUPPORTED_MEDIA_TYPE";
  message: string;
};

/**
 * 쿠키 인증 API의 CSRF 방어선. SameSite=Lax에만 기대지 않고 아래를 함께 검사한다.
 * - Sec-Fetch-Site 또는 Origin이 있으면 same-origin이어야 한다. 브라우저는 교차 출처
 *   변경 요청에 둘 중 하나를 항상 붙이므로, 둘 다 없는 요청은 curl·서버 간 호출로 본다.
 * - 본문이 있는 요청은 JSON이어야 한다. text/plain 같은 "단순 요청"으로 preflight를
 *   우회하는 교차 사이트 폼 전송을 막는다. 인증 폼(/api/auth/)만 urlencoded를 허용한다.
 */
export function rejectCrossSiteMutation(
  request: Request,
): CrossSiteRejection | null {
  if (!MUTATING_METHODS.has(request.method)) {
    return null;
  }

  const url = new URL(request.url);
  const fetchSite = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");

  if (fetchSite) {
    if (fetchSite !== "same-origin" && fetchSite !== "none") {
      return crossSite();
    }
  } else if (origin && origin !== url.origin) {
    return crossSite();
  }

  if (BODY_METHODS.has(request.method)) {
    const contentType = request.headers.get("content-type")?.toLowerCase();

    if (contentType) {
      const isJson = contentType.startsWith("application/json");
      const isAuthForm =
        url.pathname.startsWith("/api/auth/") &&
        contentType.startsWith("application/x-www-form-urlencoded");

      if (!isJson && !isAuthForm) {
        return {
          status: 415,
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "JSON 요청만 지원합니다.",
        };
      }
    }
  }

  return null;
}

function crossSite(): CrossSiteRejection {
  return {
    status: 403,
    code: "CROSS_SITE_REQUEST",
    message: "허용되지 않은 출처의 요청입니다.",
  };
}
