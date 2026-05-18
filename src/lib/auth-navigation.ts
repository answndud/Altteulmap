export function normalizeCallbackUrl(
  value: string | null | undefined,
  fallback = "/",
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  const [pathAndQuery, hashFragment] = value.split("#", 2);
  const queryIndex = pathAndQuery.indexOf("?");
  const pathname =
    queryIndex >= 0 ? pathAndQuery.slice(0, queryIndex) : pathAndQuery;

  if (pathname === "/login" || pathname === "/signup") {
    return fallback;
  }

  const rawQuery = queryIndex >= 0 ? pathAndQuery.slice(queryIndex + 1) : "";
  const encodedQuery = rawQuery ? new URLSearchParams(rawQuery).toString() : "";
  const normalizedPath = encodedQuery ? `${pathname}?${encodedQuery}` : pathname;

  if (!hashFragment) {
    return normalizedPath;
  }

  return `${normalizedPath}#${encodeURIComponent(hashFragment)}`;
}

function createAuthEntryHref(pathname: "/login" | "/signup", callbackUrl: string) {
  const safeCallbackUrl = normalizeCallbackUrl(callbackUrl);
  const params = new URLSearchParams({
    callbackUrl: safeCallbackUrl,
  });

  return `${pathname}?${params.toString()}`;
}

export function createLoginHref(callbackUrl: string) {
  return createAuthEntryHref("/login", callbackUrl);
}

export function createCurrentLoginHref() {
  const callbackUrl =
    typeof window === "undefined"
      ? "/"
      : `${window.location.pathname}${window.location.search}`;

  return createLoginHref(callbackUrl);
}

export function createSignupHref(callbackUrl: string) {
  return createAuthEntryHref("/signup", callbackUrl);
}
