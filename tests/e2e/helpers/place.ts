import { expect, type Page } from "@playwright/test";

type MapPlaceSummary = {
  id: string;
  name: string;
};

export async function pickSearchablePlace(
  page: Page,
  query = "김밥",
): Promise<MapPlaceSummary> {
  const response = await page.request.get(
    `/api/places/map?query=${encodeURIComponent(query)}&scope=global`,
  );

  expect(response.ok()).toBeTruthy();

  const payload = (await response.json()) as {
    items?: MapPlaceSummary[];
  };

  expect(payload.items?.length).toBeTruthy();

  return payload.items![0]!;
}
