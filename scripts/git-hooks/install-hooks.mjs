import { chmodSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const repoRoot = process.cwd();
const hookFiles = [
  path.join(repoRoot, ".githooks", "pre-commit"),
  path.join(repoRoot, ".githooks", "commit-msg"),
];

for (const hookFile of hookFiles) {
  if (!existsSync(hookFile)) {
    console.error(`[hooks:install] Missing hook file: ${hookFile}`);
    process.exit(1);
  }
}

for (const hookFile of hookFiles) {
  chmodSync(hookFile, 0o755);
}

execFileSync("git", ["config", "--local", "core.hooksPath", ".githooks"], {
  cwd: repoRoot,
  stdio: "inherit",
});

console.log("[hooks:install] Repo-local git hooks are now active.");
console.log("[hooks:install] Active path: .githooks");
