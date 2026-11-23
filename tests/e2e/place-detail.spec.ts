import { expect, test } from "@playwright/test";

test("상세 페이지는 위치 지도와 출처·전화·수집일을 항목별로 보여준다", async ({ page }) => {
  await page.goto("/place/goodprice-157");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("place-location-map")).toBeVisible();

  const info = page.getByTestId("place-info-panel");

  await expect(info.getByText("주소", { exact: true })).toBeVisible();
  await expect(info.getByText("전화", { exact: true })).toBeVisible();
  await expect(info.getByText("출처", { exact: true })).toBeVisible();
  await expect(info.getByText("수집일", { exact: true })).toBeVisible();
  // import가 note에 한 줄로 넣은 원본 문자열은 더 이상 그대로 노출되지 않는다.
  await expect(page.getByText("출처: 행정안전부")).toHaveCount(0);
});
