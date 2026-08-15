import "dotenv/config";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PUBLIC_ROUTES = ["/", "/login", "/submit"] as const;

for (const route of PUBLIC_ROUTES) {
  test(`접근성 자동 검사: ${route}`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .exclude("[data-map-canvas]")
      .analyze();

    expect(
      results.violations,
      results.violations
        .map(
          (violation) =>
            `${violation.id}: ${violation.nodes.map((node) => node.html).join(" | ")}`,
        )
        .join("\n"),
    ).toEqual([]);
  });
}
