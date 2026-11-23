import { expect, test } from "@playwright/test";

test("없는 경로는 빈 화면이 아니라 404 안내와 지도 링크를 보여준다", async ({ page }) => {
  await page.goto("/does-not-exist");

  await expect(page.getByTestId("not-found")).toBeVisible();
  await expect(page.getByRole("link", { name: "지도로 돌아가기" })).toBeVisible();

  await page.goto("/admin/unknown-section");
  await expect(page.getByTestId("not-found")).toBeVisible();
});

test("로그인 전 관리자 화면은 관리 메뉴 없이 로그인 안내만 보여준다", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "로그인이 필요합니다" })).toBeVisible();
  await expect(page.getByRole("link", { name: "장소 승인" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "신고 검토" })).toHaveCount(0);
});
