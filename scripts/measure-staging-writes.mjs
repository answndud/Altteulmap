// staging Worker에 가격 제보·로그인 지연을 라운드로 나눠 측정하고 p50/p95를 모은다.
// 라운드 사이에 staging DB의 rate limit 버킷을 SSH로 비운다(운영 경로에서는 IP를 위조할 수 없어 한도가 그대로 걸린다).
// 운영 DB·운영 Worker에는 아무것도 보내지 않는다.
//   npm run measure:staging              # LABEL=현재코드 ROUNDS=6 ITERS=8
//   LABEL=before ROUNDS=6 npm run measure:staging
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const rounds = Number(process.env.ROUNDS ?? 6);
const iterations = Number(process.env.ITERS ?? 8);
const label = process.env.LABEL ?? "current";
const baseUrl = "https://altteulmap-staging.altteul-lab.workers.dev";

function readEnvFile(path) {
  const values = {};

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

    if (match) values[match[1]] = match[2].trim();
  }

  return values;
}

const env = readEnvFile(join(root, ".env.vps"));
const key = (env.VPS_SSH_KEY_PATH ?? "").replace(/^~/, process.env.HOME ?? "");

function resetStagingBuckets() {
  execFileSync(
    "ssh",
    [
      "-i", key, "-p", env.VPS_SSH_PORT ?? "22", "-o", "BatchMode=yes",
      `${env.VPS_SSH_USER}@${env.VPS_SSH_HOST}`,
      `docker exec -i altteulmap-prod-postgres-1 psql -U ${env.POSTGRES_USER} -d ${env.STAGING_DB_NAME} -c "delete from public_write_rate_limits"`,
    ],
    { stdio: "ignore" },
  );
}

const quantile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] : null;
};
const samples = { price_report_ms: [], login_ms: [] };
const counters = { price_report_429: 0, login_429: 0, price_report_other: 0, login_other: 0 };
const tmp = mkdtempSync(join(tmpdir(), "staging-writes-"));

try {
  for (let round = 1; round <= rounds; round += 1) {
    resetStagingBuckets();
    const out = join(tmp, `round-${round}.json`);

    process.stdout.write(`라운드 ${round}/${rounds} ... `);
    try {
      execFileSync("k6", ["run", "--quiet", "--out", `json=${out}`, "perf/k6/staging-write.js"], {
        cwd: root,
        stdio: ["ignore", "ignore", "inherit"],
        env: { ...process.env, BASE_URL: baseUrl, ITERS: String(iterations) },
      });
    } catch {
      console.log("k6가 실패로 끝났다(임계값 또는 오류). 수집된 값은 사용한다.");
    }

    for (const line of readFileSync(out, "utf8").split("\n")) {
      if (!line.startsWith("{")) continue;
      const point = JSON.parse(line);

      if (point.type !== "Point") continue;
      if (point.metric in samples) samples[point.metric].push(point.data.value);
      if (point.metric in counters) counters[point.metric] += point.data.value;
    }
    console.log(`제보 ${samples.price_report_ms.length}건, 로그인 ${samples.login_ms.length}건 누적`);
  }
} finally {
  resetStagingBuckets();
  rmSync(tmp, { recursive: true, force: true });
}

const summarize = (name, values) => ({
  name,
  n: values.length,
  p50: Math.round(quantile(values, 0.5)),
  p95: Math.round(quantile(values, 0.95)),
  min: Math.round(Math.min(...values)),
  max: Math.round(Math.max(...values)),
});

console.log(`\n[${label}] 측정 결과 (한국 → ${baseUrl})`);
console.table([summarize("가격 제보 POST(ms)", samples.price_report_ms), summarize("로그인 POST(ms)", samples.login_ms)]);
console.log(JSON.stringify({ label, counters }));
