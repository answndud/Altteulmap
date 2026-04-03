import { expect, test } from "@playwright/test";

test("모바일에서 장소 목록 바텀시트를 열고 닫을 수 있다", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByTestId("map-panel-shell")).toBeVisible();

  const openButton = page.getByTestId("mobile-place-list-open");
  const sheet = page.getByTestId("mobile-place-list-sheet");
  const list = sheet.getByTestId("mobile-place-list");
  const countBadge = sheet.locator(".altteulmap-badge").first();

  await expect(openButton).toBeVisible();
  await openButton.click();
  await expect(sheet).toBeVisible();
  await expect(countBadge).toHaveText(/\d+곳/);
  await expect(list).toBeVisible();
  const sheetMetrics = await sheet.evaluate((element) => {
    const rect = element.getBoundingClientRect();

    return {
      top: rect.top,
      height: rect.height,
      viewportHeight: window.innerHeight,
    };
  });

  expect(sheetMetrics.top).toBeGreaterThan(40);
  expect(sheetMetrics.height).toBeLessThan(sheetMetrics.viewportHeight * 0.9);
  const visibleCount = await sheet
    .locator('[data-testid^="mobile-place-list-item-"]')
    .evaluateAll((items) => {
      const sheetElement = items[0]?.closest(
        '[data-testid="mobile-place-list-sheet"]',
      ) as HTMLElement | null;

      if (!sheetElement) {
        return 0;
      }

      const sheetRect = sheetElement.getBoundingClientRect();

      return items.filter((item) => {
        const rect = (item as HTMLElement).getBoundingClientRect();
        return rect.top >= sheetRect.top && rect.bottom <= sheetRect.bottom;
      }).length;
    });

  expect(visibleCount).toBeGreaterThanOrEqual(2);

  await page.waitForTimeout(700);
  await expect(countBadge).toHaveText(/\d+곳/);

  await sheet.getByTestId("mobile-place-list-close").click();
  await expect(sheet).toBeHidden();
  await expect(openButton).toBeVisible();
});

test("모바일에서 목록에서 플레이스를 고르면 상세 시트가 열리고 닫으면 지도 화면으로 돌아온다", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByTestId("map-panel-shell")).toBeVisible();

  const openButton = page.getByTestId("mobile-place-list-open");
  const sheet = page.getByTestId("mobile-place-list-sheet");
  const list = sheet.getByTestId("mobile-place-list");

  await openButton.click();
  await expect(sheet).toBeVisible();
  const firstItem = list.locator('[data-testid^="mobile-place-list-item-"]').first();
  await expect(firstItem).toBeVisible();
  const expectedPlaceName = await firstItem.getByRole("heading").innerText();
  await firstItem.click();
  await expect(sheet).toBeHidden();

  const detailSheet = page.getByTestId("place-detail-sheet");

  await expect(detailSheet).toBeVisible();
  await expect(
    detailSheet.getByRole("heading", { name: expectedPlaceName }).first(),
  ).toBeVisible();
  await expect(page.getByTestId("place-detail-close")).toBeVisible();
  const detailMetrics = await detailSheet.evaluate((element) => {
    const rect = element.getBoundingClientRect();

    return {
      top: rect.top,
      height: rect.height,
      viewportHeight: window.innerHeight,
    };
  });

  expect(detailMetrics.top).toBeGreaterThan(40);
  expect(detailMetrics.height).toBeLessThan(detailMetrics.viewportHeight * 0.95);
  await expect(page).toHaveURL("/");

  await page.getByTestId("place-detail-close").click();
  await expect(detailSheet).toBeHidden();
  await expect(page.getByTestId("map-panel-shell")).toBeVisible();
  await expect(openButton).toBeVisible();
});
