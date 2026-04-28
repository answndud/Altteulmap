import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const adminAppRoot = process.cwd();
const projectRoot = path.resolve(adminAppRoot, "..", "..");

function run(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: "inherit",
    ...options,
    env: {
      ...process.env,
      ...options.env,
    },
  });
}

if (process.env.ALTTEULMAP_OPENNEXT_ADMIN_BUILD === "1") {
  rmSync(path.join(adminAppRoot, ".next"), { recursive: true, force: true });
  run(
    "node",
    [
      path.join(projectRoot, "node_modules", "next", "dist", "bin", "next"),
      "build",
      "--webpack",
    ],
    { cwd: adminAppRoot },
  );
} else {
  run("npm", ["ci"], { cwd: projectRoot });
  run("npm", ["run", "cf:build:admin"], { cwd: projectRoot });
}
