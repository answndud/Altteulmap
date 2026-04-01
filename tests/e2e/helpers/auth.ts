import { expect, type Page } from "@playwright/test";

export const DEMO_EMAIL = "demo@altteulmap.local";
export const ADMIN_EMAIL = "admin@altteulmap.local";
export const DEMO_PASSWORD = process.env.AUTH_DEMO_PASSWORD ?? "demo1234";
export const ADMIN_PASSWORD = process.env.AUTH_ADMIN_PASSWORD ?? "admin1234";

export async function loginWithCredentials(
  page: Page,
  {
    callbackUrl,
    email,
    password,
  }: {
    callbackUrl: string;
    email: string;
    password: string;
  },
) {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await expect(page.getByTestId("login-form")).toBeVisible();
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
}
