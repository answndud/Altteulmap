export function getOrigin(request: Request, siteUrl?: string) {
  if (siteUrl) {
    try {
      return new URL(siteUrl).origin;
    } catch {
      // Fall through to the request origin.
    }
  }

  return new URL(request.url).origin;
}

export function normalizeCallbackUrl(
  value: string | null | undefined,
  origin?: string,
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    if (!origin) {
      return "/";
    }

    try {
      const url = new URL(value ?? "", origin);

      if (url.origin !== origin) {
        return "/";
      }

      return normalizeCallbackUrl(`${url.pathname}${url.search}${url.hash}`);
    } catch {
      return "/";
    }
  }

  const pathname = value.split(/[?#]/, 1)[0];

  if (pathname === "/login" || pathname === "/signup") {
    return "/";
  }

  return value;
}
