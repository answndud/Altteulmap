import "server-only";

const DEFAULT_SITE_URL = "http://localhost:3000";

export function getSiteOrigin() {
  const candidate =
    process.env.SITE_URL ?? process.env.NEXTAUTH_URL ?? DEFAULT_SITE_URL;

  try {
    return new URL(candidate).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function createSiteUrl(pathname = "/") {
  return new URL(pathname, getSiteOrigin());
}
