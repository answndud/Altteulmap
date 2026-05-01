import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const outputRoot = join(process.cwd(), "dist");
const workerOutput = join(outputRoot, "altteulmap");
const clientOutput = join(outputRoot, "client");
const wranglerPath = join(workerOutput, "wrangler.json");
const workerEntryPath = join(workerOutput, "index.mjs");
const clientIndexPath = join(clientOutput, "index.html");

function fail(message) {
  console.error(`Vite deploy check failed: ${message}`);
  process.exitCode = 1;
}

function assertFile(path, label) {
  if (!existsSync(path)) {
    fail(`${label} is missing at ${path}`);
    return null;
  }

  const stats = statSync(path);

  if (!stats.isFile()) {
    fail(`${label} is not a file at ${path}`);
    return null;
  }

  return stats;
}

const wranglerStats = assertFile(wranglerPath, "generated Wrangler config");
const workerStats = assertFile(workerEntryPath, "Worker entry");
const clientIndexStats = assertFile(clientIndexPath, "client index.html");

if (wranglerStats) {
  const wrangler = JSON.parse(readFileSync(wranglerPath, "utf8"));

  if (wrangler.name !== "altteulmap") {
    fail(`unexpected worker name ${JSON.stringify(wrangler.name)}`);
  }

  if (wrangler.main !== "index.mjs" && wrangler.main !== "./index.mjs") {
    fail(`generated main should be index.mjs, got ${JSON.stringify(wrangler.main)}`);
  }

  if (wrangler.assets?.not_found_handling !== "single-page-application") {
    fail("assets.not_found_handling must be single-page-application");
  }

  if (wrangler.assets?.binding !== "ASSETS") {
    fail("assets.binding must be ASSETS");
  }

  const serialized = JSON.stringify(wrangler);

  if (serialized.includes(".open-next") || serialized.includes(".next")) {
    fail("generated Vite Wrangler config must not reference Next/OpenNext output");
  }
}

if (workerStats && workerStats.size <= 0) {
  fail("Worker entry is empty");
}

if (clientIndexStats) {
  const clientIndex = readFileSync(clientIndexPath, "utf8");

  if (!clientIndex.includes("/assets/")) {
    fail("client index.html does not reference built assets");
  }
}

if (process.exitCode) {
  process.exit();
}

console.log(
  JSON.stringify(
    {
      ok: true,
      worker: {
        config: wranglerPath,
        entry: workerEntryPath,
        bytes: workerStats?.size ?? 0,
      },
      client: {
        index: clientIndexPath,
        bytes: clientIndexStats?.size ?? 0,
      },
    },
    null,
    2,
  ),
);
