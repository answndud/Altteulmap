import fs from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, "docs", "readme");

loadEnvFilesWithShellPrecedence({
  cwd: projectRoot,
  filenames: [".env", ".env.local", ".env.production.local"],
});

// 기본값은 로컬 개발 서버(npm run dev, DB는 .dev.vars). 운영 화면을 찍으려면 README_PUBLIC_URL을 지정한다.
const publicUrl = process.env.README_PUBLIC_URL ?? "http://localhost:5173";
const adminEmail = process.env.README_ADMIN_EMAIL ?? "admin@altteulmap.local";
const adminPassword = process.env.README_ADMIN_PASSWORD ?? "admin1234";
fs.mkdirSync(outputDir, { recursive: true });

async function waitForHomeReady(page) {
  await page.goto(publicUrl, { waitUntil: "domcontentloaded" });
  await page.getByTestId("map-panel-shell").waitFor({ state: "visible" });
  await page.getByTestId("place-list").waitFor({ state: "visible" });
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
  const openButton = page.locator("[data-testid^='place-list-item-open-']").first();
  await openButton.waitFor({ state: "visible" });
  await openButton.click();
  await page.getByTestId("place-detail-sheet").waitFor({ state: "visible" });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(outputDir, "place-detail.png"),
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

async function captureAdminDashboard(browser) {
  const context = await browser.newContext({
    viewport: { width: 1512, height: 1180 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  await page.goto(new URL("/login", publicUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("이메일 주소").fill(adminEmail);
  await page.getByPlaceholder("비밀번호").fill(adminPassword);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));

  await page.goto(new URL("/admin", publicUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.getByTestId("admin-metric-total-users").waitFor({ state: "visible" });
  await page.waitForTimeout(500);

  await page.locator("main").screenshot({
    path: path.join(outputDir, "admin-console.png"),
  });

  await context.close();
}

const browser = await chromium.launch({ headless: true });

try {
  await captureDesktopHome(browser);
  await captureDesktopDetail(browser);
  await captureSubmit(browser);
  await captureAdminDashboard(browser);

  process.stdout.write(`Saved README screenshots to ${outputDir}\n`);
} finally {
  await browser.close();
}
