import { expect, test } from "@playwright/test";

function parseCount(text: string | null | undefined) {
  const value = Number((text ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(value) ? value : 0;
}

test("preview fallback에서도 bootstrap fetch와 카테고리 탐색은 유지되고 가격 필터는 노출되지 않는다", async ({
  page,
}) => {
  const initialFetch = page.waitForResponse((response) =>
    response.url().includes("/api/places/map?"),
  );

  await page.goto("/");

  const initialResponse = await initialFetch;
  const initialPayload = (await initialResponse.json()) as {
    count: number;
  };

  expect(initialPayload.count).toBeGreaterThan(0);

  const mapBadge = page
    .getByTestId("map-panel-shell")
    .locator(".altteulmap-badge")
    .first();

  await expect.poll(async () => parseCount(await mapBadge.textContent())).toBe(
    initialPayload.count,
  );
  await expect(page.locator('[data-testid^="place-list-item-"]').first()).toBeVisible();
  await expect(page.getByText("가격 필터")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "5,000원 이하" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "10,000원 이하" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "20,000원 이하" })).toHaveCount(0);

  const categoryFetch = page.waitForResponse(
    (response) =>
      response.url().includes("/api/places/map?") &&
      response.url().includes("category=korean"),
  );

  await page.getByRole("link", { name: "한식" }).click();

  await expect(page).toHaveURL(/category=korean/);

  const categoryResponse = await categoryFetch;
  const categoryPayload = (await categoryResponse.json()) as {
    count: number;
  };

  expect(categoryPayload.count).toBeGreaterThan(0);
  expect(categoryPayload.count).toBeLessThanOrEqual(initialPayload.count);

  await expect.poll(async () => parseCount(await mapBadge.textContent())).toBe(
    categoryPayload.count,
  );
  await expect(page.locator('[data-testid^="place-list-item-"]').first()).toBeVisible();
});
