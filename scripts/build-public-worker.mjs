import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import dotenv from "dotenv";

const projectRoot = process.cwd();
const backupRoot = mkdtempSync(path.join(tmpdir(), "altteulmap-public-build-"));
const adminTargets = [
  "src/app/admin",
  "src/app/api/admin",
];

for (const filename of [
  ".env",
  ".env.production",
  ".env.local",
  ".env.production.local",
]) {
  dotenv.config({
    path: path.join(projectRoot, filename),
    override: true,
  });
}

function backupAndRemove(relativePath) {
  const sourcePath = path.join(projectRoot, relativePath);

  if (!existsSync(sourcePath)) {
    return;
  }

  const backupPath = path.join(backupRoot, relativePath);
  mkdirSync(path.dirname(backupPath), { recursive: true });
  cpSync(sourcePath, backupPath, { recursive: true });
  rmSync(sourcePath, { recursive: true, force: true });
}

function restore(relativePath) {
  const sourcePath = path.join(projectRoot, relativePath);
  const backupPath = path.join(backupRoot, relativePath);

  rmSync(sourcePath, { recursive: true, force: true });

  if (!existsSync(backupPath)) {
    return;
  }

  mkdirSync(path.dirname(sourcePath), { recursive: true });
  cpSync(backupPath, sourcePath, { recursive: true });
}

if (!process.env.ADMIN_APP_URL) {
  throw new Error(
    "[build-public-worker] ADMIN_APP_URL is required when building the public-only worker.",
  );
}

try {
  for (const relativePath of adminTargets) {
    backupAndRemove(relativePath);
  }

  execFileSync(
    "npx",
    ["opennextjs-cloudflare", "build"],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
      },
      stdio: "inherit",
    },
  );
} finally {
  for (const relativePath of adminTargets) {
    restore(relativePath);
  }

  rmSync(backupRoot, { recursive: true, force: true });
}
