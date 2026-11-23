/**
 * 운영 DB의 credentials 계정 비밀번호를 설정하거나(로그인 비활성화 포함) 바꾼다.
 * seed가 만든 데모·관리자 계정의 알려진 비밀번호를 운영에서 제거하는 데 쓴다.
 *
 *   TARGET_EMAIL=admin@altteulmap.local NEW_PASSWORD='...' DATABASE_URL=... npx tsx scripts/set-credentials-password.ts
 *   TARGET_EMAIL=demo@altteulmap.local DISABLE_LOGIN=1 DATABASE_URL=... npx tsx scripts/set-credentials-password.ts
 *
 * 비밀번호는 환경변수로만 받고 출력하지 않는다.
 */
import postgres from "postgres";

import { hashPassword } from "../src/features/auth/password";

const databaseUrl = process.env.DATABASE_URL;
const email = process.env.TARGET_EMAIL?.trim().toLowerCase();
const newPassword = process.env.NEW_PASSWORD;
const disableLogin = process.env.DISABLE_LOGIN === "1";

if (!databaseUrl || !email) {
  throw new Error("DATABASE_URL and TARGET_EMAIL are required.");
}

if (!disableLogin && (!newPassword || newPassword.length < 12)) {
  throw new Error("NEW_PASSWORD (12+ chars) is required unless DISABLE_LOGIN=1.");
}

async function main() {
  const targetEmail = email as string;
  const sql = postgres(databaseUrl as string, { max: 1, prepare: false, connect_timeout: 10 });

  try {
    const passwordHash = disableLogin ? null : await hashPassword(newPassword as string);
    const updated = await sql`
      update auth_accounts
      set password_hash = ${passwordHash}, updated_at = now()
      where provider = 'credentials' and provider_account_id = ${targetEmail}
      returning id`;

    if (updated.length !== 1) {
      throw new Error(`Expected exactly one credentials account for ${targetEmail}, updated ${updated.length}.`);
    }

    process.stdout.write(
      `${disableLogin ? "disabled password login for" : "updated password for"} ${targetEmail}\n`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
