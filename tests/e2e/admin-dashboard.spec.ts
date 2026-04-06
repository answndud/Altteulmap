import "dotenv/config";

import { expect, test } from "@playwright/test";

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  loginWithCredentials,
} from "./helpers/auth";

test("운영자 로그인 시 지도와 관리자 대시보드에서 관리/로그아웃 액션을 사용할 수 있다", async ({
  page,
}) => {
  const shareVisitResponse = await page.request.post("/api/telemetry/visit", {
    data: {
      path: "/place/test-shared-entry",
      ref: "share",
      scope: "public",
      source: "trending",
    },
  });

  expect(shareVisitResponse.ok()).toBeTruthy();

  await loginWithCredentials(page, {
    callbackUrl: "/",
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("session-user-badge")).toBeVisible();
  await expect(page.getByTestId("session-admin-link")).toBeVisible();
  await expect(page.getByTestId("sign-out-button")).toBeVisible();

  await page.getByTestId("session-admin-link").click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId("admin-metric-total-users")).toBeVisible();
  await expect(page.getByTestId("admin-metric-current-sessions")).toBeVisible();
  await expect(page.getByTestId("admin-metric-today-visits")).toBeVisible();
  await expect(page.getByTestId("admin-metric-shared-visits")).toBeVisible();
  await expect(page.getByTestId("admin-metric-weekly-visits")).toBeVisible();
  await expect(page.getByTestId("admin-metric-dau-wau")).toBeVisible();
  await expect(page.getByTestId("admin-metric-returning-rate")).toBeVisible();
  await expect(page.getByTestId("admin-metric-shared-visits")).toContainText("1");
  await expect(page.getByTestId("admin-share-source-breakdown")).toContainText(
    "인기 장소",
  );
  await expect(page.getByTestId("admin-recent-user-list")).toBeVisible();
  await expect(page.getByTestId("admin-overview-places-link")).toBeVisible();
  await expect(page.getByTestId("admin-overview-reports-link")).toBeVisible();

  await page.getByTestId("sign-out-button").click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("session-login-link")).toBeVisible();
});
