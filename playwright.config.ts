import { defineConfig, devices } from "@playwright/test";

const PORT = 3107;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: "test-results",
  reporter: process.env.CI ? [["list"], ["html"]] : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command: `PORT=${PORT} npm run start`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
