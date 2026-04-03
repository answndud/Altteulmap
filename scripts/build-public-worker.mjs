import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { loadEnvFilesWithShellPrecedence } from "./lib/load-env-files.mjs";

const projectRoot = process.cwd();
const backupRoot = mkdtempSync(path.join(tmpdir(), "altteulmap-public-build-"));
const adminEntrypointsPath = "src/features/admin/entrypoints";
const syncScriptPath = path.join(projectRoot, "scripts", "sync-admin-entrypoints.mjs");
const openNextBin = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  "opennextjs-cloudflare",
);

loadEnvFilesWithShellPrecedence({
  cwd: projectRoot,
  filenames: [
  ".env",
  ".env.production",
  ".env.local",
  ".env.production.local",
  ],
});

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
  backupAndRemove(adminEntrypointsPath);

  execFileSync("node", [syncScriptPath], {
    cwd: projectRoot,
    env: {
      ...process.env,
      ALTTEULMAP_ADMIN_MODE: "external",
    },
    stdio: "inherit",
  });

  execFileSync(openNextBin, ["build"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      ALTTEULMAP_ADMIN_MODE: "external",
    },
    stdio: "inherit",
  });
} finally {
  restore(adminEntrypointsPath);

  rmSync(backupRoot, { recursive: true, force: true });
}
