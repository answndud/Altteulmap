import "dotenv/config";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  loginWithCredentials,
} from "./helpers/auth";
import type {
  PlaceBounds,
  PlaceMapMarkerRecord,
  PlacePreviewRecord,
  PlaceSearchScope,
} from "../../src/features/places/types";

const PERFORMANCE_BUDGET_MS = {
  "map.initial_place_list_visible": 1_500,
  "map.refresh_to_place_list_visible": 1_000,
  "map.cluster_click_to_detail_or_marker_visible": 1_500,
  "admin.price_queue_visible": 1_500,
} satisfies Record<string, number>;

type PerformanceMeasurementName = keyof typeof PERFORMANCE_BUDGET_MS;

type PerformanceMeasurement = {
  name: PerformanceMeasurementName;
  durationMs: number;
  note?: string;
};

type MapPlacesResponse = {
  bounds: PlaceBounds | null;
  count: number;
  filters: {
    bounds: PlaceBounds | null;
    category: string | null;
    query: string | null;
    searchScope: PlaceSearchScope;
  };
  items: PlacePreviewRecord[];
  mapMarkers: PlaceMapMarkerRecord[];
  markerMode: "place" | "cluster";
  mapMarkerCount: number;
  returnedCount: number;
  source: "database" | "mock";
  mock: boolean;
};

const SEOUL_CLUSTER_QUERY =
  "/api/places/map?scope=viewport&zoom=9&minLat=37.4133&maxLat=37.7151&minLng=126.7341&maxLng=127.2693";

function roundMs(value: number) {
  return Math.round(value);
}

async function measure(
  name: PerformanceMeasurementName,
  action: () => Promise<void>,
  note?: string,
): Promise<PerformanceMeasurement> {
  const started = performance.now();

  await action();

  return {
    name,
    durationMs: roundMs(performance.now() - started),
    ...(note ? { note } : {}),
  };
}

async function loadClusterFixture(request: APIRequestContext) {
  const response = await request.get(SEOUL_CLUSTER_QUERY);

  expect(response.ok()).toBeTruthy();

  const payload = (await response.json()) as MapPlacesResponse;

  expect(payload.markerMode).toBe("cluster");
  expect(payload.mapMarkers.some((marker) => marker.kind === "cluster")).toBe(true);

  return payload;
}

async function installClusterFixtureRoute(
  page: Page,
  payload: MapPlacesResponse,
) {
  let shouldServeClusterFixture = false;

  await page.route("**/api/places/map?**", async (route) => {
    if (!shouldServeClusterFixture) {
      await route.continue();
      return;
    }

    shouldServeClusterFixture = false;
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      headers: {
        "x-altteulmap-map-cache": "perf-fixture",
      },
      body: JSON.stringify(payload),
    });
  });

  return () => {
    shouldServeClusterFixture = true;
  };
}

async function clickFirstViewportCluster(page: Page) {
  const clusterMarkers = page.locator('[data-marker-kind="cluster"]');
  const markerCount = await clusterMarkers.count();
  const viewportSize = page.viewportSize();

  expect(markerCount, "cluster fixture should render at least one marker").toBeGreaterThan(0);
  expect(viewportSize, "viewport size is required for cluster click selection").toBeTruthy();

  for (let index = 0; index < markerCount; index += 1) {
    const marker = clusterMarkers.nth(index);
    const box = await marker.boundingBox();

    if (!box || !viewportSize) {
      continue;
    }

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const isInViewport =
      centerX >= 0 &&
      centerY >= 0 &&
      centerX <= viewportSize.width &&
      centerY <= viewportSize.height;

    if (!isInViewport) {
      continue;
    }

    await page.mouse.click(centerX, centerY);
    return;
  }

  throw new Error("No cluster marker was clickable inside the viewport.");
}

test("client interaction performance baseline", async ({ page }) => {
  test.setTimeout(45_000);

  const measurements: PerformanceMeasurement[] = [];
  const clusterPayload = await loadClusterFixture(page.request);
  const serveClusterFixtureOnce = await installClusterFixtureRoute(
    page,
    clusterPayload,
  );

  measurements.push(
    await measure("map.initial_place_list_visible", async () => {
      await page.goto("/");
      await expect(page.getByTestId("map-panel-shell")).toBeVisible();
      await expect(
        page
          .getByTestId("place-list")
          .locator('[data-testid^="place-list-item-"]')
          .first(),
      ).toBeVisible();
    }),
  );

  measurements.push(
    await measure("map.refresh_to_place_list_visible", async () => {
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes("/api/places/map?"),
      );

      await page.getByTestId("map-refresh-button").click();
      await responsePromise;
      await expect(
        page
          .getByTestId("place-list")
          .locator('[data-testid^="place-list-item-"]')
          .first(),
      ).toBeVisible();
    }),
  );

  measurements.push(
    await measure("map.cluster_click_to_detail_or_marker_visible", async () => {
      serveClusterFixtureOnce();
      await page.getByTestId("map-refresh-button").click();

      await expect(page.locator('[data-marker-kind="cluster"]').first()).toBeVisible();
      await clickFirstViewportCluster(page);
      await expect(
        page.locator('[data-testid^="map-preview-marker-"]').first(),
      ).toBeVisible();
    }),
  );

  measurements.push(
    await measure("admin.price_queue_visible", async () => {
      await loginWithCredentials(page, {
        callbackUrl: "/admin/prices",
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      });
      await expect(page.getByTestId("admin-price-report-list")).toBeVisible();
    }),
  );

  for (const measurement of measurements) {
    if (measurement.note) {
      continue;
    }

    const budgetMs = PERFORMANCE_BUDGET_MS[measurement.name];

    expect(
      measurement.durationMs,
      `${measurement.name} exceeded ${budgetMs}ms budget`,
    ).toBeLessThanOrEqual(budgetMs);
  }

  console.info(
    `[client-performance] ${JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        budgetsMs: PERFORMANCE_BUDGET_MS,
        baseURL: page.url().replace(/\/admin\/prices.*/, ""),
        measurements,
      },
      null,
      2,
    )}`,
  );
});
