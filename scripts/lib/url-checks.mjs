export function isTruthy(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeComparableUrl(value) {
  const url = new URL(value);
  const normalizedPath =
    url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "");

  return `${url.origin}${normalizedPath}${url.search}`;
}

export function isLocalhostUrl(value) {
  try {
    const url = new URL(value);

    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

export function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function assertHttpsUrl(value, label) {
  if (!value) {
    throw new Error(`${label} is missing`);
  }

  const url = new URL(value);

  if (url.protocol !== "https:") {
    throw new Error(`${label} must use https`);
  }

  return url.origin;
}
