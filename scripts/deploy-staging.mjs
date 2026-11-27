// staging Worker(altteulmap-staging)를 배포한다. 운영과 분리된 DB를 가리키는 별도 Hyperdrive 설정을 쓰며,
// 쓰기 지연을 운영과 같은 경로로 재기 위한 용도다. 빌드 산출물의 wrangler 설정에서 이름·Hyperdrive id·vars만 바꾼다.
//   npm run deploy:staging
//   STAGING_SOURCE_DIR=/path/to/other/checkout npm run deploy:staging   # 다른 커밋(예: 변경 전 코드)을 배포
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceDir = process.env.STAGING_SOURCE_DIR ?? root;
const PROD_HYPERDRIVE_ID = "665ef097dab04039a8e0ae03c6d07829";
const STAGING_NAME = "altteulmap-staging";
const STAGING_URL = `https://${STAGING_NAME}.altteul-lab.workers.dev`;
// Cloudflare가 공개한 Turnstile 테스트 키(항상 통과). 운영 키가 아니다.
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

function readEnvFile(path) {
  const values = {};

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

    if (match) values[match[1]] = match[2].trim();
  }

  return values;
}

const env = readEnvFile(join(root, ".env.vps"));
const hyperdriveId = env.STAGING_HYPERDRIVE_ID;

if (!hyperdriveId || hyperdriveId === PROD_HYPERDRIVE_ID) {
  throw new Error("STAGING_HYPERDRIVE_ID가 없거나 운영 Hyperdrive와 같다. 운영 DB로 배포하지 않는다.");
}

if (!env.STAGING_AUTH_SECRET) {
  throw new Error(".env.vps에 STAGING_AUTH_SECRET이 없다.");
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { cwd: sourceDir, encoding: "utf8", stdio: ["pipe", "inherit", "inherit"], ...options });
}

console.log(`빌드: ${sourceDir}`);
run("npm", ["run", "-s", "build"], { stdio: ["ignore", "ignore", "inherit"] });

const builtConfigPath = join(sourceDir, "dist/altteulmap/wrangler.json");
const config = JSON.parse(readFileSync(builtConfigPath, "utf8"));

config.name = STAGING_NAME;
config.topLevelName = STAGING_NAME;
config.keep_vars = false;
config.triggers = { crons: [] };
config.hyperdrive = [{ binding: "HYPERDRIVE", id: hyperdriveId }];
config.vars = {
  USE_MOCK_DATA: "false",
  SITE_URL: STAGING_URL,
  TURNSTILE_SITE_KEY: TURNSTILE_TEST_SITE_KEY,
};

const stagingConfigPath = join(sourceDir, "dist/altteulmap/wrangler.staging.json");

writeFileSync(stagingConfigPath, `${JSON.stringify(config, null, 2)}\n`);
run("npx", ["wrangler", "deploy", "--config", stagingConfigPath]);

// 비밀값은 설정 파일이 아니라 secret으로 넣는다(값은 출력하지 않는다).
for (const [name, value] of [
  ["AUTH_SECRET", env.STAGING_AUTH_SECRET],
  ["TURNSTILE_SECRET_KEY", TURNSTILE_TEST_SECRET_KEY],
]) {
  run("npx", ["wrangler", "secret", "put", name, "--name", STAGING_NAME], { input: value, stdio: ["pipe", "ignore", "inherit"] });
}

console.log(`staging 배포 완료: ${STAGING_URL}`);
