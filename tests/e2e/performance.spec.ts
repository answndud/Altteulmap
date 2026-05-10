import "dotenv/config";

import { expect, test } from "@playwright/test";

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  loginWithCredentials,
} from "./helpers/auth";

type PerformanceMeasurement = {
  name: string;
  durationMs: number;
  note?: string;
};

function roundMs(value: number) {
  return Math.round(value);
}

async function measure(
  name: string,
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

test("client interaction performance baseline", async ({ page }) => {
  test.setTimeout(45_000);

  const measurements: PerformanceMeasurement[] = [];

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

  const clusterMarker = page
    .locator('[data-testid^="map-preview-marker-cluster-"]')
    .first();
  const clusterCount = await clusterMarker.count();

  if (clusterCount > 0) {
    measurements.push(
      await measure("map.cluster_click_to_detail_or_marker_visible", async () => {
        await clusterMarker.click({ force: true });
        await expect(page.locator('[data-testid^="map-preview-marker-"]').first()).toBeVisible();
      }),
    );
  } else {
    measurements.push({
      name: "map.cluster_click_to_detail_or_marker_visible",
      durationMs: 0,
      note: "skipped: no cluster marker in current fixture viewport",
    });
  }

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

  console.log(
    `[client-performance] ${JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        baseURL: page.url().replace(/\/admin\/prices.*/, ""),
        measurements,
      },
      null,
      2,
    )}`,
  );
});
