import { execFileSync } from "node:child_process";
import path from "node:path";
import { rmSync } from "node:fs";

import { patchNextCloudflareRuntime } from "./patch-next-cloudflare-runtime.mjs";

const projectRoot = process.cwd();
const adminAppRoot = path.join(projectRoot, "apps", "admin");
const openNextBin = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  "opennextjs-cloudflare",
);

for (const relativePath of [".next", ".next-dev", ".open-next"]) {
  rmSync(path.join(adminAppRoot, relativePath), {
    recursive: true,
    force: true,
  });
}

patchNextCloudflareRuntime({ projectRoot });

const adminAppUrl = process.env.ADMIN_APP_URL?.trim();

execFileSync(openNextBin, ["build"], {
  cwd: adminAppRoot,
  env: {
    ...process.env,
    npm_config_workspaces: "false",
    NEXTAUTH_URL: adminAppUrl || process.env.NEXTAUTH_URL,
  },
  stdio: "inherit",
});
