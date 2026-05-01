import fs from "node:fs";
import path from "node:path";

import { chromium, devices } from "@playwright/test";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, "docs", "readme");

loadEnvFilesWithShellPrecedence({
  cwd: projectRoot,
  filenames: [".env", ".env.local", ".env.production.local"],
});

const publicUrl =
  process.env.README_PUBLIC_URL ??
  process.env.NEXTAUTH_URL ??
  "https://altteulmap.altteul-lab.workers.dev";
const adminUrl =
  process.env.README_ADMIN_URL ??
  process.env.ADMIN_APP_URL ??
  "https://altteulmap.altteul-lab.workers.dev/admin";
fs.mkdirSync(outputDir, { recursive: true });

async function waitForHomeReady(page, { mobile = false } = {}) {
  await page.goto(publicUrl, { waitUntil: "domcontentloaded" });
  await page.getByTestId("map-panel-shell").waitFor({ state: "visible" });
  if (mobile) {
    await page.getByTestId("mobile-place-list-open").waitFor({ state: "visible" });
  } else {
    await page.getByTestId("place-list").waitFor({ state: "visible" });
  }
  await page.waitForTimeout(2200);
}

async function captureDesktopHome(browser) {
  const context = await browser.newContext({
    viewport: { width: 1512, height: 1180 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  await waitForHomeReady(page);
  await page.screenshot({
    path: path.join(outputDir, "hero-home.png"),
    fullPage: false,
  });

  await context.close();
}

async function captureDesktopDetail(browser) {
  const context = await browser.newContext({
    viewport: { width: 1512, height: 1180 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  await waitForHomeReady(page);
  const firstItem = page.locator("[data-testid^='place-list-item-']").first();
  await firstItem.waitFor({ state: "visible" });
  await firstItem.click();
  await page.getByTestId("place-detail-sheet").waitFor({ state: "visible" });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(outputDir, "place-detail.png"),
    fullPage: false,
  });

  await context.close();
}

async function captureMobileSheet(browser) {
  const context = await browser.newContext({
    ...devices["iPhone 13"],
  });
  const page = await context.newPage();

  await waitForHomeReady(page, { mobile: true });
  await page.getByTestId("mobile-place-list-open").click();
  await page.getByTestId("mobile-place-list-sheet").waitFor({ state: "visible" });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(outputDir, "mobile-map-sheet.png"),
    fullPage: false,
  });

  await context.close();
}

async function captureSubmit(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1280 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  await page.goto(new URL("/submit", publicUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.getByTestId("place-submit-form").waitFor({ state: "visible" });

  await page.getByTestId("submit-name").fill("보문분식");
  if ((await page.getByTestId("submit-business-name").count()) > 0) {
    await page.getByTestId("submit-business-name").fill("보문분식 본점");
  }
  await page.getByTestId("submit-category").selectOption("bunsik");
  await page.getByTestId("submit-district").fill("서울 성북구");
  await page.getByTestId("submit-road-address").fill("서울 성북구 보문로 123");
  await page.getByTestId("submit-price-label-0").fill("김밥");
  await page.getByTestId("submit-price-amount-0").fill("3500");
  await page.getByTestId("submit-price-unit-0").fill("1줄");
  await page.getByTestId("submit-note").fill("동네에서 자주 찾는 분식집입니다.");
  await page.waitForTimeout(300);

  await page.screenshot({
    path: path.join(outputDir, "submit-form.png"),
    fullPage: false,
  });

  await context.close();
}

async function captureAdminLanding(browser) {
  const context = await browser.newContext({
    viewport: { width: 1512, height: 1180 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  await page.goto(adminUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "운영 콘솔로 이동" }).waitFor({ state: "visible" });
  await page.waitForTimeout(500);

  await page.locator("main section").screenshot({
    path: path.join(outputDir, "admin-console.png"),
  });

  await context.close();
}

const browser = await chromium.launch({ headless: true });

try {
  await captureDesktopHome(browser);
  await captureDesktopDetail(browser);
  await captureMobileSheet(browser);
  await captureSubmit(browser);
  await captureAdminLanding(browser);

  process.stdout.write(`Saved README screenshots to ${outputDir}\n`);
} finally {
  await browser.close();
}
