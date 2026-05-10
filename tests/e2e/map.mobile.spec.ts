import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

async function dragSheetHandle(page: Page, handle: Locator, deltaY: number) {
  const box = await handle.boundingBox();

  if (!box) {
    throw new Error("sheet handle box not found");
  }

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY + deltaY, { steps: 10 });
  await page.mouse.up();
}

test("모바일에서 장소 목록 바텀시트를 열고 닫을 수 있다", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByTestId("map-panel-shell")).toBeVisible();
  await expect(page.getByTestId("map-current-location-button")).toBeVisible();
  await expect(page.getByTestId("map-refresh-button")).toBeVisible();

  const openButton = page.getByTestId("mobile-place-list-open");
  const sheet = page.getByTestId("mobile-place-list-sheet");
  const list = sheet.getByTestId("mobile-place-list");
  const countBadge = sheet.locator(".altteulmap-badge").first();
  const dragHandle = sheet.getByTestId("mobile-place-list-drag-handle");

  await expect(openButton).toBeVisible();
  await expect(openButton).toContainText(/\d+곳/);
  await openButton.click();
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("data-sheet-mode", "peek");
  await expect(countBadge).toHaveText(/\d+곳/);
  await expect(list).toBeVisible();
  const peekMetrics = await sheet.evaluate((element) => {
    const rect = element.getBoundingClientRect();

    return {
      top: rect.top,
      height: rect.height,
      viewportHeight: window.innerHeight,
    };
  });

  expect(peekMetrics.top).toBeGreaterThan(40);
  expect(peekMetrics.height).toBeLessThan(peekMetrics.viewportHeight * 0.9);
  await expect(
    list.locator('[data-testid^="mobile-place-list-item-"]').first(),
  ).toBeVisible();

  await sheet.getByTestId("mobile-place-list-toggle-size").click({ force: true });
  await expect(sheet).toHaveAttribute("data-sheet-mode", "expanded");
  await page.waitForTimeout(250);
  const expandedMetrics = await sheet.evaluate((element) => {
    const rect = element.getBoundingClientRect();

    return {
      height: rect.height,
    };
  });

  expect(expandedMetrics.height).toBeGreaterThan(peekMetrics.height);

  await page.waitForTimeout(700);
  await expect(countBadge).toHaveText(/\d+곳/);

  await dragSheetHandle(page, dragHandle, 140);
  await expect(sheet).toHaveAttribute("data-sheet-mode", "peek");
  await page.waitForTimeout(220);
  await dragSheetHandle(page, dragHandle, 150);
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

  await expect(openButton).toBeVisible();
  await expect(openButton).toContainText(/\d+곳/);
  await openButton.click();
  await expect(sheet).toBeVisible();
  const firstItem = list.locator('[data-testid^="mobile-place-list-item-"]').first();
  await expect(firstItem).toBeVisible();
  const expectedPlaceName = await firstItem.getByRole("heading").innerText();
  await firstItem.click({ force: true });
  await expect(sheet).toBeHidden();

  const detailSheet = page.getByTestId("place-detail-sheet");
  const detailDragHandle = detailSheet.getByTestId("place-detail-drag-handle");

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

  await dragSheetHandle(page, detailDragHandle, 150);
  await expect(detailSheet).toBeHidden();
  await expect(page.getByTestId("map-panel-shell")).toBeVisible();
  await expect(openButton).toBeVisible();
});
