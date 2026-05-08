import process from "node:process";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";

loadEnvFilesWithShellPrecedence({
  cwd: process.cwd(),
  filenames: [".env", ".env.production", ".env.local", ".env.production.local"],
});

const baseUrl =
  process.env.MAP_MEASURE_URL ??
  process.env.SMOKE_PUBLIC_URL ??
  process.env.NEXTAUTH_URL ??
  "http://127.0.0.1:3130";
const iterations = Number(process.env.MAP_MEASURE_ITERATIONS ?? 12);
const warmups = Number(process.env.MAP_MEASURE_WARMUPS ?? 2);
const timeoutMs = Number(process.env.MAP_MEASURE_TIMEOUT_MS ?? 10_000);

const scenarios = [
  {
    name: "seoul-viewport-z11",
    path:
      "/api/places/map?scope=viewport&zoom=11&minLat=37.42&maxLat=37.70&minLng=126.76&maxLng=127.18",
  },
  {
    name: "seoul-category-food-z13",
    path:
      "/api/places/map?scope=viewport&zoom=13&category=korean&minLat=37.50&maxLat=37.62&minLng=126.92&maxLng=127.08",
  },
  {
    name: "global-query-kimbap",
    path: "/api/places/map?scope=global&query=%EA%B9%80%EB%B0%A5",
  },
];

function percentile(values, ratio) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil(sorted.length * ratio) - 1,
  );

  return sorted[index];
}

async function measureScenario({ name, path }) {
  const durations = [];
  let lastPayload = null;

  for (let index = 0; index < warmups + iterations; index += 1) {
    const url = new URL(path, baseUrl);
    const started = performance.now();
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const elapsed = performance.now() - started;
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(`${name} returned ${response.status}`);
    }

    if (payload?.source !== "database" || payload?.mock === true) {
      throw new Error(
        `${name} expected database source but received source=${payload?.source} mock=${payload?.mock}`,
      );
    }

    if (index >= warmups) {
      durations.push(elapsed);
    }

    lastPayload = payload;
  }

  return {
    name,
    count: lastPayload?.count ?? null,
    returnedCount: lastPayload?.returnedCount ?? null,
    mapMarkerCount: lastPayload?.mapMarkerCount ?? null,
    markerMode: lastPayload?.markerMode ?? null,
    cache: lastPayload?.cacheStatus ?? null,
    minMs: Math.round(Math.min(...durations)),
    avgMs: Math.round(
      durations.reduce((sum, value) => sum + value, 0) / durations.length,
    ),
    p95Ms: Math.round(percentile(durations, 0.95)),
    maxMs: Math.round(Math.max(...durations)),
  };
}

async function main() {
  const normalizedBaseUrl = new URL(baseUrl).origin;
  const results = [];

  for (const scenario of scenarios) {
    results.push(await measureScenario(scenario));
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        baseUrl: normalizedBaseUrl,
        iterations,
        warmups,
        target: {
          p95MsAt1k: 300,
          p95MsAt10k: 500,
          p95MsAt100k: 800,
        },
        results,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  console.error(`Map API measurement failed: ${error.message}`);
  process.exitCode = 1;
});
