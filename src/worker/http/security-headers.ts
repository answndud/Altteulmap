const baseSecurityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": [
    "camera=()",
    "microphone=()",
    "payment=()",
    "usb=()",
    "geolocation=(self)",
  ].join(", "),
};

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' https://oapi.map.naver.com https://openapi.map.naver.com https://*.pstatic.net https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  [
    "connect-src 'self'",
    "https://oapi.map.naver.com",
    "https://openapi.map.naver.com",
    "https://naveropenapi.apigw.ntruss.com",
    "https://*.naver.com",
    "https://*.pstatic.net",
    "https://basemaps.cartocdn.com",
    "https://challenges.cloudflare.com",
  ].join(" "),
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

export function applySecurityHeaders(response: Response, request: Request) {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(baseSecurityHeaders)) {
    headers.set(name, value);
  }

  headers.set("Content-Security-Policy", contentSecurityPolicy);

  if (new URL(request.url).protocol === "https:") {
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
