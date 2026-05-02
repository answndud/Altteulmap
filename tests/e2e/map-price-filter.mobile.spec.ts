import { expect, test } from "@playwright/test";

test("모바일 탐색 조건에서 가격 필터는 보이지 않고 카테고리 전환은 계속 가능하다", async ({
  page,
}) => {
  await page.goto("/");

  const filterSummary = page.locator("summary").filter({
    hasText: "업종 필터",
  });

  await filterSummary.click();
  await expect(page.getByText("가격 필터")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "5,000원 이하" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "10,000원 이하" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "20,000원 이하" })).toHaveCount(0);

  await page.getByRole("link", { name: "한식" }).click();
  await expect(page).toHaveURL(/category=korean/);
});
