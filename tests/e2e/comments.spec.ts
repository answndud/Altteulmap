import "dotenv/config";

import { expect, test } from "@playwright/test";

import { pickSearchablePlace } from "./helpers/place";

test("로그인 없이 코멘트를 등록하고 같은 방문자 세션에서 삭제할 수 있다", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const uniqueComment = `E2E 익명 코멘트 ${Date.now()}`;
  const place = await pickSearchablePlace(page);

  await page.goto(`/place/${place.id}`);
  await expect(page.getByTestId("place-comments-section")).toBeVisible();
  await page.getByTestId("comment-body").fill(uniqueComment);
  await page.getByTestId("comment-submit").click();

  await expect(page.getByText("코멘트를 등록했습니다.")).toBeVisible();

  const createdComment = page
    .getByTestId("comment-item")
    .filter({ hasText: uniqueComment })
    .first();

  await expect(createdComment).toBeVisible();
  await createdComment.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText("코멘트를 삭제했습니다.")).toBeVisible();
  await expect(
    page.getByTestId("comment-item").filter({ hasText: uniqueComment }),
  ).toHaveCount(0);
});

test("다른 방문자는 코멘트를 삭제할 수 없다", async ({ browser, page }) => {
  test.setTimeout(60_000);

  const uniqueComment = `E2E 소유권 경계 ${Date.now()}`;
  const place = await pickSearchablePlace(page);

  await page.goto(`/place/${place.id}`);
  await expect(page.getByTestId("place-comments-section")).toBeVisible();
  await page.getByTestId("comment-body").fill(uniqueComment);
  await page.getByTestId("comment-submit").click();
  await expect(page.getByText("코멘트를 등록했습니다.")).toBeVisible();

  const createdComment = page
    .getByTestId("comment-item")
    .filter({ hasText: uniqueComment })
    .first();
  const deleteTestId = await createdComment
    .getByRole("button", { name: "삭제" })
    .getAttribute("data-testid");
  const commentId = deleteTestId?.replace("comment-delete-", "");

  expect(commentId).toBeTruthy();

  const otherContext = await browser.newContext();
  try {
    const otherPage = await otherContext.newPage();
    const response = await otherPage.request.delete(
      `/api/places/${encodeURIComponent(place.id)}/comments/${encodeURIComponent(commentId!)}`,
    );

    expect(response.status()).toBe(403);
    await expect(createdComment).toBeVisible();
  } finally {
    await otherContext.close();
  }
});

test("댓글 저장 서버 오류에서도 입력 내용을 유지한다", async ({ page }) => {
  test.setTimeout(60_000);

  const place = await pickSearchablePlace(page);
  const commentBody = `E2E 장애 복구 ${Date.now()}`;

  await page.goto(`/place/${place.id}`);
  await expect(page.getByTestId("place-comments-section")).toBeVisible();
  await page.route(`**/api/places/${place.id}/comments`, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, message: "코멘트를 저장하지 못했습니다." }),
    });
  });

  await page.getByTestId("comment-body").fill(commentBody);
  await page.getByTestId("comment-submit").click();

  await expect(page.getByText("코멘트를 저장하지 못했습니다.")).toBeVisible();
  await expect(page.getByTestId("comment-body")).toHaveValue(commentBody);
});

test("코멘트 rate limit에 걸리면 남은 대기 시간을 안내한다", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const place = await pickSearchablePlace(page);
  const seedPrefix = `E2E 코멘트 제한 ${Date.now()}`;

  await page.goto(`/place/${place.id}`);
  await expect(page.getByTestId("place-comments-section")).toBeVisible();

  const firstResponse = await page.request.post(
    `/api/places/${encodeURIComponent(place.id)}/comments`,
    {
      data: {
        body: `${seedPrefix}-0`,
      },
    },
  );

  expect(firstResponse.ok()).toBeTruthy();
  expect(firstResponse.headers()["x-ratelimit-policy"]).toBe(
    "place_comment_submission",
  );
  expect(firstResponse.headers()["x-ratelimit-window"]).toBe("600");

  const limitHeader = firstResponse.headers()["x-ratelimit-limit"];
  const limit = Number.parseInt(limitHeader ?? "", 10);

  expect(limit).toBeGreaterThan(1);

  for (let index = 1; index < limit; index += 1) {
    const response = await page.request.post(
      `/api/places/${encodeURIComponent(place.id)}/comments`,
      {
        data: {
          body: `${seedPrefix}-${index}`,
        },
      },
    );

    expect(response.ok()).toBeTruthy();
  }

  await page.getByTestId("comment-body").fill(`${seedPrefix}-final`);
  await page.getByTestId("comment-submit").click();

  await expect(
    page.getByText(/코멘트 등록 요청이 너무 빠릅니다\. 약 .* 후 다시 시도해주세요\./),
  ).toBeVisible();
});
