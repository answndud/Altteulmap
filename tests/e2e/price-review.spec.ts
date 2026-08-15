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

test("가격 제보를 보내면 운영자가 가격 검토 큐에서 반려할 수 있다", async ({
  browser,
}) => {
  test.setTimeout(60_000);

  const uniqueSuffix = Date.now().toString();
  const uniqueLabel = `E2E라볶이${uniqueSuffix.slice(-4)}`;
  const uniqueComment = `E2E 가격 ${uniqueSuffix}`;
  let userContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;
  let adminContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;

  try {
    userContext = await browser.newContext();
    const userPage = await userContext.newPage();
    const place = await pickSearchablePlace(userPage);

    await userPage.goto(`/place/${place.id}`);

    if (/\/login\?/.test(userPage.url())) {
      await loginWithCredentials(userPage, {
        callbackUrl: `/place/${place.id}`,
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
    }

    if ((await userPage.getByTestId("price-report-submit").count()) === 0) {
      await loginWithCredentials(userPage, {
        callbackUrl: `/place/${place.id}`,
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
    }

    await expect(userPage).toHaveURL(new RegExp(`/place/${place.id}$`));
    await expect(userPage.getByTestId("place-price-report-form")).toBeVisible();
    await userPage.getByTestId("price-report-label").fill(uniqueLabel);
    await userPage.getByTestId("price-report-amount").fill("6100");
    await userPage.getByTestId("price-report-unit").fill("1인분");
    await userPage.getByTestId("price-report-comment").fill(uniqueComment);
    await userPage.getByTestId("price-report-submit").click();

    await expect(userPage.getByTestId("price-report-message")).toContainText(
      /가격 정보가 등록되었습니다\./,
    );

    adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    await loginWithCredentials(adminPage, {
      callbackUrl: "/admin/prices",
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    await expect(adminPage).toHaveURL(/\/admin\/prices$/);
    await expect(adminPage.getByTestId("admin-price-report-list")).toBeVisible();

    const priceCard = adminPage
      .getByTestId("admin-price-report-card")
      .filter({ hasText: uniqueComment })
      .first();

    await expect(priceCard).toBeVisible();
    await expect(priceCard.getByTestId("admin-ai-review-panel")).toBeVisible();
    await expect(priceCard.getByTestId("admin-ai-review-panel")).toContainText(
      "AI 1차 검수",
    );
    await priceCard.getByTestId("admin-price-reject-button").click();
    await expect(
      adminPage.getByTestId("admin-price-report-card").filter({ hasText: uniqueComment }),
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
