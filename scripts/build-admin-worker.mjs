import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { existsSync, renameSync, rmSync } from "node:fs";

import { patchNextCloudflareRuntime } from "./patch-next-cloudflare-runtime.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const adminAppRoot = path.join(projectRoot, "apps", "admin");
const adminOpenNextBin = path.join(
  adminAppRoot,
  "node_modules",
  ".bin",
  "opennextjs-cloudflare",
);
const rootOpenNextBin = path.join(projectRoot, "node_modules", ".bin", "opennextjs-cloudflare");
const dependencyRoot = existsSync(rootOpenNextBin) ? projectRoot : adminAppRoot;
const openNextBin = dependencyRoot === adminAppRoot ? adminOpenNextBin : rootOpenNextBin;

for (const relativePath of [".next", ".next-dev", ".open-next"]) {
  rmSync(path.join(adminAppRoot, relativePath), {
    recursive: true,
    force: true,
  });
}

patchNextCloudflareRuntime({ projectRoot: dependencyRoot });

const adminAppUrl = process.env.ADMIN_APP_URL?.trim();
const adminPackageLockPath = path.join(adminAppRoot, "package-lock.json");
const adminPackageLockBackupPath = path.join(
  adminAppRoot,
  ".package-lock.json.opennext-backup",
);

if (existsSync(adminPackageLockBackupPath)) {
  rmSync(adminPackageLockBackupPath, { force: true });
}

try {
  if (dependencyRoot === projectRoot && existsSync(adminPackageLockPath)) {
    renameSync(adminPackageLockPath, adminPackageLockBackupPath);
  }

  execFileSync(openNextBin, ["build"], {
    cwd: adminAppRoot,
    env: {
      ...process.env,
      ALTTEULMAP_OPENNEXT_ADMIN_BUILD: "1",
      npm_config_workspaces: "false",
      NEXTAUTH_URL: adminAppUrl || process.env.NEXTAUTH_URL,
    },
    stdio: "inherit",
  });
} finally {
  if (existsSync(adminPackageLockBackupPath)) {
    renameSync(adminPackageLockBackupPath, adminPackageLockPath);
  }
}
