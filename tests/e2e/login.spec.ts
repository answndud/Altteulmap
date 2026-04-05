import "dotenv/config";

import { expect, test } from "@playwright/test";

test("로그인과 회원가입 진입면은 핵심 폼만 보여주고 서로 자연스럽게 이동한다", async ({
  page,
}) => {
  await page.goto("/login?callbackUrl=%2Fbookmarks");

  await expect(page.getByTestId("login-form")).toBeVisible();
  await expect(page.getByTestId("auth-readiness-panel")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();

  await page.getByRole("link", { name: "회원가입" }).click();
  await expect(page).toHaveURL(/\/signup\?callbackUrl=%2Fbookmarks$/);

  await expect(page.getByTestId("signup-form")).toBeVisible();
  await expect(page.getByTestId("auth-readiness-panel")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "회원가입" })).toBeVisible();
});
