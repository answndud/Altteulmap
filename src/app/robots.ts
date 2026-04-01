import type { MetadataRoute } from "next";

import { createSiteUrl, getSiteOrigin } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/map", "/place/"],
        disallow: [
          "/admin/",
          "/api/",
          "/bookmarks",
          "/login",
          "/report",
          "/submit",
        ],
      },
    ],
    sitemap: createSiteUrl("/sitemap.xml").toString(),
    host: getSiteOrigin(),
  };
}
