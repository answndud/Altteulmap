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

function resolveNextBin() {
  const relativeNextBin = path.join("node_modules", "next", "dist", "bin", "next");
  const rootNextBin = path.join(projectRoot, relativeNextBin);

  return existsSync(rootNextBin)
    ? rootNextBin
    : path.join(adminAppRoot, relativeNextBin);
}

function runNextBuild() {
  rmSync(path.join(adminAppRoot, ".next"), { recursive: true, force: true });

  run("node", [resolveNextBin(), "build", "--webpack"], { cwd: adminAppRoot });
}

function withRootNodeModules(callback) {
  const rootNodeModules = path.join(projectRoot, "node_modules");
  const localNodeModules = path.join(adminAppRoot, "node_modules");
  let createdRootNodeModulesSymlink = false;

  if (!existsSync(rootNodeModules) && existsSync(localNodeModules)) {
    symlinkSync(localNodeModules, rootNodeModules, "dir");
    createdRootNodeModulesSymlink = true;
  }

  try {
    callback();
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

if (process.env.ALTTEULMAP_OPENNEXT_ADMIN_BUILD === "1") {
  runNextBuild();
} else {
  withRootNodeModules(() => {
    run("node", [path.join(projectRoot, "scripts", "build-admin-worker.mjs")], {
      cwd: adminAppRoot,
    });
  });
}
