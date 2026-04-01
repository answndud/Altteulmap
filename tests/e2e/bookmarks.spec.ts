import "dotenv/config";

import { expect, test } from "@playwright/test";

import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  loginWithCredentials,
} from "./helpers/auth";

test("로그인 사용자가 지도 목록에서 북마크를 저장하고 북마크 페이지에서 해제할 수 있다", async ({
  page,
}) => {
  await loginWithCredentials(page, {
    callbackUrl: "/",
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });

  await expect(page).toHaveURL(/\/$/);
  await page.getByTestId("search-scope-global").check({ force: true });
  await page.getByTestId("place-search-input").fill("든든백반");
  await page.getByTestId("place-search-submit").click();

  const listItem = page.getByTestId("place-list-item-budget-baekban");
  await expect(listItem).toBeVisible();

  const toggle = listItem.getByTestId("bookmark-toggle-budget-baekban");
  const currentLabel = (await toggle.textContent())?.trim();

  if (currentLabel === "북마크됨") {
    await toggle.click();
    await expect(toggle).toHaveText("북마크");
  }

  await toggle.click();
  await expect(toggle).toHaveText("북마크됨");

  await page.goto("/bookmarks");

  const bookmarkItem = page.getByTestId("bookmark-item-budget-baekban");
  await expect(bookmarkItem).toBeVisible();
  await bookmarkItem.getByTestId("bookmark-toggle-budget-baekban").click();
  await expect(page.getByTestId("bookmark-item-budget-baekban")).toHaveCount(0);
});
