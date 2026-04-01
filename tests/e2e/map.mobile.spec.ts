import { expect, test } from "@playwright/test";

test("모바일에서 장소 목록 바텀시트를 열고 닫을 수 있다", async ({
  page,
}) => {
  await page.goto("/?q=%ED%95%99%EA%B5%90%EC%95%9E%EA%B9%80%EB%B0%A5&scope=global");

  await expect(page.getByTestId("map-panel-shell")).toBeVisible();

  const openButton = page.getByTestId("mobile-place-list-open");
  const sheet = page.getByTestId("mobile-place-list-sheet");
  const list = sheet.getByTestId("mobile-place-list");

  await expect(openButton).toBeVisible();
  await openButton.click();
  await expect(sheet).toBeVisible();
  await expect(list).toBeVisible();
  await expect(list.getByTestId("mobile-place-list-item-school-gimbap")).toBeVisible();

  await sheet.getByTestId("mobile-place-list-close").click();
  await expect(sheet).toBeHidden();
  await expect(openButton).toBeVisible();
});

test("모바일에서 목록에서 플레이스를 고르면 상세 시트가 열리고 닫으면 지도 화면으로 돌아온다", async ({
  page,
}) => {
  await page.goto("/?q=%ED%95%99%EA%B5%90%EC%95%9E%EA%B9%80%EB%B0%A5&scope=global");

  await expect(page.getByTestId("map-panel-shell")).toBeVisible();

  const openButton = page.getByTestId("mobile-place-list-open");
  const sheet = page.getByTestId("mobile-place-list-sheet");
  const list = sheet.getByTestId("mobile-place-list");

  await openButton.click();
  await expect(sheet).toBeVisible();
  await list.getByTestId("mobile-place-list-item-school-gimbap").click();
  await expect(sheet).toBeHidden();

  const detailSheet = page.getByTestId("place-detail-sheet");

  await expect(detailSheet).toBeVisible();
  await expect(
    detailSheet.getByRole("heading", { name: "학교앞김밥" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/scope=global/);

  await page.getByTestId("place-detail-close").click();
  await expect(detailSheet).toBeHidden();
  await expect(page.getByTestId("map-panel-shell")).toBeVisible();
  await expect(openButton).toBeVisible();
});
