import { expect, test, type Page } from "@playwright/test";

import { pickSearchablePlace } from "./helpers/place";

const SEOUL_BOOTSTRAP_BOUNDS = {
  minLat: 37.4133,
  maxLat: 37.7151,
  minLng: 126.7341,
  maxLng: 127.2693,
};
const SEOUL_BOOTSTRAP_ZOOM = 11;

function parseCount(text: string | null | undefined) {
  const value = Number((text ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(value) ? value : 0;
}

async function getLatestShareCall(page: Page) {
  return page.evaluate(() => {
    const calls = (window as typeof window & {
      __shareCalls?: Array<{
        text?: string;
        title?: string;
        url?: string;
      }>;
    }).__shareCalls;

    return calls?.at(-1) ?? null;
  });
}

test("지도 map API는 클러스터 모드에서도 단일 장소 bucket은 place marker로 반환한다", async ({ page }) => {
  const search = new URLSearchParams({
    minLat: String(SEOUL_BOOTSTRAP_BOUNDS.minLat),
    maxLat: String(SEOUL_BOOTSTRAP_BOUNDS.maxLat),
    minLng: String(SEOUL_BOOTSTRAP_BOUNDS.minLng),
    maxLng: String(SEOUL_BOOTSTRAP_BOUNDS.maxLng),
    zoom: "9",
  });
  const response = await page.request.get(`/api/places/map?${search.toString()}`);

  expect(response.ok()).toBeTruthy();

  const payload = (await response.json()) as {
    mapMarkers?: Array<{ kind: string; placeCount?: number }>;
    markerMode?: "cluster" | "place";
  };

  expect(payload.markerMode === "cluster" || payload.markerMode === "place").toBeTruthy();
  expect(payload.mapMarkers?.length).toBeTruthy();

  const markerKinds = new Set(payload.mapMarkers?.map((marker) => marker.kind) ?? []);

  expect([...markerKinds].every((kind) => kind === "cluster" || kind === "place")).toBe(
    true,
  );
  expect(
    payload.mapMarkers?.some(
      (marker) => marker.kind === "cluster" && marker.placeCount === 1,
    ),
  ).toBe(false);
});

test("홈 첫 지도 요청은 서울 bootstrap bounds와 zoom을 사용한다", async ({ page }) => {
  const mapResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());

    return (
      url.pathname === "/api/places/map" &&
      url.searchParams.get("minLat") === String(SEOUL_BOOTSTRAP_BOUNDS.minLat) &&
      url.searchParams.get("maxLat") === String(SEOUL_BOOTSTRAP_BOUNDS.maxLat) &&
      url.searchParams.get("minLng") === String(SEOUL_BOOTSTRAP_BOUNDS.minLng) &&
      url.searchParams.get("maxLng") === String(SEOUL_BOOTSTRAP_BOUNDS.maxLng) &&
      url.searchParams.get("zoom") === String(SEOUL_BOOTSTRAP_ZOOM)
    );
  });

  await page.goto("/");
  await mapResponsePromise;
});

test("지도 map API는 좁아진 클러스터 bounds에서 marker mode를 다시 계산한다", async ({ page }) => {
  const search = new URLSearchParams({
    minLat: String(SEOUL_BOOTSTRAP_BOUNDS.minLat),
    maxLat: String(SEOUL_BOOTSTRAP_BOUNDS.maxLat),
    minLng: String(SEOUL_BOOTSTRAP_BOUNDS.minLng),
    maxLng: String(SEOUL_BOOTSTRAP_BOUNDS.maxLng),
    zoom: "9",
  });
  const response = await page.request.get(`/api/places/map?${search.toString()}`);

  expect(response.ok()).toBeTruthy();

  const payload = (await response.json()) as {
    mapMarkers?: Array<{
      bounds?: typeof SEOUL_BOOTSTRAP_BOUNDS;
      kind: string;
      placeCount?: number;
    }>;
    markerMode?: "cluster" | "place";
  };
  const targetCluster = payload.mapMarkers
    ?.filter(
      (
        marker,
      ): marker is {
        bounds: typeof SEOUL_BOOTSTRAP_BOUNDS;
        kind: "cluster";
        placeCount: number;
      } =>
        marker.kind === "cluster" &&
        Boolean(marker.bounds) &&
        typeof marker.placeCount === "number",
    )
    .sort((left, right) => left.placeCount - right.placeCount)[0];

  if (!targetCluster) {
    test.skip(true, "seed data did not return a cluster marker");
    return;
  }

  const narrowedSearch = new URLSearchParams({
    minLat: String(targetCluster.bounds.minLat),
    maxLat: String(targetCluster.bounds.maxLat),
    minLng: String(targetCluster.bounds.minLng),
    maxLng: String(targetCluster.bounds.maxLng),
    zoom: "15",
  });
  const narrowedResponse = await page.request.get(
    `/api/places/map?${narrowedSearch.toString()}`,
  );

  expect(narrowedResponse.ok()).toBeTruthy();

  const narrowedPayload = (await narrowedResponse.json()) as {
    count: number;
    mapMarkers?: Array<{ kind: string }>;
    markerMode?: "cluster" | "place";
  };
  const expectedMarkerMode = narrowedPayload.count <= 96 ? "place" : "cluster";

  expect(narrowedPayload.markerMode).toBe(expectedMarkerMode);

  if (expectedMarkerMode === "place") {
    expect(new Set(narrowedPayload.mapMarkers?.map((marker) => marker.kind))).toEqual(
      new Set(["place"]),
    );
  } else {
    expect(
      narrowedPayload.mapMarkers?.some((marker) => marker.kind === "cluster"),
    ).toBe(true);
  }
});

test("지도 검색, 상세 시트, 비회원 좋아요, 공유, 닫기 흐름", async ({ page }) => {
  await page.addInitScript(() => {
    (
      window as typeof window & {
        __shareCalls?: unknown[];
      }
    ).__shareCalls = [];
    Object.defineProperty(window.navigator, "share", {
      configurable: true,
      value: async (payload: unknown) => {
        (
          window as typeof window & {
            __shareCalls?: unknown[];
          }
        ).__shareCalls?.push(payload);
      },
    });
  });

  const place = await pickSearchablePlace(page);

  await page.goto("/");

  await expect(page.getByTestId("map-panel-shell")).toBeVisible();
  await expect(page.getByTestId("map-current-location-button")).toBeVisible();
  await expect(page.getByTestId("map-refresh-button")).toBeVisible();
  await expect(
    page.getByTestId("place-list").locator('[data-testid^="place-list-item-"]').first(),
  ).toBeVisible();

  const refreshResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/places/map?"),
  );
  await page.getByTestId("map-refresh-button").click();
  await refreshResponsePromise;

  await page.getByTestId("search-scope-global").check({ force: true });
  await page.getByTestId("place-search-input").fill(place.name);
  await page.getByTestId("place-search-submit").click();

  const placeListItem = page.getByTestId(`place-list-item-${place.id}`);
  await expect(placeListItem).toBeVisible();

  const listLikeCount = page.getByTestId(`place-list-like-count-${place.id}`);
  const initialListLikeCount = parseCount(await listLikeCount.textContent());

  await page.getByTestId(`place-list-item-share-button-${place.id}`).click();
  await expect(
    page.getByTestId(`place-list-item-share-message-${place.id}`),
  ).toHaveText(/공유 문구/);
  await expect
    .poll(async () => (await getLatestShareCall(page))?.url ?? "")
    .toContain("source=list");
  const listShareCall = await getLatestShareCall(page);
  expect(listShareCall?.title).toContain(place.name);
  expect(listShareCall?.title).toContain("원");
  expect(listShareCall?.text).toContain("원");

  await placeListItem.focus();
  await placeListItem.press("Enter");

  const detailSheet = page.getByTestId("place-detail-sheet");
  await expect(detailSheet).toBeVisible();
  await expect(
    detailSheet.getByRole("heading", { name: place.name }),
  ).toBeVisible();

  const likeCount = page.getByTestId("reaction-like-count");
  const initialDetailLikeCount = parseCount(await likeCount.textContent());

  await page.getByTestId("reaction-like-button").click();
  await expect(likeCount).toHaveText(String(initialDetailLikeCount + 1));
  await expect(listLikeCount).toContainText(String(initialListLikeCount + 1));

  await page.getByTestId("place-detail-share-button").click();
  await expect(page.getByTestId("place-detail-share-message")).toHaveText(
    /공유 문구/,
  );
  await expect
    .poll(async () => (await getLatestShareCall(page))?.url ?? "")
    .toContain("source=detail_sheet");
  const detailSheetShareCall = await getLatestShareCall(page);
  expect(detailSheetShareCall?.title).toContain(place.name);
  expect(detailSheetShareCall?.title).toContain("원");

  await page.getByTestId("reaction-like-button").click();
  await expect(likeCount).toHaveText(String(initialDetailLikeCount));
  await expect(listLikeCount).toContainText(String(initialListLikeCount));

  await page.getByTestId("place-detail-close").click();
  await expect(detailSheet).toBeHidden();
  await expect(page.getByTestId("map-panel-shell")).toBeVisible();
});

test("홈에서 인기 장소 섹션이 보이고 상세 페이지로 이동할 수 있다", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (
      window as typeof window & {
        __shareCalls?: unknown[];
      }
    ).__shareCalls = [];
    Object.defineProperty(window.navigator, "share", {
      configurable: true,
      value: async (payload: unknown) => {
        (
          window as typeof window & {
            __shareCalls?: unknown[];
          }
        ).__shareCalls?.push(payload);
      },
    });
  });

  await page.goto("/");

  const section = page.getByTestId("trending-places-section");
  await expect(section).toBeVisible();

  const firstCard = section.locator('[data-testid^="trending-place-card-"]').first();
  await expect(firstCard).toBeVisible();

  const expectedPlaceName = await firstCard.getByRole("heading").innerText();
  const shareButton = firstCard.locator('[data-testid^="trending-place-share-button-"]');
  await shareButton.click();
  await expect
    .poll(async () => (await getLatestShareCall(page))?.url ?? "")
    .toContain("source=trending");
  const shareCall = await getLatestShareCall(page);
  expect(shareCall?.title).toContain(expectedPlaceName);

  await firstCard
    .locator('[data-testid^="trending-place-primary-link-"]')
    .click();

  await expect(page).toHaveURL(/\/place\//);
  await expect(
    page.getByRole("heading", { name: expectedPlaceName }).first(),
  ).toBeVisible();

  await page.getByTestId("place-page-share-button").click();
  await expect(page.getByTestId("place-page-share-message")).toHaveText(
    /공유 문구/,
  );
  await expect
    .poll(async () => (await getLatestShareCall(page))?.url ?? "")
    .toContain("source=detail");
  const detailShareCall = await getLatestShareCall(page);
  expect(detailShareCall?.title).toContain(expectedPlaceName);
});
