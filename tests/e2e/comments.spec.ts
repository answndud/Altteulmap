import "dotenv/config";

import { expect, test } from "@playwright/test";

test("로그인 없이 코멘트를 등록하고 같은 방문자 세션에서 삭제할 수 있다", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const uniqueComment = `E2E 익명 코멘트 ${Date.now()}`;

  await page.goto("/place/school-gimbap");
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
