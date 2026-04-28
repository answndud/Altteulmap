import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
  {
    destination: "pages/dashboard-page.tsx",
    source: "pages/dashboard-page.tsx",
    exports: "default, dynamic",
  },
  {
    destination: "pages/places-page.tsx",
    source: "pages/places-page.tsx",
    exports: "default, dynamic",
  },
  {
    destination: "pages/prices-page.tsx",
    source: "pages/prices-page.tsx",
    exports: "default, dynamic",
  },
  {
    destination: "pages/place-prices-page.tsx",
    source: "pages/place-prices-page.tsx",
    exports: "default, dynamic",
  },
  {
    destination: "pages/reports-page.tsx",
    source: "pages/reports-page.tsx",
    exports: "default, dynamic",
  },
  {
    destination: "api/places-list.ts",
    source: "api/places-list.ts",
    exports: "dynamic, GET",
  },
  {
    destination: "api/place-detail.ts",
    source: "api/place-detail.ts",
    exports: "GET, PATCH",
  },
  {
    destination: "api/prices-list.ts",
    source: "api/prices-list.ts",
    exports: "dynamic, GET",
  },
  {
    destination: "api/price-detail.ts",
    source: "api/price-detail.ts",
    exports: "PATCH",
  },
  {
    destination: "api/price-item-detail.ts",
    source: "api/price-item-detail.ts",
    exports: "PATCH",
  },
  {
    destination: "api/reports-list.ts",
    source: "api/reports-list.ts",
    exports: "dynamic, GET",
  },
  {
    destination: "api/report-detail.ts",
    source: "api/report-detail.ts",
    exports: "PATCH",
  },
];

rmSync(destinationBase, { recursive: true, force: true });
mkdirSync(path.join(destinationBase, "pages"), { recursive: true });
mkdirSync(path.join(destinationBase, "api"), { recursive: true });

for (const entrypoint of fileMap) {
  const source = path.join(
    rootDir,
    "src",
    "features",
    "admin",
    mode === "external" ? "stubs" : "",
    entrypoint.source,
  );
  const destination = path.join(destinationBase, entrypoint.destination);

  if (mode === "external") {
    cpSync(source, destination);
    continue;
  }

  const modulePath = entrypoint.source.replace(/\.(ts|tsx)$/, "");

  writeFileSync(
    destination,
    `export { ${entrypoint.exports} } from "@/features/admin/${modulePath}";\n`,
  );
}

process.stdout.write(`[admin:sync] mode=${mode}\n`);
