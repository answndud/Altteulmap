import type { Hono } from "hono";

import { getFilteredPlaces } from "@/features/places/queries";
import { applySecurityHeaders } from "@/worker/http/security-headers";

type AssetFetcher = {
  fetch(request: Request): Promise<Response> | Response;
};

type StaticBindings = {
  ASSETS: AssetFetcher;
  SITE_URL?: string;
};

type StaticRouteDependencies = {
  getOrigin(request: Request, siteUrl?: string): string;
};

function textResponse(body: string, contentType: string) {
  return new Response(body, {
    headers: {
      "content-type": contentType,
    },
  });
}

export function registerStaticRoutes(
  app: Hono<{ Bindings: StaticBindings; Variables: { requestId: string } }>,
  dependencies: StaticRouteDependencies,
) {
  app.get("/robots.txt", (c) => {
    const origin = dependencies.getOrigin(c.req.raw, c.env.SITE_URL);

    return textResponse(
      [
        "User-agent: *",
        "Allow: /",
        `Sitemap: ${origin}/sitemap.xml`,
        "",
      ].join("\n"),
      "text/plain; charset=utf-8",
    );
  });

  app.get("/manifest.webmanifest", () =>
    new Response(
      JSON.stringify({
        name: "알뜰맵",
        short_name: "알뜰맵",
        description: "가격이 보이는 동네 지도",
        start_url: "/",
        display: "standalone",
        background_color: "#f4f1ec",
        theme_color: "#b55a2b",
        lang: "ko",
      }),
      {
        headers: {
          "content-type": "application/manifest+json; charset=utf-8",
        },
      },
    ),
  );

  app.get("/sitemap.xml", (c) => {
    const origin = dependencies.getOrigin(c.req.raw, c.env.SITE_URL);
    const now = new Date().toISOString();
    const staticPaths = ["/", "/submit", "/report", "/login", "/signup"];
    const placePaths = getFilteredPlaces()
      .slice(0, 120)
      .map((place) => `/place/${place.id}`);
    const paths = [...staticPaths, ...placePaths];
    const urls = paths
      .map(
        (path) => `
  <url>
    <loc>${origin}${path}</loc>
    <lastmod>${now}</lastmod>
  </url>`,
      )
      .join("");

    return textResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>
`,
      "application/xml; charset=utf-8",
    );
  });

  app.all("/api/*", (c) =>
    c.json(
      {
        error: "Vite Worker API migration placeholder",
        path: c.req.path,
      },
      501,
    ),
  );

  app.notFound(async (c) =>
    applySecurityHeaders(await c.env.ASSETS.fetch(c.req.raw), c.req.raw),
  );
}
