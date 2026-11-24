// 새 서버 복구 리허설: 빈 Postgres 컨테이너에 최신 VPS 덤프를 복원하고, 앱 role을 다시 만든 뒤,
// 그 DB에 붙인 Worker(vite dev)로 읽기 요청을 확인하며 단계별 시간(RTO)을 잰다.
// 운영 DB·Hyperdrive 구성은 건드리지 않는다. 임시 비밀번호만 쓰고 끝나면 컨테이너를 지운다.
//   npm run db:rehearse:restore
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const container = "altteulmap-restore-rehearsal";
const port = 15433;
const appPort = 5199;
const adminPassword = `rehearsal-${Math.random().toString(36).slice(2)}`;
const appPassword = `rehearsal-${Math.random().toString(36).slice(2)}`;

function readEnvNames() {
  const text = readFileSync(join(root, ".env.vps"), "utf8");
  const get = (key) => text.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim();
  return { user: get("POSTGRES_USER"), db: get("POSTGRES_DB") };
}

const { user, db } = readEnvNames();
const steps = [];
let appProcess;
const tmp = mkdtempSync(join(tmpdir(), "altteulmap-rehearsal-"));

function sh(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...options });
}

async function step(name, fn) {
  const started = Date.now();
  process.stdout.write(`- ${name} ... `);
  const result = await fn();
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  steps.push({ name, seconds: Number(seconds) });
  console.log(`${seconds}s`);
  return result;
}

function cleanup() {
  appProcess?.kill("SIGTERM");
  try {
    sh("docker", ["rm", "-f", "-v", container]);
  } catch {
    // 이미 없으면 무시한다.
  }
  rmSync(tmp, { recursive: true, force: true });
}

const dumpDir = join(root, "backups/vps");
const dump = readdirSync(dumpDir)
  .filter((name) => name.endsWith(".dump"))
  .sort()
  .at(-1);
if (!dump) throw new Error("backups/vps에 덤프가 없다. 먼저 npm run backup:pull을 실행한다.");
const dumpPath = join(dumpDir, dump);

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return response;
    } catch {
      // 아직 기동 중이다.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`timeout waiting for ${url}`);
}

try {
  console.log(`복구 리허설: ${dump}`);
  const total = Date.now();
  try {
    sh("docker", ["rm", "-f", "-v", container]);
  } catch {
    // 없으면 무시한다.
  }

  await step("빈 Postgres 17 컨테이너 기동(새 서버)", async () => {
    sh("docker", [
      "run", "-d", "--name", container,
      "-e", `POSTGRES_USER=${user}`, "-e", `POSTGRES_PASSWORD=${adminPassword}`, "-e", `POSTGRES_DB=${db}`,
      "-p", `127.0.0.1:${port}:5432`, "postgres:17-alpine",
    ]);
    for (let i = 0; i < 60; i += 1) {
      try {
        sh("docker", ["exec", container, "pg_isready", "-U", user, "-d", db]);
        // 초기화 직후 재시작 구간을 지나 실제로 쿼리가 되는지 확인한다.
        sh("docker", ["exec", container, "psql", "-U", user, "-d", db, "-tAc", "select 1"]);
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    throw new Error("postgres did not become ready");
  });

  // 덤프에는 `GRANT ... TO altteulmap_app`이 들어 있어, role이 없는 새 서버에서는 복원이 중간에 실패한다.
  // 그래서 role을 먼저 만들고 복원한 뒤 grant-app-role.sh로 권한과 비밀번호를 맞춘다.
  await step("앱 role 선생성(복원 전)", async () => {
    sh("docker", [
      "exec", container, "psql", "-U", user, "-d", db, "-v", "ON_ERROR_STOP=1", "-c",
      `create role altteulmap_app login password '${appPassword}'`,
    ]);
  });

  await step("pg_restore (덤프 복원)", async () => {
    sh("docker", ["exec", "-i", container, "pg_restore", "-U", user, "-d", db, "--no-owner", "--exit-on-error"], {
      input: readFileSync(dumpPath),
      maxBuffer: 1 << 28,
    });
  });

  await step("앱 권한·비밀번호 정렬(grant-app-role.sh)", async () => {
    const envFile = join(tmp, "rehearsal.env");
    writeFileSync(
      envFile,
      `POSTGRES_USER=${user}\nPOSTGRES_DB=${db}\nPOSTGRES_PASSWORD=${adminPassword}\nAPP_DB_PASSWORD=${appPassword}\n`,
      { mode: 0o600 },
    );
    sh("bash", [join(root, "deploy/vps/grant-app-role.sh")], {
      env: { ...process.env, ENV_FILE: envFile, DOCKER_CONTAINER: container },
    });
  });

  const counts = await step("행 수 확인", async () => {
    const out = sh("docker", [
      "exec", container, "psql", "-U", user, "-d", db, "-tA", "-F", ",", "-c",
      "select (select count(*) from places), (select count(*) from price_items), (select count(*) from price_reports), (select count(*) from users), (select count(*) from categories), (select count(*) from drizzle.__drizzle_migrations)",
    ]).trim();
    const [places, priceItems, priceReports, users, categories, migrations] = out.split(",").map(Number);
    return { places, priceItems, priceReports, users, categories, migrations };
  });
  if (!(counts.places > 0 && counts.priceReports > 0 && counts.migrations > 0)) {
    throw new Error(`복원 결과가 비정상이다: ${JSON.stringify(counts)}`);
  }

  await step("앱 role로 Worker 기동·읽기 확인", async () => {
    const appUrl = `postgresql://altteulmap_app:${appPassword}@127.0.0.1:${port}/${db}`;
    appProcess = spawn("npx", ["vite", "--port", String(appPort), "--strictPort", "--host", "127.0.0.1"], {
      cwd: root,
      env: {
        ...process.env,
        CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: appUrl,
        DATABASE_URL: appUrl,
        USE_MOCK_DATA: "false",
        SITE_URL: `http://127.0.0.1:${appPort}`,
      },
      stdio: "ignore",
    });
    const base = `http://127.0.0.1:${appPort}`;
    const health = await waitFor(`${base}/api/health?deep=1`, 90_000);
    const healthBody = await health.json();
    const dbCheck = JSON.stringify(healthBody).includes('"database"') ? healthBody : null;
    if (!health.ok) throw new Error(`deep health ${health.status}: ${JSON.stringify(dbCheck).slice(0, 300)}`);

    const map = await fetch(`${base}/api/places/map?scope=global`);
    const mapBody = await map.json();
    if (!map.ok || mapBody.source !== "database" || !(mapBody.count > 0)) {
      throw new Error(`map 조회 실패: ${map.status} source=${mapBody.source} count=${mapBody.count}`);
    }
    const placeId = mapBody.items?.[0]?.id;
    if (!placeId) throw new Error("상세 확인용 장소 id를 찾지 못했다");
    const detail = await fetch(`${base}/api/places/${placeId}`);
    if (!detail.ok) throw new Error(`상세 조회 실패: ${detail.status}`);

    // 앱 role은 DDL이 불가해야 한다(최소 권한 확인).
    try {
      sh("docker", ["exec", container, "psql", "-U", "altteulmap_app", "-d", db, "-c", "create table rehearsal_probe(id int)"]);
      throw new Error("앱 role로 DDL이 성공했다(권한이 너무 넓다)");
    } catch (error) {
      if (String(error.message).includes("DDL이 성공")) throw error;
    }
  });

  const rto = ((Date.now() - total) / 1000).toFixed(1);
  console.log("\n복구 리허설 통과");
  console.log(`행 수: ${JSON.stringify(counts)}`);
  console.log(`합계(RTO, 이미지 pull 제외 로컬 기준): ${rto}s`);
  console.log(JSON.stringify({ dump, counts, steps, totalSeconds: Number(rto) }, null, 2));
} catch (error) {
  console.error(`\n복구 리허설 실패: ${error.message}`);
  process.exitCode = 1;
} finally {
  cleanup();
  console.log(`정리 완료: 컨테이너 ${container} 삭제`);
}
