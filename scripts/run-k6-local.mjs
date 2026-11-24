// 빌드한 Worker를 로컬 Postgres에 붙여 띄우고 k6 혼합 부하를 돌린다. 끝나면 쓰기 시나리오가 남긴 제보를 지운다.
//   npm run perf:k6:local            # 정점 80 req/s
//   PEAK_RPS=150 npm run perf:k6:local
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";

const cwd = process.cwd();
const port = Number(process.env.K6_LOCAL_PORT ?? 8799);
const baseUrl = `http://127.0.0.1:${port}`;
const databaseUrl =
  process.env.K6_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/altteulmap";
const devVarsPath = join(cwd, "dist/altteulmap/.dev.vars");
const wranglerConfig = join(cwd, "dist/altteulmap/wrangler.json");
const bypassToken = "k6-local-bypass";

if (!["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("로컬 부하 측정은 로컬 DB에만 쓴다(쓰기 시나리오가 데이터를 만든다).");
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { cwd, encoding: "utf8", stdio: "inherit", ...options });
}

async function waitForHealth() {
  const deadline = Date.now() + 40_000;

  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${baseUrl}/api/health`)).ok) return;
    } catch {
      // 아직 기동 중이다.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error("Worker did not start in time.");
}

function cleanup() {
  try {
    execFileSync(
      "docker",
      [
        "exec", "altteulmap-postgres-1", "psql", "-U", "postgres", "-d", "altteulmap", "-c",
        "delete from price_reports where label like 'k6 부하%'",
      ],
      { stdio: "ignore" },
    );
    execFileSync("node", ["scripts/reset-rate-limits.mjs"], { cwd, stdio: "ignore" });
  } catch {
    console.warn("정리에 실패했다. 필요하면 label like 'k6 부하%' 제보를 직접 지운다.");
  }
}

console.log("빌드 중...");
run("npm", ["run", "-s", "cf:build:vite"], { stdio: "ignore" });
mkdirSync(dirname(devVarsPath), { recursive: true });
writeFileSync(
  devVarsPath,
  [
    `DATABASE_URL=${JSON.stringify(databaseUrl)}`,
    'USE_MOCK_DATA="false"',
    'AUTH_SECRET="k6-local-secret"',
    `SITE_URL=${JSON.stringify(baseUrl)}`,
    `TURNSTILE_BYPASS_TOKEN=${JSON.stringify(bypassToken)}`,
  ].join("\n") + "\n",
);

const worker = spawn("npx", ["wrangler", "dev", "--config", wranglerConfig, "--local", "--port", String(port)], {
  cwd,
  stdio: "ignore",
});

let exitCode = 0;

try {
  await waitForHealth();
  console.log(`Worker 준비됨(${baseUrl}), k6 시작`);
  run("k6", ["run", "perf/k6/local-mixed.js"], {
    env: {
      ...process.env,
      BASE_URL: baseUrl,
      PEAK_RPS: process.env.PEAK_RPS ?? "80",
      TURNSTILE_BYPASS_TOKEN: bypassToken,
    },
  });
} catch (error) {
  exitCode = 1;
  console.error(String(error.message ?? error));
} finally {
  worker.kill("SIGTERM");
  cleanup();
  process.exitCode = exitCode;
}
