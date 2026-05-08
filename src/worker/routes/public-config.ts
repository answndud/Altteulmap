import type { Hono } from "hono";

import {
  categoryGroups,
  categoryOptions,
} from "@/features/categories/catalog";
import {
  getPublicNaverMapKeyId,
  getPublicTurnstileSiteKey,
} from "@/worker/http/public-config";

type PublicConfigBindings = {
  ASSETS: {
    fetch(request: Request): Promise<Response> | Response;
  };
  NAVER_MAP_CLIENT_ID?: string;
  NEXT_PUBLIC_NAVER_MAP_CLIENT_ID?: string;
  NEXT_PUBLIC_NAVER_MAP_KEY_ID?: string;
  NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
};

type PublicConfigRouteDependencies = {
  noStoreHeaders: Record<string, string>;
};

export function registerPublicConfigRoutes(
  app: Hono<{ Bindings: PublicConfigBindings; Variables: { requestId: string } }>,
  dependencies: PublicConfigRouteDependencies,
) {
  app.get("/api/categories", (c) =>
    c.json({
      groups: categoryGroups,
      categories: categoryOptions,
    }),
  );

  app.get("/api/config/public", (c) =>
    c.json(
      {
        naverMapKeyId: getPublicNaverMapKeyId(c.env),
        turnstileSiteKey: getPublicTurnstileSiteKey(c.env),
      },
      200,
      dependencies.noStoreHeaders,
    ),
  );
}
