import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
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
  const localNextBin = path.join(
    adminAppRoot,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );
  const rootNextBin = path.join(
    projectRoot,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );

  rmSync(path.join(adminAppRoot, ".next"), { recursive: true, force: true });
  run(
    "node",
    [
      existsSync(rootNextBin) ? rootNextBin : localNextBin,
      "build",
      "--webpack",
    ],
    { cwd: adminAppRoot },
  );
} else {
  const rootNodeModules = path.join(projectRoot, "node_modules");
  const localNodeModules = path.join(adminAppRoot, "node_modules");
  let createdRootNodeModulesSymlink = false;

  if (!existsSync(rootNodeModules) && existsSync(localNodeModules)) {
    symlinkSync(localNodeModules, rootNodeModules, "dir");
    createdRootNodeModulesSymlink = true;
  }

  try {
    run("node", [path.join(projectRoot, "scripts", "build-admin-worker.mjs")], {
      cwd: adminAppRoot,
    });
  } finally {
    if (
      createdRootNodeModulesSymlink &&
      existsSync(rootNodeModules) &&
      lstatSync(rootNodeModules).isSymbolicLink()
    ) {
      unlinkSync(rootNodeModules);
    }
  }
}
