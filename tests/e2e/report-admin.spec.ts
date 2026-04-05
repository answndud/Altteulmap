import "dotenv/config";

import { expect, test } from "@playwright/test";

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  loginWithCredentials,
} from "./helpers/auth";
import { pickSearchablePlace } from "./helpers/place";

test("신고를 제출하면 운영자 신고 큐에서 처리 완료로 바꿀 수 있다", async ({
  browser,
}) => {
  test.setTimeout(60_000);

  const uniqueDetail = `E2E 신고 ${Date.now()}`;
  let userContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;
  let adminContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;

  try {
    userContext = await browser.newContext();
    const userPage = await userContext.newPage();
    const place = await pickSearchablePlace(userPage);
    const reportPath = `/report?placeId=${place.id}&placeName=${encodeURIComponent(place.name)}`;

    await userPage.goto(reportPath);

    if (/\/login\?/.test(userPage.url())) {
      await loginWithCredentials(userPage, {
        callbackUrl: reportPath,
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
    }

    await expect(userPage).toHaveURL(/\/report\?/);
    await expect(userPage.getByTestId("report-submit-form")).toBeVisible();
    await userPage.getByTestId("report-reason").selectOption("closed_or_wrong_info");
    await userPage.getByTestId("report-detail").fill(uniqueDetail);
    await userPage.getByTestId("report-submit-button").click();

    await expect(userPage.getByTestId("report-result")).toBeVisible();
    await expect(userPage.getByTestId("report-result-message")).toContainText(
      /신고.*접수되었습니다\./,
    );
    await expect(userPage.getByTestId("report-result-detail")).toHaveText(
      uniqueDetail,
    );

    adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    await loginWithCredentials(adminPage, {
      callbackUrl: "/admin/reports",
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    await expect(adminPage).toHaveURL(/\/admin\/reports$/);
    await expect(adminPage.getByTestId("admin-report-list")).toBeVisible();

    const reportCard = adminPage
      .getByTestId("admin-report-card")
      .filter({ hasText: uniqueDetail })
      .first();

    await expect(reportCard).toBeVisible();
    await reportCard.getByTestId("admin-report-status-resolved").click();
    await expect(reportCard.getByTestId("admin-report-status-badge")).toHaveText(
      "처리 완료",
    );

    await adminPage.goto("/admin/reports?status=resolved");
    await expect(
      adminPage.getByTestId("admin-report-filter-resolved"),
    ).toHaveAttribute("data-active", "true");
    await expect(
      adminPage.getByTestId("admin-report-card").filter({ hasText: uniqueDetail }),
    ).toHaveCount(1);

    await adminPage.goto("/admin/reports?status=open");
    await expect(
      adminPage.getByTestId("admin-report-filter-open"),
    ).toHaveAttribute("data-active", "true");
    await expect(
      adminPage.getByTestId("admin-report-card").filter({ hasText: uniqueDetail }),
    ).toHaveCount(0);
  } finally {
    if (userContext) {
      await userContext.close();
    }

    if (adminContext) {
      await adminContext.close();
    }
  }
});
