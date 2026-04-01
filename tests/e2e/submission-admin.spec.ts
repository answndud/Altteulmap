import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  loginWithCredentials,
} from "./helpers/auth";

async function setHiddenCoordinate(
  page: Page,
  testId: "submit-latitude" | "submit-longitude",
  value: string,
) {
  await page.getByTestId(testId).evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

test("장소 등록 폼에서 주소가 바뀌면 좌표를 다시 확인해야 한다", async ({
  page,
}) => {
  await page.goto("/submit");
  await expect(page.getByTestId("place-submit-form")).toBeVisible();

  await page.getByTestId("submit-district").fill("서울 성북구");
  await page
    .getByTestId("submit-road-address")
    .fill("서울 성북구 동소문로22길 31");
  await setHiddenCoordinate(page, "submit-latitude", "37.590100");
  await setHiddenCoordinate(page, "submit-longitude", "127.015800");

  await page
    .getByTestId("submit-road-address")
    .fill("서울 성북구 보문로 12");

  await expect(page.getByTestId("submit-latitude")).toHaveValue("");
  await expect(page.getByTestId("submit-longitude")).toHaveValue("");
});

test("장소를 등록하고 운영자가 승인하면 홈 검색에 노출된다", async ({
  browser,
}) => {
  test.setTimeout(60_000);

  const uniqueSuffix = Date.now().toString();
  const uniqueName = `E2E분식${uniqueSuffix}`;
  const roadAddress = `서울 성북구 보문로 ${uniqueSuffix.slice(-3)}`;
  const district = "서울 성북구";
  const latitude = "37.590100";
  const longitude = "127.015800";

  let userContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;
  let adminContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;

  try {
    userContext = await browser.newContext();
    const userPage = await userContext.newPage();

    await userPage.goto("/submit");

    if (/\/login\?/.test(userPage.url())) {
      await loginWithCredentials(userPage, {
        callbackUrl: "/submit",
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
    }

    await expect(userPage).toHaveURL(/\/submit$/);
    await expect(userPage.getByTestId("place-submit-form")).toBeVisible();

    await userPage.getByTestId("submit-name").fill(uniqueName);
    if ((await userPage.getByTestId("submit-business-name").count()) > 0) {
      await userPage
        .getByTestId("submit-business-name")
        .fill(`${uniqueName} 성북점`);
    }
    await userPage.getByTestId("submit-category").selectOption("bunsik");
    await userPage.getByTestId("submit-district").fill(district);
    await userPage.getByTestId("submit-road-address").fill(roadAddress);
    await userPage.getByTestId("submit-price-label-0").fill("라볶이");
    await userPage.getByTestId("submit-price-amount-0").fill("4800");
    await userPage.getByTestId("submit-price-unit-0").fill("1인분");
    await userPage
      .getByTestId("submit-note")
      .fill("E2E 승인 검증용 제출 데이터입니다.");
    await setHiddenCoordinate(userPage, "submit-latitude", latitude);
    await setHiddenCoordinate(userPage, "submit-longitude", longitude);
    await userPage.getByTestId("submit-place-button").click();

    await expect(userPage.getByTestId("submit-result")).toBeVisible();
    await expect(userPage.getByTestId("submit-result-message")).toContainText(
      /(?:제보|장소 등록 요청).*접수되었습니다\./,
    );
    await expect(userPage.getByTestId("submit-result-name")).toHaveText(
      uniqueName,
    );

    adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    await loginWithCredentials(adminPage, {
      callbackUrl: "/admin/places",
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    await expect(adminPage).toHaveURL(/\/admin\/places$/);
    await expect(adminPage.getByTestId("admin-pending-place-list")).toBeVisible();

    const pendingCard = adminPage
      .getByTestId("admin-place-card")
      .filter({ hasText: uniqueName })
      .first();

    await expect(pendingCard).toBeVisible();
    await pendingCard.getByTestId("admin-latitude").fill(latitude);
    await pendingCard.getByTestId("admin-longitude").fill(longitude);
    await pendingCard.getByTestId("admin-approve-button").click();

    await expect(
      adminPage.getByTestId("admin-place-card").filter({ hasText: uniqueName }),
    ).toHaveCount(0);

    await adminPage.goto("/");
    await adminPage.getByTestId("search-scope-global").check({ force: true });
    await adminPage.getByTestId("place-search-input").fill(uniqueName);
    await adminPage.getByTestId("place-search-submit").click();

    const approvedListItem = adminPage
      .locator("[data-testid^='place-list-item-']")
      .filter({ hasText: uniqueName })
      .first();

    await expect(approvedListItem).toBeVisible();
    await approvedListItem.dispatchEvent("click");

    const detailSheet = adminPage.getByTestId("place-detail-sheet");
    await expect(detailSheet).toBeVisible();
    await expect(detailSheet.getByRole("heading", { name: uniqueName })).toBeVisible();
  } finally {
    if (userContext) {
      await userContext.close();
    }

    if (adminContext) {
      await adminContext.close();
    }
  }
});
