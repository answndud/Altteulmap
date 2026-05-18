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
  const csrfResponse = await page.request.get("/api/auth/csrf");
  expect(csrfResponse.ok()).toBeTruthy();

  const baseUrl = new URL(csrfResponse.url()).origin;
  const csrfPayload = (await csrfResponse.json()) as {
    csrfToken?: string;
  };
  expect(csrfPayload.csrfToken).toBeTruthy();

  const loginResponse = await page.request.post("/api/auth/callback/credentials", {
    form: {
      csrfToken: csrfPayload.csrfToken!,
      email,
      password,
      callbackUrl: new URL(callbackUrl, baseUrl).toString(),
    },
    failOnStatusCode: false,
    maxRedirects: 0,
  });

  expect(loginResponse.status()).toBe(302);

  const location = loginResponse.headers()["location"] ?? "";
  expect(location.startsWith(baseUrl)).toBeTruthy();

  await page.goto(callbackUrl);
}
