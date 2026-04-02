import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const mode =
  process.env.ALTTEULMAP_ADMIN_MODE === "external" ? "external" : "embedded";

const destinationBase = path.join(
  rootDir,
  "src",
  "features",
  "admin",
  "entrypoints",
);

const fileMap = [
  ["pages/dashboard-page.tsx", "pages/dashboard-page.tsx"],
  ["pages/places-page.tsx", "pages/places-page.tsx"],
  ["pages/prices-page.tsx", "pages/prices-page.tsx"],
  ["pages/place-prices-page.tsx", "pages/place-prices-page.tsx"],
  ["pages/reports-page.tsx", "pages/reports-page.tsx"],
  ["api/places-list.ts", "api/places-list.ts"],
  ["api/place-detail.ts", "api/place-detail.ts"],
  ["api/prices-list.ts", "api/prices-list.ts"],
  ["api/price-detail.ts", "api/price-detail.ts"],
  ["api/price-item-detail.ts", "api/price-item-detail.ts"],
  ["api/reports-list.ts", "api/reports-list.ts"],
  ["api/report-detail.ts", "api/report-detail.ts"],
];

rmSync(destinationBase, { recursive: true, force: true });
mkdirSync(path.join(destinationBase, "pages"), { recursive: true });
mkdirSync(path.join(destinationBase, "api"), { recursive: true });

for (const [destination, embeddedSource] of fileMap) {
  const source = path.join(
    rootDir,
    "src",
    "features",
    "admin",
    mode === "external" ? "stubs" : "",
    embeddedSource,
  );

  cpSync(source, path.join(destinationBase, destination));
}

process.stdout.write(`[admin:sync] mode=${mode}\n`);
