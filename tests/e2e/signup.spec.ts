import "dotenv/config";

import { expect, test } from "@playwright/test";

test("새 사용자가 이메일로 가입하면 바로 로그인되어 보호 페이지로 이동한다", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const suffix = Date.now().toString();
  const nickname = `신규사용자${suffix.slice(-4)}`;
  const email = `signup-${suffix}@altteulmap.local`;
  const password = `signup-${suffix}`;

  await page.goto("/signup?callbackUrl=%2Fbookmarks");
  await expect(page.getByTestId("signup-form")).toBeVisible();

  await page.getByTestId("signup-nickname").fill(nickname);
  await page.getByTestId("signup-email").fill(email);
  await page.getByTestId("signup-password").fill(password);
  await page.getByTestId("signup-password-confirm").fill(password);
  await page.getByTestId("signup-submit").click();

  await expect(page).toHaveURL(/\/bookmarks$/);
  await expect(
    page.getByRole("heading", { name: "저장한 장소" }),
  ).toBeVisible();
  await expect(page.getByText(nickname)).toBeVisible();
});
