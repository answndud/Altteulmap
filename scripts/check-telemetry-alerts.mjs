import { readFile } from "node:fs/promises";
import process from "node:process";

const DEFAULTS = {
  maxP95DurationMs: 1_000,
  maxFiveHundredResponses: 5,
  maxRateLimitedResponses: 50,
  maxOAuthFailures: 5,
};

function usage() {
  process.stderr.write(
    "Usage: node scripts/check-telemetry-alerts.mjs <jsonl-log> [--max-p95-ms=1000]\n",
  );
}

function parseOptions(args) {
  const [logPath, ...flags] = args;

  if (!logPath || logPath.startsWith("--")) {
    usage();
    throw new Error("a JSONL log path is required");
  }

  const options = { ...DEFAULTS };

  for (const flag of flags) {
    const match = flag.match(/^--([a-z-]+)=(\d+)$/u);

    if (!match) {
      throw new Error(`invalid option: ${flag}`);
    }

    const optionName = {
      "max-p95-ms": "maxP95DurationMs",
      "max-5xx": "maxFiveHundredResponses",
      "max-429": "maxRateLimitedResponses",
      "max-oauth-failures": "maxOAuthFailures",
    }[match[1]];

    if (!optionName) {
      throw new Error(`unknown option: ${flag}`);
    }

    options[optionName] = Number(match[2]);
  }

  return { logPath, options };
}

function percentile(values, percentileRank) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((percentileRank / 100) * sorted.length) - 1,
  );

  return sorted[index] ?? 0;
}

function readEvents(contents) {
  return contents
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const event = JSON.parse(line);
        return event && typeof event === "object" ? [event] : [];
      } catch {
        return [];
      }
    });
}

function evaluate(events, options) {
  const completed = events.filter((event) => event.event === "worker_request_complete");
  const durations = completed
    .map((event) => Number(event.durationMs))
    .filter((duration) => Number.isFinite(duration) && duration >= 0);
  const fiveHundreds = completed.filter((event) => Number(event.status) >= 500).length;
  const rateLimited = completed.filter((event) => Number(event.status) === 429).length;
  const oauthFailures = completed.filter(
    (event) => String(event.path ?? "").includes("/api/auth/callback/") && Number(event.status) >= 400,
  ).length;
  const alerts = [];
  const p95DurationMs = percentile(durations, 95);

  if (p95DurationMs > options.maxP95DurationMs) {
    alerts.push(`p95 duration ${p95DurationMs}ms > ${options.maxP95DurationMs}ms`);
  }

  if (fiveHundreds > options.maxFiveHundredResponses) {
    alerts.push(`5xx responses ${fiveHundreds} > ${options.maxFiveHundredResponses}`);
  }

  if (rateLimited > options.maxRateLimitedResponses) {
    alerts.push(`429 responses ${rateLimited} > ${options.maxRateLimitedResponses}`);
  }

  if (oauthFailures > options.maxOAuthFailures) {
    alerts.push(`OAuth callback failures ${oauthFailures} > ${options.maxOAuthFailures}`);
  }

  return {
    result: alerts.length === 0 ? "ok" : "alert",
    events: events.length,
    completedRequests: completed.length,
    p95DurationMs,
    fiveHundreds,
    rateLimited,
    oauthFailures,
    alerts,
  };
}

async function main() {
  const { logPath, options } = parseOptions(process.argv.slice(2));
  const report = evaluate(readEvents(await readFile(logPath, "utf8")), options);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (report.result === "alert") {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
