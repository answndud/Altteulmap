import process from "node:process";

import postgres from "postgres";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";

loadEnvFilesWithShellPrecedence({
  cwd: process.cwd(),
  filenames: [".env", ".env.local"],
});

// 로컬 E2E를 짧은 시간에 반복 실행하면 같은 IP(127.0.0.1) 버킷이 한도를 넘는다.
// 로컬 DB에서만 rate limit 버킷을 비운다.
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/altteulmap";
const { hostname } = new URL(databaseUrl);

if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
  throw new Error(`Refusing to reset rate limits on non-local host ${hostname}.`);
}

const client = postgres(databaseUrl, { max: 1, prepare: false });

try {
  await client`delete from public_write_rate_limits`;
  process.stdout.write("[e2e] cleared local rate limit buckets\n");
} finally {
  await client.end({ timeout: 1 });
}
