import { execFileSync } from "node:child_process";
import path from "node:path";
import { rmSync } from "node:fs";

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

execFileSync(openNextBin, ["build"], {
  cwd: adminAppRoot,
  env: {
    ...process.env,
    npm_config_workspaces: "false",
  },
  stdio: "inherit",
});
