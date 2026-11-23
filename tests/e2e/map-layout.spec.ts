import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("데스크톱 첫 화면은 검색 한 줄 아래에서 지도가 화면 대부분을 차지한다", async ({ page }) => {
  await page.goto("/");

  const shell = page.getByTestId("map-panel-shell");
  // lazy 로딩 fallback이 아니라 실제 지도 패널이 그려질 때까지 기다린다.
  await expect(page.getByTestId("map-panel")).toBeVisible();

  await expect
    .poll(() =>
      shell.evaluate((element) => {
        const box = element.getBoundingClientRect();

        return (Math.min(box.bottom, window.innerHeight) - box.top) / window.innerHeight;
      }),
    )
    .toBeGreaterThanOrEqual(0.7);
  // 지도 위에 소개 문구·제목 블록이 없다.
  await expect(page.getByText("가격이 보이는 동네 지도")).toHaveCount(0);
});

test("업종 필터는 지도를 밀어내지 않고 열기/닫기 라벨이 바뀐다", async ({ page }) => {
  await page.goto("/");

  const shell = page.getByTestId("map-panel-shell");
  await expect(page.getByTestId("map-panel")).toBeVisible();
  const topBefore = (await shell.boundingBox())?.y ?? 0;
  const summary = page.locator("summary", { hasText: "업종 필터" });

  await expect(summary).toContainText("열기");
  await summary.click();
  await expect(summary).toContainText("닫기");
  expect(Math.abs(((await shell.boundingBox())?.y ?? 0) - topBefore)).toBeLessThan(1);
  await expect(page.getByRole("link", { name: "전체 보기" })).toBeVisible();

  await summary.click();
  await expect(summary).toContainText("열기");
});
