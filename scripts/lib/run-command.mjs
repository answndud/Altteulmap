import { spawnSync } from "node:child_process";

export function runCommand(command, { cwd = process.cwd(), env = process.env } = {}) {
  const result = spawnSync(command, {
    cwd,
    env,
    shell: true,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
}
