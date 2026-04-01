import { expect, test } from "@playwright/test";

function parseCount(text: string | null | undefined) {
  const value = Number((text ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(value) ? value : 0;
}

test("지도 검색, 상세 시트, 비회원 좋아요, 공유, 닫기 흐름", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "share", {
      configurable: true,
      value: async () => undefined,
    });
  });

  await page.goto("/");

  await expect(page.getByTestId("map-panel-shell")).toBeVisible();

  await page.getByTestId("search-scope-global").check({ force: true });
  await page.getByTestId("place-search-input").fill("학교앞김밥");
  await page.getByTestId("place-search-submit").click();

  const schoolGimbapItem = page.getByTestId("place-list-item-school-gimbap");
  await expect(schoolGimbapItem).toBeVisible();

  const listLikeCount = page.getByTestId("place-list-like-count-school-gimbap");
  const initialListLikeCount = parseCount(await listLikeCount.textContent());

  await schoolGimbapItem.focus();
  await schoolGimbapItem.press("Enter");

  const detailSheet = page.getByTestId("place-detail-sheet");
  await expect(detailSheet).toBeVisible();
  await expect(
    detailSheet.getByRole("heading", { name: "학교앞김밥" }),
  ).toBeVisible();

  const likeCount = page.getByTestId("reaction-like-count");
  const initialDetailLikeCount = parseCount(await likeCount.textContent());

  await page.getByTestId("reaction-like-button").click();
  await expect(likeCount).toHaveText(String(initialDetailLikeCount + 1));
  await expect(listLikeCount).toContainText(String(initialListLikeCount + 1));

  await page.getByTestId("place-share-button").click();
  await expect(page.getByTestId("place-share-message")).toHaveText(
    /공유 링크/,
  );

  await page.getByTestId("reaction-like-button").click();
  await expect(likeCount).toHaveText(String(initialDetailLikeCount));
  await expect(listLikeCount).toContainText(String(initialListLikeCount));

  await page.getByTestId("place-detail-close").click();
  await expect(detailSheet).toBeHidden();
  await expect(page.getByTestId("map-panel-shell")).toBeVisible();
});

test("좋아요순 정렬에서 목록 좋아요 수가 내림차순이다", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("sort-option-likes").click();
  await expect(page).toHaveURL(/sort=likes/);
  await expect(page.getByTestId("place-list")).toBeVisible();

  const counts = await page
    .locator("[data-testid^='place-list-like-count-']")
    .allTextContents();
  const numericCounts = counts.map((value) => parseCount(value));
  const sortedCounts = [...numericCounts].sort((left, right) => right - left);

  expect(numericCounts.length).toBeGreaterThan(1);
  expect(numericCounts).toEqual(sortedCounts);
});
